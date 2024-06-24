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
import { UnauthorizedError } from '../errors';
import { ensureLoggedIn } from '../middleware/passport';
const router = express.Router();

export const bucketName = process.env.AWS_S3_BUCKET;
const region = process.env.AWS_BUCKET_REGION;
export const PROJECTS_PATH = process.env.S3_PROJECTS_PATH || 'projects';
export const PROFILES_PATH = process.env.S3_PROFILES_PATH || 'profiles';

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
      const projectsPostsRe =
        /projects(?:-test)*\/([a-zA-Z0-9-]*)\/posts(?:\/([a-zA-Z0-9-]*))?/;
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
        let iri: string | undefined;
        if (projectId && client) {
          const extension = file.name.split('.').pop();
          if (extension) {
            iri = await generateIRIFromRaw(file.data, extension);
            await client.query(
              `insert into upload (iri, url, size, mimetype, account_id, project_id) values ($1, $2, $3, $4, $5, $6)`,
              [iri, url, file.size, file.mimetype, currentAccountId, projectId],
            );
          }
        }

        // Get location from file metadata for projects posts
        let location;
        if (projectsPostsMatch) {
          location = await getExifLocationData(file.data);
        }

        response.send({
          url,
          location,
          iri,
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
  '/files/:path/:projectOrAccountId',
  ensureLoggedIn(),
  bodyParser.json(),
  async (request: UserRequest, response: express.Response, next) => {
    let client: undefined | PoolClient;

    try {
      const path = request.params.path;
      const projectOrAccountId = request.params.projectOrAccountId;
      const fileName = request.query.fileName;

      client = await pgPool.connect();
      await deleteFile({
        client,
        currentAccountId: request.user?.accountId,
        fileName: fileName as string,
        projectId: path === PROJECTS_PATH ? projectOrAccountId : undefined,
        accountId: path === PROFILES_PATH ? projectOrAccountId : undefined,
        bucketName,
      });
      response.send('File successfully deleted');
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

export function getFileUrl({ bucketName, path, fileName }: GetFileUrlParams) {
  return `https://${bucketName}.s3.amazonaws.com/${path}/${fileName}`;
}

type GetObjectSignedUrlParams = {
  bucketName?: string;
  fileUrl: string;
};

/**
 * getObjectSignedUrl returns an AWS S3 signed URL for a given file URL in the S3 bucket.
 * A signed URL uses security credentials to grant time-limited permission to access and download files.
 * https://docs.aws.amazon.com/AmazonS3/latest/userguide/ShareObjectPreSignedURL.html
 * This is needed in order to download private files.
 * @param getObjectSignedUrl Params for getObjectSignedUrl function
 * @param getObjectSignedUrl.bucketName The S3 bucket name
 * @param getObjectSignedUrl.fileUrl The file URL within the S3 bucket
 * @returns Promise<string | undefined>
 */
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
  return new Promise(function (resolve) {
    try {
      new ExifImage({ image: path }, function (error, exifData) {
        if (error) {
          console.error(error);
          resolve(undefined);
        } else resolve(exifData?.gps);
      });
    } catch (error) {
      console.error(error);
      resolve(undefined);
    }
  });
}

type DeleteFileParams = {
  bucketName?: string;
  client: PoolClient;
  currentAccountId?: string;
  accountId?: string;
  projectId?: string;
  fileName: string;
};

export async function deleteFile({
  bucketName,
  client,
  currentAccountId,
  fileName,
  projectId,
  accountId,
}: DeleteFileParams) {
  if (projectId) {
    // Only the project admin is allowed to delete a project file
    const queryRes = await client.query(
      'SELECT project.id FROM project JOIN account ON account.id = project.admin_account_id WHERE account.id = $1 AND project.id = $2',
      [currentAccountId, projectId],
    );
    if (queryRes.rowCount !== 1) {
      throw new UnauthorizedError('unauthorized');
    }
  } else if (accountId) {
    // Only the profile owner can delete a profile file
    if (currentAccountId !== accountId) {
      throw new UnauthorizedError('unauthorized');
    }
  } else {
    throw new UnauthorizedError('unauthorized');
  }

  const path = `${projectId ? PROJECTS_PATH : PROFILES_PATH}/${
    projectId ?? accountId
  }`;
  const key = `${path}/${fileName}`;
  await client.query('insert into s3_deletion (bucket, key) values ($1, $2)', [
    bucketName,
    key,
  ]);
}

export default router;
