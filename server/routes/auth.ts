import * as express from 'express';
import passport from 'passport';
import {
  magicLogin,
  MAGIC_LOGIN_CALLBACK_URL,
} from '../middleware/magicLoginStrategy';

const router = express.Router();

// This is where we POST to from the frontend
router.post('/magiclogin', magicLogin.send);

// The standard passport callback setup
router.get(
  MAGIC_LOGIN_CALLBACK_URL,
  passport.authenticate('magiclogin'),
  (req, res) => {
    console.log('req', req);
    return res.send(200);
  },
);

export default router;
