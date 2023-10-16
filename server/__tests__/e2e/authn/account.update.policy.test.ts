import fetch from 'node-fetch';
import {
  createNewUser,
  createNewUserAndLogin,
  getMarketplaceURL,
  performLogin,
} from '../../utils';

describe('account update policies', () => {
  it('allow a user to update an account that belongs to them', async () => {
    const { authHeaders } = await createNewUserAndLogin();

    const query = await fetch(`${getMarketplaceURL()}/graphql`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        query: '{ getCurrentAccount { id } }',
      }),
    });
    const result = await query.json();
    const accountId = result.data.getCurrentAccount.id;

    const NEW_NAME = 'FOO BAR';
    const update = await fetch(`${getMarketplaceURL()}/graphql`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        operationName: 'UpdateAccountById',
        variables: {
          input: {
            id: accountId,
            accountPatch: {
              name: NEW_NAME,
            },
          },
        },
        query:
          'mutation UpdateAccountById($input: UpdateAccountByIdInput!) { updateAccountById(input: $input) { account { id } } }',
      }),
    });
    const updResp = await update.json();
    const { id: returnedAccountId } = updResp.data.updateAccountById.account;

    expect(returnedAccountId).toBe(accountId);

    const checkAccount = await fetch(`${getMarketplaceURL()}/graphql`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        query: `{ accountById(id: "${accountId}") { name } } `,
      }),
    });
    const checkAccountResp = await checkAccount.json();

    expect(checkAccountResp.data.accountById.name).toBe(NEW_NAME);
  });

  it('does not allow a user to update another users account', async () => {
    const { authHeaders } = await createNewUserAndLogin();
    // create an additional account
    const { userAddr: otherAddr } = await createNewUserAndLogin();

    // as the first user look up the account of the other user...
    const query = await fetch(`${getMarketplaceURL()}/graphql`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        query: `{ accountByAddr(addr: "${otherAddr}") { id } }`,
      }),
    });
    const result = await query.json();
    const accountId = result.data.accountByAddr.id;

    const NEW_NAME = 'FOO BAR';
    // try to update the other users account as the first user...
    const update = await fetch(`${getMarketplaceURL()}/graphql`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        operationName: 'UpdateAccountById',
        variables: {
          input: {
            id: accountId,
            accountPatch: {
              name: NEW_NAME,
            },
          },
        },
        query:
          'mutation UpdateAccountById($input: UpdateAccountByIdInput!) { updateAccountById(input: $input) { account { id } } }',
      }),
    });
    const updResp = await update.json();
    expect(updResp.errors[0].message).toBe(
      "No values were updated in collection 'accounts' because no values you can update were found matching these criteria.",
    );
    expect(updResp.data.updateAccountById).toBe(null);
  });

  it('allow a user to update an account that he/she created', async () => {
    const { authHeaders } = await createNewUserAndLogin();

    const accountIdQuery = await fetch(`${getMarketplaceURL()}/graphql`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        query: `{ getCurrentAccount { id } }`,
      }),
    });
    const accountIdResult = await accountIdQuery.json();

    // Create an account
    const createQuery = await fetch(`${getMarketplaceURL()}/graphql`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        operationName: 'CreateAccount',
        variables: {
          input: {
            account: {
              type: 'USER',
              creatorId: accountIdResult.data.getCurrentAccount.id,
            },
          },
        },
        query:
          'mutation CreateAccount($input: CreateAccountInput!) { createAccount(input: $input) { account { id } } }',
      }),
    });
    const createResp = await createQuery.json();
    const newAccountId = createResp.data.createAccount.account.id;

    const NEW_NAME = 'FOO BAR';
    const update = await fetch(`${getMarketplaceURL()}/graphql`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        operationName: 'UpdateAccountById',
        variables: {
          input: {
            id: newAccountId,
            accountPatch: {
              name: NEW_NAME,
            },
          },
        },
        query:
          'mutation UpdateAccountById($input: UpdateAccountByIdInput!) { updateAccountById(input: $input) { account { id } } }',
      }),
    });
    const updResp = await update.json();
    const { id: returnedAccountId } = updResp.data.updateAccountById.account;

    expect(returnedAccountId).toBe(newAccountId);

    const checkAccount = await fetch(`${getMarketplaceURL()}/graphql`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        query: `{ accountById(id: "${newAccountId}") { name } } `,
      }),
    });
    const checkAccountResp = await checkAccount.json();

    expect(checkAccountResp.data.accountById.name).toBe(NEW_NAME);
  });

  it('disallow a user to update an account that he/she created BUT has since been logged in with...', async () => {
    const { authHeaders } = await createNewUserAndLogin();

    const accountIdQuery = await fetch(`${getMarketplaceURL()}/graphql`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        query: `{ getCurrentAccount { id } }`,
      }),
    });
    const accountIdResult = await accountIdQuery.json();

    // create user with an address and key-pair
    const user = await createNewUser();
    // Create an account with the users address specified
    const createQuery = await fetch(`${getMarketplaceURL()}/graphql`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        operationName: 'CreateAccount',
        variables: {
          input: {
            account: {
              type: 'USER',
              creatorId: accountIdResult.data.getCurrentAccount.id,
              addr: user.userAddr,
            },
          },
        },
        query:
          'mutation CreateAccount($input: CreateAccountInput!) { createAccount(input: $input) { account { id nonce } } }',
      }),
    });
    const createResp = await createQuery.json();
    const newAccountId = createResp.data.createAccount.account.id;

    // login with the user...
    const { nonce } = createResp.data.createAccount.account;
    await performLogin(user.userPrivKey, user.userPubKey, user.userAddr, nonce);

    const NEW_NAME = 'FOO BAR';
    const update = await fetch(`${getMarketplaceURL()}/graphql`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        operationName: 'UpdateAccountById',
        variables: {
          input: {
            id: newAccountId,
            accountPatch: {
              name: NEW_NAME,
            },
          },
        },
        query:
          'mutation UpdateAccountById($input: UpdateAccountByIdInput!) { updateAccountById(input: $input) { account { id } } }',
      }),
    });
    const updResp = await update.json();
    expect(updResp.errors[0]).toHaveProperty(
      'message',
      "No values were updated in collection 'accounts' because no values you can update were found matching these criteria.",
    );
  });
});
