import { PoolClient } from 'pg';
import { genRandomRegenAddress } from '../utils';
import { withAuthUserDb } from './helpers';

describe('the DELETE RLS policy for the project table...', () => {
  it('should NOT allow a user to delete projects...', async () => {
    const walletAddr = genRandomRegenAddress();
    await withAuthUserDb(walletAddr, async (client: PoolClient) => {
      const addrsQ = await client.query(
        'select wallet_id from get_current_addrs() where addr=$1',
        [walletAddr],
      );
      const [{ wallet_id }] = addrsQ.rows;
      const insQuery = await client.query(
        'INSERT INTO project (admin_wallet_id) VALUES ($1)',
        [wallet_id],
      );
      expect(insQuery.rowCount).toBe(1);
      const delQ = await client.query('DELETE FROM project');
      expect(delQ.rowCount).toBe(0);
    });
  });
});
