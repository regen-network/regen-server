import fetch from 'node-fetch';
import {
  createNewUserAndLogin,
  createProjectAndPost,
  getMarketplaceURL,
} from '../utils';
import { withRootDb } from '../db/helpers';
import {
  commit,
  updatedContents,
  updatedExpIri,
  updatedPrivacy,
} from './post.mock';

// PUT disabled for now.
xdescribe('/posts PUT endpoint', () => {
  it('allows the project admin to update a post privacy and contents', async () => {
    const { authHeaders } = await createNewUserAndLogin();

    // Create project and post administered by this account
    const { iri, accountId, projectId } = await createProjectAndPost({
      initAuthHeaders: authHeaders,
    });

    const resp = await fetch(`${getMarketplaceURL()}/posts`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({
        iri,
        privacy: updatedPrivacy,
        contents: updatedContents,
      }),
    });

    expect(resp.status).toBe(200);
    await withRootDb(async client => {
      const postQuery = await client.query(
        'select * from post where iri = $1',
        [updatedExpIri],
      );
      expect(postQuery.rowCount).toEqual(1);
      expect(postQuery.rows[0].project_id).toEqual(projectId);
      expect(postQuery.rows[0].creator_account_id).toEqual(accountId);
      expect(postQuery.rows[0].privacy).toEqual(updatedPrivacy);
      expect(postQuery.rows[0].contents).toEqual(updatedContents);

      // Cleaning up
      await client.query('delete from post where iri = $1', [updatedExpIri]);
    }, commit);
  });
  it("does NOT allow a user to update a post for a project he's not an admin of", async () => {
    const { authHeaders } = await createNewUserAndLogin();

    // Create project and post administered by this account
    const { iri } = await createProjectAndPost({});

    const resp = await fetch(`${getMarketplaceURL()}/posts`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({
        iri,
        privacy: updatedPrivacy,
        contents: updatedContents,
      }),
    });

    expect(resp.status).toBe(401);
    await withRootDb(async client => {
      // Cleaning up
      await client.query('delete from post where iri = $1', [iri]);
    }, commit);
  });
  it('returns a 404 error if the post to update does not exist', async () => {
    const { authHeaders } = await createNewUserAndLogin();

    const resp = await fetch(`${getMarketplaceURL()}/posts`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({
        iri: '123',
        privacy: updatedPrivacy,
        contents: updatedContents,
      }),
    });

    expect(resp.status).toBe(404);
  });
});
