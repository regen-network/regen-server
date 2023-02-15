import fetch from 'node-fetch';
import { performLogin, genAddAddressSignature } from '../utils';
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
    const { authHeaders } = await performLogin(
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
    const newSig = genAddAddressSignature(
      newPrivKey,
      newPubKey,
      newAddr,
      nonce,
    );

    const addrResp = await fetch('http://localhost:5000/web3auth/addresses', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ signature: newSig }),
    });

    expect(addrResp.status).toBe(200);

    const resp = await fetch('http://localhost:5000/graphql', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        query:
          'mutation {getCurrentAddrs(input: {}) {clientMutationId results { addr } }}',
      }),
    });
    const data = await resp.json();
    expect(data.data.getCurrentAddrs.results.length).toBe(2);
  });

  it('can add an unused address to a user account...', async () => {
    // create a new testing account
    const userPrivKey = PrivKeySecp256k1.generateRandomKey();
    const userPubKey = userPrivKey.getPubKey();
    const userAddr = new Bech32Address(userPubKey.getAddress()).toBech32(
      'regen',
    );
    const emptyNonce = '';
    const { authHeaders } = await performLogin(
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
    const newSig = genAddAddressSignature(
      newPrivKey,
      newPubKey,
      newAddr,
      nonce,
    );

    const addrResp = await fetch('http://localhost:5000/web3auth/addresses', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ signature: newSig }),
    });

    expect(addrResp.status).toBe(200);

    const resp = await fetch('http://localhost:5000/graphql', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        query:
          'mutation {getCurrentAddrs(input: {}) {clientMutationId results { addr } }}',
      }),
    });
    const data = await resp.json();
    expect(data.data.getCurrentAddrs.results.length).toBe(2);
  });
});
