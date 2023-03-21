import fetch from 'node-fetch';
import { performLogin } from '../../utils';
import { Bech32Address } from '@keplr-wallet/cosmos';
import { PrivKeySecp256k1 } from '@keplr-wallet/crypto';

describe('party update policies', () => {
  it('allow a user to update a party/profile that belongs to them', async () => {
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

    const query = await fetch('http://localhost:5000/graphql', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        query: `{ walletByAddr(addr: "${userAddr}") { id partyByWalletId { id } } }`,
      }),
    });
    const result = await query.json();
    const partyId = result.data.walletByAddr.partyByWalletId.id;

    const NEW_NAME = 'FOO BAR';
    const update = await fetch('http://localhost:5000/graphql', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        operationName: 'UpdatePartyById',
        variables: {
          input: {
            id: partyId,
            partyPatch: {
              name: NEW_NAME,
            },
          },
        },
        query:
          'mutation UpdatePartyById($input: UpdatePartyByIdInput!) { updatePartyById(input: $input) { party { id } } }',
      }),
    });
    const updResp = await update.json();
    const { id: returnedPartyId } = updResp.data.updatePartyById.party;

    expect(returnedPartyId).toBe(partyId);

    const checkParty = await fetch('http://localhost:5000/graphql', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        query: `{ partyById(id: "${partyId}") { name } } `,
      }),
    });
    const checkPartyResp = await checkParty.json();

    expect(checkPartyResp.data.partyById.name).toBe(NEW_NAME);
  });

  it('does not allow a user to update another users party/profile', async () => {
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
    // create an additional account
    const otherPrivKey = PrivKeySecp256k1.generateRandomKey();
    const otherPubKey = otherPrivKey.getPubKey();
    const otherAddr = new Bech32Address(otherPubKey.getAddress()).toBech32(
      'regen',
    );
    await performLogin(otherPrivKey, otherPubKey, otherAddr, emptyNonce);

    // as the first user look up the party of the other user...
    const query = await fetch('http://localhost:5000/graphql', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        query: `{ walletByAddr(addr: "${otherAddr}") { id partyByWalletId { id } } }`,
      }),
    });
    const result = await query.json();
    const partyId = result.data.walletByAddr.partyByWalletId.id;

    const NEW_NAME = 'FOO BAR';
    // try to update the other users party as the first user...
    const update = await fetch('http://localhost:5000/graphql', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        operationName: 'UpdatePartyById',
        variables: {
          input: {
            id: partyId,
            partyPatch: {
              name: NEW_NAME,
            },
          },
        },
        query:
          'mutation UpdatePartyById($input: UpdatePartyByIdInput!) { updatePartyById(input: $input) { party { id } } }',
      }),
    });
    const updResp = await update.json();
    expect(updResp.errors[0].message).toBe(
      "No values were updated in collection 'parties' because no values you can update were found matching these criteria.",
    );
    expect(updResp.data.updatePartyById).toBe(null);
  });
});
