import { pgPool } from 'common/pool';
import { PoolClient } from 'pg';
import { Strategy as CustomStrategy } from 'passport-custom';
import {
  InvalidLoginParameter,
  UnauthorizedError,
  NotFoundError,
} from '../errors';
import ms from 'ms';

export function PasscodeStrategy(): CustomStrategy {
  return new CustomStrategy(async function (req, done) {
    let client: PoolClient;
    try {
      client = await pgPool.connect();
      const { email, passcode } = req.body;
      const accountId = verifyPasscode({ email, passcode, client });
      if (accountId) {
        return done(null, { accountId });
      }
    } catch (err) {
      return done(err);
    } finally {
      if (client) {
        client.release();
      }
    }
  });
}

type CreatePasscodeParams = {
  email?: string;
  client?: PoolClient;
};

export async function createPasscode({ email, client }: CreatePasscodeParams) {
  try {
    if (!email) {
      throw new InvalidLoginParameter('Invalid email parameter');
    }

    // Delete unconsumed passcodes for the given email
    await client.query(
      'delete from private.passcode where email = $1 and consumed = false',
      [email],
    );

    // Create new passcode
    const passcodeResp = await client.query(
      'insert into private.passcode (email) values ($1) returning code',
      [email],
    );

    const passcode = passcodeResp.rows[0].code;
    return passcode;
  } catch (err) {
    throw new Error(err);
  }
}

type VerifyPasscodeParams = {
  email?: string;
  passcode?: string;
  client?: PoolClient;
};

export async function verifyPasscode({
  email,
  passcode,
  client,
}: VerifyPasscodeParams) {
  if (!email || !passcode) {
    throw new InvalidLoginParameter('Invalid email or passcode parameter');
  }
  try {
    const passcodeQuery = await client.query(
      'select * from private.passcode where email = $1 and consumed = false limit 1',
      [email],
    );
    if (passcodeQuery.rowCount === 1) {
      const [{ id, code, created_at, max_try_count }] = passcodeQuery.rows;

      const expiresInMs = ms(process.env.PASSCODE_EXPIRES_IN);
      if (new Date(created_at).getTime() + expiresInMs < Date.now()) {
        throw new UnauthorizedError('passcode.expired');
      }

      if (max_try_count >= process.env.PASSCODE_MAX_TRY_COUNT) {
        throw new UnauthorizedError('passcode.exceed_max_try');
      }

      if (code !== passcode) {
        await client.query(
          'update private.passcode set max_try_count = max_try_count + 1 where id = $1',
          [id],
        );
        throw new UnauthorizedError('passcode.code_mismatch');
      }

      await client.query(
        'update private.passcode set consumed = true where id = $1',
        [id],
      );

      const accountQuery = await client.query(
        'select id from account where email = $1',
        [email],
      );
      if (accountQuery.rowCount === 1) {
        const [{ id: accountId }] = accountQuery.rows;
        return accountId;
      } else {
        const createAccountQuery = await client.query(
          'insert into account (type, email) values ($1, $2) returning id',
          ['user', email],
        );
        if (createAccountQuery.rowCount === 1) {
          const [{ id: accountId }] = createAccountQuery.rows;
          await client.query('select private.create_auth_user($1)', [
            accountId,
          ]);
          return accountId;
        }
      }
    } else {
      throw new NotFoundError('passcode.not_found');
    }
  } catch (err) {
    throw new Error(err);
  }
}
