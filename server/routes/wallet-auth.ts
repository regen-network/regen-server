import { pubkeyToAddress, decodeSignature, StdSignature } from '@cosmjs/amino';
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
import { genArbitraryConnectWalletData } from '../middleware/keplrStrategy';
import { UserRequest } from '../types';

export const walletAuth = express.Router();

walletAuth.use(
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

walletAuth.post(
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

walletAuth.get('/nonce', async (req, res, next) => {
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

walletAuth.post(
  '/connect-wallet',
  doubleCsrfProtection,
  ensureLoggedIn(),
  async (req: UserRequest, res, next) => {
    let client: PoolClient | null = null;
    try {
      client = await pgPool.connect();
      const { signature } = req.body;
      const accountId = req.user?.accountId;
      await connectWallet({ signature, accountId, client });
      res.send({ message: 'Wallet address successfully connected' });
    } catch (err) {
      return next(err);
    } finally {
      if (client) {
        client.release();
      }
    }
  },
);

type ConnectWalletParams = {
  signature?: StdSignature;
  accountId?: string;
  client: PoolClient;
};

/**
 * Connects a wallet address to an existing account if the provided signature is verified.
 * @param connectWalletParams Params for connectWallet function
 * @param connectWalletParams.signature The signature that will be verified
 * @param connectWalletParams.accountId The id of the account to connect the wallet address to
 * @param connectWalletParams.client The pg PoolClient
 * @returns Promise<void>
 */
export async function connectWallet({
  signature,
  accountId,
  client,
}: ConnectWalletParams) {
  if (!signature) {
    throw new InvalidLoginParameter('Invalid signature parameter');
  }
  const address = pubkeyToAddress(signature.pub_key, 'regen');
  const accountByAddr = await client.query(
    'select id, nonce from account where addr = $1',
    [address],
  );

  if (accountByAddr.rowCount === 1) {
    throw new Conflict('Wallet address used by another account');
  } else {
    const accountById = await client.query(
      'select nonce from account where id = $1',
      [accountId],
    );
    if (accountById.rowCount === 1) {
      const nonce = accountById.rows[0].nonce;
      const { pubkey: decodedPubKey, signature: decodedSignature } =
        decodeSignature(signature);
      const data = genArbitraryConnectWalletData(nonce);
      // generate a new nonce for the user to invalidate the current
      // signature...
      await client.query(
        `update account set nonce = encode(sha256(gen_random_bytes(256)), 'hex') where id = $1`,
        [accountId],
      );
      const verified = verifyADR36Amino(
        'regen',
        address,
        data,
        decodedPubKey,
        decodedSignature,
      );
      if (verified) {
        await client.query('update account set addr = $1 where id = $2', [
          address,
          accountId,
        ]);
      } else {
        throw new UnauthorizedError('Invalid signature');
      }
    } else {
      throw new UnauthorizedError('Account not found for the given id');
    }
  }
}
