import { PoolClient } from 'pg';
import { genRandomRegenAddress } from '../utils';
import { withAuthUserDb } from './helpers';

describe('the UPDATE RLS policy for the wallet table...', () => {
  it('should disallow auth_users from updating any wallets...', async () => {
    const walletAddr = genRandomRegenAddress();
    await withAuthUserDb(walletAddr, async (client: PoolClient) => {
      const res = await client.query(`UPDATE wallet SET addr='${walletAddr}'`);
      expect(res.rowCount).toBe(0);
    });
  });
});
