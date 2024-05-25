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
import { privacy, contents } from './e2e/post.mock';
import { createAccountWithAuthUser } from './db/helpers';

export const longerTestTimeout = 30000;

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
  // create copy of headers to prevent mutation
  const authHeadersCopy = new Headers([...authHeaders.entries()]);
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

    authHeadersCopy.delete('content-type');
    const resp = await fetch(`${getMarketplaceURL()}/files`, {
      method: 'POST',
      headers: authHeadersCopy,
      body: form,
    });
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
  noFiles?: boolean;
} & OptionalAuthHeaders;

export async function createProjectAndPost({
  initAuthHeaders,
  initPrivacy,
  noFiles,
}: CreateProjectAndPostParams) {
  const authHeaders = await getAuthHeaders({ initAuthHeaders });

  const { projectId, accountId, key, fname } = await createProject({
    initAuthHeaders: authHeaders,
  });
  const resp = await fetch(`${getMarketplaceURL()}/posts`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      projectId,
      privacy: initPrivacy ?? privacy,
      contents: { ...contents, files: noFiles ? [] : contents.files },
    }),
  });
  const { iri } = await resp.json();
  return { accountId, projectId, iri, key, fname };
}

type CreateProjectAndPostsParams = { nbPosts: number } & OptionalAuthHeaders;
export async function createProjectAndPosts({
  initAuthHeaders,
  nbPosts,
}: CreateProjectAndPostsParams) {
  const authHeaders = await getAuthHeaders({ initAuthHeaders });

  const { projectId, accountId, key, fname } = await createProject({
    initAuthHeaders: authHeaders,
  });
  const iris: Array<string> = [];
  for (let i = 0; i < nbPosts; i++) {
    const resp = await fetch(`${getMarketplaceURL()}/posts`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        projectId,
        privacy,
        contents: { ...contents, name: i, files: [] },
      }),
    });
    const { iri } = await resp.json();
    iris.push(iri);
  }
  return { accountId, projectId, iris, key, fname };
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
