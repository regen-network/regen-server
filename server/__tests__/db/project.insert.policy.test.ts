import { PoolClient } from 'pg';
import { genRandomRegenAddress } from '../utils';
import { becomeUser, withAuthUserDb, withRootDb } from './helpers';

describe('the INSERT RLS policy for the project table...', () => {
  it('should allow auth_users to insert', async () => {
    const walletAddr = genRandomRegenAddress();
    await withAuthUserDb(walletAddr, async (client: PoolClient) => {
      const insQuery = await client.query('INSERT INTO project DEFAULT VALUES');
      expect(insQuery.rowCount).toBe(1);
    });
  });
  it('should not allow any app_user to insert', async () => {
    await withRootDb(async (client: PoolClient) => {
      await becomeUser(client, 'app_user');
      expect(
        client.query('INSERT INTO project DEFAULT VALUES'),
      ).rejects.toThrow(
        'new row violates row-level security policy for table "project"',
      );
    });
  });
});
