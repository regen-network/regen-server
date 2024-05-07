import fetch from 'node-fetch';
import {
  createNewUserAndLogin,
  dummyFilesSetup,
  dummyFilesTeardown,
  getMarketplaceURL,
  longerTestTimeout,
} from '../utils';

describe('files endpoint, profiles auth...', () => {
  describe('upload profile media', () => {
    it(
      'allows a user to upload profile media...',
      async () => {
        const { authHeaders } = await createNewUserAndLogin();

        const query = await fetch(`${getMarketplaceURL()}/graphql`, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            query: '{ getCurrentAccount { id } }',
          }),
        });
        const result = await query.json();
        const accountId = result.data.getCurrentAccount.id;
        const key = `${process.env.S3_PROFILES_PATH}/${accountId}`;
        const fname = `test-${accountId}.txt`;

        try {
          const { resp } = await dummyFilesSetup(
            key,
            fname,
            accountId,
            authHeaders,
          );
          expect(resp.status).toBe(200);
        } finally {
          await dummyFilesTeardown(key, fname);
        }
      },
      longerTestTimeout,
    );
    it(
      'does not allow a user to update another users media...',
      async () => {
        const { authHeaders } = await createNewUserAndLogin();

        const accountId = 'another-users-uuid';
        const key = `${process.env.S3_PROFILES_PATH}/${accountId}`;
        const fname = `test-${accountId}.txt`;

        const { resp } = await dummyFilesSetup(
          key,
          fname,
          accountId,
          authHeaders,
        );
        expect(resp.status).toBe(401);
      },
      longerTestTimeout,
    );
  });
  describe('delete profile media', () => {
    it(
      'allows a user to delete profile media...',
      async () => {
        const { authHeaders } = await createNewUserAndLogin();

        const query = await fetch(`${getMarketplaceURL()}/graphql`, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            query: '{ getCurrentAccount { id } }',
          }),
        });
        const result = await query.json();
        const accountId = result.data.getCurrentAccount.id;
        const key = `${process.env.S3_PROFILES_PATH}/${accountId}`;
        const fname = `test-${accountId}.txt`;

        try {
          await dummyFilesSetup(key, fname, accountId, authHeaders);
          const resp = await fetch(
            `${getMarketplaceURL()}/files/${
              process.env.S3_PROFILES_PATH
            }/${accountId}?fileName=${fname}`,
            {
              method: 'DELETE',
              headers: authHeaders,
            },
          );
          expect(resp.status).toBe(200);
        } finally {
          await dummyFilesTeardown(key, fname);
        }
      },
      longerTestTimeout,
    );
    it(
      'does not allow a user to delete another users media...',
      async () => {
        const { authHeaders } = await createNewUserAndLogin();

        const query = await fetch(`${getMarketplaceURL()}/graphql`, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            query: '{ getCurrentAccount { id } }',
          }),
        });
        const result = await query.json();
        const accountId = result.data.getCurrentAccount.id;

        const key = `${process.env.S3_PROFILES_PATH}/${accountId}`;
        const fname = `test-${accountId}.txt`;

        await dummyFilesSetup(key, fname, accountId, authHeaders);

        const { authHeaders: authHeaders1 } = await createNewUserAndLogin();
        const resp = await fetch(
          `${getMarketplaceURL()}/files/${
            process.env.S3_PROFILES_PATH
          }/${accountId}?fileName=${fname}`,
          {
            method: 'DELETE',
            headers: authHeaders1,
          },
        );
        expect(resp.status).toBe(401);
      },
      longerTestTimeout,
    );
  });
});
