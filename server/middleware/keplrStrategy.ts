import { pubkeyToAddress, decodeSignature } from '@cosmjs/amino';
import { verifyADR36Amino } from '@keplr-wallet/cosmos';
import { pgPool } from 'common/pool';
import { PoolClient } from 'pg';
import { Strategy as CustomStrategy } from 'passport-custom';
import { InvalidLoginParameter } from '../errors';

export function KeplrStrategy(): CustomStrategy {
  return new CustomStrategy(async function (req, done) {
    let client: PoolClient;
    try {
      const { signature, profileType } = req.body;
      if (!signature) {
        throw new InvalidLoginParameter('invalid signature parameter');
      } else if (
        !profileType ||
        !['user', 'organization'].includes(profileType)
      ) {
        throw new InvalidLoginParameter('invalid profileType parameter');
      }
      const address = pubkeyToAddress(signature.pub_key, 'regen');
      // is there an existing account for the given address?
      client = await pgPool.connect();
      const account = await client.query(
        'select a.id, a.nonce from private.get_account_by_addr($1) q join account a on a.id = q.id',
        [address],
      );
      if (account.rowCount === 1) {
        // if yes, then we need to verify this signature accounting for the nonce.
        const [{ id, nonce }] = account.rows;
        const { pubkey: decodedPubKey, signature: decodedSignature } =
          decodeSignature(signature);
        const data = JSON.stringify({
          title: 'Regen Network Login',
          description:
            'This is a transaction that allows Regen Network to authenticate you with our application.',
          nonce: nonce,
        });
        // generate a new nonce for the user to invalidate the current
        // signature...
        await client.query(
          'update account set nonce = md5(random()::text) where id = $1',
          [id],
        );
        // https://github.com/chainapsis/keplr-wallet/blob/master/packages/cosmos/src/adr-36/amino.ts
        const verified = verifyADR36Amino(
          'regen',
          address,
          data,
          decodedPubKey,
          decodedSignature,
        );
        if (verified) {
          return done(null, { id: id, address: address, nonce: nonce });
        } else {
          return done(null, false);
        }
      } else {
        const { pubkey: decodedPubKey, signature: decodedSignature } =
          decodeSignature(signature);
        const data = JSON.stringify({
          title: 'Regen Network Login',
          description:
            'This is a transaction that allows Regen Network to authenticate you with our application.',
          nonce: '', // an empty string since this is an account creation login..
        });
        // https://github.com/chainapsis/keplr-wallet/blob/master/packages/cosmos/src/adr-36/amino.ts
        const verified = verifyADR36Amino(
          'regen',
          address,
          data,
          decodedPubKey,
          decodedSignature,
        );
        if (verified) {
          // if no, then we need to create a new account, and then log them in.
          try {
            try {
              await client.query(`create role ${address} in role auth_user`);
            } catch (err) {
              if (err.message !== `role "${address}" already exists`) {
                throw err;
              }
            }
            await client.query(
              'select * from private.create_new_account($1, $2)',
              [address, profileType],
            );
          } catch (err) {
            if (
              err.toString() !==
              'error: this addr belongs to a different account'
            ) {
              throw err;
            }
          }
          const newAccount = await client.query(
            'select a.id, a.nonce from private.get_account_by_addr($1) q join account a on a.id = q.id',
            [address],
          );
          const [{ id, nonce }] = newAccount.rows;
          return done(null, { id: id, address: address, nonce: nonce });
        } else {
          return done(null, false);
        }
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
