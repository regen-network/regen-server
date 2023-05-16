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
  '/addresses',
  doubleCsrfProtection,
  ensureLoggedIn(),
  async (req, res, next) => {
    try {
      const { signature } = req.body;
      const currentUserId = (req.user as User).id;
      const currentUserAddr = (req.user as User).address;
      if (!signature) {
        throw new InvalidLoginParameter('invalid signature parameter');
      }
      const address = pubkeyToAddress(signature.pub_key, 'regen');
      const client = await pgPool.connect();
      const account = await client.query(
        'select a.id, a.nonce from private.get_account_by_addr($1) q join account a on a.id = q.id',
        [currentUserAddr],
      );
      if (account.rowCount !== 1) {
        throw new NotFoundError('nonce not found');
      }
      const [{ id, nonce }] = account.rows;
      const { pubkey: decodedPubKey, signature: decodedSignature } =
        decodeSignature(signature);
      const data = genArbitraryAddAddressData(nonce);
      await client.query(
        'update account set nonce = md5(gen_random_bytes(256)) where id = $1',
        [id],
      );

      const verified = verifyADR36Amino(
        'regen',
        address,
        data,
        decodedPubKey,
        decodedSignature,
      );
      if (verified) {
        const associatedAccount = await client.query(
          'select id from private.get_account_by_addr($1)',
          [address],
        );
        if (associatedAccount.rowCount === 1) {
          const [{ id: associatedId }] = associatedAccount.rows;
          await client.query(
            'select from private.remove_addr_from_account($1, $2)',
            [associatedId, address],
          );
        }
        await client.query(
          'select from private.add_addr_to_account($1, $2, $3)',
          [currentUserId, address, 'user'],
        );
        return res.status(200).send({ message: 'success' });
      } else {
        throw new InvalidSignature(
          'invalid signature during attempt to add an address',
        );
      }
    } catch (err) {
      next(err);
    }
  },
);

web3auth.post('/logout', doubleCsrfProtection, ensureLoggedIn(), (req, res) => {
  req.logout(err => {
    console.log(err);
  });
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
    let client: undefined | PoolClient = undefined;
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
