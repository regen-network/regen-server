import { becomeUser, withAuthUserDb } from '../../helpers';

const walletAddr = 'regen123456789';

describe('get_parties_by_account_id', () => {
  it('returns all parties associated to a given account id', async () => {
    await withAuthUserDb(walletAddr, async client => {
      const newWalletAddr = 'regenABC123';
      const accountIdRes = await client.query(
        'select * from get_current_account()',
      );
      const [{ account_id }] = accountIdRes.rows;
      await becomeUser(client, 'postgres');
      await client.query(
        `select * from private.add_addr_to_account('${account_id}', '${newWalletAddr}', 'user')`,
      );
      const partiesQuery = await client.query(
        `SELECT id FROM private.get_parties_by_account_id($1)`,
        [account_id],
      );
      expect(partiesQuery.rowCount).toBe(2);
    });
  });
});
