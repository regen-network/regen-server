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
    await client.query('ROLLBACK');
    await client.query('RESET ALL'); // Shouldn't be necessary, but just in case...
    await client.release();
  }
};

export const withRootDb = <T>(fn: ClientCallback<T>): Promise<void> =>
  withDbFromUrl(TEST_DATABASE_URL, fn);

export const becomeRoot = (client: PoolClient): Promise<QueryResult<any>> =>
  client.query(`set role "${process.env.TEST_DATABASE_USER}"`);

export const becomeUser = async (
  client: PoolClient,
  userSub: string,
): Promise<void> => {
  await becomeRoot(client);
  await client.query(`set role "${userSub}"`);
};

export type Party = {
  wallet_id: string;
  id: string;
};

export type User = {
  auth0_sub: string;
  id: string;
  email: string;
  party_id: string;
};

export const withAdminUserDb = <T>(
  fn: (client: PoolClient, user: User, party: Party) => Promise<T>,
): Promise<void> =>
  withRootDb(async client => {
    const sub = 'test-admin-sub';
    const email = 'johndoe@regen.network';
    const name = 'john doe';
    const organization = await createUserOrganisation(
      client,
      email,
      name,
      '',
      'RND test',
      'walletAddr',
      null,
      { some: 'address' },
    );
    const {
      rows: [party],
    } = await client.query('select * from party where id=$1', [
      organization.party_id,
    ]);
    await client.query('SELECT private.create_app_user_if_needed($1)', [sub]);
    await client.query('INSERT INTO admin (auth0_sub) VALUES ($1)', [sub]);

    const user = await createUser(client, email, name, '', sub, null);
    await becomeUser(client, sub);
    await fn(client, user, party);
  });

export const withAuthUserDb = <T>(
  addr: string,
  fn: (client: PoolClient) => Promise<T>,
): Promise<void> =>
  withRootDb(async client => {
    await createAccount(client, addr);
    await becomeUser(client, addr);
    await fn(client);
  });

export async function createUser(
  client: PoolClient,
  email: string | null,
  name: string | null,
  image: string | null,
  sub: string | null,
  roles: string[] | null,
): Promise<User> {
  const {
    rows: [row],
  } = await client.query(
    `
      select * from private.really_create_user_if_needed(
        $1,
        $2,
        $3,
        $4,
        $5
      )
      `,
    [email, name, image, sub, roles],
  );
  return row;
}

interface OrganizationType {
  id: string;
  party_id: string;
  legal_name: string;
}

export async function createUserOrganisation(
  client: PoolClient,
  email: string | null,
  name: string | null,
  image: string | null,
  orgName: string | null,
  walletAddr: string | null,
  roles: string[] | null,
  orgAddress: object | null,
): Promise<OrganizationType> {
  const {
    rows: [row],
  } = await client.query(
    `
      select * from public.create_user_organization(
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7
      )
      `,
    [email, name, image, orgName, walletAddr, roles, orgAddress],
  );
  return row;
}

export interface ProjectType {
  id: string;
  credit_class_id: string;
  developer_id: string;
  steward_id: string;
}

interface MethodologyVersion {
  id: string;
  created_at: string;
}

interface CreditClassVersion {
  id: string;
  created_at: string;
}

interface CreateProject {
  project: ProjectType;
  methodologyVersion: MethodologyVersion;
  creditClassVersion: CreditClassVersion;
}

export async function createProject(
  client: PoolClient,
  issuerWalletId: string | null,
): Promise<CreateProject> {
  const methodologyDeveloper = await createUserOrganisation(
    client,
    'methodology@test.com',
    'methodology dev user',
    '',
    'methodology dev org',
    'methodology wallet address',
    null,
    { some: 'address' },
  );
  const projectDeveloper = await createUserOrganisation(
    client,
    'project@test.com',
    'project dev user',
    '',
    'project dev org',
    'project wallet address',
    null,
    { some: 'address' },
  );
  const landSteward = await createUserOrganisation(
    client,
    'steward@test.com',
    'steward user',
    '',
    'steward org',
    'steward wallet address',
    null,
    { some: 'address' },
  );
  const {
    rows: [project],
  } = await client.query(
    `
      select * from private.really_create_project(
        $1, $2, $3, $4, $5, $6, $7
      )
      `,
    [
      methodologyDeveloper.party_id,
      projectDeveloper.party_id,
      landSteward.party_id,
      new Date(),
      new Date(),
      new Date(),
      'active',
    ],
  );

  // Insert credit_class_version and methodology_version
  const {
    rows: [creditClass],
  } = await client.query(
    `
      select methodology_id from credit_class
      where id = $1
      `,
    [project.credit_class_id],
  );
  const {
    rows: [methodologyVersion],
  } = await client.query(
    `
      insert into methodology_version (id, created_at, name, version, date_developed)
      values ($1, $2, 'some methodology', 'v1.0', now())
      returning *
      `,
    [creditClass.methodology_id, new Date()],
  );
  const {
    rows: [creditClassVersion],
  } = await client.query(
    `
      insert into credit_class_version (id, created_at, name, version, date_developed)
      values ($1, $2, 'some credit class', 'v1.0', now())
      returning *
      `,
    [project.credit_class_id, new Date()],
  );

  if (issuerWalletId) {
    await client.query(
      `
        insert into credit_class_issuer (credit_class_id, issuer_id) values ($1, $2)
        `,
      [project.credit_class_id, issuerWalletId],
    );
  }
  return { project, methodologyVersion, creditClassVersion };
}

export async function reallyCreateOrganization(
  client: PoolClient,
  legalName: string,
  displayName: string,
  walletAddr: string,
  ownerId: string,
  image: string,
  description: string | null,
  roles: string[] | null,
  orgAddress: object | null,
): Promise<OrganizationType> {
  const {
    rows: [row],
  } = await client.query(
    `
      select * from public.really_create_organization(
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8
      )
    `,
    [
      legalName,
      displayName,
      walletAddr,
      ownerId,
      image,
      description,
      roles,
      orgAddress,
    ],
  );
  return row;
}

export async function reallyCreateOrganizationIfNeeded(
  client: PoolClient,
  legalName: string,
  displayName: string,
  walletAddr: string,
  ownerId: string,
  image: string,
  description: string | null,
  roles: string[] | null,
  orgAddress: object | null,
): Promise<OrganizationType> {
  const {
    rows: [row],
  } = await client.query(
    `
      select * from public.really_create_organization_if_needed(
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8
      )
    `,
    [
      legalName,
      displayName,
      walletAddr,
      ownerId,
      image,
      description,
      roles,
      orgAddress,
    ],
  );
  return row;
}

export async function createAccount(
  client: PoolClient,
  walletAddr: string,
  partyType: 'user' | 'organization' = 'user',
): Promise<string> {
  await client.query(`create role ${walletAddr} in role auth_user`);
  const result = await client.query(
    `select * from private.create_new_account('${walletAddr}', '${partyType}') as account_id`,
  );
  const [{ account_id }] = result.rows;
  return account_id;
}

export async function getAccount(client: PoolClient): Promise<string> {
  const result = await client.query('select * from get_current_account()');
  const [{ account_id }] = result.rows;
  return account_id;
}
