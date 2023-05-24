import fetch from 'node-fetch';
import { withRootDb } from '../db/helpers';
import {
  genAddAddressSignature,
  createNewUserAndLogin,
  createNewUser,
} from '../utils';

describe('web3auth addresses endpoint', () => {
  it('can add a previously claimed address to a user account...', async () => {
    // create a new testing account
    const { authHeaders, userAddr } = await createNewUserAndLogin();

    const nonceResp = await fetch(
      `http://localhost:5000/web3auth/nonce?userAddress=${userAddr}`,
    );
    // get the nonce for the currently authenticated user
    const { nonce } = await nonceResp.json();

    const {
      authHeaders: testUserAuthHeaders,
      userAddr: newAddr,
      userPrivKey: newPrivKey,
      userPubKey: newPubKey,
    } = await createNewUserAndLogin();

    const testUserPartyQuery = await fetch('http://localhost:5000/graphql', {
      method: 'POST',
      headers: testUserAuthHeaders,
      body: JSON.stringify({
        query: `{ walletByAddr(addr: "${newAddr}") { id partyByWalletId { id } } }`,
      }),
    });
    const testUserPartyResult = await testUserPartyQuery.json();
    const testUserPartyId =
      testUserPartyResult.data.walletByAddr.partyByWalletId.id;

    // test user has updated their profile name..
    const testUserName = 'Foo Bar';
    await fetch('http://localhost:5000/graphql', {
      method: 'POST',
      headers: testUserAuthHeaders,
      body: JSON.stringify({
        operationName: 'UpdatePartyById',
        variables: {
          input: {
            id: testUserPartyId,
            partyPatch: {
              name: testUserName,
            },
          },
        },
        query:
          'mutation UpdatePartyById($input: UpdatePartyByIdInput!) { updatePartyById(input: $input) { party { id } } }',
      }),
    });

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
        query: '{getCurrentAddrs { nodes {addr}}}',
      }),
    });
    const data = await resp.json();
    expect(data.data.getCurrentAddrs.nodes.length).toBe(2);

    const testUserResp = await fetch('http://localhost:5000/graphql', {
      method: 'POST',
      headers: testUserAuthHeaders,
      body: JSON.stringify({
        query: '{getCurrentAddrs { nodes {addr}}}',
      }),
    });
    const testUserData = await testUserResp.json();
    expect(testUserData.data.getCurrentAddrs.nodes.length).toBe(0);

    const partyQuery = await fetch('http://localhost:5000/graphql', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        query: `{ walletByAddr(addr: "${newAddr}") { id partyByWalletId { name } } }`,
      }),
    });
    const partyResult = await partyQuery.json();
    const partyName = partyResult.data.walletByAddr.partyByWalletId.name;
    // after the user claims the test user address, the profile info should remain the same
    expect(partyName).toBe(testUserName);
  });

  it('can add an unused address to a user account...', async () => {
    // create a new testing account
    const { authHeaders, userAddr } = await createNewUserAndLogin();

    const nonceResp = await fetch(
      `http://localhost:5000/web3auth/nonce?userAddress=${userAddr}`,
    );
    // get the nonce for the currently authenticated user
    const { nonce } = await nonceResp.json();

    // just generate a key pair and an address
    // do not create an account for this address
    const {
      userPubKey: newPubKey,
      userPrivKey: newPrivKey,
      userAddr: newAddr,
    } = await createNewUser();
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
        query: '{getCurrentAddrs { nodes {addr}}}',
      }),
    });
    const data = await resp.json();
    expect(data.data.getCurrentAddrs.nodes.length).toBe(2);
    await withRootDb(async client => {
      const result = await client.query(
        `SELECT rolname FROM pg_roles WHERE rolname = '${newAddr}'`,
      );
      // we expect that a role is created for the unused address when adding an address
      expect(result.rowCount).toBe(1);
    });
  });
});
