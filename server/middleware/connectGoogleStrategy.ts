import { Strategy } from 'passport-google-oauth20';
import { PoolClient } from 'pg';
import { pgPool } from 'common/pool';
import { UserRequest } from '../types';
import { UnauthorizedError } from '../errors';

export const CONNECT_GOOGLE_CALLBACK_URL = '/google/connect/callback';

export const connectGoogleStrategy = new Strategy(
  {
    clientID: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    callbackURL: `/marketplace/v1/auth${CONNECT_GOOGLE_CALLBACK_URL}`,
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
        const accountId = req.user?.accountId;
        await connectGoogleAccount({
          email,
          verified,
          googleId,
          accountId,
          client,
        });
        callback(null, { accountId });
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
connectGoogleStrategy.name = 'connect-google';

type ConnectParams = {
  email: string;
  verified: 'true' | 'false';
  googleId: string;
  accountId?: string;
  client: PoolClient;
};

/**
 * Verifies that a google account has a verified email,
 * if so, it creates or updates an account in the database if needed
 * and returns the account id
 * @param connectParams Params for connectGoogleAccount function
 * @param connectParams.email The email of the google account
 * @param connectParams.verified The verified state of the google account email
 * @param connectParams.googleId The id of the google account
 * @param connectParams.accountId The id of the currently logged in account if any
 * @param connectParams.client The pg PoolClient
 * @returns Promise<accountId>
 */
export async function connectGoogleAccount({
  email,
  verified,
  googleId,
  accountId,
  client,
}: ConnectParams) {
  // Adding the toString() conversion here,
  // because even though passport-google-oauth20 expects a string 'true' or 'false',
  // in practice, we get a boolean
  if (verified.toString() !== 'true') {
    throw new Error('Email not verified');
  }

  if (accountId) {
    await client.query(
      'update private.account set google = $1, google_email = $2 where id = $3',
      [googleId, email, accountId],
    );
  } else {
    throw new UnauthorizedError('No logged-in user');
  }
}
