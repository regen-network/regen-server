import { pubkeyToAddress, decodeSignature } from '@cosmjs/amino';
import { verifyADR36Amino } from '@keplr-wallet/cosmos';
import { pgPool } from 'common/pool';
import { PoolClient } from 'pg';
import { Strategy as CustomStrategy } from 'passport-custom';
import { InvalidLoginParameter } from '../errors';

export function genArbitraryLoginData(nonce: string): string {
  const data = JSON.stringify({
    title: 'Regen Network Login',
    description:
      'This is a transaction that allows Regen Network to authenticate you with our application.',
    nonce: nonce,
  });
  return data;
}

export function genArbitraryAddAddressData(nonce: string): string {
  const data = JSON.stringify({
    title: 'Regen Network Login',
    description:
      'This is a transaction that allows Regen Network to add an address to your account.',
    nonce: nonce,
  });
  return data;
}

export function KeplrStrategy(): CustomStrategy {
  return new CustomStrategy(async function (req, done) {
    let client: PoolClient;
    try {
      const { signature } = req.body;
      if (!signature) {
        throw new InvalidLoginParameter('invalid signature parameter');
      }
      const address = pubkeyToAddress(signature.pub_key, 'regen');
      // is there an existing account for the given address?
      client = await pgPool.connect();
      const account = await client.query(
        'select a.id, a.nonce from private.get_account_by_addr($1) q join account a on a.id = q.id',
        [address],
      );
      if (account.rowCount === 1) {
        // if there is an existing account, then we need to verify the signature and log them in.
        const [{ id, nonce }] = account.rows;
        const { pubkey: decodedPubKey, signature: decodedSignature } =
          decodeSignature(signature);
        const data = genArbitraryLoginData(nonce);
        // generate a new nonce for the user to invalidate the current
        // signature...
        await client.query(
          'update account set nonce = md5(gen_random_bytes(256)) where id = $1',
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
        const party = await client.query(
          'select party.id from party join wallet on wallet.id = party.wallet_id where wallet.addr = $1',
          [address],
        );
        const [{ id: partyId }] = party.rows;
        console.dir(
          { message: 'existing account path...', partyId },
          { depth: null },
        );
        if (verified) {
          return done(null, {
            id: id,
            address: address,
            nonce: nonce,
            partyId,
          });
        } else {
          return done(null, false);
        }
      } else {
        // if there was no existing account, then we need to verify the signature, create a new account, and then log them in.
        const { pubkey: decodedPubKey, signature: decodedSignature } =
          decodeSignature(signature);
        const data = genArbitraryLoginData(''); //  an empty string since this is an account creation login..
        // https://github.com/chainapsis/keplr-wallet/blob/master/packages/cosmos/src/adr-36/amino.ts
        const verified = verifyADR36Amino(
          'regen',
          address,
          data,
          decodedPubKey,
          decodedSignature,
        );
        if (verified) {
          const DEFAULT_PROFILE_TYPE = 'user';
          try {
            try {
              await client.query('select private.create_auth_user($1)', [
                address,
              ]);
            } catch (err) {
              if (err.message !== `role "${address}" already exists`) {
                throw err;
              }
            }
            await client.query(
              'select * from private.create_new_account($1, $2)',
              [address, DEFAULT_PROFILE_TYPE],
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
          const party = await client.query(
            'select party.id from party join wallet on wallet.id = party.wallet_id where wallet.addr = $1',
            [address],
          );
          const [{ id: partyId }] = party.rows;
          console.dir(
            { message: 'new account path...', partyId },
            { depth: null },
          );
          return done(null, {
            id: id,
            address: address,
            nonce: nonce,
            partyId,
          });
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
