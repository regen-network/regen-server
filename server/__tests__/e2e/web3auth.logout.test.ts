import fetch, { Headers } from 'node-fetch';
import { CSRFRequest, performLogin, parseSessionCookies } from '../utils';
import { Bech32Address } from '@keplr-wallet/cosmos';
import { PrivKeySecp256k1 } from '@keplr-wallet/crypto';

describe('web3auth logout endpoint', () => {
  it('returns 403 if double csrf is not used', async () => {
    const resp = await fetch('http://localhost:5000/web3auth/logout', {
      method: 'POST',
    });
    expect(resp.status).toBe(403);
  });

  it('returns 401 if request is unauthorized', async () => {
    const req = await CSRFRequest(
      'http://localhost:5000/web3auth/logout',
      'POST',
    );
    const resp = await fetch(req);
    expect(resp.status).toBe(401);
  });

  it('closes the user session and a user can no longer make authd requests', async () => {
    // set up a key pair and sign the required login transaction..
    const privKey = PrivKeySecp256k1.generateRandomKey();
    const pubKey = privKey.getPubKey();
    const signer = new Bech32Address(pubKey.getAddress()).toBech32('regen');
    // use an empty nonce since this is a request to create a new user account
    const nonce = '';

    const loginResp = await performLogin(privKey, pubKey, signer, nonce);

    const logoutReq = await CSRFRequest(
      'http://localhost:5000/web3auth/logout',
      'POST',
    );

    // we need to combine the auth cookies, and the csrf cookie
    const authCookies = loginResp.headers.raw()['set-cookie'];
    const csrfCookies = logoutReq.headers.raw()['Cookie'];
    const cookies = authCookies.concat(csrfCookies);
    const parsedCookies = cookies
      .map(entry => {
        const parts = entry.split(';');
        const cookiePart = parts[0];
        return cookiePart;
      })
      .join(';');
    const headers = new Headers([...logoutReq.headers.entries()]);
    headers.delete('cookie');
    headers.append('cookie', parsedCookies);

    // now we pass the combined headers for the logout request
    const logoutResp = await fetch(logoutReq, { headers: headers });
    expect(logoutResp.status).toBe(200);
    const logoutRespData = await logoutResp.json();
    expect(logoutRespData).toHaveProperty(
      'message',
      'You have been logged out!',
    );
    // the logout request alters the auth cookies
    // we must parse those here, and include these in subsequent requests
    const logoutCookie = parseSessionCookies(logoutResp);

    const resp = await fetch('http://localhost:5000/graphql', {
      method: 'POST',
      headers: {
        Cookie: logoutCookie,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query:
          'mutation {getCurrentAddrs(input: {}) {clientMutationId results { addr } }}',
      }),
    });
    const data = await resp.json();
    const errMsgs = data.errors.map(x => x.message);
    const expectedResult = ['permission denied for table account'];
    expect(errMsgs).toStrictEqual(expectedResult);
  });
});
