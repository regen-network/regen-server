import { PoolClient } from 'pg';
import { withRootDb } from '../db/helpers';
import { verifyGoogleAccount } from '../../middleware/googleStrategy';

const email = 'john@doe.com';
const googleId = '12345';

describe('auth google strategy verifyGoogleAccount', () => {
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
      expect(accountQuery.rows[0].email).toEqual(email);
      expect(accountQuery.rows[0].google).toEqual(googleId);

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
        'INSERT INTO account (type, email) values ($1, $2) returning id',
        ['user', email],
      );
      const [{ id: newId }] = insertQuery.rows;
      await client.query('select private.create_auth_user($1)', [newId]);

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
      expect(newId).toEqual(accountId);
      expect(accountQuery.rowCount).toBe(1);
      expect(accountQuery.rows[0].email).toEqual(email);
      expect(accountQuery.rows[0].google).toEqual(googleId);
    });
  });
  test('when an existing user signs in, it should verifyGoogleAccount the existing account', async () => {
    await withRootDb(async (client: PoolClient) => {
      const insertQuery = await client.query(
        'INSERT INTO account (type, email, google) values ($1, $2, $3) returning id',
        ['user', email, googleId],
      );
      const [{ id: newId }] = insertQuery.rows;
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
});
