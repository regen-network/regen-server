import fetch from 'node-fetch';
import {
  createNewUserAndLogin,
  createProjectAndPost,
  createProject,
  getMarketplaceURL,
  dummyFilesSetup,
  dummyFilesTeardown,
  longerTestTimeout,
  createCreditBatch,
  deleteCreditBatch,
} from '../utils';
import { withRootDb } from '../db/helpers';
import { bucketName, getFileUrl } from '../../routes/files';

const commit = true;

describe('/projects DELETE endpoint', () => {
  it(
    'deletes a project, its associated posts, uploads, documents, project_partners, and adds files to s3_deletion table when a project admin attempts to delete an off-chain project',
    async () => {
      const timestamp = new Date();

      const { authHeaders } = await createNewUserAndLogin();
      const { projectId, accountId, key, fname } = await createProjectAndPost({
        initAuthHeaders: authHeaders,
      });

      // create project partner
      await withRootDb(async client => {
        const projectPartnerQuery = await client.query(
          'INSERT INTO project_partner (project_id, account_id) VALUES ($1, $2)',
          [projectId, accountId],
        );
        expect(projectPartnerQuery.rowCount).toEqual(1);
      }, true);

      // create document for the project
      await withRootDb(async client => {
        const documentQuery = await client.query(
          'INSERT INTO document (name, type, date, url, project_id) VALUES ($1, $2, $3, $4, $5) RETURNING id',
          [
            'My Test Document',
            'Test Plan Document',
            new Date(),
            getFileUrl({
              bucketName,
              path: 'projects-test',
              fileName: 'test-document.txt',
            }),
            projectId,
          ],
        );
        expect(documentQuery.rowCount).toEqual(1);
      }, commit);

      // create upload
      try {
        const { resp: filesResp } = await dummyFilesSetup(
          key,
          fname,
          projectId,
          authHeaders,
        );
        const json = await filesResp.json();

        expect(filesResp.status).toBe(200);

        // verify that the upload was created
        await withRootDb(async client => {
          const uploadQuery = await client.query(
            'SELECT * FROM upload WHERE url = $1',
            [json.url],
          );
          expect(uploadQuery.rowCount).toEqual(1);
          expect(uploadQuery.rows[0].account_id).toEqual(accountId);
          expect(uploadQuery.rows[0].project_id).toEqual(projectId);
        });
      } finally {
        // Delete files from S3
        await dummyFilesTeardown(key, fname);
      }

      const resp = await fetch(`${getMarketplaceURL()}/projects`, {
        method: 'DELETE',
        headers: authHeaders,
        body: JSON.stringify({
          id: projectId,
        }),
      });
      expect(resp.status).toBe(200);

      await withRootDb(async client => {
        const projectQuery = await client.query(
          'SELECT * FROM project WHERE id = $1',
          [projectId],
        );
        expect(projectQuery.rowCount).toEqual(0);

        const postQuery = await client.query(
          'SELECT * FROM post WHERE project_id = $1',
          [projectId],
        );
        expect(postQuery.rowCount).toEqual(0);

        const uploadQuery = await client.query(
          'SELECT * FROM upload WHERE project_id = $1',
          [projectId],
        );
        expect(uploadQuery.rowCount).toEqual(0);

        const documentQuery = await client.query(
          'SELECT * FROM document WHERE project_id = $1',
          [projectId],
        );
        expect(documentQuery.rowCount).toEqual(0);

        const projectPartnerQuery = await client.query(
          'SELECT * FROM project_partner WHERE project_id = $1',
          [projectId],
        );
        expect(projectPartnerQuery.rowCount).toEqual(0);

        const s3DeletetionsQuery = await client.query(
          'SELECT * FROM s3_deletion WHERE created_at >= $1',
          [timestamp],
        );
        // 4 resources should be deleted from S3: 2 post files, 1 upload, 1 document
        expect(s3DeletetionsQuery.rowCount).toEqual(4);
      });
    },
    longerTestTimeout,
  );
  it('returns 404 Not Found for a non-existent project', async () => {
    const { authHeaders } = await createNewUserAndLogin();

    const resp = await fetch(`${getMarketplaceURL()}/projects`, {
      method: 'DELETE',
      headers: authHeaders,
      body: JSON.stringify({
        id: '00000000-0000-0000-0000-000000000000',
      }),
    });

    expect(resp.status).toBe(404);
  });
  it('returns 403 Forbidden when a project admin attempts to delete a project with credit batches', async () => {
    const { authHeaders } = await createNewUserAndLogin();
    const { projectId } = await createProject({
      initAuthHeaders: authHeaders,
    });

    const creditBatch = await createCreditBatch({ projectId, authHeaders });
    const resp = await fetch(`${getMarketplaceURL()}/projects`, {
      method: 'DELETE',
      headers: authHeaders,
      body: JSON.stringify({
        id: projectId,
      }),
    });

    expect(resp.status).toBe(403);

    // clean up credit batch
    deleteCreditBatch({ creditBatchId: creditBatch.id, authHeaders });
  });
  it('returns 403 Forbidden when an admin attempts to delete a on-chain project', async () => {
    const { authHeaders } = await createNewUserAndLogin();

    // Create project and post
    const { projectId } = await createProject({
      initAuthHeaders: authHeaders,
    });

    // set on_chain_id
    await withRootDb(async client => {
      await client.query('UPDATE project SET on_chain_id = $1 where id = $2', [
        'FOO-ONCHAIN-ID-2',
        projectId,
      ]);
    }, commit);

    const resp = await fetch(`${getMarketplaceURL()}/projects`, {
      method: 'DELETE',
      headers: authHeaders,
      body: JSON.stringify({
        id: projectId,
      }),
    });

    expect(resp.status).toBe(403);
    // Clean up
    await withRootDb(async client => {
      await client.query('UPDATE project SET on_chain_id = $1 where id = $2', [
        null,
        projectId,
      ]);
      await client.query('DELETE FROM project WHERE id = $1', [projectId]);
    }, commit);
  });
  it('returns 401 Unauthorized when a non project admin attempts to delete a off-chain project', async () => {
    const { authHeaders } = await createNewUserAndLogin();

    // Create project with another user
    const { projectId } = await createProject({});

    const resp = await fetch(`${getMarketplaceURL()}/projects`, {
      method: 'DELETE',
      headers: authHeaders,
      body: JSON.stringify({
        id: projectId,
      }),
    });

    expect(resp.status).toBe(401);
    await withRootDb(async client => {
      // Cleaning up
      await client.query('DELETE FROM project WHERE id = $1', [projectId]);
    }, commit);
  });
});
