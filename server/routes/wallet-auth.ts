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
      req.session = null;
      if (err) {
        next(err);
      } else {
        return res.send({
          message: 'You have been logged out!',
        });
      }
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

walletAuth.post(
  '/merge-accounts',
  doubleCsrfProtection,
  ensureLoggedIn(),
  async (req: UserRequest, res, next) => {
    let client: PoolClient | null = null;
    try {
      client = await pgPool.connect();
      const { signature, keepCurrentAccount } = req.body;
      const accountId = req.user?.accountId as string; // we use ensureLoggedIn so current accountId is defined
      const walletAccountId = await mergeAccounts({
        signature,
        accountId,
        keepCurrentAccount,
        client,
      });
      if (!keepCurrentAccount && walletAccountId) {
        if (req.session) {
          req.session.activeAccountId = walletAccountId;
          req.session.authenticatedAccountIds = [walletAccountId];
        }
        await new Promise<void>((resolve, reject) => {
          req.login({ accountId: walletAccountId }, err => {
            if (err) reject(err);
            else resolve();
          });
        });
      }
      res.send({ message: 'Account successfully merged' });
    } catch (err) {
      return next(err);
    } finally {
      if (client) {
        client.release();
      }
    }
  },
);

type MergeAccountsParams = {
  signature?: StdSignature;
  accountId: string;
  keepCurrentAccount: boolean;
  client: PoolClient;
};

/**
 * Merges 2 accounts, the current web2 account and an existing web3 account, and all data associated to them
 * @param mergeAccountsParams Params for mergeAccounts function
 * @param mergeAccountsParams.signature The signature that will be verified, corresponds to the account address to be merged
 * @param mergeAccountsParams.accountId The current account id
 * @param mergeAccountsParams.keepCurrentAccount Boolean to indicate whether to merge account data into the current account or the web3 account
 * @param mergeAccountsParams.client The pg PoolClient
 * @returns Promise<void>
 */
export async function mergeAccounts({
  signature,
  accountId,
  keepCurrentAccount,
  client,
}: MergeAccountsParams) {
  if (!signature) {
    throw new InvalidLoginParameter('Invalid signature parameter');
  }
  const address = pubkeyToAddress(signature.pub_key, 'regen');
  const accountByAddr = await client.query(
    'select id from account where addr = $1',
    [address],
  );

  if (accountByAddr.rowCount !== 1) {
    throw new UnauthorizedError('No account with the given wallet address');
  } else {
    const walletAccountId = accountByAddr.rows[0].id;
    const privWalletAccount = await client.query(
      'select email, google, google_email from private.account where id = $1',
      [walletAccountId],
    );
    if (privWalletAccount.rowCount === 1) {
      const { email, google, google_email } = privWalletAccount.rows[0];
      if (email || google || google_email)
        throw new UnauthorizedError(
          'Account with the given wallet address already has email or google associated to it',
        );
    }

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
        if (keepCurrentAccount) {
          // Migrate web3 account data to current account
          await migrateAccountData({
            keepCurrentAccount,
            toAccountId: accountId,
            fromAccountId: walletAccountId,
            client,
          });
          await client.query('update account set addr = $1 where id = $2', [
            address,
            accountId,
          ]);
        } else {
          // Migrate current account data to web3 account
          await migrateAccountData({
            keepCurrentAccount,
            toAccountId: walletAccountId,
            fromAccountId: accountId,
            client,
          });
        }
        return walletAccountId;
      } else {
        throw new UnauthorizedError('Invalid signature');
      }
    } else {
      throw new UnauthorizedError('Account not found for the given id');
    }
  }
}

type MigrateAccountDataParams = {
  keepCurrentAccount: boolean;
  toAccountId: string;
  fromAccountId: string;
  client: PoolClient;
};

async function migrateAccountData({
  keepCurrentAccount,
  toAccountId,
  fromAccountId,
  client,
}: MigrateAccountDataParams) {
  await client.query(
    'update account set creator_id = $1 where creator_id = $2',
    [toAccountId, fromAccountId],
  );
  await client.query(
    'update credit_class set registry_id = $1 where registry_id = $2',
    [toAccountId, fromAccountId],
  );
  await client.query(
    'update upload set account_id = $1 where account_id = $2',
    [toAccountId, fromAccountId],
  );
  await client.query(
    'update post set creator_account_id = $1 where creator_account_id = $2',
    [toAccountId, fromAccountId],
  );
  await client.query(
    'update organization set account_id = $1 where account_id = $2',
    [toAccountId, fromAccountId],
  );
  await client.query(
    'update project set admin_account_id = $1 where admin_account_id = $2',
    [toAccountId, fromAccountId],
  );
  await client.query(
    'update project set developer_id = $1 where developer_id = $2',
    [toAccountId, fromAccountId],
  );
  await client.query(
    'update project set verifier_id = $1 where verifier_id = $2',
    [toAccountId, fromAccountId],
  );
  await client.query(
    'update project_partner set account_id = $1 where account_id = $2',
    [toAccountId, fromAccountId],
  );

  if (!keepCurrentAccount) {
    await client.query('delete from private.account where id = $1', [
      toAccountId,
    ]);
    await client.query('update private.account set id = $1 where id = $2', [
      toAccountId,
      fromAccountId,
    ]);
  } else {
    await client.query('delete from private.account where id = $1', [
      fromAccountId,
    ]);
  }

  await client.query('delete from account where id = $1', [fromAccountId]);
  await client.query(`drop role "${fromAccountId}"`);
}
