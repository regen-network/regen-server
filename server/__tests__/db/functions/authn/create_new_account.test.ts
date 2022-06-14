import { createAccount, withAppUserDb } from '../../helpers';

const walletAddr = 'regen123456789';

describe('create_new_account', () => {
  it('should be able to create a new account for an unused wallet address', async () => {
    await withAppUserDb(async client => {
      const accountId = await createAccount(client, walletAddr);
      const result = await client.query(
        `select addr from get_addrs_by_account_id('${accountId}') where addr = '${walletAddr}'`,
      );
      expect(result.rowCount).toBe(1);
    });
  });
  it('should not be able to create a new account for an already taken wallet address', async () => {
    await withAppUserDb(async client => {
      await createAccount(client, walletAddr);
      expect(
        client.query(
          `select * from create_new_account('${walletAddr}') as accountId`,
        ),
      ).rejects.toThrow();
    });
  });
});