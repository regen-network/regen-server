import { withRootDb } from '../helpers';

const walletAddr = 'regen123456789';
const partyName = 'John Doe';

describe('get_parties_by_name_or_addr', () => {
  it('returns parties by name or addr', async () => {
    await withRootDb(async client => {
      const walletIdRes = await client.query(
        'INSERT INTO wallet (addr) values ($1) returning id',
        [walletAddr],
      );
      const [{ id: walletId }] = walletIdRes.rows;
      console.log('walletIdRes', walletIdRes);
      const partyIdRes = await client.query(
        `INSERT INTO party (type, name, wallet_id) values ('user', $1, $2) returning id`,
        [partyName, walletId],
      );
      const [{ id: partyId }] = partyIdRes.rows;

      const partiesByAddrRes = await client.query(
        `SELECT id FROM public.get_parties_by_name_or_addr($1)`,
        [walletAddr.substring(5, 10)],
      );
      expect(partiesByAddrRes.rowCount).toBe(1);
      expect(partiesByAddrRes.rows[0].id).toEqual(partyId);

      const partiesByNameRes = await client.query(
        `SELECT id FROM public.get_parties_by_name_or_addr($1)`,
        [partyName.substring(0, 4)],
      );
      expect(partiesByNameRes.rowCount).toBe(1);
      expect(partiesByNameRes.rows[0].id).toEqual(partyId);
    });
  });
});
