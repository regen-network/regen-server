import { PoolClient } from 'pg';
import { withAuthUserDb } from './helpers';

describe('the DELETE RLS policy for the project table...', () => {
  it('should NOT allow a user to delete projects...', async () => {
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
      const delQ = await client.query('DELETE FROM project');
      expect(delQ.rowCount).toBe(0);
    });
  });
});
