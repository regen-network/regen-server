import ms from 'ms';
import {
  createPasscode,
  verifyPasscode,
} from '../../middleware/passcodeStrategy';
import { withRootDb } from '../db/helpers';
import { PoolClient } from 'pg';

const email = 'john@doe.com';

describe('auth create passcode', () => {
  it('should delete unconsumed passcode and create a new passcode for the email', async () => {
    await withRootDb(async (client: PoolClient) => {
      // inserting some passcode which will remain unconsumed
      const insQuery = await client.query(
        'INSERT INTO private.passcode (email) values ($1) returning code',
        [email],
      );
      const existingCode = insQuery.rows[0].code;

      await createPasscode({ email, client });

      const passcodeQuery = await client.query(
        'SELECT * FROM private.passcode WHERE email = $1 AND consumed = false',
        [email],
      );
      // only the new unconsumed passcode remaining
      expect(passcodeQuery.rowCount).toBe(1);
      expect(passcodeQuery.rows[0].code).not.toEqual(existingCode);
    });
  });
  it('should throw an error if email is not provided', async () => {
    await withRootDb(async (client: PoolClient) => {
      expect(createPasscode({ client })).rejects.toThrow(
        'Invalid email parameter',
      );
    });
  });
});

describe('auth verify passcode', () => {
  it('when a user signs in for the first time with a valid code, a new account and role should be created', async () => {
    await withRootDb(async (client: PoolClient) => {
      const passcode = await createPasscode({ email, client });
      const accountId = await verifyPasscode({ email, passcode, client });

      const accountQuery = await client.query(
        'SELECT * FROM account WHERE email = $1',
        [email],
      );
      expect(accountQuery.rowCount).toBe(1);
      expect(accountQuery.rows[0].id).toEqual(accountId);

      const roleQuery = await client.query(
        'SELECT 1 FROM pg_roles WHERE rolname = $1',
        [accountId],
      );
      expect(roleQuery.rowCount).toBe(1);

      const passcodeQuery = await client.query(
        'SELECT * FROM private.passcode WHERE code = $1',
        [passcode],
      );
      expect(passcodeQuery.rowCount).toBe(1);
      expect(passcodeQuery.rows[0].consumed).toEqual(true);
    });
  });
  it('when an existing user signs in with a valid code, it should return the user account id', async () => {
    await withRootDb(async (client: PoolClient) => {
      const insertQuery = await client.query(
        'INSERT INTO account (type, email) values ($1, $2) returning id',
        ['user', email],
      );
      const [{ id: newAccountId }] = insertQuery.rows;
      await client.query('select private.create_auth_user($1)', [newAccountId]);

      const passcode = await createPasscode({ email, client });
      const accountId = await verifyPasscode({ email, passcode, client });

      expect(newAccountId).toEqual(accountId);

      const passcodeQuery = await client.query(
        'SELECT * FROM private.passcode WHERE code = $1',
        [passcode],
      );
      expect(passcodeQuery.rowCount).toBe(1);
      expect(passcodeQuery.rows[0].consumed).toEqual(true);
    });
  });
  it('should throw an error if email is not provided', async () => {
    await withRootDb(async (client: PoolClient) => {
      expect(verifyPasscode({ passcode: '123456', client })).rejects.toThrow(
        'Invalid email or passcode parameter',
      );
    });
  });
  it('should throw an error if passcode is not provided', async () => {
    await withRootDb(async (client: PoolClient) => {
      expect(verifyPasscode({ email, client })).rejects.toThrow(
        'Invalid email or passcode parameter',
      );
    });
  });
  it("should throw an error if there's no existing passcode for the email", async () => {
    await withRootDb(async (client: PoolClient) => {
      expect(
        verifyPasscode({ email, passcode: 'AAAAAA', client }),
      ).rejects.toThrow('passcode.not_found');
    });
  });
  it('should throw an error if passcode has expired', async () => {
    await withRootDb(async (client: PoolClient) => {
      const insertQuery = await client.query(
        'INSERT INTO private.passcode (created_at, email) values ($1, $2) returning code',
        [
          new Date(Date.now() - ms(process.env.PASSCODE_EXPIRES_IN) - 100),
          email,
        ],
      );
      const [{ code }] = insertQuery.rows;

      expect(verifyPasscode({ email, passcode: code, client })).rejects.toThrow(
        'passcode.expired',
      );
    });
  });
  it('should throw an error if max retry count is exceeding', async () => {
    await withRootDb(async (client: PoolClient) => {
      await createPasscode({ email, client });
      expect(
        verifyPasscode({ email, passcode: 'WRONG 1', client }),
      ).rejects.toThrow('passcode.code_mismatch');
      expect(
        verifyPasscode({ email, passcode: 'WRONG 2', client }),
      ).rejects.toThrow('passcode.code_mismatch');
      expect(
        verifyPasscode({ email, passcode: 'WRONG 3', client }),
      ).rejects.toThrow('passcode.code_mismatch');

      expect(
        verifyPasscode({ email, passcode: 'WRONG 4', client }),
      ).rejects.toThrow('passcode.exceed_max_try');
    });
  });
  it('should throw an error if the wrong code is provided', async () => {
    await withRootDb(async (client: PoolClient) => {
      await createPasscode({ email, client });

      expect(
        verifyPasscode({ email, passcode: 'WRONG', client }),
      ).rejects.toThrow('passcode.code_mismatch');
    });
  });
});
