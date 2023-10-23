import * as express from 'express';
import passport from 'passport';
import { doubleCsrfProtection } from '../middleware/csrf';
import { GOOGLE_CALLBACK_URL } from '../middleware/googleStrategy';
import { PoolClient } from 'pg';
import { pgPool } from 'common/pool';
import { runnerPromise } from '../runner';
import { Runner } from 'graphile-worker';
import { createPasscode } from '../middleware/passcodeStrategy';

let runner: Runner | undefined;
runnerPromise.then(res => {
  runner = res;
});

const router = express.Router();

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
  let client: PoolClient | null = null;
  try {
    client = await pgPool.connect();
    const email = req.body;

    const passcode = await createPasscode({ email, client });

    // Send email with this passcode
    if (runner && passcode) {
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
      res.sendStatus(200);
    } else {
      res.sendStatus(500);
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
