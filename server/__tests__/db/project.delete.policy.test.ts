import { PoolClient } from 'pg';
import { genRandomRegenAddress } from '../utils';
import {
  withAuthUserDb,
  becomeAuthUser,
  createAccountWithAuthUser,
  withRootDb,
} from './helpers';

describe('the DELETE RLS policy for the project table...', () => {
  it('allows project admin to delete an off-chain project', async () => {
    const walletAddr = genRandomRegenAddress();
    await withAuthUserDb(walletAddr, async (client: PoolClient) => {
      const query = await client.query('select id from get_current_account()');
      const [{ id: accountId }] = query.rows;
      const insertQuery = await client.query(
        'INSERT INTO project (admin_account_id) VALUES ($1) RETURNING id AS project_id',
        [accountId],
      );
      expect(insertQuery.rowCount).toBe(1);
      const [{ project_id }] = insertQuery.rows;
      const delQ = await client.query('DELETE FROM project WHERE id = $1', [
        project_id,
      ]);
      expect(delQ.rowCount).toBe(1);
    });
  });
  it('does NOT allow a non project admin user to delete a project', async () => {
    const walletAddr = genRandomRegenAddress();
    const walletAddr2 = genRandomRegenAddress();
    await withRootDb(async (client: PoolClient) => {
      const { accountId } = await createAccountWithAuthUser(client, walletAddr);
      const { accountId: accountId2 } = await createAccountWithAuthUser(
        client,
        walletAddr2,
      );
      // become first user
      await becomeAuthUser(client, accountId);
      const insertQuery = await client.query(
        'INSERT INTO project (admin_account_id) VALUES ($1) RETURNING id AS project_id',
        [accountId],
      );
      expect(insertQuery.rowCount).toBe(1);
      const [{ project_id }] = insertQuery.rows;

      // become the second user...
      await becomeAuthUser(client, accountId2);
      expect(insertQuery.rowCount).toBe(1);
      const delQ = await client.query('DELETE FROM project WHERE id = $1', [
        project_id,
      ]);
      expect(delQ.rowCount).toBe(0);
    });
  });
  it('does NOT allow a project admin to delete an on-chain project', async () => {
    const walletAddr = genRandomRegenAddress();
    await withAuthUserDb(walletAddr, async (client: PoolClient) => {
      const query = await client.query('select id from get_current_account()');
      const [{ id: accountId }] = query.rows;
      const insertQuery = await client.query(
        'INSERT INTO project (admin_account_id, on_chain_id) VALUES ($1, $2) RETURNING id AS project_id',
        [accountId, 'FOO-ONCHAIN-ID'],
      );
      expect(insertQuery.rowCount).toBe(1);
      const [{ project_id }] = insertQuery.rows;
      const delQ = await client.query('DELETE FROM project WHERE id = $1', [
        project_id,
      ]);
      expect(delQ.rowCount).toBe(0);
    });
  });
});
