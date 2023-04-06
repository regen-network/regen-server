import { PoolClient } from 'pg';
import { withAuthUserDb } from './helpers';

describe('the SELECT RLS policy for the wallet table...', () => {
  it('should allow auth_users view all wallets...', async () => {
    const walletAddr = `regen${Math.random().toString().slice(2, 11)}`;
    await withAuthUserDb(walletAddr, async (client: PoolClient) => {
      const res = await client.query('SELECT * FROM wallet');
      expect(res.rowCount).toBeGreaterThan(0);
    });
  });
});
