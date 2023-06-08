import {
  createAccount,
  withRootDb,
  becomeAuthUser,
  createWalletAndParty,
} from '../../helpers';

const walletAddr = 'regen123456789';

describe('add_addr_to_account', () => {
  it('does not allow adding an addr that already has an association', async () => {
    await withRootDb(async client => {
      const accountId = await createAccount(client, walletAddr);
      expect(
        client.query(
          `select * from private.add_addr_to_account('${accountId}', '${walletAddr}', 'user')`,
        ),
      ).rejects.toThrow('this addr already belongs to this account');
    });
  });
  it('should throw an error if the address already belongs to a different users account', async () => {
    await withRootDb(async client => {
      const user1WalletAddr = 'regen123';
      const user2WalletAddr = 'regen456';
      const accountId = await createAccount(client, user1WalletAddr);
      await createAccount(client, user2WalletAddr);
      expect(
        client.query(
          `select * from private.add_addr_to_account('${accountId}', '${user2WalletAddr}', 'user')`,
        ),
      ).rejects.toThrow('this addr belongs to a different account');
    });
  });
  it('allows adding a new, unused addr', async () => {
    await withRootDb(async client => {
      const accountId = await createAccount(client, walletAddr);
      const newWalletAddr = 'regenABC123';
      const result = await client.query(
        `select * from private.add_addr_to_account('${accountId}', '${newWalletAddr}', 'user')`,
      );
      expect(result.rowCount).toBe(1);
      await becomeAuthUser(client, walletAddr, accountId);
      const addrs = await client.query('select * from get_current_addrs()');
      expect(addrs.rowCount).toBe(2);
    });
  });
  it('allows adding an existing addr with no account yet', async () => {
    await withRootDb(async client => {
      // Create existing wallet and party
      const existingWalletAddr = 'regenABC123456';
      const partyName = 'John';
      const partyType = 'organization';
      const { walletId, partyId } = await createWalletAndParty(
        client,
        existingWalletAddr,
        partyName,
        partyType,
      );

      const accountId = await createAccount(client, walletAddr);
      const result = await client.query(
        `select * from private.add_addr_to_account('${accountId}', '${existingWalletAddr}', 'user')`,
      );
      expect(result.rowCount).toBe(1);

      // Check that the party now belongs to the account with unchanged wallet_id, name and type
      const updatedPartyRes = await client.query(
        `select * from party where id = $1`,
        [partyId],
      );
      expect(updatedPartyRes.rowCount).toBe(1);
      const [party] = updatedPartyRes.rows;
      expect(party.account_id).toEqual(accountId);
      expect(party.wallet_id).toEqual(walletId);
      expect(party.name).toEqual(partyName);
      expect(party.type).toEqual(partyType);

      await becomeAuthUser(client, walletAddr, accountId);
      const addrs = await client.query('select * from get_current_addrs()');
      expect(addrs.rowCount).toBe(2);
    });
  });
});
