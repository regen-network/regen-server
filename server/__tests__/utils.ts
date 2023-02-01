import fetch, { Response, Request } from 'node-fetch';
import {
  makeADR36AminoSignDoc,
  serializeSignDoc,
  encodeSecp256k1Signature,
} from '@keplr-wallet/cosmos';
import { Hash, PrivKeySecp256k1, PubKeySecp256k1 } from '@keplr-wallet/crypto';
import { genArbitraryData } from '../middleware/keplrStrategy';

export async function fetchCsrf(): Promise<{ cookie: string; token: string }> {
  const resp = await fetch('http://localhost:5000/csrfToken', {
    method: 'GET',
  });
  const cookie = resp.headers.get('set-cookie');
  const { token } = await resp.json();
  return { cookie, token };
}

export async function CSRFRequest(
  endpoint: string,
  method: string,
): Promise<Request> {
  const { cookie, token } = await fetchCsrf();
  const request = new Request(endpoint, {
    method: method,
    headers: {
      'X-CSRF-TOKEN': token,
      Cookie: cookie,
      'Content-Type': 'application/json',
    },
  });
  return request;
}

export async function performLogin(
  privKey: PrivKeySecp256k1,
  pubKey: PubKeySecp256k1,
  signer: string,
  nonce: string,
): Promise<Response> {
  // prepare the data to be signed
  const data = genArbitraryData(nonce);
  const signDoc = makeADR36AminoSignDoc(signer, data);
  const msg = serializeSignDoc(signDoc);
  // these next lines are equivalent to the keplr.signArbitrary browser API
  const signatureBytes = privKey.signDigest32(Hash.sha256(msg));
  const signature = encodeSecp256k1Signature(
    pubKey.toBytes(false),
    signatureBytes,
  );
  // send the request to login API endpoint
  // this step requires retrieving CSRF tokens first
  const req = await CSRFRequest('http://localhost:5000/web3auth/login', 'POST');
  const resp = await fetch(req, {
    body: JSON.stringify({ signature: signature }),
  });
  return resp;
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
  expect(sessionData).toHaveProperty('passport.user.id');
  expect(sessionData).toHaveProperty('passport.user.address', signer);
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
