import fetch from 'node-fetch';
import {
  CSRFRequest,
  performLogin,
  loginResponseAssertions,
  parseSessionCookies,
} from '../utils';
import { Bech32Address } from '@keplr-wallet/cosmos';
import { Mnemonic, PrivKeySecp256k1 } from '@keplr-wallet/crypto';

const TEST_ACCOUNT_MNEMONIC =
  'culture photo express fantasy draft world dress waste side mask page valve';

async function setUpTestAccount(mnemonic: string): Promise<void> {
  const privKey = new PrivKeySecp256k1(
    Mnemonic.generateWalletFromMnemonic(mnemonic),
  );
  const pubKey = privKey.getPubKey();
  const signer = new Bech32Address(pubKey.getAddress()).toBech32('regen');

  const resp = await fetch(
    `http://localhost:5000/web3auth/nonce?userAddress=${signer}`,
  );
  // if the nonce was not found then the account does not yet exist
  if (resp.status === 404) {
    // create the account if it did not exist
    const emptyNonce = '';
    const loginResp = await performLogin(privKey, pubKey, signer, emptyNonce);
    expect(loginResp.status).toBe(200);
  }
}

describe('web3auth login endpoint', () => {
  beforeAll(async () => {
    await setUpTestAccount(TEST_ACCOUNT_MNEMONIC);
  });

  it('returns 403 if double csrf is not used', async () => {
    const resp = await fetch('http://localhost:5000/web3auth/login', {
      method: 'POST',
    });
    expect(resp.status).toBe(403);
  });

  it('does not return 403 if double csrf is used', async () => {
    const req = await CSRFRequest(
      'http://localhost:5000/web3auth/login',
      'POST',
    );
    const resp = await fetch(req);
    expect(resp.status !== 403).toBe(true);
  });

  it('an invalid signature returns a 500 error', async () => {
    const req = await CSRFRequest(
      'http://localhost:5000/web3auth/login',
      'POST',
    );
    const resp = await fetch(req, {
      body: JSON.stringify({ signature: 'FOOBAR' }),
    });
    expect(resp.status).toBe(500);
  });

  it('authenticates a new user successfully and creates a session...', async () => {
    // set up a key pair and sign the required login transaction..
    const privKey = PrivKeySecp256k1.generateRandomKey();
    const pubKey = privKey.getPubKey();
    const signer = new Bech32Address(pubKey.getAddress()).toBech32('regen');
    // use an empty nonce since this is a request to create a new user account
    const nonce = '';

    const loginResp = await performLogin(privKey, pubKey, signer, nonce);
    loginResponseAssertions(loginResp, signer);

    const cookie = parseSessionCookies(loginResp);

    // check that an authenticated user use an authenticated graphql query
    const resp = await fetch('http://localhost:5000/graphql', {
      method: 'POST',
      headers: {
        Cookie: cookie,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query:
          'mutation {getCurrentAddrs(input: {}) {clientMutationId results { addr } }}',
      }),
    });
    const data = await resp.json();
    // expect that the response contains the users current addresses
    // because this test is for a new user they should only have one address
    expect(data).toHaveProperty('data.getCurrentAddrs.results', [
      { addr: signer },
    ]);
  });

  it('authenticates an existing user successfully and creates a session...', async () => {
    const privKey = new PrivKeySecp256k1(
      Mnemonic.generateWalletFromMnemonic(TEST_ACCOUNT_MNEMONIC),
    );
    const pubKey = privKey.getPubKey();
    const signer = new Bech32Address(pubKey.getAddress()).toBech32('regen');
    expect(signer).toBe('regen1hscq3r6zz9ucut2d0jqqdc9lqwvu8h47x73lvm');
    const nonceResp = await fetch(
      `http://localhost:5000/web3auth/nonce?userAddress=${signer}`,
    );
    expect(nonceResp.status).toBe(200);
    const { nonce } = await nonceResp.json();

    const loginResp = await performLogin(privKey, pubKey, signer, nonce);
    loginResponseAssertions(loginResp, signer);

    const cookie = parseSessionCookies(loginResp);

    const resp = await fetch('http://localhost:5000/graphql', {
      method: 'POST',
      headers: {
        Cookie: cookie,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query:
          'mutation {getCurrentAddrs(input: {}) {clientMutationId results { addr } }}',
      }),
    });
    const data = await resp.json();
    expect(data).toHaveProperty('data.getCurrentAddrs.results', [
      { addr: signer },
    ]);
  });
});
