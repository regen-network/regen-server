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

describe('create_new_account', () => {
  it('should be able to create a new account for an unused wallet address', async () => {
    await withRootDb(async client => {
      const accountId = await createAccount(client, walletAddr);
      const result = await client.query(
        `select addr from get_addrs_by_account_id('${accountId}') where addr = '${walletAddr}'`,
      );
      expect(result.rowCount).toBe(1);
    });
  });
  it('should not be able to create a new account for an already taken wallet address', async () => {
    await withRootDb(async client => {
      await createAccount(client, walletAddr);
      expect(
        client.query(
          `select * from create_new_account('${walletAddr}') as accountId`,
        ),
      ).rejects.toThrow();
    });
  });
});

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

describe('get_account_by_addr', () => {
  it('gets the same account for a user with multiple addresses', async () => {
    await withRootDb(async client => {
      const accountId = await createAccount(client, walletAddr);
      const newWalletAddr = 'regenABC123';
      await client.query(
        `select * from add_addr_to_account('${accountId}', '${newWalletAddr}')`,
      );
      // at this point account_id has two wallets associated to it, so we should
      // be able to lookup this account with either of these two wallets.
      const result1 = await client.query(
        `select account_id from get_account_by_addr('${walletAddr}')`,
      );
      const [{ account_id: accountId1 }] = result1.rows;
      const result2 = await client.query(
        `select account_id from get_account_by_addr('${walletAddr}')`,
      );
      const [{ account_id: accountId2 }] = result2.rows;
      // make sure that either wallet returns the original accountId
      expect(accountId).toBe(accountId1);
      expect(accountId).toBe(accountId2);
    });
  });
});

describe('get_addrs_by_account_id', () => {
  it('returns all addresses associated to a given account id', async () => {
    await withRootDb(async client => {
      const accountId = await createAccount(client, walletAddr);
      const newWalletAddr = 'regenABC123';
      await client.query(
        `select * from add_addr_to_account('${accountId}', '${newWalletAddr}')`,
      );
      // given that we have multiple addrs associated to this particular accountId
      // we should be able to look up all of these addresses.
      const result = await client.query(
        `select * from get_addrs_by_account_id('${accountId}')`,
      );
      expect(result.rowCount).toBe(2);
    });
  });
});
