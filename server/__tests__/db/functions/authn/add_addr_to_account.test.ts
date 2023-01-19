import { createAccount, withRootDb, becomeUser } from '../../helpers';

const walletAddr = 'regen123456789';

describe('add_addr_to_account', () => {
  it('does not allow adding an addr that already has an association', async () => {
    await withRootDb(async client => {
      const accountId = await createAccount(client, walletAddr);
      expect(
        client.query(
          `select * from private.add_addr_to_account('${accountId}', '${walletAddr}', 'user')`,
        ),
      ).rejects.toThrow('this addr already belongs to this account');
    });
  });
  it('should throw an error if the address already belongs to a different users account', async () => {
    await withRootDb(async client => {
      const user1WalletAddr = 'regen123';
      const user2WalletAddr = 'regen456';
      const accountId = await createAccount(client, user1WalletAddr);
      await createAccount(client, user2WalletAddr);
      expect(
        client.query(
          `select * from private.add_addr_to_account('${accountId}', '${user2WalletAddr}', 'user')`,
        ),
      ).rejects.toThrow('this addr belongs to a different account');
    });
  });
  it('allows adding a new, unused addr', async () => {
    await withRootDb(async client => {
      const accountId = await createAccount(client, walletAddr);
      const newWalletAddr = 'regenABC123';
      const result = await client.query(
        `select * from private.add_addr_to_account('${accountId}', '${newWalletAddr}', 'user')`,
      );
      expect(result.rowCount).toBe(1);
      await becomeUser(client, walletAddr);
      const addrs = await client.query('select * from get_current_addrs()');
      expect(addrs.rowCount).toBe(2);
    });
  });
});
