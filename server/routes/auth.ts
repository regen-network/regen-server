import * as env from 'env-var';
import * as express from 'express';
import passport from 'passport';
import { doubleCsrfProtection } from '../middleware/csrf';
import { GOOGLE_CALLBACK_URL } from '../middleware/googleStrategy';
import { ensureLoggedIn } from '../middleware/passport';
import { updateActiveAccounts } from '../middleware/loginHelpers';
import { PoolClient } from 'pg';
import { pgPool } from 'common/pool';
import { runnerPromise } from '../runner';
import { Runner } from 'graphile-worker';
import {
  PASSCODE_EXPIRES_IN_DEFAULT,
  createPasscode,
} from '../middleware/passcodeStrategy';

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
    updateActiveAccounts(req);
    res.redirect(`${process.env.MARKETPLACE_APP_URL}/profile`);
  },
);

router.get('/accounts', ensureLoggedIn(), (req, res) => {
  if (!req.session) {
    return res.sendStatus(500).json({ error: 'req.session is falsy' });
  }
  return res.json({
    activeAccountId: req.session.activeAccountId,
    authenticatedAccountIds: req.session.authenticatedAccountIds,
  });
});

router.post('/accounts', doubleCsrfProtection, ensureLoggedIn(), (req, res) => {
  const { accountId } = req.body;
  if (!req.session) {
    return res.sendStatus(500).json({ error: 'req.session is falsy' });
  }
  if (!accountId) {
    return res.status(400).json({ error: 'missing accountId query parameter' });
  }
  if (req.session.authenticatedAccountIds.includes(accountId)) {
    req.session.activeAccountId = accountId;
    return res.json({
      activeAccountId: req.session.activeAccountId,
      authenticatedAccountIds: req.session.authenticatedAccountIds,
    });
  } else {
    return res
      .status(401)
      .json({ error: 'user is not authorized to use the given accountId' });
  }
});

router.post('/passcode', doubleCsrfProtection, async (req, res, next) => {
  let client: PoolClient | null = null;
  try {
    client = await pgPool.connect();
    const { email } = req.body;

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
          expiresIn: env
            .get('PASSCODE_EXPIRES_IN')
            .default(PASSCODE_EXPIRES_IN_DEFAULT)
            .asString(),
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
