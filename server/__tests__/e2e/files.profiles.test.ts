import fetch from 'node-fetch';
import {
  createNewUserAndLogin,
  dummyFilesSetup,
  dummyFilesTeardown,
  getMarketplaceURL,
  longerTestTimeout,
} from '../utils';

describe('files endpoint, profiles auth...', () => {
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
      const key = `profiles-test/${accountId}`;
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
      const key = `profiles-test/${accountId}`;
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
