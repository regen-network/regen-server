import { withRootDb } from '../db/helpers';
import { getServerBaseURL } from '../utils';
import fetch from 'node-fetch';

function hostHeaders() {
  return { 'X-Forwarded-Host': 'api.registry.regen.network' };
}

describe('redirect middleware', () => {
  it('redirects GET /metadata-graph requests', async () => {
    const { status, headers } = await fetch(
      `${getServerBaseURL()}/metadata-graph/foo`,
      {
        method: 'GET',
        headers: hostHeaders(),
        redirect: 'manual',
      },
    );
    expect(status).toBe(308);
    expect(headers.get('location')).toContain(
      `${getServerBaseURL()}/data/v1/metadata-graph/foo`,
    );
  });
  it('redirects POST /iri-gen requests and it preserves the body of the POST request', async () => {
    const jsonld = {
      '@context': 'https://json-ld.org/contexts/person.jsonld',
      '@id': 'http://dbpedia.org/resource/John_Lennon',
      name: 'John Lennon',
      born: '1940-10-09',
      spouse: 'http://dbpedia.org/resource/Cynthia_Lennon',
    };
    const dryRunResp = await fetch(`${getServerBaseURL()}/iri-gen`, {
      method: 'POST',
      headers: hostHeaders(),
      redirect: 'manual',
      body: JSON.stringify(jsonld),
    });
    expect(dryRunResp.status).toBe(308);
    expect(dryRunResp.headers.get('location')).toContain(
      `${getServerBaseURL()}/data/v1/iri-gen`,
    );
    const headers = hostHeaders();
    headers['Content-Type'] = 'application/json';
    const iriResp = await fetch(`${getServerBaseURL()}/iri-gen`, {
      method: 'POST',
      headers,
      body: JSON.stringify(jsonld),
    });
    expect(iriResp.status).toBe(201);
    const { iri } = await iriResp.json();
    try {
      const metaResp = await fetch(
        `${getServerBaseURL()}/metadata-graph/${iri}`,
        {
          method: 'GET',
          headers: hostHeaders(),
        },
      );
      const metadata = await metaResp.json();
      expect(metadata).toEqual(jsonld);
    } finally {
      await withRootDb(async client => {
        await client.query('DELETE FROM metadata_graph WHERE iri=$1', [iri]);
      });
    }
  });
  it('redirects POST /mailerlite requests', async () => {
    const { status, headers } = await fetch(
      `${getServerBaseURL()}/mailerlite`,
      {
        method: 'POST',
        headers: hostHeaders(),
        redirect: 'manual',
      },
    );
    expect(status).toBe(308);
    expect(headers.get('location')).toContain(
      `${getServerBaseURL()}/website/v1/mailerlite`,
    );
  });
  it('redirects POST /contact requests', async () => {
    const { status, headers } = await fetch(`${getServerBaseURL()}/contact`, {
      method: 'POST',
      headers: hostHeaders(),
      redirect: 'manual',
    });
    expect(status).toBe(308);
    expect(headers.get('location')).toContain(
      `${getServerBaseURL()}/website/v1/contact`,
    );
  });
  it('redirects POST /indexer/graphql requests', async () => {
    const { status, headers } = await fetch(
      `${getServerBaseURL()}/indexer/graphql`,
      {
        method: 'POST',
        headers: hostHeaders(),
        redirect: 'manual',
      },
    );
    expect(status).toBe(308);
    expect(headers.get('location')).toContain(
      `${getServerBaseURL()}/indexer/v1/graphql`,
    );
  });
  it('redirects GET /indexer/graphiql requests', async () => {
    const resp = await fetch(`${getServerBaseURL()}/indexer/graphiql`, {
      method: 'GET',
      headers: hostHeaders(),
      redirect: 'manual',
    });
    expect(resp.status).toBe(308);
    const redirectedLocation = resp.headers.get('location');
    expect(redirectedLocation).toBe(
      `${getServerBaseURL()}/indexer/v1/graphiql`,
    );
    if (redirectedLocation) {
      const redirectedResp = await fetch(redirectedLocation, {
        method: 'GET',
      });
      console.dir({ redirectedResp }, { depth: null });
      expect(redirectedResp.status).toBe(200);
    }
  });
  it('redirects GET /csrfToken requests to /marketplace/v1', async () => {
    const resp = await fetch(`${getServerBaseURL()}/csrfToken`, {
      method: 'GET',
      headers: hostHeaders(),
    });
    expect(resp.status).toBe(200);
  });
});
