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
  genArbitraryLoginData,
  genArbitraryAddAddressData,
} from '../middleware/keplrStrategy';

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
) {
  const data = genArbitraryLoginData(nonce);
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

export function genAddAddressSignature(
  privKey: PrivKeySecp256k1,
  pubKey: PubKeySecp256k1,
  signer: string,
  nonce: string,
) {
  const data = genArbitraryAddAddressData(nonce);
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
): Promise<PerformLogin> {
  // sign the data
  const signature = genSignature(privKey, pubKey, signer, nonce);
  // send the request to login API endpoint
  // this step requires retrieving CSRF tokens first
  const req = await CSRFRequest(
    `${getMarketplaceURL()}/web3auth/login`,
    'POST',
  );
  const response = await fetch(req, {
    body: JSON.stringify({ signature: signature }),
  });
  const authHeaders = genAuthHeaders(response.headers, req.headers);
  return { authHeaders, response, csrfHeaders: req.headers };
}

export function loginResponseAssertions(resp: Response, signer: string): void {
  expect(resp.status).toBe(200);
  // these assertions on the cookies check for important fields that should be set
  // we expect that a session cookie is created here
  // this session cookie is where the user session is stored
  const cookies = resp.headers.get('set-cookie');
  expect(cookies).toMatch(/session=(.*?);/);
  expect(cookies).toMatch(/session.sig=(.*?);/);
  expect(cookies).toMatch(/expires=(.*?);/);

  // assertions on the base64 encoded user session..
  const sessionString = cookies.match(/session=(.*?);/)[1];
  const sessionData = JSON.parse(atob(sessionString));
  expect(sessionData).toHaveProperty('passport.user.address', signer);
  expect(sessionData).toHaveProperty('passport.user.partyId');
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
    `${getMarketplaceURL()}/web3auth/nonce?userAddress=${signer}`,
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

export async function createNewUserAndLogin(): Promise<CreateNewUserAndLogin> {
  const { userPrivKey, userPubKey, userAddr } = await createNewUser();
  const nonce = '';
  const loginResp = await performLogin(
    userPrivKey,
    userPubKey,
    userAddr,
    nonce,
  );
  return { ...loginResp, userAddr, userPrivKey, userPubKey };
}

export function genRandomRegenAddress(): string {
  return `regen${Math.random().toString().slice(2, 11)}`;
}

export async function dummyFilesSetup(
  key: string,
  fname: string,
  identifier: any,
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
    return { resp };
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

export function getServerBaseURL() {
  return 'http://localhost:5000';
}

export function getMarketplaceURL() {
  return `${getServerBaseURL()}/marketplace/v1`;
}
