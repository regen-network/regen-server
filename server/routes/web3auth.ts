import * as express from 'express';
import passport from 'passport';

export const web3auth = express.Router();

web3auth.use('/login', passport.authenticate('keplr'), (req, res) => {
  return res.send({
    user: req.user,
    message: 'You have been signed in via keplr!',
  });
});

web3auth.post('/logout', (req, res, next) => {
  req.logout(function (err) {
    if (err) {
      return next(err);
    } else {
      return res.send({
        message: 'You have been logged out!',
      });
    }
  });
});
