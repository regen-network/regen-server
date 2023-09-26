import * as express from 'express';
import passport from 'passport';
import {
  magicLogin,
  MAGIC_LOGIN_CALLBACK_URL,
} from '../middleware/magicLoginStrategy';

const router = express.Router();

router.post('/magiclogin', magicLogin.send);

router.get(
  MAGIC_LOGIN_CALLBACK_URL,
  passport.authenticate('magiclogin'),
  (req, res) => {
    res.redirect(`${process.env.MARKETPLACE_APP_URL}/profile`);
  },
);

export default router;
