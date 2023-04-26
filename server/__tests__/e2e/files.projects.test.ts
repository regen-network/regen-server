import fetch from 'node-fetch';
import { createNewUserAndLogin } from '../utils';
import { FileHandle, open, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import FormData from 'form-data';
import { createReadStream } from 'node:fs';
import { S3Client, DeleteObjectsCommand } from '@aws-sdk/client-s3';

const bucketName = process.env.AWS_S3_BUCKET;
const region = process.env.AWS_BUCKET_REGION;
const s3 = new S3Client({ region });

describe('files endpoint, projects auth...', () => {
  it('allows a user to upload project media to a project they are an admin for...', async () => {
    const { authHeaders, userAddr } = await createNewUserAndLogin();

    const walletIdQuery = await fetch('http://localhost:5000/graphql', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        query: `{ walletByAddr(addr: "${userAddr}") { id } }`,
      }),
    });
    const walletIdResult = await walletIdQuery.json();
    const walletId = walletIdResult.data.walletByAddr.id;

    const createProjectQuery = await fetch('http://localhost:5000/graphql', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        query:
          'mutation CreateProject($input: CreateProjectInput!) { createProject(input: $input) { project { id } } }',
        variables: `{"input":{"project":{"adminWalletId":"${walletId}"}}}`,
      }),
    });
    const createProjectResult = await createProjectQuery.json();
    const projectId = createProjectResult.data.createProject.project.id;

    const key = `projects-test/${projectId}`;
    const fname = `test-${projectId}.txt`;

    let dir: undefined | string = undefined;
    let fd: undefined | FileHandle = undefined;
    try {
      const path = join(tmpdir(), 'projects-');
      dir = await mkdtemp(path);
      const fpath = join(dir, fname);
      fd = await open(fpath, 'w');
      await fd.write(`helloworld, for ${projectId}.`);
      await fd.sync();

      const form = new FormData();
      form.append('image', createReadStream(fpath));
      form.append('filePath', key);

      authHeaders.delete('content-type');
      const resp = await fetch('http://localhost:5000/files', {
        method: 'POST',
        headers: authHeaders,
        body: form,
      });
      expect(resp.status).toBe(200);
    } finally {
      if (fd) {
        await fd?.close();
      }
      if (dir) {
        await rm(dir, { recursive: true, force: true });
      }
      const cmd = new DeleteObjectsCommand({
        Bucket: bucketName,
        Delete: {
          Objects: [{ Key: `${key}/${fname}` }, { Key: `${key}` }],
        },
      });
      const response = await s3.send(cmd);
      if (response['$metadata'].httpStatusCode !== 200) {
        console.dir(
          {
            response,
            warning: 'objects possibly not removed rom s3 testing bucket',
          },
          { depth: null },
        );
      }
    }
  });
  it('disallows a user from uploading project media to a project they are not admin for...', async () => {
    const { authHeaders } = await createNewUserAndLogin();

    const { authHeaders: authHeaders1, userAddr: userAddr1 } =
      await createNewUserAndLogin();

    const walletIdQuery = await fetch('http://localhost:5000/graphql', {
      method: 'POST',
      headers: authHeaders1,
      body: JSON.stringify({
        query: `{ walletByAddr(addr: "${userAddr1}") { id } }`,
      }),
    });
    const walletIdResult = await walletIdQuery.json();
    const walletId1 = walletIdResult.data.walletByAddr.id;

    const createProjectQuery = await fetch('http://localhost:5000/graphql', {
      method: 'POST',
      headers: authHeaders1,
      body: JSON.stringify({
        query:
          'mutation CreateProject($input: CreateProjectInput!) { createProject(input: $input) { project { id } } }',
        variables: `{"input":{"project":{"adminWalletId": "${walletId1}"}}}`,
      }),
    });
    const createProjectResult = await createProjectQuery.json();
    const projectId = createProjectResult.data.createProject.project.id;

    const key = `projects-test/${projectId}`;
    const fname = `test-${projectId}.txt`;

    let dir: undefined | string = undefined;
    let fd: undefined | FileHandle = undefined;
    try {
      const path = join(tmpdir(), 'projects-');
      dir = await mkdtemp(path);
      const fpath = join(dir, fname);
      fd = await open(fpath, 'w');
      await fd.write(`helloworld, for ${projectId}.`);
      await fd.sync();

      const form = new FormData();
      form.append('image', createReadStream(fpath));
      form.append('filePath', key);

      authHeaders.delete('content-type');
      const resp = await fetch('http://localhost:5000/files', {
        method: 'POST',
        headers: authHeaders,
        body: form,
      });
      expect(resp.status).toBe(401);
    } finally {
      if (fd) {
        await fd?.close();
      }
      if (dir) {
        await rm(dir, { recursive: true, force: true });
      }
    }
  });
});
