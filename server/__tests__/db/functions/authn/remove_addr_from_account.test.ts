import {
  createAccount,
  addrBelongsToAccount,
  withAppUserDb,
  becomeUser,
} from '../../helpers';

const walletAddr = 'regen123456789';

describe('remove_addr_from_account', () => {
  it('throws an error if address is not associated to the user', async () => {
    await withAppUserDb(async client => {
      await becomeUser(client, 'app_user');
      const accountId = await createAccount(client, walletAddr);
      await client.query('savepoint clean');
      expect(
        client.query(
          `select * from remove_addr_from_account('${accountId}', 'regenABC123')`,
        ),
      ).rejects.toThrow();
      await client.query('rollback to clean');
      expect(addrBelongsToAccount(client, accountId, walletAddr)).resolves.toBe(
        true,
      );
    });
  });
  it('throws an error if account does not exist', async () => {
    await withAppUserDb(async client => {
      const accountId = '44b26018-e2ab-11ec-983d-0242ac160003';
      expect(
        client.query(
          `select * from remove_addr_from_account('${accountId}', '${walletAddr}')`,
        ),
      ).rejects.toThrow();
    });
  });
  it('does not remove an address from the wrong user', async () => {
    await withAppUserDb(async client => {
      const addr1 = 'regen123';
      const addr2 = 'regenABC';
      const accountId1 = await createAccount(client, addr1);
      const accountId2 = await createAccount(client, addr2);
      await client.query('savepoint clean');
      try {
        await client.query(
          `select * from remove_addr_from_account('${accountId1}', '${addr2}')`,
        );
      } catch (e) {
        console.log(e);
        await client.query('rollback to clean');
      }
      expect(addrBelongsToAccount(client, accountId1, addr1)).resolves.toBe(
        true,
      );
      expect(addrBelongsToAccount(client, accountId2, addr2)).resolves.toBe(
        true,
      );
    });
  });
  it('successfully removes an address from an account', async () => {
    await withAppUserDb(async client => {
      const accountId = await createAccount(client, walletAddr);
      const resp = await client.query(
        `select * from remove_addr_from_account('${accountId}', '${walletAddr}')`,
      );
      console.log(resp);
      const check = await client.query("select a.id as aid, p.id as pid, w.addr as addr from account a join party p on p.account_id = a.id join wallet w on p.wallet_id = w.id");
      console.log(check);
      expect(true).toBe(
        false,
      );
    });
  });
});
