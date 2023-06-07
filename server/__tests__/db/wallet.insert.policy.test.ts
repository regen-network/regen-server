import { PoolClient } from 'pg';
import { genRandomRegenAddress } from '../utils';
import { becomeUser, withAuthUserDb, withRootDb } from './helpers';

describe.only('the INSERT RLS policy for the wallet table...', () => {
  it('should allow auth_users to insert', async () => {
    const walletAddr = genRandomRegenAddress();
    await withAuthUserDb(walletAddr, async (client: PoolClient) => {
      const insQuery = await client.query(
        'INSERT INTO wallet (addr) VALUES ($1)',
        ['foobar'],
      );
      expect(insQuery.rowCount).toBe(1);
    });
  });
  it('should not allow any app_user to insert', async () => {
    await withRootDb(async (client: PoolClient) => {
      await becomeUser(client, 'app_user');
      expect(
        client.query('INSERT INTO wallet (addr) VALUES ($1)', ['foobar']),
      ).rejects.toThrow(
        'new row violates row-level security policy for table "wallet"',
      );
    });
  });
});
