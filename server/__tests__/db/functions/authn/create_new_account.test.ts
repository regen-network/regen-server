import { createAccount, withRootDb } from '../../helpers';

const walletAddr = 'regen123456789';

describe('create_new_account', () => {
  it('should be able to create a new account for an unused wallet address', async () => {
    await withRootDb(async client => {
      const accountId = await createAccount(client, walletAddr);
      const result = await client.query(
        `select addr from private.get_addrs_by_account_id('${accountId}') where addr = '${walletAddr}'`,
      );
      expect(result.rowCount).toBe(1);
    });
  });
  it('should not be able to create a new account for an already taken wallet address', async () => {
    await withRootDb(async client => {
      await createAccount(client, walletAddr);
      expect(
        client.query(
          `select * from private.create_new_account('${walletAddr}', 'user') as accountId`,
        ),
      ).rejects.toThrow('this addr belongs to a different account');
    });
  });
});
