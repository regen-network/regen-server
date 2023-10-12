import { genRandomRegenAddress } from '../../../utils';
import {
  createAccountWithAuthUser,
  createAccount,
  withRootDb,
} from '../../helpers';

const walletAddr = genRandomRegenAddress();

describe('create_new_account_with_wallet', () => {
  it('should be able to create a new account for an unused wallet address', async () => {
    await withRootDb(async client => {
      const { accountId } = await createAccountWithAuthUser(client, walletAddr);
      const result = await client.query('select 1 from account where id=$1', [
        accountId,
      ]);
      expect(result.rowCount).toBe(1);
    });
  });
  it('account creation is an idempotent operation...', async () => {
    await withRootDb(async client => {
      const { accountId: accountId1 } = await createAccountWithAuthUser(
        client,
        walletAddr,
      );
      const { accountId: accountId2 } = await createAccountWithAuthUser(
        client,
        walletAddr,
      );
      expect(accountId1).toBe(accountId2);
    });
  });
  it('should be able to create a new account with an unclaimed existing wallet address...', async () => {
    await withRootDb(async client => {
      // Create existing account
      const accountName = 'John';
      const accountType = 'organization';
      const { accountId, creatorId } = await createAccount(
        client,
        walletAddr,
        accountName,
        accountType,
      );
      expect(creatorId).toBe(null);

      const { accountId: accountId1 } = await createAccountWithAuthUser(
        client,
        walletAddr,
      );
      expect(accountId).toBe(accountId1);

      // Check that the account now has the newly created accountId with unchanged wallet_id, name and type
      const updatedRes = await client.query(
        `select * from account where id = $1`,
        [accountId],
      );
      expect(updatedRes.rowCount).toBe(1);
      const [account] = updatedRes.rows;
      expect(account.id).toEqual(accountId);
      expect(account.addr).toEqual(walletAddr);
      expect(account.name).toEqual(accountName);
      expect(account.type).toEqual(accountType);
      expect(account.creatorId).toBeFalsy();
    });
  });
  it('should be able to create a new account with an existing wallet address even if it was created by a different account..', async () => {
    await withRootDb(async client => {
      // Create the creator account
      const creatorWalletAddr = genRandomRegenAddress();
      const { accountId: creatorAccountId } = await createAccountWithAuthUser(
        client,
        creatorWalletAddr,
      );

      // Create existing account with creator
      const accountName = 'John';
      const accountType = 'organization';
      const { accountId, creatorId } = await createAccount(
        client,
        walletAddr,
        accountName,
        accountType,
        creatorAccountId,
      );
      expect(creatorId).not.toBe(null);

      // Create the user account that will claim the account from the creator
      const { accountId: accountId1 } = await createAccountWithAuthUser(
        client,
        walletAddr,
      );
      expect(accountId).toBe(accountId1);

      // Check that the account now has the newly created accountId with unchanged addr, name and type
      const updatedRes = await client.query(
        `select * from account where id = $1`,
        [accountId],
      );
      expect(updatedRes.rowCount).toBe(1);
      const [account] = updatedRes.rows;
      expect(account.id).toEqual(accountId);
      expect(account.creator_id).toEqual(null);
      expect(account.addr).toEqual(walletAddr);
      expect(account.name).toEqual(accountName);
      expect(account.type).toEqual(accountType);
    });
  });
});
