import fetch, { Response } from 'node-fetch';

describe('CSRF protection', () => {
  it('provides a CSRF token on the GET endpoint and sets the hash cookie', async () => {
    const resp = await fetch('http://localhost:5000/csrfToken', {
      method: 'GET',
    });
    const cookie = resp.headers.get('set-cookie');
    expect(cookie).toMatch(/^__Host-regen-dev.x-csrf-token=/);
    const { token } = await resp.json();
    expect(token.length).toBeGreaterThan(0);
  });
  it('protects an POST endpoint which does not include a CSRF token', async () => {
    const resp = await fetch('http://localhost:5000/csrfToken', {
      method: 'POST',
    });
    expect(resp.status).toBe(403);
  });
  it('allows requests that use the double CSRF pattern', async () => {
    let resp: Response;
    resp = await fetch('http://localhost:5000/csrfToken', { method: 'GET' });
    const cookie = resp.headers.get('set-cookie');
    const { token } = await resp.json();
    resp = await fetch('http://localhost:5000/csrfToken', {
      method: 'POST',
      headers: {
        'X-CSRF-TOKEN': token,
        Cookie: cookie,
      },
    });
    expect(resp.status).toBe(200);
  });
});
