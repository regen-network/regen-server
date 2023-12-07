import fetch from 'node-fetch';
import {
  createNewUserAndLogin,
  createProject,
  dummyFilesSetup,
  dummyFilesTeardown,
  getMarketplaceURL,
  longerTestTimeout,
} from '../utils';
import { withRootDb } from '../db/helpers';

describe('files endpoint, projects auth...', () => {
  describe('upload project files', () => {
    it(
      'allows a user to upload project media to a project they are an admin for...',
      async () => {
        const { authHeaders } = await createNewUserAndLogin();

        // Create a project administered by this account
        const { key, fname, projectId, accountId } = await createProject({
          initAuthHeaders: authHeaders,
        });

        try {
          const { resp } = await dummyFilesSetup(
            key,
            fname,
            projectId,
            authHeaders,
          );
          const json = await resp.json();

          expect(resp.status).toBe(200);
          await withRootDb(async client => {
            const uploadQuery = await client.query(
              'select * from upload where url = $1',
              [json.imageUrl],
            );
            expect(uploadQuery.rowCount).toEqual(1);
            expect(uploadQuery.rows[0].account_id).toEqual(accountId);
            expect(uploadQuery.rows[0].project_id).toEqual(projectId);
          });
        } finally {
          await dummyFilesTeardown(key, fname);
        }
      },
      longerTestTimeout,
    );
    it(
      'disallows a user from uploading project media to a project they are not admin for...',
      async () => {
        // this can be a longer running test...
        const { authHeaders } = await createNewUserAndLogin();

        // Create a project administered by another account
        const { key, fname, projectId } = await createProject({});

        const { resp } = await dummyFilesSetup(
          key,
          fname,
          projectId,
          authHeaders,
        );
        expect(resp.status).toBe(401);
      },
      longerTestTimeout,
    );
  });

  describe('delete project files', () => {
    it(
      'allows a user to delete project media from a project they are an admin for...',
      async () => {
        const { authHeaders } = await createNewUserAndLogin();

        // Create a project administered by this account
        const { key, fname, projectId } = await createProject({
          initAuthHeaders: authHeaders,
        });

        try {
          const { resp: uploadResp } = await dummyFilesSetup(
            key,
            fname,
            projectId,
            authHeaders,
          );
          const json = await uploadResp.json();
          console.log('resp', json.imageUrl);
          const resp = await fetch(
            `${getMarketplaceURL()}/files/${projectId}/${fname}`,
            {
              method: 'DELETE',
              headers: authHeaders,
            },
          );
          expect(resp.status).toBe(200);

          await withRootDb(async client => {
            const uploadQuery = await client.query(
              'select * from upload where url = $1',
              [json.imageUrl],
            );
            expect(uploadQuery.rowCount).toEqual(0);
          });
        } finally {
          await dummyFilesTeardown(key, fname);
        }
      },
      longerTestTimeout,
    );
    it(
      'disallows a user from deleting project media from a project they are not admin for...',
      async () => {
        const { authHeaders } = await createNewUserAndLogin();
        const { key, fname, projectId } = await createProject({
          initAuthHeaders: authHeaders,
        });

        try {
          await dummyFilesSetup(key, fname, projectId, authHeaders);

          // Try to delete project media administered by another account
          const { authHeaders: authHeaders1 } = await createNewUserAndLogin();
          const resp = await fetch(
            `${getMarketplaceURL()}/files/${projectId}/${fname}`,
            {
              method: 'DELETE',
              headers: authHeaders1,
            },
          );
          expect(resp.status).toBe(401);
        } finally {
          await dummyFilesTeardown(key, fname);
        }
      },
      longerTestTimeout,
    );
  });
});
