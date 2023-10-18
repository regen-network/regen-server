import fetch, { Headers } from 'node-fetch';
import {
  CSRFRequest,
  performLogin,
  loginResponseAssertions,
  setUpTestAccount,
  createNewUserAndLogin,
  getMarketplaceURL,
  createNewUser,
  parseSessionData,
} from '../utils';
import { Bech32Address } from '@keplr-wallet/cosmos';
import { Mnemonic, PrivKeySecp256k1 } from '@keplr-wallet/crypto';

const TEST_ACCOUNT_MNEMONIC =
  'culture photo express fantasy draft world dress waste side mask page valve';
const TEST_ADDRESS = 'regen1hscq3r6zz9ucut2d0jqqdc9lqwvu8h47x73lvm';

describe('web3auth login endpoint', () => {
  beforeAll(async () => {
    await setUpTestAccount(TEST_ACCOUNT_MNEMONIC);
  });

  it('returns 403 if double csrf is not used', async () => {
    const resp = await fetch(`${getMarketplaceURL()}/web3auth/login`, {
      method: 'POST',
    });
    expect(resp.status).toBe(403);
  });

  it('does not return 403 if double csrf is used', async () => {
    const req = await CSRFRequest(
      `${getMarketplaceURL()}/web3auth/login`,
      'POST',
    );
    const resp = await fetch(req);
    expect(resp.status !== 403).toBe(true);
  });

  it('an invalid signature returns a 500 error', async () => {
    const req = await CSRFRequest(
      `${getMarketplaceURL()}/web3auth/login`,
      'POST',
    );
    const resp = await fetch(req, {
      body: JSON.stringify({ signature: 'FOOBAR' }),
    });
    expect(resp.status).toBe(500);
  });

  it('authenticates a new user successfully and creates a session...', async () => {
    // set up a key pair and sign the required login transaction..
    const {
      response: loginResp,
      authHeaders,
      userAddr,
    } = await createNewUserAndLogin();
    loginResponseAssertions(loginResp);

    // check that an authenticated user can use an authenticated graphql query
    const resp = await fetch(`${getMarketplaceURL()}/graphql`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        query: '{ getCurrentAccount { id addr } }',
      }),
    });
    const data = await resp.json();

    // expect that the response contains the user's current account
    expect(data).toHaveProperty('data.getCurrentAccount.addr', userAddr);
    const loginRespJson = await loginResp.json();
    expect(data).toHaveProperty(
      'data.getCurrentAccount.id',
      loginRespJson.user.accountId,
    );
  });

  it('authenticates an existing user successfully and creates a session...', async () => {
    const privKey = new PrivKeySecp256k1(
      Mnemonic.generateWalletFromMnemonic(TEST_ACCOUNT_MNEMONIC),
    );
    const pubKey = privKey.getPubKey();
    const signer = new Bech32Address(pubKey.getAddress()).toBech32('regen');
    expect(signer).toBe(TEST_ADDRESS);
    const nonceResp = await fetch(
      `${getMarketplaceURL()}/web3auth/nonce?userAddress=${signer}`,
    );
    expect(nonceResp.status).toBe(200);
    const { nonce } = await nonceResp.json();

    const { response: loginResp, authHeaders } = await performLogin(
      privKey,
      pubKey,
      signer,
      nonce,
    );
    loginResponseAssertions(loginResp);

    const resp = await fetch(`${getMarketplaceURL()}/graphql`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        query: '{ getCurrentAccount { id addr } }',
      }),
    });
    const data = await resp.json();
    expect(data).toHaveProperty('data.getCurrentAccount.addr', signer);
  });

  it('returns a permissions error if the user session is manipulated...', async () => {
    const privKey = new PrivKeySecp256k1(
      Mnemonic.generateWalletFromMnemonic(TEST_ACCOUNT_MNEMONIC),
    );
    const pubKey = privKey.getPubKey();
    const signer = new Bech32Address(pubKey.getAddress()).toBech32('regen');
    expect(signer).toBe(TEST_ADDRESS);
    const nonceResp = await fetch(
      `${getMarketplaceURL()}/web3auth/nonce?userAddress=${signer}`,
    );
    expect(nonceResp.status).toBe(200);
    const { nonce } = await nonceResp.json();

    const { response: loginResp, authHeaders } = await performLogin(
      privKey,
      pubKey,
      signer,
      nonce,
    );

    // generate a new regen address
    // this address is the target of the attackers session hijacking
    const targetPrivKey = PrivKeySecp256k1.generateRandomKey();
    const targetPubKey = targetPrivKey.getPubKey();
    const targetAddr = new Bech32Address(targetPubKey.getAddress()).toBech32(
      'regen',
    );

    // manipulate the session cookie
    const raw = loginResp.headers.raw()['set-cookie'];
    const manipulatedCookie = raw
      .map(entry => {
        const parts = entry.split(';');
        const cookiePart = parts[0];
        if (cookiePart.startsWith('session=')) {
          const cv = cookiePart.split('session=')[1];
          const cj = JSON.parse(atob(cv));
          cj['passport']['user']['address'] = targetAddr;
          const mcv = btoa(JSON.stringify(cj));
          const mCookiePart = `session=${mcv}`;
          return mCookiePart;
        }
        return cookiePart;
      })
      .join(';');
    const cookieParts = authHeaders.get('cookie')!.split(';');
    const manipulatedParts = manipulatedCookie.split(';');
    const newCookie = [...manipulatedParts, cookieParts[2]].join(';');
    authHeaders.set('cookie', newCookie);

    const resp = await fetch(`${getMarketplaceURL()}/graphql`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        query: '{ getCurrentAccount { id addr } }',
      }),
    });
    const data = await resp.json();
    // since the session cookie was manipulated, we expect that the user session is invalidated.
    // the user session is invalidated because the session is signed
    // with a secret that only the backend knows,
    // an attacker could only succeed if they knew the secret and created a new signature.
    expect(data.data.getCurrentAccount).toBe(null);
  });

  it('when a user signs in with multiple accounts, there is an active account and a list of all active accounts, in the user session and the user can update their active account..', async () => {
    // set up a key pair and sign the required login transaction...
    const { response: loginResp1, authHeaders } = await createNewUserAndLogin();
    loginResponseAssertions(loginResp1);

    // get the users account id...
    const {
      user: { accountId: user1AccountId },
    } = await loginResp1.json();

    // using the same session from the user above, sign in with another users address...
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
        authHeaders, // authHeaders is where session cookies are stored
      );

    // get the users account id...
    const {
      user: { accountId: user2AccountId },
    } = await loginResp2.json();

    const { sessionData } = parseSessionData(loginResp2);
    // check that the sessions active account is the most recently logged in user...
    expect(sessionData).toHaveProperty('activeAccountId', user2AccountId);
    // check that both accounts are stored as active accounts...
    expect(sessionData).toHaveProperty('activeAccountIds', [
      user1AccountId,
      user2AccountId,
    ]);

    // test the GET current account API endpoint...
    const getQuery = await fetch(`${getMarketplaceURL()}/auth/accounts`, {
      method: 'GET',
      headers: authHeaders2,
    });
    const getResult = await getQuery.json();
    // expect the active account to be the second user at this point...
    expect(getResult).toHaveProperty('activeAccountId', user2AccountId);
    expect(getResult).toHaveProperty('activeAccountIds', [
      user1AccountId,
      user2AccountId,
    ]);

    // test the POST account API endpoint for updating the current account...
    const postQuery = await fetch(
      `${getMarketplaceURL()}/auth/accounts?accountId=${user1AccountId}`,
      {
        method: 'POST',
        headers: authHeaders2,
      },
    );
    const postResult = await postQuery.json();
    // now we expect the first user account to be the active one...
    expect(postResult).toHaveProperty('activeAccountId', user1AccountId);
    expect(postResult).toHaveProperty('activeAccountIds', [
      user1AccountId,
      user2AccountId,
    ]);

    // TODO: abstract into a function that can be re-used
    // is it similar enough to genAuthHeaders?
    // this block of code is just messy cookie parsing and updates...
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
        if (part.startsWith('regen-dev.x-csrf-token')) {
          cookies.push(part);
        }
      }
    }
    const updatedCookie = cookies.join(';');
    const headers = new Headers([...authHeaders2.entries()]);
    headers.delete('cookie');
    headers.append('cookie', updatedCookie);

    // for completeness, check that the GET active account API endpoint also shows the first user as the active one...
    // the check we did with postQuery was based on the POST API endpoint response...
    // this check is based on the user session...
    const getQuery1 = await fetch(`${getMarketplaceURL()}/auth/accounts`, {
      method: 'GET',
      headers,
    });
    const getResult1 = await getQuery1.json();
    expect(getResult1).toHaveProperty('activeAccountId', user1AccountId);

    // check that the user cannot try to switch to an account they have yet to authenticate as...
    const postQuery1 = await fetch(
      `${getMarketplaceURL()}/auth/accounts?accountId=foobar`,
      {
        method: 'POST',
        headers: headers,
      },
    );
    expect(postQuery1.status).toBe(401);

    // expect that a missing accountId returns on 400 bad request status code...
    const postQuery2 = await fetch(`${getMarketplaceURL()}/auth/accounts`, {
      method: 'POST',
      headers: headers,
    });
    expect(postQuery2.status).toBe(400);
  });
});
