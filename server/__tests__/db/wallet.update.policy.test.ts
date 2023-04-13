import { PoolClient } from 'pg';
import { withAuthUserDb } from './helpers';

describe('the UPDATE RLS policy for the wallet table...', () => {
  it('should disallow auth_users from updating any wallets...', async () => {
    const walletAddr = `regen${Math.random().toString().slice(2, 11)}`;
    await withAuthUserDb(walletAddr, async (client: PoolClient) => {
      const res = await client.query(`UPDATE wallet SET addr='${walletAddr}'`);
      expect(res.rowCount).toBe(0);
    });
  });
});
