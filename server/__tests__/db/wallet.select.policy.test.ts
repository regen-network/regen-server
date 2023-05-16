import { PoolClient } from 'pg';
import { genRandomRegenAddress } from '../utils';
import { withAuthUserDb } from './helpers';

describe('the SELECT RLS policy for the wallet table...', () => {
  it('should allow auth_users view all wallets...', async () => {
    const walletAddr = genRandomRegenAddress();
    await withAuthUserDb(walletAddr, async (client: PoolClient) => {
      const res = await client.query('SELECT * FROM wallet');
      expect(res.rowCount).toBeGreaterThan(0);
    });
  });
});
