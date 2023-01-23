import fetch, { Request } from 'node-fetch';

export async function fetchCsrf(): Promise<{ cookie: string; token: string }> {
  const resp = await fetch('http://localhost:5000/csrfToken', {
    method: 'GET',
  });
  const cookie = resp.headers.get('set-cookie');
  const { token } = await resp.json();
  return { cookie, token };
}

export async function CSRFRequest(endpoint: string): Promise<Request> {
  const { cookie, token } = await fetchCsrf();
  const request = new Request(endpoint, {
    method: 'POST',
    headers: {
      'X-CSRF-TOKEN': token,
      Cookie: cookie,
    },
  });
  return request;
}
