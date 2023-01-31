import fetch from 'node-fetch';
import { CSRFRequest } from '../utils';
import {
  Bech32Address,
  makeADR36AminoSignDoc,
  serializeSignDoc,
  encodeSecp256k1Signature,
} from '@keplr-wallet/cosmos';
import { PrivKeySecp256k1, Hash } from '@keplr-wallet/crypto';
import { genArbitraryData } from '../../middleware/keplrStrategy';

describe('web3auth login endpoint', () => {
  it('returns 403 if double csrf is not used', async () => {
    const resp = await fetch('http://localhost:5000/web3auth/login', {
      method: 'POST',
    });
    expect(resp.status).toBe(403);
  });

  it('does not return 403 if double csrf is used', async () => {
    const req = await CSRFRequest(
      'http://localhost:5000/web3auth/login',
      'POST',
    );
    const resp = await fetch(req);
    expect(resp.status !== 403).toBe(true);
  });

  it('an invalid signature returns a 500 error', async () => {
    const req = await CSRFRequest(
      'http://localhost:5000/web3auth/login',
      'POST',
    );
    const resp = await fetch(req, {
      body: JSON.stringify({ signature: 'FOOBAR' }),
    });
    expect(resp.status).toBe(500);
  });

  // note: if we need a key pair that comes from a mnemonic:
  // https://github.com/chainapsis/keplr-wallet/blob/c6ea69512ee7487fe3dcd9ce89f928a96dbf44a2/packages/crypto/src/mnemonic.spec.ts#L6-L11
  it('authenticates a new user successfully and creates a session...', async () => {
    // set up a key pair and sign the required login transaction..
    const privKey = PrivKeySecp256k1.generateRandomKey();
    const pubKey = privKey.getPubKey();
    const signer = new Bech32Address(pubKey.getAddress()).toBech32('regen');
    const data = genArbitraryData('');
    const signDoc = makeADR36AminoSignDoc(signer, data);
    const msg = serializeSignDoc(signDoc);
    const signatureBytes = privKey.signDigest32(Hash.sha256(msg));
    const signature = encodeSecp256k1Signature(
      pubKey.toBytes(false),
      signatureBytes,
    );

    // send the request to login..
    const req = await CSRFRequest(
      'http://localhost:5000/web3auth/login',
      'POST',
    );
    const resp = await fetch(req, {
      body: JSON.stringify({ signature: signature }),
    });

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
    expect(sessionData).toHaveProperty('passport.user.address');
    expect(sessionData.passport.user.address).toBe(signer);
  });
});
