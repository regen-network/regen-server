import MagicLoginStrategy from 'passport-magic-login';
import { runnerPromise } from '../runner';
import { pgPool } from 'common/pool';
import { PoolClient } from 'pg';

let runner;
runnerPromise.then(res => {
  runner = res;
});

export const MAGIC_LOGIN_CALLBACK_URL = '/magiclogin/callback';

export const magicLogin = new MagicLoginStrategy({
  // Used to encrypt the authentication token. Needs to be long, unique and (duh) secret.
  secret: process.env.MAGIC_LINK_SECRET,

  callbackUrl: `/marketplace/v1/auth${MAGIC_LOGIN_CALLBACK_URL}`,

  sendMagicLink: async (destination, href, verificationCode, req) => {
    if (runner) {
      await runner.addJob('send_email', {
        options: {
          to: destination,
          subject: 'Login with magic link',
          text: `Click this link to finish logging in: ${
            req.protocol
          }://${req.get('host')}${href}`,
        },
      });
    }
  },

  verify: async (payload, callback) => {
    let client: PoolClient;
    try {
      client = await pgPool.connect();
      const partyQuery = await client.query(
        'select id from party where email = $1',
        [payload.destination],
      );
      if (partyQuery.rowCount === 1) {
        const [{ id }] = partyQuery.rows;
        callback(null, { id });
      } else {
        // TODO (#375): we'll need to adjust how we define roles/session variables in the db because right now,
        // they are based on wallet address that we don't necessarily have here for email based-login.
        // For now, we just create a new entry in the party table but we'll need to create a db role as well
        // if we want to continue using the db role approach along with our RLS policies.
        const createPartyQuery = await client.query(
          'insert into party (type, email) values ($1, $2) returning id',
          ['user', payload.destination],
        );
        if (createPartyQuery.rowCount === 1) {
          const [{ id: createdPartyId }] = createPartyQuery.rows;
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

  jwtOptions: {
    expiresIn: process.env.MAGIC_LINK_JWT_EXPIRES_IN,
  },
});
