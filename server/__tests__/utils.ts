import fetch, { Response, Request, RequestInfo, Headers } from 'node-fetch';
import { FileHandle, open, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createReadStream } from 'node:fs';
import FormData from 'form-data';
import { S3Client, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import {
  Bech32Address,
  makeADR36AminoSignDoc,
  serializeSignDoc,
  encodeSecp256k1Signature,
} from '@keplr-wallet/cosmos';
import {
  Mnemonic,
  Hash,
  PrivKeySecp256k1,
  PubKeySecp256k1,
} from '@keplr-wallet/crypto';
import {
  genArbitraryConnectWalletData,
  genArbitraryLoginData,
} from '../middleware/keplrStrategy';
import { PoolClient } from 'pg';
import { createAccountWithAuthUser } from './db/helpers';
import { getTableColumnsWithForeignKey } from '../routes/wallet-auth';

export const longerTestTimeout = 30000;
export const privacy = 'public';
export const contents = {
  '@context': { x: 'http://some.schema' },
  'x:someField': 'some value',
};
export const expIri =
  'regen:13toVhB7bM4zUgwzH5N5UkTjfx1ZEHK1qXkhEWysLqCoP8iaACRxJJK.rdf';

export async function fetchCsrf(): Promise<{ cookie: string; token: string }> {
  const resp = await fetch(`${getMarketplaceURL()}/csrfToken`, {
    method: 'GET',
  });
  const cookie = resp.headers.get('set-cookie');
  const { token } = await resp.json();
  return { cookie, token };
}

export async function CSRFRequest(
  endpoint: RequestInfo,
  method: string,
): Promise<Request> {
  const { cookie, token } = await fetchCsrf();
  const request = new Request(endpoint, {
    method,
    headers: {
      'X-CSRF-TOKEN': token,
      Cookie: cookie,
      'Content-Type': 'application/json',
    },
  });
  return request;
}

export function genSignature(
  privKey: PrivKeySecp256k1,
  pubKey: PubKeySecp256k1,
  signer: string,
  nonce: string,
  data: string = genArbitraryLoginData(nonce),
) {
  const signDoc = makeADR36AminoSignDoc(signer, data);
  const msg = serializeSignDoc(signDoc);
  // these next lines are equivalent to the keplr.signArbitrary browser API
  const signatureBytes = privKey.signDigest32(Hash.sha256(msg));
  const signature = encodeSecp256k1Signature(
    pubKey.toBytes(false),
    signatureBytes,
  );
  return signature;
}

interface PerformLogin {
  response: Response;
  authHeaders: Headers;
  csrfHeaders: Headers;
}

interface CreateNewUser {
  userAddr: string;
  userPrivKey: PrivKeySecp256k1;
  userPubKey: PubKeySecp256k1;
}

interface CreateNewUserAndLogin extends CreateNewUser, PerformLogin {}

export async function performLogin(
  privKey: PrivKeySecp256k1,
  pubKey: PubKeySecp256k1,
  signer: string,
  nonce: string,
  headers?: Headers,
): Promise<PerformLogin> {
  // sign the data
  const signature = genSignature(privKey, pubKey, signer, nonce);
  // send the request to login API endpoint
  // this step requires retrieving CSRF tokens first
  const req = await CSRFRequest(
    `${getMarketplaceURL()}/wallet-auth/login`,
    'POST',
  );
  const response = await fetch(req, {
    body: JSON.stringify({ signature: signature }),
    headers: headers ? headers : undefined,
  });
  const authHeaders = genAuthHeaders(response.headers, req.headers);
  return { authHeaders, response, csrfHeaders: req.headers };
}

export function parseSessionData(resp: Response) {
  const cookies = resp.headers.get('set-cookie');
  if (!cookies) {
    throw new Error('set cookie headers are missing..');
  }
  const sessionMatch = cookies.match(/session=(.*?);/);
  if (!sessionMatch) {
    throw new Error('session cookie not found..');
  }
  const sessionString = sessionMatch[1];
  const sessionData = JSON.parse(atob(sessionString));
  return { cookies, sessionData };
}

export function loginResponseAssertions(resp: Response): void {
  expect(resp.status).toBe(200);
  // these assertions on the cookies check for important fields that should be set
  // we expect that a session cookie is created here
  // this session cookie is where the user session is stored
  const { cookies, sessionData } = parseSessionData(resp);
  expect(cookies).toMatch(/session=(.*?);/);
  expect(cookies).toMatch(/session.sig=(.*?);/);
  expect(cookies).toMatch(/expires=(.*?);/);

  // assertions on the base64 encoded user session..
  expect(sessionData).toHaveProperty('passport.user.accountId');
  expect(sessionData).toHaveProperty('activeAccountId');
  expect(sessionData).toHaveProperty('authenticatedAccountIds');
}

export function parseSessionCookies(resp: Response): string {
  // the node-fetch api has shortcomings with cookies
  // resp.headers.get from above doesn't work for passing along cookies
  // https://stackoverflow.com/a/55680330/4028706
  // this code just acquires the cookies required for authenticated requests
  const raw = resp.headers.raw()['set-cookie'];
  const parsedCookies = raw
    .map(entry => {
      const parts = entry.split(';');
      const cookiePart = parts[0];
      return cookiePart;
    })
    .join(';');
  return parsedCookies;
}

export function genAuthHeaders(
  loginHeaders: Headers,
  csrfHeaders: Headers,
): Headers {
  // we need to combine the auth cookies, and the csrf cookie
  const authCookies = loginHeaders.raw()['set-cookie'];
  const csrfCookies = csrfHeaders.raw()['Cookie'];
  const cookies = authCookies.concat(csrfCookies);
  const parsedCookies = cookies
    .map(entry => {
      const parts = entry.split(';');
      const cookiePart = parts[0];
      return cookiePart;
    })
    .join(';');
  const headers = new Headers([...csrfHeaders.entries()]);
  headers.delete('cookie');
  headers.append('cookie', parsedCookies);
  return headers;
}

export async function setUpTestAccount(mnemonic: string): Promise<void> {
  const privKey = new PrivKeySecp256k1(
    Mnemonic.generateWalletFromMnemonic(mnemonic),
  );
  const pubKey = privKey.getPubKey();
  const signer = new Bech32Address(pubKey.getAddress()).toBech32('regen');

  const resp = await fetch(
    `${getMarketplaceURL()}/wallet-auth/nonce?userAddress=${signer}`,
  );
  // if the nonce was not found then the account does not yet exist
  if (resp.status === 404) {
    // create the account if it did not exist
    const emptyNonce = '';
    const { response: loginResp } = await performLogin(
      privKey,
      pubKey,
      signer,
      emptyNonce,
    );
    expect(loginResp.status).toBe(200);
  }
}

export async function createNewUser(): Promise<CreateNewUser> {
  const userPrivKey = PrivKeySecp256k1.generateRandomKey();
  const userPubKey = userPrivKey.getPubKey();
  const userAddr = new Bech32Address(userPubKey.getAddress()).toBech32('regen');
  return { userPrivKey, userPubKey, userAddr };
}

export async function createNewUserAndLogin(
  headers?: Headers,
): Promise<CreateNewUserAndLogin> {
  const { userPrivKey, userPubKey, userAddr } = await createNewUser();
  const nonce = '';
  const loginResp = await performLogin(
    userPrivKey,
    userPubKey,
    userAddr,
    nonce,
    headers,
  );
  return { ...loginResp, userAddr, userPrivKey, userPubKey };
}

export function genRandomRegenAddress(): string {
  return `regen${Math.random().toString().slice(2, 11)}`;
}

export async function dummyFilesSetup(
  key: string,
  fname: string,
  identifier: string,
  authHeaders: Headers,
): Promise<{ resp: Response }> {
  let dir: undefined | string = undefined;
  let fd: undefined | FileHandle = undefined;
  try {
    const path = join(tmpdir(), 'projects-');
    dir = await mkdtemp(path);
    const fpath = join(dir, fname);
    fd = await open(fpath, 'w');
    await fd.write(`helloworld, for ${identifier}.`);
    await fd.sync();

    const form = new FormData();
    form.append('image', createReadStream(fpath));
    form.append('filePath', key);

    authHeaders.delete('content-type');
    const resp = await fetch(`${getMarketplaceURL()}/files`, {
      method: 'POST',
      headers: authHeaders,
      body: form,
    });
    console.log('resp', resp);
    return { resp };
  } catch (e) {
    console.log('e', e);
  } finally {
    if (fd) {
      await fd?.close();
    }
    if (dir) {
      await rm(dir, { recursive: true, force: true });
    }
  }
}

export async function dummyFilesTeardown(key: string, fname: string) {
  const bucketName = process.env.AWS_S3_BUCKET;
  const region = process.env.AWS_BUCKET_REGION;
  const s3 = new S3Client({ region });
  const cmd = new DeleteObjectsCommand({
    Bucket: bucketName,
    Delete: {
      Objects: [{ Key: `${key}/${fname}` }, { Key: `${key}` }],
    },
  });
  const response = await s3.send(cmd);
  if (response['$metadata'].httpStatusCode !== 200) {
    console.dir(
      {
        response,
        warning: 'objects possibly not removed rom s3 testing bucket',
      },
      { depth: null },
    );
  }
}

type OptionalAuthHeaders = {
  initAuthHeaders?: Headers;
};

async function getAuthHeaders({ initAuthHeaders }: OptionalAuthHeaders) {
  let authHeaders: Headers;
  if (initAuthHeaders) {
    authHeaders = initAuthHeaders;
  } else {
    const newUser = await createNewUserAndLogin();
    authHeaders = newUser.authHeaders;
  }
  return authHeaders;
}

type CreateProjectAndPostParams = {
  initPrivacy?: 'private' | 'private_files' | 'private_locations' | 'public';
} & OptionalAuthHeaders;

export async function createProjectAndPost({
  initAuthHeaders,
  initPrivacy,
}: CreateProjectAndPostParams) {
  const authHeaders = await getAuthHeaders({ initAuthHeaders });

  const { projectId, accountId } = await createProject({
    initAuthHeaders: authHeaders,
  });
  const resp = await fetch(`${getMarketplaceURL()}/posts`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      projectId,
      privacy: initPrivacy ?? privacy,
      contents,
    }),
  });
  const { iri } = await resp.json();
  return { accountId, projectId, iri };
}

type CreateProjectAndPostsParams = { nbPosts: number } & OptionalAuthHeaders;
export async function createProjectAndPosts({
  initAuthHeaders,
  nbPosts,
}: CreateProjectAndPostsParams) {
  const authHeaders = await getAuthHeaders({ initAuthHeaders });

  const { projectId, accountId } = await createProject({
    initAuthHeaders: authHeaders,
  });
  const iris = [];
  for (let i = 0; i < nbPosts; i++) {
    const resp = await fetch(`${getMarketplaceURL()}/posts`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        projectId,
        privacy,
        contents: { ...contents, 'x:someField': i },
      }),
    });
    const { iri } = await resp.json();
    iris.push(iri);
  }
  return { accountId, projectId, iris };
}

export async function createProject({ initAuthHeaders }: OptionalAuthHeaders) {
  const authHeaders = await getAuthHeaders({ initAuthHeaders });
  const accountIdQuery = await fetch(`${getMarketplaceURL()}/graphql`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      query: `{ getCurrentAccount { id } }`,
    }),
  });
  const accountIdResult = await accountIdQuery.json();
  const accountId = accountIdResult.data.getCurrentAccount.id;

  const createProjectQuery = await fetch(`${getMarketplaceURL()}/graphql`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      query:
        'mutation CreateProject($input: CreateProjectInput!) { createProject(input: $input) { project { id } } }',
      variables: `{"input":{"project":{"adminAccountId":"${accountId}"}}}`,
    }),
  });
  const createProjectResult = await createProjectQuery.json();
  const projectId = createProjectResult.data.createProject.project.id;

  const key = `${process.env.S3_PROJECTS_PATH}/${projectId}`;
  const fname = `test-${projectId}.txt`;
  return {
    key,
    fname,
    accountId,
    projectId,
  };
}

export function getServerBaseURL() {
  return 'http://localhost:5000';
}

export function getMarketplaceURL() {
  return `${getServerBaseURL()}/marketplace/v1`;
}

type CreateWeb2AccountParams = {
  client: PoolClient;
  email: string;
  google?: string;
};
export async function createWeb2Account({
  client,
  email,
  google,
}: CreateWeb2AccountParams) {
  const insertQuery = await client.query(
    'select * from private.create_new_web2_account($1, $2, $3)',
    ['user', email, google],
  );
  const [{ create_new_web2_account: accountId }] = insertQuery.rows;
  await client.query('select private.create_auth_user($1)', [accountId]);
  return accountId;
}

type SetupAccountsWithDataParams = {
  client: PoolClient;
  email: string;
  google?: string;
  nonceOverride?: string;
  nameWeb2: string;
  nameWeb3: string;
};
export async function setupTestAccountsWithData({
  client,
  email,
  google,
  nonceOverride,
  nameWeb2,
  nameWeb3,
}: SetupAccountsWithDataParams) {
  // inserting some web2 account
  const accountId = await createWeb2Account({ client, email, google });
  const query = await client.query('select nonce from account where id = $1', [
    accountId,
  ]);
  const [{ nonce }] = query.rows;

  // inserting some web3 account
  const { userPrivKey, userPubKey, userAddr } = await createNewUser();
  const { accountId: walletAccountId } = await createAccountWithAuthUser(
    client,
    userAddr,
  );

  // generate signature
  const signature = genSignature(
    userPrivKey,
    userPubKey,
    userAddr,
    nonceOverride ?? nonce,
    genArbitraryConnectWalletData(nonceOverride ?? nonce),
  );

  // set some name for the accounts
  await client.query('update account set name = $1 where id = $2', [
    nameWeb2,
    accountId,
  ]);
  await client.query('update account set name = $1 where id = $2', [
    nameWeb3,
    walletAccountId,
  ]);

  // create some projects and post for the web2 account
  const web2AccountData = await createProjectsAndPostForAccount({
    client,
    accountId,
    postIri: 'regen:123.rdf',
  });

  // create some projects and post for the web3 account
  const web3AccountData = await createProjectsAndPostForAccount({
    client,
    accountId: walletAccountId,
    postIri: 'regen:456.rdf',
  });

  return {
    accountId,
    walletAccountId,
    userAddr,
    nonce,
    signature,
    web2AccountData,
    web3AccountData,
  };
}

type CreateProjectsAndPostForAccountParams = {
  client: PoolClient;
  accountId: string;
  postIri: string;
};
async function createProjectsAndPostForAccount({
  client,
  accountId,
  postIri,
}: CreateProjectsAndPostForAccountParams) {
  await generateRandomData({
    client,
    tableName: 'account',
    columnName: 'id',
    columnValue: accountId,
  });

  // This part can be removed once generateRandomData is fully implemented
  const adminProjectQuery = await client.query(
    'INSERT INTO project (admin_account_id) values ($1) returning id',
    [accountId],
  );
  const [{ id: adminProjectId }] = adminProjectQuery.rows;

  const developerProjectQuery = await client.query(
    'INSERT INTO project (developer_id) values ($1) returning id',
    [accountId],
  );
  const [{ id: developerProjectId }] = developerProjectQuery.rows;

  const projectVerifierQuery = await client.query(
    'INSERT INTO project (verifier_id) values ($1) returning id',
    [accountId],
  );
  const [{ id: verifierProjectId }] = projectVerifierQuery.rows;

  const creatorPostQuery = await client.query(
    'INSERT INTO post (iri, creator_account_id, project_id, contents) values ($1, $2, $3, $4) returning iri',
    [postIri, accountId, adminProjectId, { some: 'data' }],
  );
  const [{ iri: creatorPostIri }] = creatorPostQuery.rows;

  return {
    adminProjectId,
    developerProjectId,
    verifierProjectId,
    creatorPostIri,
  };
}

type GenerateRandomDataParams = {
  client: PoolClient;
  tableName: string;
  columnName: string;
  columnValue: unknown;
  schemaName?: string;
};
async function generateRandomData({
  client,
  tableName,
  columnName,
  columnValue,
  schemaName = 'public',
}: GenerateRandomDataParams) {
  const fkQueryRows = await getTableColumnsWithForeignKey({
    client,
    tableName,
    columnName,
    schemaName,
  });
  for (const row of fkQueryRows) {
    // If an entry already exists in the table then we can just continue
    const entryQuery = await client.query(
      `SELECT 1 FROM ${row.table_schema}.${row.table_name} WHERE ${row.column_name} = $1`,
      [columnValue],
    );
    if (entryQuery.rowCount > 0) {
      continue;
    }

    // Get columns names and types that have a not null constraint without a default to generate random data,
    // different from the current row.column_name
    const notNullColumnsQuery = await client.query(
      `SELECT column_name, data_type FROM information_schema.columns \
        WHERE table_schema = '${row.table_schema}' AND table_name = '${row.table_name}' \
        AND is_nullable = 'NO' AND column_default IS NULL AND column_name != '${row.column_name}'`,
    );
    const notNullColumns = notNullColumnsQuery.rows;
    const columnsNames = [
      row.column_name, // column that has account.id as fk
      ...notNullColumns.map(notNullColumn => notNullColumn.column_name), // not null columns without default
    ].join(',');

    const columnsValues = [
      columnValue,
      ...(await Promise.all(
        notNullColumns.map(async notNullColumn => {
          // If a not null column is a foreign key then we need to create a corresponding entry
          const fkValue = await generateRowForForeignKey({
            client,
            tableName: row.table_name,
            columnName: notNullColumn.column_name,
            schemaName: row.table_schema,
          });
          if (fkValue) return fkValue;
          return generateRandomValueForType({
            client,
            datatype: notNullColumn.data_type,
          });
        }),
      )),
    ];

    console.log(
      `${row.table_schema}.${row.table_name}`,
      columnsNames,
      columnsValues,
    );

    // For every table that has a column where public.account.id is used as foreign key,
    // create a new entry in this table with the foreign key value set to accountId
    await client.query(
      `insert into ${row.table_schema}.${
        row.table_name
      } (${columnsNames}) VALUES (${columnsValues.map(
        (_, index) => `$${index + 1}`,
      )})`,
      columnsValues,
    );
  }
}

type GenerateRowForForeignKeyParams = {
  client: PoolClient;
  tableName: string;
  columnName: string;
  schemaName?: string;
};
async function generateRowForForeignKey({
  client,
  tableName,
  columnName,
  schemaName,
}: GenerateRowForForeignKeyParams) {
  const pkQuery = await client.query(
    `SELECT DISTINCT \
    kcu.table_schema as foreign_table_schema, \
    kcu.table_name as foreign_table_name, \
    rel_kcu.table_schema as primary_table_schema, \
    rel_kcu.table_name as primary_table_name, \
    kcu.column_name as fk_column, \
    rel_kcu.column_name as pk_column, \
    kcu.constraint_name \
  from information_schema.table_constraints tco \
  join information_schema.key_column_usage kcu \
    on tco.constraint_schema = kcu.constraint_schema \
    and tco.constraint_name = kcu.constraint_name \
  join information_schema.referential_constraints rco \
    on tco.constraint_schema = rco.constraint_schema \
    and tco.constraint_name = rco.constraint_name \
  join information_schema.key_column_usage rel_kcu  \
    on rco.unique_constraint_schema = rel_kcu.constraint_schema  \
    and rco.unique_constraint_name = rel_kcu.constraint_name  \
    and kcu.ordinal_position = rel_kcu.ordinal_position  \
  where tco.constraint_type = 'FOREIGN KEY' \
    AND kcu.table_schema='${schemaName}' \
    AND kcu.table_name='${tableName}' \
    AND kcu.column_name='${columnName}'`,
  );

  if (pkQuery.rowCount === 0) {
    return;
  }
  for (const row of pkQuery.rows) {
    // Get columns names and types that have a not null constraint without a default to generate random data
    const notNullColumnsQuery = await client.query(
      `SELECT column_name, data_type FROM information_schema.columns \
        WHERE table_schema = '${row.primary_table_schema}' AND table_name = '${row.primary_table_name}' \
        AND is_nullable = 'NO' AND column_default IS NULL`,
    );
    const notNullColumns = notNullColumnsQuery.rows;

    const columnsNames = notNullColumns
      .map(notNullColumn => notNullColumn.column_name)
      .join(',');

    const columnsValues = await Promise.all(
      notNullColumns.map(async notNullColumn => {
        // If a not null column is a foreign key then we need to create a corresponding entry
        const fkValue = await generateRowForForeignKey({
          client,
          tableName: row.primary_table_name,
          columnName: notNullColumn.column_name,
          schemaName: row.primary_table_schema,
        });
        if (fkValue) return fkValue;
        return generateRandomValueForType({
          client,
          datatype: notNullColumn.data_type,
        });
      }),
    );

    console.log(
      `${row.primary_table_schema}.${row.primary_table_name}`,
      columnsNames,
      columnsValues,
    );
    const insQuery =
      columnsNames.length > 0
        ? await client.query(
            `insert into ${row.primary_table_schema}.${
              row.primary_table_name
            } (${columnsNames}) VALUES \
      (${columnsValues.map((_, index) => `$${index + 1}`)}) returning ${
              row.pk_column
            }`,
            columnsValues,
          )
        : await client.query(
            `insert into ${row.primary_table_schema}.${row.primary_table_name} DEFAULT VALUES returning ${row.pk_column}`,
          );
    if (insQuery.rowCount === 1) {
      return insQuery.rows[0][row.pk_column];
    }
  }
}

type GenerateRandomValueForTypeParams = {
  client: PoolClient;
  datatype: unknown;
};
function generateRandomValueForType({
  client,
  datatype,
}: GenerateRandomValueForTypeParams) {
  // For simplicity, this doesn't check any constraint that might be defined on the column
  // that has the given datatype
  // If we start defining some, the tests might start to fail and we can update
  // this random value generator function to account for that.
  switch (datatype) {
    case 'integer':
      return Math.floor(Math.random() * 100);
    case 'text':
      return Math.random().toString(36).slice(2);
    // Generate random timestamp and jsonb
    case 'timestamp with time zone':
      return '2023-12-07 08:27:51.772791+00';
    case 'jsonb':
      return '{}::jsonb';
    case 'USER-DEFINED':
      // TODO make this more generic
      // for now, we know the only user defined type that is set as
      // data type for a non null column without default is the account_type enum
      return 'user';
  }
}
