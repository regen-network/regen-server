import { withRootDb } from '../db/helpers';
import { PoolClient } from 'pg';
import { connectWallet } from '../../routes/web3auth';
import { createNewUser, genSignature } from '../utils';

describe('web3auth connect wallet', () => {
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
      const signature = genSignature(userPrivKey, userPubKey, userAddr, nonce);

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
      const [{ id: accountId, nonce }] = insQuery.rows;

      // generate signature
      const { userPrivKey, userPubKey, userAddr } = await createNewUser();
      const signature = genSignature(userPrivKey, userPubKey, userAddr, '123');

      expect(connectWallet({ client, signature, accountId })).rejects.toThrow(
        'Invalid signature',
      );
    });
  });
  it('should throw an error if signature is not provided', async () => {
    await withRootDb(async (client: PoolClient) => {
      expect(connectWallet({ client })).rejects.toThrow(
        'Invalid signature parameter',
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
      const signature = genSignature(userPrivKey, userPubKey, userAddr, nonce);

      expect(connectWallet({ client, signature, accountId })).rejects.toThrow(
        'Wallet address used by another account',
      );
    });
  });
  it('should throw an error if the account does not exist', async () => {
    await withRootDb(async (client: PoolClient) => {
      // inserting some account and delete it
      const insQuery = await client.query(
        'INSERT INTO account (type) values ($1) returning id',
        ['user'],
      );
      const [{ id: accountId }] = insQuery.rows;
      await client.query('DELETE FROM account where id = $1', [accountId]);

      // generate signature for an address already used by another account
      const { userPrivKey, userPubKey, userAddr } = await createNewUser();
      const signature = genSignature(userPrivKey, userPubKey, userAddr, '');

      expect(connectWallet({ client, signature, accountId })).rejects.toThrow(
        'Account not found for the given id',
      );
    });
  });
});
