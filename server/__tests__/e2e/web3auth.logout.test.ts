import fetch from 'node-fetch';
import { CSRFRequest, performLogin, genAuthHeaders } from '../utils';
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
    const { authHeaders, csrfHeaders } = await performLogin(
      privKey,
      pubKey,
      signer,
      nonce,
    );

    // now we pass the combined headers for the logout request
    const logoutResp = await fetch('http://localhost:5000/web3auth/logout', {
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

    const resp = await fetch('http://localhost:5000/graphql', {
      method: 'POST',
      headers: newAuthHeaders,
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
