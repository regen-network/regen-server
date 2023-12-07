import * as express from 'express';
import * as bodyParser from 'body-parser';
import { Readable } from 'stream';
import { UserRequest } from '../types';
import { PoolClient } from 'pg';
import { pgPool } from 'common/pool';
import {
  DeleteObjectCommand,
  DeleteObjectCommandInput,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { UploadedFile } from 'express-fileupload';
import { generateIRIFromRaw } from 'iri-gen/iri-gen';
const router = express.Router();

const bucketName = process.env.AWS_S3_BUCKET;
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
      const image = request.files?.image as UploadedFile;
      const key = request.body.filePath;

      const profilesRe = /profiles(?:-test)*\/([a-zA-Z0-9-]*)/;
      const profilesMatch = key.match(profilesRe);
      const projectsRe = /projects(?:-test)*\/([a-zA-Z0-9-]*)/;
      const projectsMatch = key.match(projectsRe);

      // block any unauthenticated requests are made to filePath that includes profiles
      // otherwise, check if the filePath belongs to the current user based on their account id
      // if not, block the request...
      // otherwise, allow the request to update the file to proceed
      if (
        (key.includes('profiles') || key.includes('projects')) &&
        request.isUnauthenticated()
      ) {
        return response.status(401).send({ error: 'unauthorized' });
      } else if (profilesMatch) {
        client = await pgPool.connect();

        const accountId = profilesMatch[1];
        if (currentAccountId !== accountId) {
          return response.status(401).send({ error: 'unauthorized' });
        }
      } else if (projectsMatch) {
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

      const fileStream = Readable.from([image.data]);
      fileStream.on('error', function (err) {
        console.log('File Error: ', err);
      });

      const cmd = new PutObjectCommand({
        Bucket: bucketName,
        Body: image.data,
        Key: `${key}/${image.name}`,
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
          key,
          fileName: image.name,
        });

        // Track file storage for projects
        if (projectId && client) {
          const extension = image.name.split('.').pop();
          const iri = await generateIRIFromRaw(image.data, extension);
          await client.query(
            `insert into upload (iri, url, size, mimetype, account_id, project_id) values ($1, $2, $3, $4, $5, $6)`,
            [iri, url, image.size, image.mimetype, currentAccountId, projectId],
          );
        }

        response.send({
          imageUrl: url,
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
          key: `${PROJECTS_PATH}/${projectId}`,
          fileName,
        });
        console.log('server url', url);
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
  key: string;
  fileName: string;
};

function getFileUrl({ bucketName, key, fileName }: GetFileUrlParams) {
  return `https://${bucketName}.s3.amazonaws.com/${key}/${fileName}`;
}

export default router;
