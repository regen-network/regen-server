import { genRandomRegenAddress } from '../../../utils';
import {
  becomeAuthUser,
  createAccountWithAuthUser,
  withRootDb,
} from '../../helpers';

const walletAddr = genRandomRegenAddress();

describe('UPDATE account', () => {
  test('that a user can update a account that belongs to them', async () => {
    await withRootDb(async client => {
      const { accountId } = await createAccountWithAuthUser(client, walletAddr);
      await becomeAuthUser(client, accountId);
      const result = await client.query(
        `UPDATE account set name = 'my updated name'`,
      );
      expect(result.rowCount).toBe(1);
    });
  });

  test('that any other user cannot update another users account', async () => {
    await withRootDb(async client => {
      const { accountId } = await createAccountWithAuthUser(client, walletAddr);
      const walletAddr2 = genRandomRegenAddress();
      const { accountId: accountId2 } = await createAccountWithAuthUser(
        client,
        walletAddr2,
      );
      await becomeAuthUser(client, accountId);
      const result = await client.query(
        `UPDATE account set name = 'my updated name'`,
      );
      expect(result.rowCount).toBe(1);
      await becomeAuthUser(client, accountId2);
      client.query('select name from get_current_account()').then(res => {
        const name = res.rows[0].name;
        expect(name).toBe('');
      });
    });
  });

  test('that a user can update a account that he/she created', async () => {
    await withRootDb(async client => {
      const { accountId: creatorAccountId } = await createAccountWithAuthUser(
        client,
        walletAddr,
      );
      await becomeAuthUser(client, creatorAccountId);
      const insertResult = await client.query(
        `INSERT INTO account (type, creator_id) values ('user', $1) returning id`,
        [creatorAccountId],
      );
      const [{ id }] = insertResult.rows;
      const updateResult = await client.query(
        `UPDATE account set name = 'my updated name' where id = $1`,
        [id],
      );
      expect(updateResult.rowCount).toBe(1);
    });
  });
});
