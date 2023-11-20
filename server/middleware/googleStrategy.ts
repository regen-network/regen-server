import { Strategy } from 'passport-google-oauth20';
import { PoolClient } from 'pg';
import { pgPool } from 'common/pool';
import { UserRequest } from '../types';

export const GOOGLE_CALLBACK_URL = '/google/callback';

export const googleStrategy = new Strategy(
  {
    clientID: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    callbackURL: `/marketplace/v1/auth${GOOGLE_CALLBACK_URL}`,
    passReqToCallback: true,
  },
  async function (
    req: UserRequest,
    accessToken,
    refreshToken,
    profile,
    callback,
  ) {
    const { id: googleId, emails } = profile;
    let client: PoolClient | null = null;

    try {
      client = await pgPool.connect();
      if (emails) {
        const [{ value: email, verified }] = emails;
        const currentAccountId = req.user?.accountId;
        const accountId = await verifyGoogleAccount({
          email,
          verified,
          googleId,
          currentAccountId,
          client,
        });
        if (accountId) {
          callback(null, { accountId });
        }
      }
    } catch (err) {
      callback(err);
    } finally {
      if (client) {
        client.release();
      }
    }
  },
);

type VerifyParams = {
  email: string;
  verified: 'true' | 'false';
  googleId: string;
  currentAccountId?: string;
  client: PoolClient;
};

/**
 * Verifies that a google account has a verified email,
 * if so, it creates or updates an account in the database if needed
 * and returns the account id
 * @param verifyParams Params for verifyGoogleAccount function
 * @param verifyParams.email The email of the google account
 * @param verifyParams.verified The verified state of the google account email
 * @param verifyParams.googleId The id of the google account
 * @param verifyParams.currentAccountId The id of the currently logged in account if any
 * @param verifyParams.client The pg PoolClient
 * @returns Promise<accountId>
 */
export async function verifyGoogleAccount({
  email,
  verified,
  googleId,
  currentAccountId,
  client,
}: VerifyParams) {
  // Adding the toString() conversion here,
  // because even though passport-google-oauth20 expects a string 'true' or 'false',
  // in practice, we get a boolean
  if (verified.toString() !== 'true') {
    throw new Error('Email not verified');
  }

  // There's already a currently logged in account,
  // so this is a request to connect the current account to google
  if (currentAccountId) {
    await client.query(
      'update private.account set google = $1, google_email = $2 where id = $3',
      [googleId, email, currentAccountId],
    );
    return currentAccountId;
  } else {
    // Log in request
    const emailAccountQuery = await client.query(
      'select id from private.account where email = $1 and google is null',
      [email],
    );
    const googleAccountQuery = await client.query(
      'select id from private.account where google = $1',
      [googleId],
    );
    const existingUserWithEmail = emailAccountQuery.rowCount === 1;
    if (existingUserWithEmail || googleAccountQuery.rowCount === 1) {
      if (existingUserWithEmail) {
        // Set google id ang google email for existing user
        const [{ id: accountId }] = emailAccountQuery.rows;
        await client.query(
          'update private.account set google = $1, google_email = $2 where email = $2',
          [googleId, email],
        );
        return accountId;
      } else {
        const [{ id: accountId }] = googleAccountQuery.rows;
        return accountId;
      }
    } else {
      const createAccountQuery = await client.query(
        'select * from private.create_new_web2_account($1, $2, $3)',
        ['user', email, googleId],
      );
      if (createAccountQuery.rowCount === 1) {
        const [{ create_new_web2_account: accountId }] =
          createAccountQuery.rows;
        await client.query('select private.create_auth_user($1)', [accountId]);
        return accountId;
      }
    }
  }
}
