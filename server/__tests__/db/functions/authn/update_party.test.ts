import { genRandomRegenAddress } from '../../../utils';
import {
  becomeAuthUser,
  createAccount,
  withAuthUserDb,
  withRootDb,
} from '../../helpers';

const walletAddr = genRandomRegenAddress();

describe('update party', () => {
  test('that a user can update a party that belongs to them', async () => {
    await withRootDb(async client => {
      const accountId = await createAccount(client, walletAddr);
      await becomeAuthUser(client, walletAddr, accountId);
      const result = await client.query(
        `update party set name = 'my updated name'`,
      );
      expect(result.rowCount).toBe(1);
    });
  });

  test('that any other user cannot update another users party', async () => {
    await withRootDb(async client => {
      const accountId = await createAccount(client, walletAddr);
      const walletAddr2 = genRandomRegenAddress();
      const accountId2 = await createAccount(client, walletAddr2);
      await becomeAuthUser(client, walletAddr, accountId);
      const result = await client.query(
        `update party set name = 'my updated name'`,
      );
      expect(result.rowCount).toBe(1);
      await becomeAuthUser(client, walletAddr2, accountId2);
      client
        .query(
          `select p.name from wallet w join party p on p.wallet_id = w.id where w.addr = '${walletAddr2}'`,
        )
        .then(res => {
          const name = res.rows[0].name;
          expect(name).toBe('');
        });
    });
  });

  test('that a user can update a party that he/she created', async () => {
    await withRootDb(async client => {
      const creatorAccountId = await createAccount(client, walletAddr);
      await becomeAuthUser(client, walletAddr, creatorAccountId);
      const insertResult = await client.query(
        `insert into party (type, creator_id) values ('user', $1) returning id`,
        [creatorAccountId],
      );
      const [{ id }] = insertResult.rows;
      const updateResult = await client.query(
        `update party set name = 'my updated name' where id = $1`,
        [id],
      );
      expect(updateResult.rowCount).toBe(1);
    });
  });

  test('that superusers can update wallet_id', async () => {
    await withRootDb(async client => {
      const insertResult = await client.query(
        `INSERT INTO party (type) values ('user') RETURNING id`,
      );
      const [{ id }] = insertResult.rows;
      const walletInsertResult = await client.query(
        'INSERT INTO wallet (addr) values ($1) RETURNING id',
        [walletAddr],
      );
      const [{ id: walletId }] = walletInsertResult.rows;
      const updateWalletResult = await client.query(
        'UPDATE party SET wallet_id = $1 WHERE id = $2',
        [walletId, id],
      );
      expect(updateWalletResult.rowCount).toBe(1);
    });
  });

  test('that superusers can update account_id', async () => {
    await withRootDb(async client => {
      const accountId = await createAccount(client, walletAddr);
      const insertResult = await client.query(
        `INSERT INTO party (type) values ('user') RETURNING id`,
      );
      const [{ id }] = insertResult.rows;
      const updateAccountResult = await client.query(
        'UPDATE party SET account_id = $1 WHERE id = $2',
        [accountId, id],
      );
      expect(updateAccountResult.rowCount).toBe(1);
    });
  });

  test('that superusers can update creator_id', async () => {
    await withRootDb(async client => {
      const accountId = await createAccount(client, walletAddr);
      const insertResult = await client.query(
        `INSERT INTO party (type) values ('user') RETURNING id`,
      );
      const [{ id }] = insertResult.rows;
      const updateCreatorResult = await client.query(
        'UPDATE party SET creator_id = $1 WHERE id = $2',
        [accountId, id],
      );
      expect(updateCreatorResult.rowCount).toBe(1);
    });
  });

  it('that non-superusers cannot update wallet_id', async () => {
    const walletAddr = genRandomRegenAddress();
    await withAuthUserDb(walletAddr, async (client, accountId) => {
      const partyResult = await client.query(
        `SELECT id FROM party WHERE account_id = $1`,
        [accountId],
      );
      const [{ id }] = partyResult.rows;
      const walletAddr2 = genRandomRegenAddress();
      const insertWalletResult = await client.query(
        `INSERT INTO wallet (addr) values ($1) RETURNING id`,
        [walletAddr2],
      );
      const [{ id: wallet2Id }] = insertWalletResult.rows;
      const r = await client.query('UPDATE party SET name = $1 WHERE id = $2', [
        'name',
        id,
      ]);
      console.log('ROWS', r.rows);
      expect(
        client.query('UPDATE party SET wallet_id = $1 WHERE id=$2', [
          wallet2Id,
          id,
        ]),
      ).rejects.toThrow('permission denied for table party');
    });
  });

  // test('that non-superusers cannot update wallet_id', async () => {
  //   await withRootDb(async client => {
  //     const accountId = await createAccount(client, walletAddr);
  //     const walletAddr2 = genRandomRegenAddress();
  //     const insertWalletResult = await client.query(
  //       `INSERT INTO wallet (addr) values ($1) RETURNING id`,
  //       [walletAddr2],
  //     );
  //     const [{ id: walletId }] = insertWalletResult.rows;
  //     await becomeAuthUser(client, walletAddr, accountId);
  //     // const partyResult = await client.query(
  //     //   'select id from party where account_id = $1',
  //     //   [accountId],
  //     // );
  //     // const [{ id }] = partyResult.rows;
  //     const r = await client.query(
  //       `update party set wallet_id = $1 where account_id = $2`,
  //       [walletId, accountId],
  //     );
  //     console.log('RESULT', r);
  //     expect(
  //       client.query(`update party set wallet_id = $1 where account_id = $2`, [
  //         walletId,
  //         accountId,
  //       ]),
  //     ).rejects.toThrow('permission denied for table party');
  //   });
  // });

  // test('that non-superusers cannot update wallet_id, account_id and creator_id', async () => {
  //   await withAuthUserDb(walletAddr, async client => {
  //     const addrsQ = await client.query(
  //       'select wallet_id from get_current_addrs() where addr=$1',
  //       [walletAddr],
  //     );
  //     const [{ wallet_id }] = addrsQ.rows;
  //     const insertResult = await client.query(
  //       'INSERT INTO party (account_id) VALUES ($1) RETURNING id AS project_id',
  //       [wallet_id],
  //     );
  //     const [{ project_id }] = insertResult.rows;
  //     expect(
  //       client.query("UPDATE project SET approved = 't' WHERE id=$1", [
  //         project_id,
  //       ]),
  //     ).rejects.toThrow('permission denied for table project');
  //   });
  // });
});
