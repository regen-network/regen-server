import { PoolClient } from 'pg';
import { withAuthUserDb } from './helpers';

describe('the INSERT RLS policy for the wallet table...', () => {
  it('should disallow auth_users from inserting...', async () => {
    const walletAddr = `regen${Math.random().toString().slice(2, 11)}`;
    await withAuthUserDb(walletAddr, async (client: PoolClient) => {
      expect(
        client.query('INSERT INTO wallet (addr) VALUES ($1)', ['foobar']),
      ).rejects.toThrow(
        'new row violates row-level security policy for table "wallet"',
      );
    });
  });
});
