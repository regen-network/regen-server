import { PoolClient } from 'pg';
import {
  becomeAuthUser,
  createAccount,
  withAuthUserDb,
  withRootDb,
} from './helpers';

describe('the INSERT RLS policy for the project table...', () => {
  it('should allow a user to create a project with their own wallet as admin...', async () => {
    const walletAddr = `regen${Math.random().toString().slice(2, 11)}`;
    await withAuthUserDb(walletAddr, async (client: PoolClient) => {
      const addrsQ = await client.query(
        'select wallet_id from get_current_addrs() where addr=$1',
        [walletAddr],
      );
      const [{ wallet_id }] = addrsQ.rows;
      const insQuery = await client.query(
        'INSERT INTO project (admin_id) VALUES ($1)',
        [wallet_id],
      );
      expect(insQuery.rowCount).toBe(1);
    });
  });

  it('should NOT allow a user to create a project with another users wallet as admin...', async () => {
    const walletAddr = `regen${Math.random().toString().slice(2, 11)}`;
    const walletAddr2 = `regen${Math.random().toString().slice(2, 11)}`;
    await withRootDb(async (client: PoolClient) => {
      const accountId = await createAccount(client, walletAddr);
      const accountId2 = await createAccount(client, walletAddr2);
      // get the wallet_id for the first user
      await becomeAuthUser(client, walletAddr, accountId);
      const addrsQ = await client.query(
        'select wallet_id from get_current_addrs() where addr=$1',
        [walletAddr],
      );
      const [{ wallet_id }] = addrsQ.rows;
      // switch the second user
      await becomeAuthUser(client, walletAddr2, accountId2);
      // try to insert the first users wallet_id as admin_id
      // this operation should fail
      await expect(
        client.query('INSERT INTO project (admin_id) VALUES ($1)', [wallet_id]),
      ).rejects.toThrow(
        'new row violates row-level security policy for table "project"',
      );
    });
  });
});
