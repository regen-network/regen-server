import fetch from 'node-fetch';
import {
  createNewUserAndLogin,
  createProjectAndPost,
  createProject,
  getMarketplaceURL,
  dummyFilesSetup,
  dummyFilesTeardown,
  longerTestTimeout,
} from '../utils';
import { withRootDb } from '../db/helpers';

const commit = true;

describe('/projects DELETE endpoint', () => {
  it(
    'deletes a project, its associated posts, uploads, documents and files when a project admin attempts to delete an off-chain project',
    async () => {
      const { authHeaders } = await createNewUserAndLogin();
      // const { authHeaders: authHeaders2 } = await createNewUserAndLogin();
      const { projectId, accountId, key, fname } = await createProjectAndPost({
        initAuthHeaders: authHeaders,
      });

      // TODO: create additional resources for project
      // - documents

      // create project partner
      await withRootDb(async client => {
        await client.query(
          'INSERT INTO project_partner (project_id, account_id) VALUES ($1, $2)',
          [projectId, accountId],
        );
      });

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

        await withRootDb(async client => {
          const uploadQuery = await client.query(
            'SELECT * FROM upload WHERE url = $1',
            [json.imageUrl],
          );

          expect(uploadQuery.rowCount).toEqual(1);
          expect(uploadQuery.rows[0].account_id).toEqual(accountId);
          expect(uploadQuery.rows[0].project_id).toEqual(projectId);
        });

        const resp = await fetch(`${getMarketplaceURL()}/projects`, {
          method: 'DELETE',
          headers: authHeaders,
          body: JSON.stringify({
            id: projectId,
          }),
        });

        expect(resp.status).toBe(200);
      } finally {
        // Delete files from S3
        await dummyFilesTeardown(key, fname);
      }

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
      });

      // TODO: Clean Up
    },
    longerTestTimeout,
  );
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
    // cleanup
    await withRootDb(async client => {
      // Cleaning up
      await client.query('UPDATE project SET on_chain_id = $1 where id = $2', [
        null,
        projectId,
      ]);
      await client.query('DELETE FROM project WHERE id = $1', [projectId]);
    }, commit);
  });
  it('returns 401 Unauthorized when a non project admin attempts to delete a off-chain project', async () => {
    const { authHeaders } = await createNewUserAndLogin();

    // Create project and post from another user
    const { projectId } = await createProject({});

    const resp = await fetch(`${getMarketplaceURL()}/projects`, {
      method: 'DELETE',
      headers: authHeaders,
      body: JSON.stringify({
        id: projectId,
      }),
    });

    expect(resp.status).toBe(401);
    // cleanup
    await withRootDb(async client => {
      // Cleaning up
      await client.query('DELETE FROM project WHERE id = $1', [projectId]);
    }, commit);
  });
});
