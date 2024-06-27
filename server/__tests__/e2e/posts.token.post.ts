import fetch from 'node-fetch';
import {
  createNewUserAndLogin,
  createProjectAndPost,
  getMarketplaceURL,
} from '../utils';
import { withRootDb } from '../db/helpers';
import { commit } from './post.mock';

describe('/posts/:iri/token POST endpoint', () => {
  it('returns a token if project admin', async () => {
    const { authHeaders } = await createNewUserAndLogin();

    // Create project and post administered by this account
    const { projectId, iri } = await createProjectAndPost({
      initAuthHeaders: authHeaders,
      noFiles: true,
      initPrivacy: 'private',
    });

    const resp = await fetch(`${getMarketplaceURL()}/posts/${iri}/token`, {
      method: 'POST',
      headers: authHeaders,
    });

    expect(resp.status).toBe(200);
    const data = await resp.json();
    const token = data.token;
    expect(token).toHaveLength(15);

    const resp2 = await fetch(`${getMarketplaceURL()}/posts/${iri}/token`, {
      method: 'POST',
      headers: authHeaders,
    });

    expect(resp2.status).toBe(200);
    const data2 = await resp.json();
    // Token is persistent
    expect(data2.token).toHaveLength(token);

    await withRootDb(async client => {
      // Cleaning up
      await client.query('delete from private.post_token where post_iri = $1', [
        iri,
      ]);
      await client.query('delete from post where project_id = $1', [projectId]);
    }, commit);
  });
  it('returns unauthorized error if any user tries to generate a token', async () => {
    const { authHeaders } = await createNewUserAndLogin();

    // Create project and private post administered by this account
    const { projectId, iri } = await createProjectAndPost({
      initAuthHeaders: authHeaders,
      noFiles: true,
    });

    const resp = await fetch(`${getMarketplaceURL()}/posts/${iri}/token`, {
      method: 'POST',
      // no authHeaders
    });

    expect(resp.status).toBe(401);

    await withRootDb(async client => {
      // Cleaning up
      await client.query('delete from post where project_id = $1', [projectId]);
    }, commit);
  });
  it('returns no content if post is public', async () => {
    const { authHeaders } = await createNewUserAndLogin();

    // Create project and post administered by this account
    const { projectId, iri } = await createProjectAndPost({
      initAuthHeaders: authHeaders,
      noFiles: true,
    });

    const resp = await fetch(`${getMarketplaceURL()}/posts/${iri}/token`, {
      method: 'POST',
      headers: authHeaders,
    });

    expect(resp.status).toBe(204);

    await withRootDb(async client => {
      // Cleaning up
      await client.query('delete from post where project_id = $1', [projectId]);
    }, commit);
  });
  it('returns a 404 error if the post does not exist', async () => {
    const fakeIri = '123';
    const resp = await fetch(`${getMarketplaceURL()}/posts/${fakeIri}/token`, {
      method: 'POST',
    });

    expect(resp.status).toBe(404);
  });
});
