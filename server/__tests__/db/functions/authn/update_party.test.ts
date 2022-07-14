import { becomeUser, createAccount, withRootDb } from '../../helpers';

const walletAddr = 'regen123456789';

describe('update party', () => {
  test('that a user can update a party that belongs to them', async () => {
    await withRootDb(async client => {
      await createAccount(client, walletAddr);
      await becomeUser(client, walletAddr);
      const result = await client.query(
        `update party set name = 'my updated name'`,
      );
      expect(result.rowCount).toBe(1);
    });
  });
  test('that a user cannot update another users party', async () => {
    await withRootDb(async client => {
      await createAccount(client, walletAddr);
      const walletAddr2 = 'regen987654321';
      await createAccount(client, walletAddr2);
      await becomeUser(client, walletAddr);
      const result = await client.query(
        `update party set name = 'my updated name'`,
      );
      expect(result.rowCount).toBe(1);
      await becomeUser(client, walletAddr2);
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
