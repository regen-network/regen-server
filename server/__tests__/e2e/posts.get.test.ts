import fetch from 'node-fetch';
import {
  createNewUserAndLogin,
  createProjectAndPost,
  getMarketplaceURL,
} from '../utils';
import { withRootDb } from '../db/helpers';

const commit = true;

describe('/posts GET endpoint', () => {
  it('returns the post by IRI', async () => {
    const { authHeaders } = await createNewUserAndLogin();

    // Create project and post administered by this account
    const { projectId, iri } = await createProjectAndPost({
      initAuthHeaders: authHeaders,
    });

    const resp = await fetch(`${getMarketplaceURL()}/posts/${iri}`, {
      method: 'GET',
      headers: authHeaders,
    });

    expect(resp.status).toBe(200);
    const data = await resp.json();
    // returned post contents based on privacy settings tested in unit test for getPostData function
    expect(data.iri).toEqual(iri);

    await withRootDb(async client => {
      // Cleaning up
      await client.query('delete from post where project_id = $1', [projectId]);
    }, commit);
  });
  it('returns unauthorized error if any user tries to get a private post', async () => {
    const { authHeaders } = await createNewUserAndLogin();

    // Create project and private post administered by this account
    const { projectId, iri } = await createProjectAndPost({
      initAuthHeaders: authHeaders,
      initPrivacy: 'private',
    });

    const resp = await fetch(`${getMarketplaceURL()}/posts/${iri}`, {
      method: 'GET',
      // no authHeaders
    });

    expect(resp.status).toBe(401);

    await withRootDb(async client => {
      // Cleaning up
      await client.query('delete from post where project_id = $1', [projectId]);
    }, commit);
  });
  it('returns a 404 error if the post does not exist', async () => {
    const fakeIri = '123';
    const resp = await fetch(`${getMarketplaceURL()}/posts/${fakeIri}`, {
      method: 'GET',
    });

    expect(resp.status).toBe(404);
  });
});
