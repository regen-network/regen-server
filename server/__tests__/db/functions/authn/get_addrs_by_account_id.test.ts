import { becomeUser, withAuthUserDb } from '../../helpers';

const walletAddr = 'regen123456789';

describe('get_addrs_by_account_id', () => {
  it('returns all addresses associated to a given account id', async () => {
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
      await becomeUser(client, walletAddr);
      // given that we have multiple addrs associated to this particular accountId
      // we should be able to look up all of these addresses.
      const result = await client.query(`select * from get_current_addrs()`);
      expect(result.rowCount).toBe(2);
      // assert that addr and profile_type should be present in data from get_current_addrs
      const colsRetrieved = result.fields.map(x => x.name);
      expect(colsRetrieved).toEqual(
        expect.arrayContaining(['addr', 'profile_type']),
      );
    });
  });
});
