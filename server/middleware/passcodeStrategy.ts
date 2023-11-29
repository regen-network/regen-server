import * as env from 'env-var';
import ms from 'ms';
import { pgPool } from 'common/pool';
import { PoolClient } from 'pg';
import { Strategy as CustomStrategy } from 'passport-custom';
import {
  InvalidLoginParameter,
  UnauthorizedError,
  NotFoundError,
} from '../errors';
import { UserRequest } from '../types';

export const PASSCODE_EXPIRES_IN_DEFAULT = '5 minutes';
export const PASSCODE_MAX_TRY_COUNT_DEFAULT = 3;

export function PasscodeStrategy(): CustomStrategy {
  return new CustomStrategy(async function (req: UserRequest, done) {
    let client: PoolClient | null = null;
    try {
      client = await pgPool.connect();
      const { email, passcode } = req.body;
      const currentAccountId = req.user?.accountId;
      const accountId = await verifyPasscode({
        email,
        passcode,
        currentAccountId,
        client,
      });
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
  client: PoolClient;
};

/**
 * Deletes unconsumed passcodes and create a new passcode for the given email
 * @param createPasscodeParams Params for createPasscode function
 * @param createPasscodeParams.email The email of the user requesting a passcode to sign in
 * @param createPasscodeParams.client The pg PoolClient
 * @returns Promise<passcode>
 */
export async function createPasscode({ email, client }: CreatePasscodeParams) {
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
}

type VerifyPasscodeParams = {
  email?: string;
  passcode?: string;
  currentAccountId?: string;
  client: PoolClient;
};

/**
 * Verifies that the provided passcode matches with the given email,
 * if so, either it updates the currently logged in account email or
 * it creates an account in the database if it doesn't exist
 * and returns the account id
 * @param verifyPasscodeParams Params for createPasscode function
 * @param verifyPasscodeParams.email The email of the user providing a passcode to sign in
 * @param verifyPasscodeParams.passcode The passcode to verify
 * @param verifyPasscodeParams.currentAccountId The id of the currently logged in account if any
 * @param verifyPasscodeParams.client The pg PoolClient
 * @returns Promise<passcode>
 */
export async function verifyPasscode({
  email,
  passcode,
  currentAccountId,
  client,
}: VerifyPasscodeParams) {
  if (!email || !passcode) {
    throw new InvalidLoginParameter('Invalid email or passcode parameter');
  }
  const passcodeQuery = await client.query(
    'select * from private.passcode where email = $1 and consumed = false limit 1',
    [email],
  );
  if (passcodeQuery.rowCount === 1) {
    const [{ id, code, created_at, max_try_count }] = passcodeQuery.rows;

    const expiresIn = env
      .get('PASSCODE_EXPIRES_IN')
      .default(PASSCODE_EXPIRES_IN_DEFAULT)
      .asString();
    const expiresInMs = ms(expiresIn);
    if (new Date(created_at).getTime() + expiresInMs < Date.now()) {
      throw new UnauthorizedError('passcode.expired');
    }

    const maxTryCount = env
      .get('PASSCODE_MAX_TRY_COUNT')
      .default(PASSCODE_MAX_TRY_COUNT_DEFAULT)
      .asIntPositive();
    if (max_try_count >= maxTryCount) {
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

    // There's an account currently logged in,
    // This is a request to add the email to it
    if (currentAccountId) {
      const currentAccountQuery = await client.query(
        'select email from private.account where id = $1',
        [currentAccountId],
      );
      if (currentAccountQuery.rowCount === 1) {
        const [{ email: currentAccountEmail }] = currentAccountQuery.rows;
        // For now, only account without any email can update it
        if (!currentAccountEmail) {
          await client.query(
            'update private.account set email = $1 where id = $2',
            [email, currentAccountId],
          );
          return currentAccountId;
        } else {
          throw new Error('This account already has an email');
        }
      } else {
        throw new NotFoundError('Account not found');
      }
    } else {
      const accountQuery = await client.query(
        'select id from private.account where email = $1',
        [email],
      );
      if (accountQuery.rowCount === 1) {
        const [{ id: accountId }] = accountQuery.rows;
        return accountId;
      } else {
        const createAccountQuery = await client.query(
          'select * from private.create_new_web2_account($1, $2)',
          ['user', email],
        );
        if (createAccountQuery.rowCount === 1) {
          const [{ create_new_web2_account: accountId }] =
            createAccountQuery.rows;
          await client.query('select private.create_auth_user($1)', [
            accountId,
          ]);
          return accountId;
        }
      }
    }
  } else {
    throw new NotFoundError('passcode.not_found');
  }
}
