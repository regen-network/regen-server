import fetch from 'node-fetch';
import {
  CSRFRequest,
  genAuthHeaders,
  createNewUserAndLogin,
  getMarketplaceURL,
} from '../utils';

describe('web3auth logout endpoint', () => {
  it('returns 403 if double csrf is not used', async () => {
    const resp = await fetch(`${getMarketplaceURL()}/web3auth/logout`, {
      method: 'POST',
    });
    expect(resp.status).toBe(403);
  });

  it('returns 401 if request is unauthorized', async () => {
    const req = await CSRFRequest(
      `${getMarketplaceURL()}/web3auth/logout`,
      'POST',
    );
    const resp = await fetch(req);
    expect(resp.status).toBe(401);
  });

  it('closes the user session and a user can no longer make authd requests', async () => {
    const { authHeaders, csrfHeaders } = await createNewUserAndLogin();

    // now we pass the combined headers for the logout request
    const logoutResp = await fetch(`${getMarketplaceURL()}/web3auth/logout`, {
      method: 'POST',
      headers: authHeaders,
    });
    expect(logoutResp.status).toBe(200);
    const logoutRespData = await logoutResp.json();
    expect(logoutRespData).toHaveProperty(
      'message',
      'You have been logged out!',
    );
    // the logout request alters the auth cookies
    // we must parse those here, and include these in subsequent requests
    const newAuthHeaders = genAuthHeaders(logoutResp.headers, csrfHeaders);

    const resp = await fetch(`${getMarketplaceURL()}/graphql`, {
      method: 'POST',
      headers: newAuthHeaders,
      body: JSON.stringify({
        query: '{ getCurrentParty { id addr } }',
      }),
    });
    const data = await resp.json();
    expect(data.data.getCurrentParty).toBe(null);
  });
});
