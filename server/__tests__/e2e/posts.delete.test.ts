import fetch from 'node-fetch';
import {
  createNewUserAndLogin,
  createProjectAndPost,
  getMarketplaceURL,
} from '../utils';
import { withRootDb } from '../db/helpers';
import { commit } from './post.mock';

describe('/posts DELETE endpoint', () => {
  it('allows the project admin to delete a post', async () => {
    const { authHeaders } = await createNewUserAndLogin();

    // Create project and post administered by this account
    const { iri } = await createProjectAndPost({
      initAuthHeaders: authHeaders,
    });

    const resp = await fetch(`${getMarketplaceURL()}/posts`, {
      method: 'DELETE',
      headers: authHeaders,
      body: JSON.stringify({
        iri,
      }),
    });

    expect(resp.status).toBe(200);
    await withRootDb(async client => {
      const postQuery = await client.query(
        'select * from post where iri = $1',
        [iri],
      );
      expect(postQuery.rowCount).toEqual(0);
    });
  });
  it("does NOT allow a user to delete a post for a project he's not an admin of", async () => {
    const { authHeaders } = await createNewUserAndLogin();

    // Create project and post administered by this account
    const { iri } = await createProjectAndPost({});

    const resp = await fetch(`${getMarketplaceURL()}/posts`, {
      method: 'DELETE',
      headers: authHeaders,
      body: JSON.stringify({
        iri,
      }),
    });

    expect(resp.status).toBe(401);
    await withRootDb(async client => {
      // Cleaning up
      await client.query('delete from post where iri = $1', [iri]);
    }, commit);
  });
  it('returns a 404 error if the post to delete does not exist', async () => {
    const { authHeaders } = await createNewUserAndLogin();

    const resp = await fetch(`${getMarketplaceURL()}/posts`, {
      method: 'DELETE',
      headers: authHeaders,
      body: JSON.stringify({
        iri: '123',
      }),
    });

    expect(resp.status).toBe(404);
  });
});
