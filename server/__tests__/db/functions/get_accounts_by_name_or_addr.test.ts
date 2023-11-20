import { withRootDb } from '../helpers';

const walletAddr = 'regen123456789';
const accountName = 'John Doe';

describe('get_accounts_by_name_or_addr', () => {
  it('returns accounts by name or addr', async () => {
    await withRootDb(async client => {
      const accountIdRes = await client.query(
        `INSERT INTO account (type, name, addr) values ('user', $1, $2) returning id`,
        [accountName, walletAddr],
      );
      const [{ id: accountId }] = accountIdRes.rows;

      const accountsByAddrRes = await client.query(
        `SELECT id FROM public.get_accounts_by_name_or_addr($1)`,
        [walletAddr.substring(5, 10)],
      );
      expect(accountsByAddrRes.rowCount).toBe(1);
      expect(accountsByAddrRes.rows[0].id).toEqual(accountId);

      const accountsByNameRes = await client.query(
        `SELECT id FROM public.get_accounts_by_name_or_addr($1)`,
        [accountName.substring(0, 4)],
      );
      expect(accountsByNameRes.rowCount).toBe(1);
      expect(accountsByNameRes.rows[0].id).toEqual(accountId);
    });
  });

  it('returns accounts without wallet addresses by name', async () => {
    await withRootDb(async client => {
      const accountIdRes = await client.query(
        `INSERT INTO account (type, name) values ('user', $1) returning id`,
        [accountName],
      );
      const [{ id: accountId }] = accountIdRes.rows;

      const accountsByNameRes = await client.query(
        `SELECT id FROM public.get_accounts_by_name_or_addr($1)`,
        [accountName.substring(0, 4)],
      );
      expect(accountsByNameRes.rowCount).toBe(1);
      expect(accountsByNameRes.rows[0].id).toEqual(accountId);
    });
  });
});
