import { genRandomRegenAddress } from '../../../utils';
import { becomeAuthUser, createAccount, withRootDb } from '../../helpers';

const walletAddr = genRandomRegenAddress();

describe('update party', () => {
  test('that a user can update a party that belongs to them', async () => {
    await withRootDb(async client => {
      const { accountId } = await createAccount(client, walletAddr);
      await becomeAuthUser(client, accountId);
      const result = await client.query(
        `update party set name = 'my updated name'`,
      );
      expect(result.rowCount).toBe(1);
    });
  });

  test('that any other user cannot update another users party', async () => {
    await withRootDb(async client => {
      const { accountId } = await createAccount(client, walletAddr);
      const walletAddr2 = genRandomRegenAddress();
      const { accountId: accountId2 } = await createAccount(
        client,
        walletAddr2,
      );
      await becomeAuthUser(client, accountId);
      const result = await client.query(
        `update party set name = 'my updated name'`,
      );
      expect(result.rowCount).toBe(1);
      await becomeAuthUser(client, accountId2);
      client.query('select name from get_current_party()').then(res => {
        const name = res.rows[0].name;
        expect(name).toBe('');
      });
    });
  });

  test('that a user can update a party that he/she created', async () => {
    await withRootDb(async client => {
      const { partyId: creatorPartyId } = await createAccount(
        client,
        walletAddr,
      );
      await becomeAuthUser(client, creatorPartyId);
      const insertResult = await client.query(
        `insert into party (type, creator_id) values ('user', $1) returning id`,
        [creatorPartyId],
      );
      const [{ id }] = insertResult.rows;
      const updateResult = await client.query(
        `update party set name = 'my updated name' where id = $1`,
        [id],
      );
      expect(updateResult.rowCount).toBe(1);
    });
  });
});
