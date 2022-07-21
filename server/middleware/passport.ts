import { pubkeyToAddress, decodeSignature } from '@cosmjs/amino';
import { Random } from '@cosmjs/crypto';
import { Strategy as CustomStrategy } from 'passport-custom';
import { verifyADR36Amino } from '@keplr-wallet/cosmos';
import { PoolClient } from 'pg';
import { pgPool } from 'common/pool';

const genNonce = () => {
  const bytes = Random.getBytes(128);
  const hex = Buffer.from(bytes).toString('hex');
  return hex;
};

const users = [
  {
    id: 1,
    username: 'kyle',
    password: 'password',
    address: 'regen1rn2mn8p0j3kqgglf7kpn8eshymgy5sm8w4wmj4',
    nonce: genNonce(),
  },
];

const fetchUserById = userId => {
  for (const user of users) {
    if (user.id === userId) {
      return {
        id: user.id,
        username: user.username,
        address: user.address,
        nonce: user.nonce,
      };
    }
  }
};

const fetchUserByAddress = userAddress => {
  for (const user of users) {
    if (user.address === userAddress) {
      return {
        id: user.id,
        username: user.username,
        address: user.address,
        nonce: user.nonce,
      };
    }
  }
};

export class InvalidLoginParameter extends Error {
  constructor(message: string) {
    super(message);
  }
}

function KeplrStrategy() {
  return new CustomStrategy(async function (req, done) {
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
      for (const user of users) {
        // assume 1-1 map between a given user and an address.
        if (address === user.address) {
          const { pubkey: decodedPubKey, signature: decodedSignature } =
            decodeSignature(signature);
          const data = JSON.stringify({
            title: 'Regen Network Login',
            description:
              'This is a transaction that allows Regen Network to authenticate you with our application.',
            nonce: user.nonce,
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
            let client: PoolClient;
            try {
              client = await pgPool.connect();
              try {
                const create = await client.query(
                  'select * from private.create_new_account($1, $2)',
                  [address, profileType],
                );
                console.log(create);
              } catch (err) {
                console.log(err);
              }
              const account = await client.query(
                'select id from private.get_account_by_addr($1)',
                [address],
              );
              console.log(account);
            } finally {
              if (client) {
                client.release();
              }
            }
            // generate a new nonce for the user to invalidate the current
            // signature...
            user.nonce = genNonce();
            return done(null, fetchUserById(user.id));
          } else {
            return done(null, false);
          }
        }
      }
    } catch (err) {
      return done(err);
    }
    return done(null, false);
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
    done(null, { userId: user.id });
  });

  passport.deserializeUser(function (user, done) {
    // deserialize is about what ends up in req.user when the session
    // cookie gets parsed. private info should be carefully handled
    // here, as it could potentially expose that info if this is being
    // used in a response.
    const { userId } = user;
    done(null, fetchUserById(userId));
  });

  passport.use('keplr', KeplrStrategy());
}
