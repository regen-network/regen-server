import { PoolClient } from 'pg';
import { genRandomRegenAddress } from '../utils';
import { withAuthUserDb } from './helpers';

describe('the INSERT RLS policy for the wallet table...', () => {
  it('should disallow auth_users from inserting...', async () => {
    const walletAddr = genRandomRegenAddress();
    await withAuthUserDb(walletAddr, async (client: PoolClient) => {
      expect(
        client.query('INSERT INTO wallet (addr) VALUES ($1)', ['foobar']),
      ).rejects.toThrow(
        'new row violates row-level security policy for table "wallet"',
      );
    });
  });
});
