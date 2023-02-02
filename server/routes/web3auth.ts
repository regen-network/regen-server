import * as express from 'express';
import passport from 'passport';
import { PoolClient } from 'pg';
import { pgPool } from 'common/pool';
import { InvalidQueryParam, NotFoundError } from '../errors';
import { doubleCsrfProtection } from '../middleware/csrf';
import { ensureLoggedIn } from '../middleware/passport';

export const web3auth = express.Router();

web3auth.use(
  '/login',
  doubleCsrfProtection,
  passport.authenticate('keplr'),
  (req, res) => {
    return res.send({
      user: req.user,
      message: 'You have been signed in via keplr!',
    });
  },
);

web3auth.post('/logout', doubleCsrfProtection, ensureLoggedIn(), (req, res) => {
  req.logout();
  return res.send({
    message: 'You have been logged out!',
  });
});

web3auth.get('/nonce', async (req, res, next) => {
  // this endpoint fetches a nonce for a given user by their wallet
  // address. this is a piece of public information so it is ok to
  // have this public.
  if (!req.query.userAddress) {
    const msg = 'Invalid or missing userAddress query parameter';
    console.error(msg);
    const err = new InvalidQueryParam(msg);
    next(err);
  } else {
    let client: PoolClient;
    try {
      client = await pgPool.connect();
      const result = await client.query(
        'select a.nonce from private.get_account_by_addr($1) q join account a on a.id = q.id',
        [req.query.userAddress],
      );
      if (result.rowCount === 0) {
        const msg = 'User not found for the given address';
        console.error(msg);
        const err = new NotFoundError(msg);
        next(err);
      } else {
        const [{ nonce }] = result.rows;
        return res.status(200).send({ nonce });
      }
    } catch (err) {
      next(err);
    } finally {
      if (client) {
        client.release();
      }
    }
  }
});
