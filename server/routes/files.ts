import * as express from 'express';
import * as bodyParser from 'body-parser';
import S3 from 'aws-sdk/clients/s3';
import { Readable } from 'stream';
import { UserRequest } from '../types';
import { PoolClient } from 'pg';
import { pgPool } from 'common/pool';
const router = express.Router();

const bucketName = process.env.AWS_S3_BUCKET;
const region = process.env.AWS_BUCKET_REGION;
const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

const s3 = new S3({
  region,
  accessKeyId,
  secretAccessKey,
});

interface FilesRequest extends express.Request {
  files: {
    image: {
      data: File;
      name: string;
    };
  };
}

router.post(
  '/files',
  bodyParser.json(),
  async (request: UserRequest, response: express.Response, next) => {
    let client: undefined | PoolClient = undefined;
    try {
      const image = (request as FilesRequest).files.image;
      const key = request.body.filePath;

      const profilesRe = /profiles(?:-test)*\/([a-zA-Z0-9-]*)/;
      const profilesMatch = key.match(profilesRe);
      const projectsRe = /projects(?:-test)*\/([a-zA-Z0-9-]*)/;
      const projectsMatch = key.match(projectsRe);

      // block any unauthenticated requests are made to filePath that includes profiles
      // otherwise, check if the filePath belongs to the current user based on their party id
      // if not, block the request...
      // otherwise, allow the request to update the file to proceed
      if (
        (key.includes('profiles') || key.includes('projects')) &&
        request.isUnauthenticated()
      ) {
        return response.status(401).send({ error: 'unauthorized' });
      } else if (profilesMatch) {
        client = await pgPool.connect();

        const accountQuery = await client.query(
          'SELECT id FROM private.get_account_by_addr($1)',
          [request.user?.address],
        );
        const [{ id: accountId }] = accountQuery.rows;

        const partiesQuery = await client.query(
          'SELECT id FROM private.get_parties_by_account_id($1)',
          [accountId],
        );
        const partyId = profilesMatch[1];
        const partyIds = partiesQuery.rows.map(x => {
          return x.id;
        });
        if (!partyIds.includes(partyId)) {
          return response.status(401).send({ error: 'unauthorized' });
        }
      } else if (projectsMatch) {
        const projectId = projectsMatch[1];
        client = await pgPool.connect();
        console.log(request.user?.address);
        console.log(projectId);
        const queryRes = await client.query(
          'SELECT project.id FROM project JOIN wallet ON wallet.id = project.admin_wallet_id WHERE wallet.addr = $1 AND project.id = $2',
          [request.user?.address, projectId],
        );
        if (queryRes.rowCount !== 1) {
          return response.status(401).send({ error: 'unauthorized' });
        }
      }

      const fileStream = Readable.from([image.data]);

      const uploadParams = {
        Bucket: `${bucketName}/${key}`,
        Key: `${image.name}`,
        Body: fileStream,
      };

      fileStream.on('error', function (err) {
        console.log('File Error: ', err);
      });

      s3.upload(
        uploadParams,
        function (err: Error, data: S3.ManagedUpload.SendData) {
          if (err) {
            console.log('s3 Error', err);
            response.status(500).send({ Error: err });
          }
          if (data) {
            response.send({ imageUrl: data.Location });
          }
        },
      );
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
  '/files/:projectId/:key',
  bodyParser.json(),
  (request, response: express.Response) => {
    const projectId = request.params.projectId;
    const key = request.params.key;

    const deleteParams = {
      Bucket: `${bucketName}/projects/${projectId}`,
      Key: key,
    };

    s3.deleteObject(deleteParams, function (err, data) {
      if (err) {
        console.log('s3 Error', err);
        response.status(500).send(err);
      }
      if (data) {
        response.send('File successfully deleted');
      }
    });
  },
);

export default router;
