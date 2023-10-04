import { genRandomRegenAddress } from '../../../utils';
import { createAccount, withRootDb } from '../../helpers';

const walletAddr = genRandomRegenAddress();

describe('party has account or creator', () => {
  test('that a party cannot have both an account_id and a creator_id', async () => {
    await withRootDb(async client => {
      const { accountId } = await createAccount(client, walletAddr);
      expect(
        client.query(`update party set creator_id = $1 where account_id = $2`, [
          accountId,
          accountId,
        ]),
      ).rejects.toThrow(
        `new row for relation "party" violates check constraint "cannot_have_account_and_creator"`,
      );
    });
  });
});
