import { pubkeyToAddress, decodeSignature } from '@cosmjs/amino';
import { verifyADR36Amino } from '@keplr-wallet/cosmos';
import * as express from 'express';
import passport from 'passport';
import { PoolClient } from 'pg';
import { pgPool } from 'common/pool';
import { User } from '../types';
import {
  InvalidSignature,
  InvalidLoginParameter,
  InvalidQueryParam,
  NotFoundError,
} from '../errors';
import { doubleCsrfProtection } from '../middleware/csrf';
import { ensureLoggedIn } from '../middleware/passport';
import { genArbitraryAddAddressData } from '../middleware/keplrStrategy';

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

web3auth.post(
  '/logout',
  doubleCsrfProtection,
  ensureLoggedIn(),
  (req, res, next) => {
    req.logout(err => {
      if (err) {
        next(err);
      }
    });
    return res.send({
      message: 'You have been logged out!',
    });
  },
);

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
    let client: undefined | PoolClient = undefined;
    try {
      client = await pgPool.connect();
      const result = await client.query(
        'select nonce from party where addr=$1',
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
