import { pubkeyToAddress, decodeSignature } from '@cosmjs/amino';
import { Strategy as CustomStrategy } from 'passport-custom';
import { verifyADR36Amino } from '@keplr-wallet/cosmos';
import { PoolClient } from 'pg';
import { pgPool } from 'common/pool';

export class InvalidLoginParameter extends Error {
  constructor(message: string) {
    super(message);
  }
}

function KeplrStrategy() {
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
            await client.query(`create role ${address} in role auth_user`);
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

export function initializePassport(app, passport) {
  app.use(passport.initialize());
  app.use(passport.session());

  passport.serializeUser(function (user, done) {
    // todo: it's possible that code in serialize/deserialize
    // should be wrapped in process.nextTick (there's references
    // to this in the passport.js docs, probably just performance
    // related).
    //
    // serialize is about what will end up in the http-only session
    // cookie in terms of user data. very important to not include
    // private information here.
    console.log(`serializeUser user: ${JSON.stringify(user)}`)
    done(null, { id: user.id , address: user.address });
  });

  passport.deserializeUser(function (user, done) {
    // deserialize is about what ends up in req.user when the session
    // cookie gets parsed. private info should be carefully handled
    // here, as it could potentially expose that info if this is being
    // used in a response.
    console.log(`deserializeUser user: ${JSON.stringify(user)}`);
    const { id, address } = user;
    // todo: add more fields here probably based on a lookup in db...
    done(null, { id, address });
  });

  passport.use('keplr', KeplrStrategy());
}
