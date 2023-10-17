import * as express from 'express';
import passport from 'passport';
import {
  magicLoginStrategy,
  MAGIC_LOGIN_CALLBACK_URL,
} from '../middleware/magicLoginStrategy';
import { doubleCsrfProtection } from '../middleware/csrf';
import { GOOGLE_CALLBACK_URL } from '../middleware/googleStrategy';
import { InvalidLoginParameter } from '../errors';
import { PoolClient } from 'pg';
import { pgPool } from 'common/pool';
import { runnerPromise } from '../runner';
import { Runner } from 'graphile-worker';

let runner: Runner | undefined;
runnerPromise.then(res => {
  runner = res;
});

const router = express.Router();

router.post('/magiclogin', doubleCsrfProtection, magicLoginStrategy.send);

router.get(
  MAGIC_LOGIN_CALLBACK_URL,
  passport.authenticate('magiclogin'),
  (req, res) => {
    res.redirect(`${process.env.MARKETPLACE_APP_URL}/profile`);
  },
);

router.get('/google', passport.authenticate('google', { scope: ['email'] }));

router.get(
  GOOGLE_CALLBACK_URL,
  passport.authenticate('google', {
    failureRedirect: process.env.MARKETPLACE_APP_URL,
  }),
  function (req, res) {
    res.redirect(`${process.env.MARKETPLACE_APP_URL}/profile`);
  },
);

router.post('/passcode', doubleCsrfProtection, async (req, res, next) => {
  let client: PoolClient;
  try {
    const { email } = req.body;
    if (!email) {
      throw new InvalidLoginParameter('invalid email parameter');
    }
    client = await pgPool.connect();

    // Delete unconsumed passcodes for the given email
    await client.query(
      'delete from private.passcode where email = $1 and consumed = false',
      [email],
    );

    // Create new passcode
    const passcodeResp = await client.query(
      'insert into private.passcode (email) values ($1) returning code',
      [email],
    );
    const passcode = passcodeResp.rows[0].code;

    // Send email with this passcode
    if (runner) {
      await runner.addJob('send_email', {
        options: {
          to: email,
          subject: 'Sign in to Regen Marketplace',
        },
        template: 'login_with_passcode.mjml',
        variables: {
          passcode,
          expiresIn: process.env.PASSCODE_EXPIRES_IN,
        },
      });
      res.send(200);
    }
  } catch (err) {
    return next(err);
  } finally {
    if (client) {
      client.release();
    }
  }
});

router.post(
  '/passcode/verify',
  doubleCsrfProtection,
  passport.authenticate('passcode'),
  (req, res) => {
    return res.send({
      user: req.user,
      message: 'You have been signed in via email!',
    });
  },
);

export default router;
