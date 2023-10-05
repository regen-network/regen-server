import * as express from 'express';
import passport from 'passport';
import {
  magicLoginStrategy,
  MAGIC_LOGIN_CALLBACK_URL,
} from '../middleware/magicLoginStrategy';
import { doubleCsrfProtection } from '../middleware/csrf';
import { GOOGLE_CALLBACK_URL } from '../middleware/googleStrategy';

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

export default router;
