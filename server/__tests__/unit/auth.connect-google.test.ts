import { PoolClient } from 'pg';

import { connectGoogleAccount } from '../../middleware/connectGoogleStrategy';
import { withRootDb } from '../db/helpers';
import { createAccountWithEmail } from '../utils';
import { UnauthorizedError } from '../../errors';
import { verifyGoogleAccount } from '../../middleware/googleStrategy';

const email = 'john@doe.com';
const googleId = '12345';
const googleEmail = 'google@email.com';

describe('auth connect google strategy', () => {
  test('when a logged-in user connects to google, it should update the account google id and google email', async () => {
    await withRootDb(async (client: PoolClient) => {
      const accountId = await createAccountWithEmail(client, email);

      await connectGoogleAccount({
        email: googleEmail,
        verified: 'true',
        googleId,
        accountId,
        client,
      });
      const privateAccountQuery = await client.query(
        'SELECT * FROM private.account WHERE id = $1',
        [accountId],
      );
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
      const accountId = await createAccountWithEmail(client, email);

      // Try to connect it to google using googleEmail
      await expect(
        connectGoogleAccount({
          email: googleEmail,
          verified: 'true',
          googleId,
          accountId,
          client,
        }),
      ).rejects.toThrow(
        'duplicate key value violates unique constraint "account_google_key"',
      );
    });
  });
  test('when a logged-in user connects to google, it should throw an error if the email from google is not verified', async () => {
    await withRootDb(async (client: PoolClient) => {
      const accountId = await createAccountWithEmail(client, email);

      expect(
        connectGoogleAccount({
          email,
          verified: 'false',
          googleId,
          accountId,
          client,
        }),
      ).rejects.toThrow('Email not verified');
    });
  });
  test("when there's no logged-in user, it should throw an error", async () => {
    await withRootDb(async (client: PoolClient) => {
      expect(
        connectGoogleAccount({
          email,
          verified: 'true',
          googleId,
          client,
        }),
      ).rejects.toThrow(new UnauthorizedError('No logged-in user'));
    });
  });
});
