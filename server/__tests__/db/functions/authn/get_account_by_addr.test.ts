import { becomeUser, createAccount, withRootDb } from '../../helpers';

const walletAddr = 'regen123456789';

describe('get_account_by_addr', () => {
  it('gets the same account for a user with multiple addresses', async () => {
    await withRootDb(async client => {
      const { accountId } = await createAccount(client, walletAddr);
      await becomeUser(client, walletAddr);
      const newWalletAddr = 'regenABC123';
      await becomeUser(client, 'postgres');
      await client.query(
        `select * from private.add_addr_to_account('${accountId}', '${newWalletAddr}', 'user')`,
      );
      // at this point account_id has two wallets associated to it, so we should
      // be able to lookup this account with either of these two wallets.
      const result1 = await client.query(
        `select id from private.get_account_by_addr('${walletAddr}')`,
      );
      const [{ id: accountId1 }] = result1.rows;
      const result2 = await client.query(
        `select id from private.get_account_by_addr('${newWalletAddr}')`,
      );
      const [{ id: accountId2 }] = result2.rows;
      // make sure that either wallet returns the original accountId
      expect(accountId).toBe(accountId1);
      expect(accountId).toBe(accountId2);
    });
  });
});
