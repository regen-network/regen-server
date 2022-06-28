import { createAccount, withRootDb } from '../../helpers';

const walletAddr = 'regen123456789';

describe('update party', () => {
  test('that a user can update a party that belongs to them', async () => {
    await withRootDb(async client => {
      await createAccount(client, walletAddr);
      await client.query(`set role ${walletAddr}`);
      const result = await client.query(
        `update party set name = 'my updated name'`,
      );
      expect(result.rowCount).toBe(1);
    });
  });
  test('that a user cannot update another users party', async () => {
    await withRootDb(async client => {
      await createAccount(client, walletAddr);
      await createAccount(client, 'otherUsersAddr');
      await client.query(`set role ${walletAddr}`);
      const result = await client.query(
        `update party set name = 'my updated name'`,
      );
      expect(result.rowCount).toBe(1);
    });
  });
});
