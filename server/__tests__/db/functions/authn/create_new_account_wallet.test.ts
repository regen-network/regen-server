import { genRandomRegenAddress } from '../../../utils';
import { createAccount, createWalletAndParty, withRootDb } from '../../helpers';

const walletAddr = genRandomRegenAddress();

describe('create_new_account_with_wallet', () => {
  it('should be able to create a new account for an unused wallet address', async () => {
    await withRootDb(async client => {
      const { accountId } = await createAccount(client, walletAddr);
      const result = await client.query('select 1 from party where id=$1', [
        accountId,
      ]);
      expect(result.rowCount).toBe(1);
    });
  });
  it('account creation is an idempotent operation...', async () => {
    await withRootDb(async client => {
      const { accountId: accountId1 } = await createAccount(client, walletAddr);
      const { accountId: accountId2 } = await createAccount(client, walletAddr);
      expect(accountId1).toBe(accountId2);
    });
  });
  it('should be able to create a new account with an existing wallet address and party with no account yet', async () => {
    await withRootDb(async client => {
      // Create existing wallet and party
      const partyName = 'John';
      const partyType = 'organization';
      const { walletId, partyId } = await createWalletAndParty(
        client,
        walletAddr,
        partyName,
        partyType,
      );

      const { accountId } = await createAccount(client, walletAddr);
      const result = await client.query(
        `select wallet.addr from party join wallet on wallet.id=party.wallet_id where party.id='${accountId}' and wallet.addr = '${walletAddr}'`,
      );
      expect(result.rowCount).toBe(1);

      // Check that the party now has the newly created accountId with unchanged wallet_id, name and type
      const updatedPartyRes = await client.query(
        `select * from party where id = $1`,
        [partyId],
      );
      expect(updatedPartyRes.rowCount).toBe(1);
      const [party] = updatedPartyRes.rows;
      expect(party.id).toEqual(accountId);
      expect(party.wallet_id).toEqual(walletId);
      expect(party.name).toEqual(partyName);
      expect(party.type).toEqual(partyType);
    });
  });
  it('should be able to create a new account with an existing wallet address and party with a creator but no account yet', async () => {
    await withRootDb(async client => {
      // Create the creator account
      const creatorWalletAddr = genRandomRegenAddress();
      const { partyId: creatorPartyId } = await createAccount(
        client,
        creatorWalletAddr,
      );

      // Create existing wallet and party with creator
      const partyName = 'John';
      const partyType = 'organization';
      const { walletId, partyId } = await createWalletAndParty(
        client,
        walletAddr,
        partyName,
        partyType,
        creatorPartyId,
      );

      // Create the user account that will claim the party from the creator
      const { accountId } = await createAccount(client, walletAddr);
      const result = await client.query(
        `select wallet.addr from party join wallet on wallet.id=party.wallet_id where party.id='${accountId}' and wallet.addr = '${walletAddr}'`,
      );
      expect(result.rowCount).toBe(1);

      // Check that the party now has the newly created accountId with unchanged wallet_id, name and type
      const updatedPartyRes = await client.query(
        `select * from party where id = $1`,
        [partyId],
      );
      expect(updatedPartyRes.rowCount).toBe(1);
      const [party] = updatedPartyRes.rows;
      expect(party.id).toEqual(accountId);
      expect(party.creator_id).toEqual(null);
      expect(party.wallet_id).toEqual(walletId);
      expect(party.name).toEqual(partyName);
      expect(party.type).toEqual(partyType);
    });
  });
});
