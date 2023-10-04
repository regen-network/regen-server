import fetch from 'node-fetch';
import {
  CSRFRequest,
  performLogin,
  loginResponseAssertions,
  setUpTestAccount,
  createNewUserAndLogin,
  getMarketplaceURL,
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
    loginResponseAssertions(loginResp, userAddr);

    // check that an authenticated user can use an authenticated graphql query
    const resp = await fetch(`${getMarketplaceURL()}/graphql`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        query: '{getCurrentParty}',
      }),
    });
    const data = await resp.json();
    console.dir({ data }, { depth: null });
    // expect that the response contains the user's current addresses
    // because this test is for a new user they should only have one address
    expect(data).toHaveProperty('data.getCurrentParty', [{ addr: userAddr }]);

    // check that the getCurrentParty function works...
    const resp1 = await fetch(`${getMarketplaceURL()}/graphql`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        query: '{getCurrentParty}',
      }),
    });
    const data1 = await resp1.json();
    const loginRespJson = await loginResp.json();
    expect(data1).toHaveProperty(
      'data.getCurrentParty',
      loginRespJson.user.partyId,
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
    loginResponseAssertions(loginResp, signer);

    const resp = await fetch(`${getMarketplaceURL()}/graphql`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        query: '{getCurrentAddrs { nodes {addr}}}',
      }),
    });
    const data = await resp.json();
    expect(data).toHaveProperty('data.getCurrentAddrs.nodes', [
      { addr: signer },
    ]);
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
        query: '{getCurrentAddrs { nodes {addr}}}',
      }),
    });
    const data = await resp.json();
    // since the session cookie was manipulated, we expect that the user session is invalidated.
    // the user session is invalidated because the session is signed
    // with a secret that only the backend knows,
    // an attacker could only succeed if they knew the secret and created a new signature.
    expect(data.data.getCurrentAddrs).toBe(null);
  });
});
