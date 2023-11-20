import { withRootDb } from '../../helpers';

const email = 'john@doe.com';
const type = 'user';
const googleId = '12345';

describe('create_new_account_with_wallet', () => {
  it('should be able to create a new account with an email', async () => {
    await withRootDb(async client => {
      const query = await client.query(
        'select * from private.create_new_web2_account($1, $2)',
        [type, email],
      );
      const [{ create_new_web2_account: accountId }] = query.rows;

      // public account info
      const accountQuery = await client.query(
        'select * from public.account where id = $1',
        [accountId],
      );
      expect(accountQuery.rowCount).toBe(1);
      expect(accountQuery.rows[0].type).toBe(type);

      // private account info
      const privateAccountQuery = await client.query(
        'select * from private.account where id = $1',
        [accountId],
      );
      expect(privateAccountQuery.rowCount).toBe(1);
      expect(privateAccountQuery.rows[0].email).toBe(email);
    });
  });
  it('should be able to create a new account with an email and a google id', async () => {
    await withRootDb(async client => {
      const query = await client.query(
        'select * from private.create_new_web2_account($1, $2, $3)',
        [type, email, googleId],
      );
      const [{ create_new_web2_account: accountId }] = query.rows;

      // public account info
      const accountQuery = await client.query(
        'select * from public.account where id = $1',
        [accountId],
      );
      expect(accountQuery.rowCount).toBe(1);
      expect(accountQuery.rows[0].type).toBe(type);

      // private account info
      const privateAccountQuery = await client.query(
        'select * from private.account where id = $1',
        [accountId],
      );
      expect(privateAccountQuery.rowCount).toBe(1);
      expect(privateAccountQuery.rows[0].email).toBe(email);
      expect(privateAccountQuery.rows[0].google).toBe(googleId);
    });
  });
});
