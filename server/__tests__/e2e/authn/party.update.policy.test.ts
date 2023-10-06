import fetch from 'node-fetch';
import { createNewUserAndLogin, getMarketplaceURL } from '../../utils';

describe('party update policies', () => {
  it('allow a user to update a party/profile that belongs to them', async () => {
    const { authHeaders, userAddr } = await createNewUserAndLogin();

    const query = await fetch(`${getMarketplaceURL()}/graphql`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        query: '{ getCurrentParty { id } }',
      }),
    });
    const result = await query.json();
    const partyId = result.data.getCurrentParty.id;

    const NEW_NAME = 'FOO BAR';
    const update = await fetch(`${getMarketplaceURL()}/graphql`, {
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

    const checkParty = await fetch(`${getMarketplaceURL()}/graphql`, {
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
    const { authHeaders } = await createNewUserAndLogin();
    // create an additional account
    const { userAddr: otherAddr } = await createNewUserAndLogin();

    // as the first user look up the party of the other user...
    const query = await fetch(`${getMarketplaceURL()}/graphql`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        query: `{ partyByAddr(addr: "${otherAddr}") { id } }`,
      }),
    });
    const result = await query.json();
    const partyId = result.data.partyByAddr.id;

    const NEW_NAME = 'FOO BAR';
    // try to update the other users party as the first user...
    const update = await fetch(`${getMarketplaceURL()}/graphql`, {
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

  it('allow a user to update a party/profile that he/she created', async () => {
    const { authHeaders } = await createNewUserAndLogin();

    const partyIdQuery = await fetch(`${getMarketplaceURL()}/graphql`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        query: `{ getCurrentParty { id } }`,
      }),
    });
    const partyIdResult = await partyIdQuery.json();

    // Create a party
    const createQuery = await fetch(`${getMarketplaceURL()}/graphql`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        operationName: 'CreateParty',
        variables: {
          input: {
            party: {
              type: 'USER',
              creatorId: partyIdResult.data.getCurrentParty.id,
            },
          },
        },
        query:
          'mutation CreateParty($input: CreatePartyInput!) { createParty(input: $input) { party { id } } }',
      }),
    });
    const createResp = await createQuery.json();
    const newPartyId = createResp.data.createParty.party.id;

    const NEW_NAME = 'FOO BAR';
    const update = await fetch(`${getMarketplaceURL()}/graphql`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        operationName: 'UpdatePartyById',
        variables: {
          input: {
            id: newPartyId,
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

    expect(returnedPartyId).toBe(newPartyId);

    const checkParty = await fetch(`${getMarketplaceURL()}/graphql`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        query: `{ partyById(id: "${newPartyId}") { name } } `,
      }),
    });
    const checkPartyResp = await checkParty.json();

    expect(checkPartyResp.data.partyById.name).toBe(NEW_NAME);
  });
});
