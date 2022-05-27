import { PoolClient } from 'pg';
import { withRootDb } from '../helpers';

const walletAddr = 'regen123456789';

async function createAccount(
  client: PoolClient,
  walletAddr: string,
): Promise<string> {
  const result = await client.query(
    `select * from create_new_account('${walletAddr}') as account_id`,
  );
  const [{ account_id }] = result.rows;
  return account_id;
}

describe('create new account function', () => {
  it('should be able to create a new account for an unused wallet address', () => {
    withRootDb(async client => {
      const accountId = await createAccount(client, walletAddr);
      const result = await client.query(
        `select addr from get_addrs_by_account_id('${accountId}') where addr = '${walletAddr}'`,
      );
      expect(result.rowCount).toBe(1);
    });
  });
  it('should not be able to create a new account for an already taken wallet address', () => {
    withRootDb(async client => {
      await createAccount(client, walletAddr);
      expect(
        client.query(
          `select * from create_new_account('${walletAddr}') as accountId`,
        ),
      ).rejects.toThrow();
    });
  });
});

describe('address can be added function arity 1', () => {
  it('should be able to add a new address if it does not already exist', () => {
    withRootDb(async client => {
      const result = await client.query(
        `select * from addr_can_be_added('${walletAddr}')`,
      );
      const [{ can_be_added }] = result.rows;
      expect(can_be_added).toBe(true);
    });
  });
  it('should not be able to add a new address if exists', () => {
    withRootDb(async client => {
      await createAccount(client, walletAddr);
      expect(
        client.query(`select * from addr_can_be_added('${walletAddr}')`),
      ).rejects.toThrow();
    });
  });
});

describe('address can be added function arity 2', () => {
  it('should throw an error if the account was not found', () => {
    const uuid = '7c2f4c1c-ddfc-11ec-a800-0242ac130003';
    withRootDb(async client => {
      expect(
        client.query(
          `select * from addr_can_be_added('${uuid}', '${walletAddr}')`,
        ),
      ).rejects.toThrow();
    });
  });
  it('should throw an error if the address already belongs to the users account', () => {
    withRootDb(async client => {
      const accountId = await createAccount(client, walletAddr);
      expect(
        client.query(
          `select * from addr_can_be_added('${accountId}', '${walletAddr}')`,
        ),
      ).rejects.toThrow();
    });
  });
  it('should throw an error if the address already belongs to a different users account', () => {
    withRootDb(async client => {
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
  it('should return true if an address is not in use by any user', () => {
    withRootDb(async client => {
      const accountId = await createAccount(client, walletAddr);
      const result = await client.query(
        `select * from addr_can_be_added('${accountId}', '${walletAddr}xyz')`,
      );
      const [{ can_be_added }] = result.rows;
      expect(can_be_added).toBe(true);
    });
  });
});
