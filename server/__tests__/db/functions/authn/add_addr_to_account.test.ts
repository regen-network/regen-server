import { createAccount, withRootDb } from '../../helpers';

const walletAddr = 'regen123456789';

describe('add_addr_to_account', () => {
  it('cannot add an addr to a non-existent account', async () => {
    await withRootDb(async client => {
      const accountId = '44b26018-e2ab-11ec-983d-0242ac160003';
      expect(
        client.query(
          `select * from add_addr_to_account('${accountId}', '${walletAddr}')`,
        ),
      ).rejects.toThrow();
    });
  });
  it('does not allow user to add an addr that already has an association', async () => {
    await withRootDb(async client => {
      const accountId = await createAccount(client, walletAddr);
      await client.query(`set role ${walletAddr}`);
      expect(
        client.query(
          `select * from add_addr_to_account('${accountId}', '${walletAddr}')`,
        ),
      ).rejects.toThrow();
    });
  });
  it('should throw an error if the address already belongs to a different users account', async () => {
    await withRootDb(async client => {
      const user1WalletAddr = 'regen123';
      const user2WalletAddr = 'regen456';
      const user1AccountId = await createAccount(client, user1WalletAddr);
      await createAccount(client, user2WalletAddr);
      await client.query(`set role ${user1WalletAddr}`);
      expect(
        client.query(
          `select * from add_addr_to_account('${user1AccountId}', '${user2WalletAddr}')`,
        ),
      ).rejects.toThrow();
    });
  });
  it('allows the user to add a new, unused addr', async () => {
    await withRootDb(async client => {
      const accountId = await createAccount(client, walletAddr);
      await client.query(`set role ${walletAddr}`);
      const newWalletAddr = 'regenABC123';
      const result = await client.query(
        `select * from add_addr_to_account('${accountId}', '${newWalletAddr}')`,
      );
      expect(result.rowCount).toBe(1);
    });
  });
});
