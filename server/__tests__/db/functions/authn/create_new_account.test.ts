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
  it('should not be able to create a new account with a wallet address that already belongs to an account', async () => {
    await withRootDb(async client => {
      await createAccount(client, walletAddr);
      expect(
        client.query(
          `select * from private.create_new_account('${walletAddr}', 'user') as accountId`,
        ),
      ).rejects.toThrow('this addr belongs to a different account');
    });
  });
  it('should be able to create a new account with an existing wallet address and party with no account yet', async () => {
    await withRootDb(async client => {
      // Create existing wallet and party
      const partyName = 'John';
      const partyType = 'organization';
      const walletRes = await client.query(
        `insert into wallet (addr) values ($1) returning id`,
        [walletAddr],
      );
      expect(walletRes.rowCount).toBe(1);
      const [{ id: walletId }] = walletRes.rows;
      const partyRes = await client.query(
        `insert into party (name, type, wallet_id) values ($1, $2, $3) returning id`,
        [partyName, partyType, walletId],
      );
      expect(partyRes.rowCount).toBe(1);
      const [{ id: partyId }] = partyRes.rows;

      const accountId = await createAccount(client, walletAddr);
      const result = await client.query(
        `select addr from private.get_addrs_by_account_id('${accountId}') where addr = '${walletAddr}'`,
      );
      expect(result.rowCount).toBe(1);

      // Check that the party now has the newly created accountId with unchanged wallet_id, name and type
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
    });
  });
});
