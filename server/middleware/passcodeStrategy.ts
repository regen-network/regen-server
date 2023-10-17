import { pubkeyToAddress, decodeSignature } from '@cosmjs/amino';
import { verifyADR36Amino } from '@keplr-wallet/cosmos';
import { pgPool } from 'common/pool';
import { PoolClient } from 'pg';
import { Strategy as CustomStrategy } from 'passport-custom';
import { InvalidLoginParameter } from '../errors';

export function PasscodeStrategy(): CustomStrategy {
  return new CustomStrategy(async function (req, done) {
    let client: PoolClient;
    try {
      const { email, passcode } = req.body;
      if (!email || !passcode) {
        throw new InvalidLoginParameter('invalid email or passcode parameter');
      }
      client = await pgPool.connect();
      const verified = true;
      if (verified) {
        return done(null, { accountId: '123' });
      } else {
        return done(null, false);
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
