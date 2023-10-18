import * as express from 'express';
import passport from 'passport';
import {
  magicLoginStrategy,
  MAGIC_LOGIN_CALLBACK_URL,
} from '../middleware/magicLoginStrategy';
import { doubleCsrfProtection } from '../middleware/csrf';
import { GOOGLE_CALLBACK_URL } from '../middleware/googleStrategy';
import { ensureLoggedIn } from '../middleware/passport';

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

router.get('/accounts', ensureLoggedIn(), (req, res) => {
  if (!req.session) {
    return res.sendStatus(500).json({ error: 'req.session is falsy' });
  }
  return res.json({
    activeAccountId: req.session.activeAccountId,
    activeAccountIds: req.session.activeAccountIds,
  });
});

router.post('/accounts', doubleCsrfProtection, ensureLoggedIn(), (req, res) => {
  const { accountId } = req.query;
  if (!req.session) {
    return res.sendStatus(500).json({ error: 'req.session is falsy' });
  }
  if (!accountId) {
    return res.status(400).json({ error: 'missing accountId query parameter' });
  }
  if (req.session.activeAccountIds.includes(accountId)) {
    req.session.activeAccountId = accountId;
    return res.json({
      activeAccountId: req.session.activeAccountId,
      activeAccountIds: req.session.activeAccountIds,
    });
  } else {
    return res
      .status(401)
      .json({ error: 'user is not authorized to use the given accountId' });
  }
});

export default router;
