import { createAccount, withRootDb } from '../../helpers';

const walletAddr = 'regen123456789';

describe('addr_can_be_added, arity 1', () => {
  it('should be able to add a new address if it does not already exist', async () => {
    await withRootDb(async client => {
      const result = await client.query(
        `select * from addr_can_be_added('${walletAddr}')`,
      );
      const [{ can_be_added }] = result.rows;
      expect(can_be_added).toBe(true);
    });
  });
  it('should not be able to add a new address if exists', async () => {
    await withRootDb(async client => {
      await createAccount(client, walletAddr);
      expect(
        client.query(`select * from addr_can_be_added('${walletAddr}')`),
      ).rejects.toThrow();
    });
  });
});

describe('addr_can_be_added, arity 2', () => {
  it('should throw an error if the account was not found', async () => {
    const uuid = '7c2f4c1c-ddfc-11ec-a800-0242ac130003';
    await withRootDb(async client => {
      expect(
        client.query(
          `select * from addr_can_be_added('${uuid}', '${walletAddr}')`,
        ),
      ).rejects.toThrow();
    });
  });
  it('should throw an error if the address already belongs to the users account', async () => {
    await withRootDb(async client => {
      const accountId = await createAccount(client, walletAddr);
      expect(
        client.query(
          `select * from addr_can_be_added('${accountId}', '${walletAddr}')`,
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
      expect(
        client.query(
          `select * from addr_can_be_added('${user1AccountId}', '${user2WalletAddr}')`,
        ),
      ).rejects.toThrow();
    });
  });
  it('should return true if an address is not in use by any user', async () => {
    await withRootDb(async client => {
      const accountId = await createAccount(client, walletAddr);
      const result = await client.query(
        `select * from addr_can_be_added('${accountId}', '${walletAddr}xyz')`,
      );
      const [{ can_be_added }] = result.rows;
      expect(can_be_added).toBe(true);
    });
  });
});
