import fetch from 'node-fetch';
import {
  createNewUserAndLogin,
  createProjectAndPost,
  expIri,
  getMarketplaceURL,
} from '../utils';
import { withRootDb } from '../db/helpers';

const updatedPrivacy = 'private_files';
const updatedMetadata = {
  '@context': { x: 'http://some.schema' },
  'x:someField': 'some other value',
};
const updatedExpIri =
  'regen:13toVh6DipJCaUZp7Ve33MEJ8fEtYVd6f8Xmswk8E3ocqVqJA3QVN3X.rdf';

describe('/posts PUT endpoint', () => {
  it('allows the project admin to update a post privacy and metadata', async () => {
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
        metadata: updatedMetadata,
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
      expect(postQuery.rows[0].metadata).toEqual(updatedMetadata);

      // Cleaning up
      await client.query('delete from post where iri = $1', [updatedExpIri]);
    }, false);
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
        metadata: updatedMetadata,
      }),
    });

    expect(resp.status).toBe(401);
    await withRootDb(async client => {
      // Cleaning up
      await client.query('delete from post where iri = $1', [expIri]);
    }, false);
  });
  it('returns a 500 error if the post does not exist', async () => {
    const { authHeaders } = await createNewUserAndLogin();

    const resp = await fetch(`${getMarketplaceURL()}/posts`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({
        iri: '123',
        privacy: updatedPrivacy,
        metadata: updatedMetadata,
      }),
    });

    expect(resp.status).toBe(404);
  });
});
