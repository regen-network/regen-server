import { PoolClient } from 'pg';
import { genRandomRegenAddress } from '../utils';
import { withAuthUserDb } from './helpers';

describe('the DELETE RLS policy for the project table...', () => {
  it('should NOT allow a user to delete projects...', async () => {
    const walletAddr = genRandomRegenAddress();
    await withAuthUserDb(walletAddr, async (client: PoolClient) => {
      const query = await client.query('select id from get_current_party()');
      const [{ id: accountId }] = query.rows;
      const insQuery = await client.query(
        'INSERT INTO project (admin_party_id) VALUES ($1)',
        [accountId],
      );
      expect(insQuery.rowCount).toBe(1);
      const delQ = await client.query('DELETE FROM project');
      expect(delQ.rowCount).toBe(0);
    });
  });
});
