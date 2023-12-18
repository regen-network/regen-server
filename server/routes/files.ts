import * as express from 'express';
import * as bodyParser from 'body-parser';
import Exif, { ExifImage } from 'exif';
import { Readable } from 'stream';
import { UserRequest } from '../types';
import { PoolClient } from 'pg';
import { pgPool } from 'common/pool';
import {
  DeleteObjectCommand,
  DeleteObjectCommandInput,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { UploadedFile } from 'express-fileupload';
import { generateIRIFromRaw } from 'iri-gen/iri-gen';
const router = express.Router();

export const bucketName = process.env.AWS_S3_BUCKET;
const region = process.env.AWS_BUCKET_REGION;
const PROJECTS_PATH = process.env.S3_PROJECTS_PATH || 'projects';

const s3 = new S3Client({
  region,
});

router.post(
  '/files',
  async (request: UserRequest, response: express.Response, next) => {
    let client: undefined | PoolClient = undefined,
      projectId: undefined | string;
    const currentAccountId = request.user?.accountId;
    try {
      const file = (request.files?.image ||
        request.files?.file) as UploadedFile;
      const path = request.body.filePath;

      const profilesRe = /profiles(?:-test)*\/([a-zA-Z0-9-]*)/;
      const profilesMatch = path.match(profilesRe);
      const projectsRe = /projects(?:-test)*\/([a-zA-Z0-9-]*)/;
      const projectsMatch = path.match(projectsRe);
      const projectsPostsRe = /projects(?:-test)*\/([a-zA-Z0-9-]*\/posts)/;
      const projectsPostsMatch = path.match(projectsPostsRe);

      // block any unauthenticated requests are made to filePath that includes profiles
      // otherwise, check if the filePath belongs to the current user based on their account id
      // if not, block the request...
      // otherwise, allow the request to update the file to proceed
      if (
        (path.includes('profiles') || path.includes('projects')) &&
        request.isUnauthenticated()
      ) {
        return response.status(401).send({ error: 'unauthorized' });
      } else if (profilesMatch) {
        client = await pgPool.connect();

        const accountId = profilesMatch[1];
        if (currentAccountId !== accountId) {
          return response.status(401).send({ error: 'unauthorized' });
        }
      } else if (projectsPostsMatch || projectsMatch) {
        projectId = projectsMatch[1];
        client = await pgPool.connect();
        // select the projects that the given account is an admin for
        // AND then, make sure the project in question belongs to the account
        const queryRes = await client.query(
          'SELECT project.id FROM project JOIN account ON account.id = project.admin_account_id WHERE account.id = $1 AND project.id = $2',
          [currentAccountId, projectId],
        );
        if (queryRes.rowCount !== 1) {
          return response.status(401).send({ error: 'unauthorized' });
        }
      }

      const fileStream = Readable.from([file.data]);
      fileStream.on('error', function (err) {
        console.log('File Error: ', err);
      });

      // Make all project posts files private on S3
      // so that we don't have to update the files ACL if the
      // user updates the post privacy settings.
      const cmd = new PutObjectCommand({
        Bucket: bucketName,
        Body: file.data,
        Key: `${path}/${file.name}`,
        ACL: projectsPostsMatch ? 'private' : 'public-read',
      });
      const cmdResp = await s3.send(cmd);
      console.dir({ cmdResp }, { depth: null });
      const status = cmdResp['$metadata'].httpStatusCode;

      if (status && (status < 200 || status >= 300)) {
        console.log({ cmdResp });
        throw new Error('Error uploading file to s3');
      } else {
        const url = getFileUrl({
          bucketName,
          path,
          fileName: file.name,
        });

        // Track file storage for projects
        if (projectId && client) {
          const extension = file.name.split('.').pop();
          const iri = await generateIRIFromRaw(file.data, extension);
          await client.query(
            `insert into upload (iri, url, size, mimetype, account_id, project_id) values ($1, $2, $3, $4, $5, $6)`,
            [iri, url, file.size, file.mimetype, currentAccountId, projectId],
          );
          // TODO Anchor files from project posts on chain (#422)
        }

        // Get location from file metadata for projects posts
        let location;
        if (projectsPostsMatch) {
          try {
            location = await getExifLocationData(file.data);
          } catch (_) {
            // just ignore error if no location metadata found
          }
        }

        response.send({
          imageUrl: url,
          location,
        });
      }
    } catch (err) {
      next(err);
    } finally {
      if (client) {
        client.release();
      }
    }
  },
);

router.delete(
  '/files/:projectId/:fileName',
  bodyParser.json(),
  async (request: UserRequest, response: express.Response, next) => {
    let client: undefined | PoolClient;
    try {
      const projectId = request.params.projectId;
      const fileName = request.params.fileName;

      client = await pgPool.connect();
      // Only the project admin is allowed to delete a project file
      const queryRes = await client.query(
        'SELECT project.id FROM project JOIN account ON account.id = project.admin_account_id WHERE account.id = $1 AND project.id = $2',
        [request.user?.accountId, projectId],
      );
      if (queryRes.rowCount !== 1) {
        return response.status(401).send({ error: 'unauthorized' });
      }

      const input: DeleteObjectCommandInput = {
        Bucket: bucketName,
        Key: `${PROJECTS_PATH}/${projectId}/${fileName}`,
      };
      const cmd = new DeleteObjectCommand(input);
      const cmdResp = await s3.send(cmd);
      const status = cmdResp['$metadata'].httpStatusCode;
      if (status && (status < 200 || status >= 300)) {
        console.log({ cmdResp });
        throw new Error('Unable to delete file');
      } else {
        const url = getFileUrl({
          bucketName,
          path: `${PROJECTS_PATH}/${projectId}`,
          fileName,
        });
        await client.query(`delete from upload where url = $1`, [url]);
        response.send('File successfully deleted');
      }
    } catch (err) {
      next(err);
    } finally {
      if (client) client.release();
    }
  },
);

type GetFileUrlParams = {
  bucketName?: string;
  path: string;
  fileName: string;
};

function getFileUrl({ bucketName, path, fileName }: GetFileUrlParams) {
  return `https://${bucketName}.s3.amazonaws.com/${path}/${fileName}`;
}

type GetObjectSignedUrlParams = {
  bucketName?: string;
  fileUrl: string;
};

export async function getObjectSignedUrl({
  bucketName,
  fileUrl,
}: GetObjectSignedUrlParams) {
  const key = fileUrl.split(`https://${bucketName}.s3.amazonaws.com/`).pop();
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  try {
    return await getSignedUrl(s3, command, { expiresIn: 3600 });
  } catch (err) {
    console.error(err);
  }
}

function getExifLocationData(path: string | Buffer): Promise<Exif.ExifData> {
  return new Promise(function (resolve, reject) {
    try {
      new ExifImage({ image: path }, function (error, exifData) {
        if (error) reject(error);
        else resolve(exifData?.gps);
      });
    } catch (error) {
      reject(error);
    }
  });
}

export default router;
