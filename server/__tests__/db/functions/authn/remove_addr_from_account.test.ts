import { createAccount, withRootDb } from '../../helpers';

const walletAddr = 'regen123456789';

describe('remove_addr_from_account', () => {
  it('throws an error if address is not associated to the user', async () => {
    await withRootDb(async client => {
      const { accountId } = await createAccount(client, walletAddr);
      await client.query('savepoint clean');
      expect(
        client.query(
          `select * from private.remove_addr_from_account('${accountId}', 'regenABC123')`,
        ),
      ).rejects.toThrow(
        'cannot remove, this address is not associated to the given account id',
      );
      await client.query('rollback to clean');
      client
        .query(`select * from private.get_addrs_by_account_id('${accountId}')`)
        .then(result => {
          expect(result.rowCount).toBe(1);
        });
    });
  });
  it('throws an error if account does not exist', async () => {
    await withRootDb(async client => {
      const accountId = '44b26018-e2ab-11ec-983d-0242ac160003';
      expect(
        client.query(
          `select * from private.remove_addr_from_account('${accountId}', '${walletAddr}')`,
        ),
      ).rejects.toThrow(
        'cannot remove, this address is not associated to the given account id',
      );
    });
  });
  it('does not remove an address from the wrong user', async () => {
    await withRootDb(async client => {
      const addr1 = 'regen123';
      const addr2 = 'regenABC';
      const { accountId: accountId1 } = await createAccount(client, addr1);
      const { accountId: accountId2 } = await createAccount(client, addr2);
      await client.query('savepoint clean');
      try {
        await client.query(
          `select * from private.remove_addr_from_account('${accountId1}', '${addr2}')`,
        );
      } catch (e) {
        expect(e.message).toBe(
          'cannot remove, this address is not associated to the given account id',
        );
        await client.query('rollback to clean');
      }
      client
        .query(`select * from private.get_addrs_by_account_id('${accountId1}')`)
        .then(result => {
          expect(result.rowCount).toBe(1);
        });
      client
        .query(`select * from private.get_addrs_by_account_id('${accountId2}')`)
        .then(result => {
          expect(result.rowCount).toBe(1);
        });
    });
  });
  it('successfully removes an address from an account', async () => {
    await withRootDb(async client => {
      const { accountId } = await createAccount(client, walletAddr);
      const resp = await client.query(
        `select * from private.get_parties_by_account_id('${accountId}')`,
      );
      const [{ id: partyId }] = resp.rows;
      await client.query(
        `select * from private.remove_addr_from_account('${accountId}', '${walletAddr}')`,
      );
      client
        .query(`select * from private.get_addrs_by_account_id('${accountId}')`)
        .then(result => {
          expect(result.rowCount).toBe(0);
        });
      client
        .query(`select count(*) from party where id = '${partyId}'`)
        .then(result => {
          expect(result.rowCount).toBe(1);
        });
    });
  });
});
