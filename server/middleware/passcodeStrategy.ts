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
      const { email, passcode } = req.body;
      if (!email || !passcode) {
        throw new InvalidLoginParameter('invalid email or passcode parameter');
      }
      client = await pgPool.connect();

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
          const [{ id }] = accountQuery.rows;
          return done(null, { accountId: id });
        } else {
          const createPartyQuery = await client.query(
            'insert into account (type, email) values ($1, $2) returning id',
            ['user', email],
          );
          if (createPartyQuery.rowCount === 1) {
            const [{ id: createdPartyId }] = createPartyQuery.rows;
            return done(null, { accountId: createdPartyId });
          }
        }
      } else {
        throw new NotFoundError('passcode.not_found');
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
