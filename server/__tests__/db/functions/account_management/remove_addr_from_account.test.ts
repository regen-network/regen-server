import { createAccount, addrBelongsToAccount, withRootDb } from '../../helpers';

const walletAddr = 'regen123456789';

describe('remove_addr_from_account', () => {
  it('throws an error if address is not associated to the user', async () => {
    await withRootDb(async client => {
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
    await withRootDb(async client => {
      const accountId = '44b26018-e2ab-11ec-983d-0242ac160003';
      expect(
        client.query(
          `select * from remove_addr_from_account('${accountId}', '${walletAddr}')`,
        ),
      ).rejects.toThrow();
    });
  });
  it('does not remove an address from the wrong user', async () => {
    await withRootDb(async client => {
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
    await withRootDb(async client => {
      const accountId = await createAccount(client, walletAddr);
      await client.query(
        `select * from remove_addr_from_account('${accountId}', '${walletAddr}')`,
      );
      expect(addrBelongsToAccount(client, accountId, walletAddr)).resolves.toBe(
        false,
      );
    });
  });
});
