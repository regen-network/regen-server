import { withAuthUserDb } from '../../helpers';

const walletAddr = 'regen123456789';

describe('get_addrs_by_account_id', () => {
  it('returns all addresses associated to a given account id', async () => {
    await withAuthUserDb(walletAddr, async client => {
      const newWalletAddr = 'regenABC123';
      await client.query(
        `select * from add_addr_to_account('${newWalletAddr}')`,
      );
      // given that we have multiple addrs associated to this particular accountId
      // we should be able to look up all of these addresses.
      const result = await client.query(
        `select * from get_current_addrs()`,
      );
      expect(result.rowCount).toBe(2);
    });
  });
});
