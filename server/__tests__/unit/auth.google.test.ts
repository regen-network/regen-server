import { PoolClient } from 'pg';
import { withRootDb } from '../db/helpers';
import { verifyGoogleAccount } from '../../middleware/googleStrategy';

const email = 'john@doe.com';
const googleId = '12345';
const googleEmail = 'google@email.com';

describe('auth google strategy', () => {
  test('when a user signs in for the first time, a new account and role should be created', async () => {
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
      const insertQuery = await client.query(
        'select * from private.create_new_web2_account($1, $2)',
        ['user', email],
      );
      const [{ create_new_web2_account: newId }] = insertQuery.rows;
      await client.query('select private.create_auth_user($1)', [newId]);

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
  test('when a user signs in, it should throw an error if the email from google is not verified', async () => {
    await withRootDb(async (client: PoolClient) => {
      expect(
        verifyGoogleAccount({ email, verified: 'false', googleId, client }),
      ).rejects.toThrow('Email not verified');
    });
  });
  test('when a logged-in user connects to google, it should update the account google id and google email', async () => {
    await withRootDb(async (client: PoolClient) => {
      const insertQuery = await client.query(
        'select * from private.create_new_web2_account($1, $2)',
        ['user', email],
      );
      const [{ create_new_web2_account: newId }] = insertQuery.rows;
      await client.query('select private.create_auth_user($1)', [newId]);

      const accountId = await verifyGoogleAccount({
        email: googleEmail,
        verified: 'true',
        googleId,
        currentAccountId: newId,
        client,
      });
      const privateAccountQuery = await client.query(
        'SELECT * FROM private.account WHERE id = $1',
        [accountId],
      );
      expect(newId).toEqual(accountId);
      expect(privateAccountQuery.rowCount).toBe(1);
      expect(privateAccountQuery.rows[0].email).toEqual(email);
      expect(privateAccountQuery.rows[0].google_email).toEqual(googleEmail);
      expect(privateAccountQuery.rows[0].google).toEqual(googleId);
    });
  });

  test('when a logged-in user connects to google, it should throw an error if google_email is already used', async () => {
    await withRootDb(async (client: PoolClient) => {
      // Create account with googleEmail
      await verifyGoogleAccount({
        email: googleEmail,
        verified: 'true',
        googleId,
        client,
      });

      // Create another account
      const insertQuery = await client.query(
        'select * from private.create_new_web2_account($1, $2)',
        ['user', email],
      );
      const [{ create_new_web2_account: newId }] = insertQuery.rows;
      await client.query('select private.create_auth_user($1)', [newId]);

      // Try to connect it to google using googleEmail
      expect(
        verifyGoogleAccount({
          email: googleEmail,
          verified: 'true',
          googleId,
          currentAccountId: newId,
          client,
        }),
      ).rejects.toThrow(
        'duplicate key value violates unique constraint "account_google_key"',
      );
    });
  });
});
