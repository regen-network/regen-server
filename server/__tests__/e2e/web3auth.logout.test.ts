import fetch from 'node-fetch';
import { CSRFRequest } from '../utils';

describe('web3auth logout endpoint', () => {
  it('returns 403 if double csrf is not used', async () => {
    const resp = await fetch('http://localhost:5000/web3auth/logout', {
      method: 'POST',
    });
    expect(resp.status).toBe(403);
  });

  it('does not return 403 if double csrf is used', async () => {
    const req = await CSRFRequest(
      'http://localhost:5000/web3auth/logout',
      'POST',
    );
    const resp = await fetch(req);
    expect(resp.status !== 403).toBe(true);
  });
});
