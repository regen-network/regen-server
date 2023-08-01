import fetch from 'node-fetch';
import {
  createNewUserAndLogin,
  dummyFilesSetup,
  dummyFilesTeardown,
} from '../utils';

describe('files endpoint, profiles auth...', () => {
  it('allows a user to upload profile media...', async () => {
    const { authHeaders, userAddr } = await createNewUserAndLogin();

    const query = await fetch('http://localhost:5000/marketplace/v1/graphql', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        query: `{ walletByAddr(addr: "${userAddr}") { id partyByWalletId { id } } }`,
      }),
    });
    const result = await query.json();
    const partyId = result.data.walletByAddr.partyByWalletId.id;
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
