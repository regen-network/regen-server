import { becomeAuthUser, createAccount, withRootDb } from '../../helpers';

const walletAddr = 'regen123456789';

describe('update party', () => {
  test('that a user can update a party that belongs to them', async () => {
    await withRootDb(async client => {
      const accountId = await createAccount(client, walletAddr);
      await becomeAuthUser(client, walletAddr, accountId);
      const result = await client.query(
        `update party set name = 'my updated name'`,
      );
      expect(result.rowCount).toBe(1);
    });
  });
  test('that a user cannot update another users party', async () => {
    await withRootDb(async client => {
      const accountId = await createAccount(client, walletAddr);
      const walletAddr2 = 'regen987654321';
      const accountId2 = await createAccount(client, walletAddr2);
      await becomeAuthUser(client, walletAddr, accountId);
      const result = await client.query(
        `update party set name = 'my updated name'`,
      );
      expect(result.rowCount).toBe(1);
      await becomeAuthUser(client, walletAddr2, accountId2);
      client
        .query(
          `select p.name from wallet w join party p on p.wallet_id = w.id where w.addr = '${walletAddr2}'`,
        )
        .then(res => {
          const name = res.rows[0].name;
          expect(name).toBe('');
        });
    });
  });
});
