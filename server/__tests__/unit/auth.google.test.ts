import { PoolClient } from 'pg';
import { createAccountWithAuthUser, withRootDb } from '../db/helpers';
import { verifyGoogleAccount } from '../../middleware/googleStrategy';
import { createWeb2Account, genRandomRegenAddress } from '../utils';
import { connectGoogleAccount } from '../../middleware/connectGoogleStrategy';

const email = 'john@doe.com';
const googleId = '12345';

describe('auth google strategy', () => {
  test('when a user signs in for the first time, a new account and role should be created with email and google_email set to the same email', async () => {
    await withRootDb(async (client: PoolClient) => {
      const accountId = await verifyGoogleAccount({
        email,
        verified: 'true',
        googleId,
        client,
      });
      const accountQuery = await client.query(
        'SELECT * FROM account WHERE id = $1',
        [accountId],
      );
      expect(accountQuery.rowCount).toBe(1);

      const privateAccountQuery = await client.query(
        'SELECT * FROM private.account WHERE id = $1',
        [accountId],
      );
      expect(privateAccountQuery.rowCount).toBe(1);
      expect(privateAccountQuery.rows[0].email).toEqual(email);
      expect(privateAccountQuery.rows[0].google_email).toEqual(email);
      expect(privateAccountQuery.rows[0].google).toEqual(googleId);

      const roleQuery = await client.query(
        'SELECT 1 FROM pg_roles WHERE rolname = $1',
        [accountId],
      );
      expect(roleQuery.rowCount).toBe(1);
    });
  });
  test('when an existing user signs in with google for the first time, it should update the account with the same email', async () => {
    await withRootDb(async (client: PoolClient) => {
      const newId = await createWeb2Account({ client, email });

      const accountId = await verifyGoogleAccount({
        email,
        verified: 'true',
        googleId,
        client,
      });
      const privateAccountQuery = await client.query(
        'SELECT * FROM private.account WHERE id = $1',
        [accountId],
      );
      expect(newId).toEqual(accountId);
      expect(privateAccountQuery.rowCount).toBe(1);
      expect(privateAccountQuery.rows[0].email).toEqual(email);
      expect(privateAccountQuery.rows[0].google_email).toEqual(email);
      expect(privateAccountQuery.rows[0].google).toEqual(googleId);
    });
  });
  test('when an existing user signs in, it should verify the existing account', async () => {
    await withRootDb(async (client: PoolClient) => {
      const insertQuery = await client.query(
        'select * from private.create_new_web2_account($1, $2, $3)',
        ['user', email, googleId],
      );
      const [{ create_new_web2_account: newId }] = insertQuery.rows;
      await client.query('select private.create_auth_user($1)', [newId]);

      const accountId = await verifyGoogleAccount({
        email,
        verified: 'true',
        googleId,
        client,
      });
      expect(newId).toEqual(accountId);
    });
  });
  test('when a web3 user connected to google signs in with google using an email that is used as main email by another account, it should log the web3 account in', async () => {
    await withRootDb(async (client: PoolClient) => {
      // Create a web2 account with main email
      await createWeb2Account({ client, email });

      // Create a web3 account
      const walletAddr = genRandomRegenAddress();
      const { accountId } = await createAccountWithAuthUser(client, walletAddr);

      // Connect it to google with the same email as above
      await connectGoogleAccount({
        email,
        verified: 'true',
        googleId,
        accountId,
        client,
      });

      // Log in successfully to the web3 account using google
      const verifiedAccountId = await verifyGoogleAccount({
        email,
        verified: 'true',
        googleId,
        client,
      });
      expect(verifiedAccountId).toEqual(accountId);
    });
  });
  test('when a user signs in, it should throw an error if the email from google is not verified', async () => {
    await withRootDb(async (client: PoolClient) => {
      expect(
        verifyGoogleAccount({ email, verified: 'false', googleId, client }),
      ).rejects.toThrow('Email not verified');
    });
  });
});
