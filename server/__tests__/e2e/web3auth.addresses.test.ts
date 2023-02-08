import fetch, { Headers } from 'node-fetch';
import { CSRFRequest, performLogin, genSignature } from '../utils';
import { Bech32Address } from '@keplr-wallet/cosmos';
import { PrivKeySecp256k1 } from '@keplr-wallet/crypto';

describe('web3auth addresses endpoint', () => {
  it('can add a previously claimed address to a user account...', async () => {
    // create a new testing account
    const userPrivKey = PrivKeySecp256k1.generateRandomKey();
    const userPubKey = userPrivKey.getPubKey();
    const userAddr = new Bech32Address(userPubKey.getAddress()).toBech32(
      'regen',
    );
    const emptyNonce = '';
    const loginResp = await performLogin(
      userPrivKey,
      userPubKey,
      userAddr,
      emptyNonce,
    );

    const nonceResp = await fetch(
      `http://localhost:5000/web3auth/nonce?userAddress=${userAddr}`,
    );
    // get the nonce for the currently authenticated user
    const { nonce } = await nonceResp.json();

    // create another new testing account to add to the first account
    const newPrivKey = PrivKeySecp256k1.generateRandomKey();
    const newPubKey = newPrivKey.getPubKey();
    const newAddr = new Bech32Address(newPubKey.getAddress()).toBech32('regen');
    await performLogin(newPrivKey, newPubKey, newAddr, emptyNonce);
    // prove ownership of the new testing account
    // use the nonce of the currently authenticated user
    const newSig = genSignature(newPrivKey, newPubKey, newAddr, nonce);

    const csrfReq = await CSRFRequest(
      'http://localhost:5000/web3auth/addresses',
      'POST',
    );

    // we need to combine the auth cookies, and the csrf cookie
    const authCookies = loginResp.headers.raw()['set-cookie'];
    const csrfCookies = csrfReq.headers.raw()['Cookie'];
    const cookies = authCookies.concat(csrfCookies);
    const parsedCookies = cookies
      .map(entry => {
        const parts = entry.split(';');
        const cookiePart = parts[0];
        return cookiePart;
      })
      .join(';');
    const headers = new Headers([...csrfReq.headers.entries()]);
    headers.delete('cookie');
    headers.append('cookie', parsedCookies);
    headers.append('content-type', 'application/json');

    const addrResp = await fetch(csrfReq, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ signature: newSig }),
    });

    expect(addrResp.status).toBe(200);

    const resp = await fetch('http://localhost:5000/graphql', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        query:
          'mutation {getCurrentAddrs(input: {}) {clientMutationId results { addr } }}',
      }),
    });
    const data = await resp.json();
    expect(data.data.getCurrentAddrs.results.length).toBe(2);
  });

  it('can add a previously unused address to a user account...', async () => {
    // create a new testing account
    const userPrivKey = PrivKeySecp256k1.generateRandomKey();
    const userPubKey = userPrivKey.getPubKey();
    const userAddr = new Bech32Address(userPubKey.getAddress()).toBech32(
      'regen',
    );
    const emptyNonce = '';
    const loginResp = await performLogin(
      userPrivKey,
      userPubKey,
      userAddr,
      emptyNonce,
    );

    const nonceResp = await fetch(
      `http://localhost:5000/web3auth/nonce?userAddress=${userAddr}`,
    );
    // get the nonce for the currently authenticated user
    const { nonce } = await nonceResp.json();

    // just generate a key pair and an address
    // do not create an account for this address
    const newPrivKey = PrivKeySecp256k1.generateRandomKey();
    const newPubKey = newPrivKey.getPubKey();
    const newAddr = new Bech32Address(newPubKey.getAddress()).toBech32('regen');
    // prove ownership of the key pair
    // use the nonce of the currently authenticated user
    const newSig = genSignature(newPrivKey, newPubKey, newAddr, nonce);

    const csrfReq = await CSRFRequest(
      'http://localhost:5000/web3auth/addresses',
      'POST',
    );

    // we need to combine the auth cookies, and the csrf cookie
    const authCookies = loginResp.headers.raw()['set-cookie'];
    const csrfCookies = csrfReq.headers.raw()['Cookie'];
    const cookies = authCookies.concat(csrfCookies);
    const parsedCookies = cookies
      .map(entry => {
        const parts = entry.split(';');
        const cookiePart = parts[0];
        return cookiePart;
      })
      .join(';');
    const headers = new Headers([...csrfReq.headers.entries()]);
    headers.delete('cookie');
    headers.append('cookie', parsedCookies);
    headers.append('content-type', 'application/json');

    const addrResp = await fetch(csrfReq, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ signature: newSig }),
    });

    expect(addrResp.status).toBe(200);

    const resp = await fetch('http://localhost:5000/graphql', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        query:
          'mutation {getCurrentAddrs(input: {}) {clientMutationId results { addr } }}',
      }),
    });
    const data = await resp.json();
    expect(data.data.getCurrentAddrs.results.length).toBe(2);
  });
});
