import fetch from 'node-fetch';
import {
  createNewUserAndLogin,
  dummyFilesSetup,
  dummyFilesTeardown,
  getMarketplaceURL,
} from '../utils';

describe('files endpoint, profiles auth...', () => {
  it('allows a user to upload profile media...', async () => {
    const { authHeaders } = await createNewUserAndLogin();

    const query = await fetch(`${getMarketplaceURL()}/graphql`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        query: '{ getCurrentParty { id } }',
      }),
    });
    const result = await query.json();
    const partyId = result.data.getCurrentParty.id;
    const key = `profiles-test/${partyId}`;
    const fname = `test-${partyId}.txt`;

    try {
      const { resp } = await dummyFilesSetup(key, fname, partyId, authHeaders);
      expect(resp.status).toBe(200);
    } finally {
      await dummyFilesTeardown(key, fname);
    }
  });
  it('does not allow a user to update another users media...', async () => {
    const { authHeaders } = await createNewUserAndLogin();

    const partyId = 'another-users-uuid';
    const key = `profiles-test/${partyId}`;
    const fname = `test-${partyId}.txt`;

    const { resp } = await dummyFilesSetup(key, fname, partyId, authHeaders);
    expect(resp.status).toBe(401);
  });
});
