import fetch from 'node-fetch';
import {
  CSRFRequest,
  genAuthHeaders,
  createNewUserAndLogin,
  getMarketplaceURL,
} from '../utils';

describe('wallet-auth logout endpoint', () => {
  it('returns 403 if double csrf is not used', async () => {
    const resp = await fetch(`${getMarketplaceURL()}/wallet-auth/logout`, {
      method: 'POST',
    });
    expect(resp.status).toBe(403);
  });

  it('returns 401 if request is unauthorized', async () => {
    const req = await CSRFRequest(
      `${getMarketplaceURL()}/wallet-auth/logout`,
      'POST',
    );
    const resp = await fetch(req);
    expect(resp.status).toBe(401);
  });

  it('closes the user session and a user can no longer make authd requests', async () => {
    const { authHeaders, csrfHeaders } = await createNewUserAndLogin();

    // now we pass the combined headers for the logout request
    const logoutResp = await fetch(
      `${getMarketplaceURL()}/wallet-auth/logout`,
      {
        method: 'POST',
        headers: authHeaders,
      },
    );
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
        query: '{ getCurrentAccount { id addr } }',
      }),
    });
    const data = await resp.json();
    expect(data.data.getCurrentAccount).toBe(null);
  });

  it('removes authenticatedAccounts from session', async () => {
    // Log in with one account
    const { authHeaders, csrfHeaders } = await createNewUserAndLogin();

    // Then log out
    const logoutResp = await fetch(
      `${getMarketplaceURL()}/wallet-auth/logout`,
      {
        method: 'POST',
        headers: authHeaders,
      },
    );
    expect(logoutResp.status).toBe(200);

    // the logout request alters the auth cookies
    // we must parse those here, and include these in subsequent requests
    const logoutAuthHeaders = genAuthHeaders(logoutResp.headers, csrfHeaders);

    // Log in with another account
    const { authHeaders: newAuthHeaders, response } =
      await createNewUserAndLogin(logoutAuthHeaders);
    const {
      user: { accountId },
    } = await response.json();

    // Only the new account is part of the authenticated accounts
    const accountsQuery = await fetch(`${getMarketplaceURL()}/auth/accounts`, {
      method: 'GET',
      headers: newAuthHeaders,
    });
    const accounts = await accountsQuery.json();
    expect(accounts.authenticatedAccounts.length).toEqual(1);
    expect(accounts.authenticatedAccounts[0].id).toEqual(accountId);
    expect(accounts.activeAccountId).toEqual(accountId);
  });
});
