import { createAccountWithAuthUser, withRootDb } from '../db/helpers';
import { PoolClient } from 'pg';
import { connectWallet } from '../../routes/wallet-auth';
import { createNewUser, genSignature } from '../utils';
import {
  Conflict,
  InvalidLoginParameter,
  UnauthorizedError,
} from '../../errors';
import { genArbitraryConnectWalletData } from '../../middleware/keplrStrategy';

describe('wallet-auth connect wallet', () => {
  it('should update the account address and nonce when a verified signature is provided', async () => {
    await withRootDb(async (client: PoolClient) => {
      // inserting some account
      const insQuery = await client.query(
        'INSERT INTO account (type) values ($1) returning id, nonce',
        ['user'],
      );
      const [{ id: accountId, nonce }] = insQuery.rows;

      // generate signature
      const { userPrivKey, userPubKey, userAddr } = await createNewUser();
      const signature = genSignature(
        userPrivKey,
        userPubKey,
        userAddr,
        nonce,
        genArbitraryConnectWalletData(nonce),
      );

      await connectWallet({ signature, accountId, client });

      const accountQuery = await client.query(
        'SELECT * FROM account WHERE id = $1',
        [accountId],
      );

      // account address and nonce have been updated
      expect(accountQuery.rowCount).toBe(1);
      expect(accountQuery.rows[0].addr).toEqual(userAddr);
      expect(accountQuery.rows[0].nonce).not.toEqual(nonce);
    });
  });
  it('should throw an error if signature is not verified', async () => {
    await withRootDb(async (client: PoolClient) => {
      // inserting some account
      const insQuery = await client.query(
        'INSERT INTO account (type) values ($1) returning id, nonce',
        ['user'],
      );
      const [{ id: accountId }] = insQuery.rows;

      // generate signature with invalid nonce '123'
      const { userPrivKey, userPubKey, userAddr } = await createNewUser();
      const signature = genSignature(userPrivKey, userPubKey, userAddr, '123');

      await expect(
        connectWallet({ client, signature, accountId }),
      ).rejects.toThrow(new UnauthorizedError('Invalid signature'));
    });
  });
  it('should throw an error if signature is not provided', async () => {
    await withRootDb(async (client: PoolClient) => {
      await expect(connectWallet({ client })).rejects.toThrow(
        new InvalidLoginParameter('Invalid signature parameter'),
      );
    });
  });
  it('should throw an error if the wallet address is already used by another account', async () => {
    await withRootDb(async (client: PoolClient) => {
      // inserting some account
      const insQuery = await client.query(
        'INSERT INTO account (type) values ($1) returning id, nonce',
        ['user'],
      );
      const [{ id: accountId, nonce }] = insQuery.rows;

      // generate signature for an address already used by another account
      const { userPrivKey, userPubKey, userAddr } = await createNewUser();
      await client.query('INSERT INTO account (type, addr) values ($1, $2)', [
        'user',
        userAddr,
      ]);
      const signature = genSignature(
        userPrivKey,
        userPubKey,
        userAddr,
        nonce,
        genArbitraryConnectWalletData(nonce),
      );

      await expect(
        connectWallet({ client, signature, accountId }),
      ).rejects.toThrow(
        new Conflict(
          'This wallet address is already in use by another account.',
        ),
      );
    });
  });
  it('should throw an error if the wallet address is already used by another account with an email address', async () => {
    await withRootDb(async (client: PoolClient) => {
      // inserting some account
      const insQuery = await client.query(
        'INSERT INTO account (type) values ($1) returning id, nonce',
        ['user'],
      );
      const [{ id: accountId, nonce }] = insQuery.rows;

      // generate signature for an address already used by another account
      const { userPrivKey, userPubKey, userAddr } = await createNewUser();
      const { accountId: walletAccountId } = await createAccountWithAuthUser(
        client,
        userAddr,
      );
      const signature = genSignature(
        userPrivKey,
        userPubKey,
        userAddr,
        nonce,
        genArbitraryConnectWalletData(nonce),
      );

      // set some email and google for the web3 account
      await client.query(
        'update private.account set email = $1, google_email = $2, google = $3 where id = $4',
        [
          'jane.doe@gmail.com',
          'jane.doe@gmail.com',
          'google123',
          walletAccountId,
        ],
      );

      await expect(
        connectWallet({ client, signature, accountId }),
      ).rejects.toThrow(
        new Conflict(
          'You cannot connect your account to this wallet address. This wallet address is already associated with another email address.',
        ),
      );
    });
  });
  it('should throw an error if the account does not exist', async () => {
    await withRootDb(async (client: PoolClient) => {
      // inserting some account and delete it
      const insQuery = await client.query(
        'INSERT INTO account (type) values ($1) returning id, nonce',
        ['user'],
      );
      const [{ id: accountId, nonce }] = insQuery.rows;
      await client.query('DELETE FROM account where id = $1', [accountId]);

      // generate signature
      const { userPrivKey, userPubKey, userAddr } = await createNewUser();
      const signature = genSignature(
        userPrivKey,
        userPubKey,
        userAddr,
        nonce,
        genArbitraryConnectWalletData(nonce),
      );

      await expect(
        connectWallet({ client, signature, accountId }),
      ).rejects.toThrow(
        new UnauthorizedError('Account not found for the given id'),
      );
    });
  });
});
