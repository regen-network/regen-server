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
      expect(
        client.query(
          `select * from add_addr_to_account('${accountId}', '${walletAddr}')`,
        ),
      ).rejects.toThrow();
    });
  });
  it('allows the user to add a new, unused addr', async () => {
    await withRootDb(async client => {
      const accountId = await createAccount(client, walletAddr);
      const newWalletAddr = 'regenABC123';
      const result = await client.query(
        `select * from add_addr_to_account('${accountId}', '${newWalletAddr}')`,
      );
      expect(result.rowCount).toBe(1);
    });
  });
});
