import MagicLoginStrategy from 'passport-magic-login';
import { runnerPromise } from '../runner';
import { pgPool } from 'common/pool';
import { PoolClient } from 'pg';

let runner;
runnerPromise.then(res => {
  runner = res;
});

export const MAGIC_LOGIN_CALLBACK_URL = '/magiclogin/callback';

export const magicLoginStrategy = new MagicLoginStrategy({
  // Used to encrypt the authentication token. Needs to be long, unique and (duh) secret.
  secret: process.env.MAGIC_LINK_SECRET,

  callbackUrl: `/marketplace/v1/auth${MAGIC_LOGIN_CALLBACK_URL}`,

  sendMagicLink: async (destination, href, verificationCode, req) => {
    if (runner) {
      await runner.addJob('send_email', {
        options: {
          to: destination,
          subject: 'Login with magic link',
        },
        template: 'login_with_magic_link.mjml',
        variables: {
          url: `${req.protocol}://${req.get('host')}${href}`,
          expiresIn: process.env.MAGIC_LINK_JWT_EXPIRES_IN,
        },
      });
    }
  },

  verify: async (payload, callback) => {
    let client: PoolClient;
    try {
      client = await pgPool.connect();
      const accountQuery = await client.query(
        'select id from account where email = $1',
        [payload.destination],
      );
      if (accountQuery.rowCount === 1) {
        const [{ id: accountId }] = accountQuery.rows;
        callback(null, { accountId });
      } else {
        const createAccountQuery = await client.query(
          'insert into account (type, email) values ($1, $2) returning id',
          ['user', payload.destination],
        );
        if (createAccountQuery.rowCount === 1) {
          const [{ id: accountId }] = createAccountQuery.rows;
          await client.query('select private.create_auth_user($1)', [
            accountId,
          ]);
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

  jwtOptions: {
    expiresIn: process.env.MAGIC_LINK_JWT_EXPIRES_IN,
  },
});
