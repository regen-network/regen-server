import { Strategy } from 'passport-google-oauth20';
import { PoolClient } from 'pg';
import { pgPool } from 'common/pool';

export const GOOGLE_CALLBACK_URL = '/google/callback';

export const googleStrategy = new Strategy(
  {
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: `/marketplace/v1/auth${GOOGLE_CALLBACK_URL}`,
  },
  async function (accessToken, refreshToken, profile, callback) {
    const { id: googleId, emails } = profile;
    let client: PoolClient;

    try {
      const [{ value: email, verified }] = emails;
      client = await pgPool.connect();
      const id = await verifyGoogleAccount({
        email,
        verified,
        googleId,
        client,
      });
      if (id) {
        callback(null, { id });
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
 * @param verifyParams.client The pg PoolClient
 * @returns Promise<accountId>
 */
export async function verifyGoogleAccount({
  email,
  verified,
  googleId,
  client,
}: VerifyParams) {
  try {
    // Adding the toString() conversion here,
    // because even though passport-google-oauth20 expects a string 'true' or 'false',
    // in practice, we get a boolean
    if (verified.toString() !== 'true') {
      throw new Error('Email not verified');
    }

    const emailAccountQuery = await client.query(
      'select id from account where email = $1 and google is null',
      [email],
    );
    const googleAccountQuery = await client.query(
      'select id from account where google = $1',
      [googleId],
    );
    const existingUserWithEmail = emailAccountQuery.rowCount === 1;
    if (existingUserWithEmail || googleAccountQuery.rowCount === 1) {
      if (existingUserWithEmail) {
        // Set google id for existing user
        const [{ id }] = emailAccountQuery.rows;
        await client.query('update account set google = $1 where email = $2', [
          googleId,
          email,
        ]);
        return id;
      } else {
        const [{ id }] = googleAccountQuery.rows;
        return id;
      }
    } else {
      const createAccountQuery = await client.query(
        'insert into account (type, email, google) values ($1, $2, $3) returning id',
        ['user', email, googleId],
      );
      if (createAccountQuery.rowCount === 1) {
        const [{ id }] = createAccountQuery.rows;
        await client.query('select private.create_auth_user($1)', [id]);
        return id;
      }
    }
  } catch (err) {
    throw new Error(err);
  }
}
