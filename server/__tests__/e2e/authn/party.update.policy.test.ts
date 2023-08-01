import fetch from 'node-fetch';
import { createNewUserAndLogin } from '../../utils';

describe('party update policies', () => {
  it('allow a user to update a party/profile that belongs to them', async () => {
    const { authHeaders, userAddr } = await createNewUserAndLogin();

    const query = await fetch('http://localhost:5000/marketplace/v1/graphql', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        query: `{ walletByAddr(addr: "${userAddr}") { id partyByWalletId { id } } }`,
      }),
    });
    const result = await query.json();
    const partyId = result.data.walletByAddr.partyByWalletId.id;

    const NEW_NAME = 'FOO BAR';
    const update = await fetch('http://localhost:5000/marketplace/v1/graphql', {
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

    const checkParty = await fetch(
      'http://localhost:5000/marketplace/v1/graphql',
      {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          query: `{ partyById(id: "${partyId}") { name } } `,
        }),
      },
    );
    const checkPartyResp = await checkParty.json();

    expect(checkPartyResp.data.partyById.name).toBe(NEW_NAME);
  });

  it('does not allow a user to update another users party/profile', async () => {
    const { authHeaders } = await createNewUserAndLogin();
    // create an additional account
    const { userAddr: otherAddr } = await createNewUserAndLogin();

    // as the first user look up the party of the other user...
    const query = await fetch('http://localhost:5000/marketplace/v1/graphql', {
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
    const update = await fetch('http://localhost:5000/marketplace/v1/graphql', {
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
