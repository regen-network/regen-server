import { PoolClient } from 'pg';
import { genRandomRegenAddress } from '../utils';
import { withAuthUserDb } from './helpers';

describe('the DELETE RLS policy for the wallet table...', () => {
  it('should disallow auth_users from deleting any wallets...', async () => {
    const walletAddr = genRandomRegenAddress();
    await withAuthUserDb(walletAddr, async (client: PoolClient) => {
      expect(client.query('DELETE FROM wallet')).rejects.toThrow(
        'permission denied for table wallet',
      );
    });
  });
  it('should disallow auth_users from deleting their own wallet...', async () => {
    const walletAddr = genRandomRegenAddress();
    await withAuthUserDb(walletAddr, async (client: PoolClient) => {
      expect(
        client.query(`DELETE FROM wallet WHERE addr='${walletAddr}'`),
      ).rejects.toThrow('permission denied for table wallet');
    });
  });
});
