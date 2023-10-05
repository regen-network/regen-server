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
    let client: PoolClient;
    const { id: googleId, emails } = profile;
    try {
      client = await pgPool.connect();
      const [{ value: email, verified }] = emails;
      if (!verified) {
        callback(new Error('Email not verified'));
      }
      const emailPartyQuery = await client.query(
        'select id from party where email = $1 and google is null',
        [email],
      );
      const googlePartyQuery = await client.query(
        'select id from party where google = $1',
        [googleId],
      );
      const existingUserWithEmail = emailPartyQuery.rowCount === 1;
      if (existingUserWithEmail || googlePartyQuery.rowCount === 1) {
        if (existingUserWithEmail) {
          // Set google id for existing user
          const [{ id }] = emailPartyQuery.rows;
          await client.query('update party set google = $1 where email = $2', [
            googleId,
            email,
          ]);
          callback(null, { id });
        } else {
          const [{ id }] = googlePartyQuery.rows;
          callback(null, { id });
        }
      } else {
        const createPartyQuery = await client.query(
          'insert into party (type, email, google) values ($1, $2, $3) returning id',
          ['user', email, googleId],
        );
        if (createPartyQuery.rowCount === 1) {
          const [{ id: createdPartyId }] = createPartyQuery.rows;
          await client.query('select private.create_auth_user($1)', [
            createdPartyId,
          ]);
          callback(null, { id: createdPartyId });
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
