import { Task } from 'graphile-worker';
import {
  DeleteObjectCommand,
  DeleteObjectCommandInput,
  S3Client,
} from '@aws-sdk/client-s3';

const region = process.env.AWS_BUCKET_REGION;

type DeleteS3FilePayload = {
  id: string;
  bucket: string;
  key: string;
};

function assertPayload(payload: any): asserts payload is DeleteS3FilePayload {
  if (typeof payload.id !== 'string') throw new Error('invalid');
  if (typeof payload.bucket !== 'string') throw new Error('invalid');
  if (typeof payload.key !== 'string') throw new Error('invalid');
}

const task: Task = async (payload, helpers) => {
  assertPayload(payload);
  const { id, bucket, key } = payload;
  const input: DeleteObjectCommandInput = {
    Bucket: bucket,
    Key: key,
  };
  const cmd = new DeleteObjectCommand(input);
  const s3 = new S3Client({
    region,
  });
  const cmdResp = await s3.send(cmd);
  const status = cmdResp['$metadata'].httpStatusCode;
  if (status && (status < 200 || status >= 300)) {
    throw new Error('Unable to delete file');
  }

  const { withPgClient } = helpers;
  const url = `https://${bucket}.s3.amazonaws.com/${key}`;
  await withPgClient(async pgClient => {
    await pgClient.query('delete from s3_deletion where id = $1', [id]);
    await pgClient.query('delete from upload where url = $1', [url]);
  });
};

export default task;
