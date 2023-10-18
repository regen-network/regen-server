import fetch, { Headers } from 'node-fetch';
import {
  performLogin,
  createNewUserAndLogin,
  getMarketplaceURL,
  createNewUser,
  parseSessionData,
  CSRFRequest,
} from '../utils';
import { CSRF_COOKIE_NAME } from '../../middleware/csrf';

describe('auth accounts endpoint', () => {
  it('GET /accounts requires an authenticated session...', async () => {
    const resp = await fetch(`${getMarketplaceURL()}/auth/accounts`, {
      method: 'GET',
    });
    expect(resp.status).toBe(401);
  });
  it('GET /accounts returns user info when authenticated...', async () => {
    const { response, authHeaders } = await createNewUserAndLogin();
    const {
      user: { accountId },
    } = await response.json();
    const resp = await fetch(`${getMarketplaceURL()}/auth/accounts`, {
      method: 'GET',
      headers: authHeaders,
    });
    const { activeAccountId, activeAccountIds } = await resp.json();
    expect(activeAccountId).toBe(accountId);
    expect(activeAccountIds).toStrictEqual([accountId]);
  });
  it('POST /accounts is CSRF protected...', async () => {
    const resp = await fetch(`${getMarketplaceURL()}/auth/accounts`, {
      method: 'POST',
    });
    expect(resp.status).toBe(403);
  });
  it('POST /accounts requires an authenticated session...', async () => {
    const req = await CSRFRequest(
      `${getMarketplaceURL()}/auth/accounts`,
      'POST',
    );
    const resp = await fetch(req);
    expect(resp.status).toBe(401);
  });
  it('POST /accounts requires an accountId parameter...', async () => {
    const { authHeaders } = await createNewUserAndLogin();
    const resp = await fetch(`${getMarketplaceURL()}/auth/accounts`, {
      method: 'POST',
      headers: authHeaders,
    });
    expect(resp.status).toBe(400);
  });
  it('POST /accounts only allows users to specify an accountId they have authenticated with...', async () => {
    const { authHeaders } = await createNewUserAndLogin();
    const getAccountsResp = await fetch(
      `${getMarketplaceURL()}/auth/accounts`,
      {
        method: 'GET',
        headers: authHeaders,
      },
    );
    const { activeAccountId } = await getAccountsResp.json();
    const updateActiveAccountResp1 = await fetch(
      `${getMarketplaceURL()}/auth/accounts?accountId=${activeAccountId}`,
      {
        method: 'POST',
        headers: authHeaders,
      },
    );
    expect(updateActiveAccountResp1.status).toBe(200);
    const updateActiveAccountResp2 = await fetch(
      `${getMarketplaceURL()}/auth/accounts?accountId=foobar`,
      {
        method: 'POST',
        headers: authHeaders,
      },
    );
    expect(updateActiveAccountResp2.status).toBe(401);
  });
  it('supports multiple logins and account switching...', async () => {
    // authenticate as user 1 and get user 1's account id...
    const { response: loginResp1, authHeaders } = await createNewUserAndLogin();
    const {
      user: { accountId: user1AccountId },
    } = await loginResp1.json();

    // as user 1, sign in to a different account, called user 2...
    // this simulates signing in to the application multiple times using the same session...
    const {
      userPrivKey,
      userPubKey,
      userAddr: userAddr2,
    } = await createNewUser();
    const nonce = '';
    const { response: loginResp2, authHeaders: authHeaders2 } =
      await performLogin(
        userPrivKey,
        userPubKey,
        userAddr2,
        nonce,
        authHeaders, // authHeaders is where session cookies are stored, notice how this is the session from user 1
      );
    // get user 2's account id...
    const {
      user: { accountId: user2AccountId },
    } = await loginResp2.json();

    // now we are going to check the state of the user session
    // we do this by reading cookies in the login response from user 2
    const { sessionData } = parseSessionData(loginResp2);
    // check that the sessions active account is the most recently logged in user...
    expect(sessionData).toHaveProperty('activeAccountId', user2AccountId);
    // check that both accounts are stored as active accounts...
    expect(sessionData).toHaveProperty('activeAccountIds', [
      user1AccountId,
      user2AccountId,
    ]);

    // even though we already confirmed what was in the user session cookie,
    // let's confirm that the information about the active users is correct from the API endpoint as well...
    const getQuery = await fetch(`${getMarketplaceURL()}/auth/accounts`, {
      method: 'GET',
      headers: authHeaders2, // we have to use the latest auth headers because these are up-to-date..
    });
    const getResult = await getQuery.json();
    // we expect the same result from the API response as we saw in the session cookie...
    expect(getResult).toHaveProperty('activeAccountId', user2AccountId);
    expect(getResult).toHaveProperty('activeAccountIds', [
      user1AccountId,
      user2AccountId,
    ]);

    // now since the current active account is user 2,
    // let's test the POST API endpoint and make sure we can switch back to user 1 as the active user...
    const postQuery = await fetch(
      `${getMarketplaceURL()}/auth/accounts?accountId=${user1AccountId}`,
      {
        method: 'POST',
        headers: authHeaders2,
      },
    );
    expect(postQuery.status).toBe(200);

    // given that the query to switch the current active account modifies the user session,
    // there are updates that the server sends to use via the set-cookie header.
    // this block of code parses those updates and prepares a set of headers that will include them in our next request.
    // web browsers do this for client-side applications, but we're doing low-level http here.
    const newCookies = postQuery.headers.raw()['set-cookie'];
    const currentCookies = authHeaders2.raw()['cookie'];
    const cookies: string[] = [];
    for (const entry of newCookies) {
      const parts = entry.split(';');
      const cookiePart = parts[0];
      if (cookiePart.startsWith('session')) {
        cookies.push(cookiePart);
      }
    }
    for (const entry of currentCookies) {
      const parts = entry.split(';');
      for (const part of parts) {
        if (part.includes(CSRF_COOKIE_NAME)) {
          cookies.push(part);
        }
      }
    }
    const updatedCookie = cookies.join(';');
    const headers = new Headers([...authHeaders2.entries()]);
    headers.delete('cookie');
    headers.append('cookie', updatedCookie);

    // now let's run the GET active account query again,
    // and make sure that the active account is user 1...
    const getQuery1 = await fetch(`${getMarketplaceURL()}/auth/accounts`, {
      method: 'GET',
      headers,
    });
    const getResult1 = await getQuery1.json();
    expect(getResult1).toHaveProperty('activeAccountId', user1AccountId);
  });
});
