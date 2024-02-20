import { Pool, PoolClient, QueryResult } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const pools = {};

if (!process.env.TEST_DATABASE_URL) {
  throw new Error('Cannot run tests without a TEST_DATABASE_URL');
}
const TEST_DATABASE_URL: string = process.env.TEST_DATABASE_URL;

beforeAll(() => {
  // TODO
});

// Make sure we release those pgPools so that our tests exit!
afterAll(() => {
  const keys = Object.keys(pools);
  return Promise.all(
    keys.map(async key => {
      try {
        const pool = pools[key];
        delete pools[key];
        await pool.end();
      } catch (e) {
        console.error('Failed to release connection!');
        console.error(e);
      }
    }),
  );
});

export const poolFromUrl = (url: string): Pool => {
  if (!pools[url]) {
    pools[url] = new Pool({ connectionString: url });
  }
  return pools[url];
};

type ClientCallback<T = any> = (client: PoolClient) => Promise<T>;

const withDbFromUrl = async <T>(
  url: string,
  fn: ClientCallback<T>,
  commit = false,
): Promise<void> => {
  const pool = poolFromUrl(url);
  const client = await pool.connect();
  await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE;');

  try {
    // because this callback function has a client that has had a
    // postgresql transaction initiated, you need to be aware that
    // in downstream code, if your SQL raises any exception, this
    // transaction will be put into an aborted state. if you wish
    // to avoid these abort states downstream, you will need to make
    // use of SAVEPOINT and ROLLBACK TO.
    // ref: https://www.postgresql.org/docs/current/tutorial-transactions.html
    await fn(client);
  } catch (e) {
    // Error logging can be helpful:
    if (typeof e.code === 'string' && e.code.match(/^[0-9A-Z]{5}$/)) {
      console.error([e.message, e.code, e.detail, e.hint, e.where].join('\n'));
    }
    throw e;
  } finally {
    if (!commit) await client.query('ROLLBACK');
    else await client.query('COMMIT');
    await client.query('RESET ALL'); // Shouldn't be necessary, but just in case...
    client.release();
  }
};

export const withRootDb = <T>(
  fn: ClientCallback<T>,
  commit = false,
): Promise<void> => withDbFromUrl(TEST_DATABASE_URL, fn, commit);

export const becomeRoot = (client: PoolClient): Promise<QueryResult<any>> =>
  client.query(`set role "${process.env.TEST_DATABASE_USER}"`);

export const becomeUser = async (
  client: PoolClient,
  userSub: string,
): Promise<void> => {
  await becomeRoot(client);
  await client.query(`set role "${userSub}"`);
};

export const becomeAuthUser = async (
  client: PoolClient,
  accountId: string,
): Promise<void> => {
  await becomeRoot(client);
  await client.query(`set role "${accountId}"`);
};

export const withAuthUserDb = <T>(
  addr: string,
  fn: (client: PoolClient) => Promise<T>,
): Promise<void> =>
  withRootDb(async client => {
    const { accountId } = await createAccountWithAuthUser(client, addr);
    await becomeAuthUser(client, accountId);
    await fn(client);
  });

export async function createAccountWithAuthUser(
  client: PoolClient,
  walletAddr: string,
  accountType: 'user' | 'organization' = 'user',
): Promise<{ accountId: string }> {
  const result = await client.query(
    `select * from private.create_new_account_with_wallet('${walletAddr}', '${accountType}') as account_id`,
  );
  const [{ account_id: accountId }] = result.rows;
  try {
    await client.query('select private.create_auth_user($1)', [accountId]);
  } catch {}
  return { accountId };
}

export async function createAccount(
  client: PoolClient,
  walletAddr: string,
  accountName: string,
  accountType: 'user' | 'organization' = 'user',
  creatorAccountId?: string,
): Promise<{ accountId: string; creatorId: string }> {
  const accountRes = await client.query(
    `insert into account (name, type, addr, creator_id) values ($1, $2, $3, $4) returning id, creator_id`,
    [accountName, accountType, walletAddr, creatorAccountId],
  );
  expect(accountRes.rowCount).toBe(1);
  const [{ id: accountId, creator_id: creatorId }] = accountRes.rows;

  return { accountId, creatorId };
}
