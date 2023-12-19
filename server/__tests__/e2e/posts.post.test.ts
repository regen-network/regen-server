import fetch from 'node-fetch';
import {
  createNewUserAndLogin,
  createProject,
  expIri,
  getMarketplaceURL,
  metadata,
  privacy,
} from '../utils';
import { withRootDb } from '../db/helpers';

describe('/posts POST endpoint', () => {
  it('allows the project admin to insert a post for this project', async () => {
    const { authHeaders } = await createNewUserAndLogin();

    // Create a project administered by this account
    const { projectId, accountId } = await createProject({
      initAuthHeaders: authHeaders,
    });

    const resp = await fetch(`${getMarketplaceURL()}/posts`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ projectId, privacy, metadata }),
    });

    expect(resp.status).toBe(200);
    const { iri } = await resp.json();
    expect(iri).toEqual(expIri);
    await withRootDb(async client => {
      const postQuery = await client.query(
        'select * from post where iri = $1',
        [iri],
      );
      expect(postQuery.rowCount).toEqual(1);
      expect(postQuery.rows[0].creator_account_id).toEqual(accountId);
      expect(postQuery.rows[0].project_id).toEqual(projectId);
      expect(postQuery.rows[0].privacy).toEqual(privacy);
      expect(postQuery.rows[0].metadata).toEqual(metadata);

      // Cleaning up
      await client.query('delete from post where iri = $1', [expIri]);
    }, false);
  });
  it("does NOT allow a user to insert a post for a project he's not an admin of", async () => {
    const { authHeaders } = await createNewUserAndLogin();

    // Create a project administered by another account
    const { projectId } = await createProject({});

    const resp = await fetch(`${getMarketplaceURL()}/posts`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ projectId, privacy, metadata }),
    });

    expect(resp.status).toBe(401);
  });
  it('returns a 404 error if the project does not exist', async () => {
    const { authHeaders } = await createNewUserAndLogin();

    const resp = await fetch(`${getMarketplaceURL()}/posts`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        projectId: '00000000-0000-0000-0000-000000000000',
        privacy,
        metadata,
      }),
    });

    expect(resp.status).toBe(404);
  });
});
