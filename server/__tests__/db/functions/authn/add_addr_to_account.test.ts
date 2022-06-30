import { createAccount, withRootDb, withAuthUserDb, becomeUser } from '../../helpers';

const walletAddr = 'regen123456789';

describe('add_addr_to_account', () => {
  it('does not allow user to add an addr that already has an association', async () => {
    await withAuthUserDb(walletAddr, async client => {
      expect(
        client.query(
          `select * from add_addr_to_account('${walletAddr}', 'user')`,
        ),
      ).rejects.toThrow();
    });
  });
  it('should throw an error if the address already belongs to a different users account', async () => {
    await withRootDb(async client => {
      const user1WalletAddr = 'regen123';
      const user2WalletAddr = 'regen456';
      await createAccount(client, user1WalletAddr);
      await createAccount(client, user2WalletAddr);
      await becomeUser(client, user1WalletAddr);
      expect(
        client.query(`select * from add_addr_to_account('${user2WalletAddr}')`),
      ).rejects.toThrow();
    });
  });
  it('allows the user to add a new, unused addr', async () => {
    await withAuthUserDb(walletAddr, async client => {
      const newWalletAddr = 'regenABC123';
      const result = await client.query(
        `select * from add_addr_to_account('${newWalletAddr}', 'user')`,
      );
      expect(result.rowCount).toBe(1);
      const addrs = await client.query('select * from get_current_addrs()');
      expect(addrs.rowCount).toBe(2);
    });
  });
});
