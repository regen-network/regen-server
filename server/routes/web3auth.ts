import { pubkeyToAddress, decodeSignature } from '@cosmjs/amino';
import { verifyADR36Amino } from '@keplr-wallet/cosmos';
import * as express from 'express';
import passport from 'passport';
import { PoolClient } from 'pg';
import { pgPool } from 'common/pool';
import {
  Conflict,
  InvalidLoginParameter,
  InvalidQueryParam,
  NotFoundError,
  UnauthorizedError,
} from '../errors';
import { doubleCsrfProtection } from '../middleware/csrf';
import { ensureLoggedIn } from '../middleware/passport';
import { genArbitraryLoginData } from '../middleware/keplrStrategy';

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
        'select nonce from account where addr=$1',
        [req.query.userAddress],
      );
      if (result.rowCount === 0) {
        const msg = 'Account not found for the given address';
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

web3auth.post(
  '/connect-wallet',
  doubleCsrfProtection,
  async (req, res, next) => {
    let client: PoolClient | null = null;
    try {
      const { signature, accountId } = req.body;
      if (!accountId || !signature) {
        throw new InvalidLoginParameter(
          'invalid account id or signature parameter',
        );
      }
      const address = pubkeyToAddress(signature.pub_key, 'regen');
      client = await pgPool.connect();
      const accountByAddr = await client.query(
        'select id, nonce from account where addr = $1',
        [address],
      );
      if (accountByAddr.rowCount === 1) {
        throw new Conflict('Wallet address used by another account');
      } else {
        const accountById = await client.query(
          'select nonce from account where id = $2',
          [accountId],
        );
        if (accountById.rowCount === 1) {
          const nonce = accountById.rows[0].nonce;
          const { pubkey: decodedPubKey, signature: decodedSignature } =
            decodeSignature(signature);
          const data = genArbitraryLoginData(nonce);
          const verified = verifyADR36Amino(
            'regen',
            address,
            data,
            decodedPubKey,
            decodedSignature,
          );
          if (verified) {
            await client.query('update account set addr = $1 where id = $2', [
              accountId,
            ]);
            res.send({ message: 'Wallet address successfully connected' });
          } else {
            throw new UnauthorizedError('Invalid signature');
          }
        } else {
          throw new UnauthorizedError('Account not found for the given id');
        }
      }
    } catch (err) {
      return next(err);
    } finally {
      if (client) {
        client.release();
      }
    }
  },
);
