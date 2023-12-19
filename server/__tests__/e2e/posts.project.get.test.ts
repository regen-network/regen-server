import fetch from 'node-fetch';
import {
  createNewUserAndLogin,
  createProjectAndPosts,
  getMarketplaceURL,
} from '../utils';
import { withRootDb } from '../db/helpers';

const commit = true;

describe('/posts/project/:projectId GET endpoint', () => {
  it('returns the first posts from the most recent year if year is not provided', async () => {
    const { authHeaders } = await createNewUserAndLogin();

    // Create project and post administered by this account
    const { projectId } = await createProjectAndPosts({
      initAuthHeaders: authHeaders,
    });

    const resp = await fetch(
      `${getMarketplaceURL()}/posts/project/${projectId}`,
      {
        method: 'GET',
        headers: authHeaders,
      },
    );

    expect(resp.status).toBe(200);
    const data = await resp.json();
    console.log(data);
    await withRootDb(async client => {
      // Cleaning up
      await client.query('delete from post where project_id = $1', [projectId]);
    }, commit);
  });
  it('returns the posts from the provided year', async () => {
    // TODO
  });
  it('returns a 404 error if the project to get posts for does not exist', async () => {
    const resp = await fetch(
      `${getMarketplaceURL()}/posts/project/00000000-0000-0000-0000-000000000000`,
      {
        method: 'GET',
      },
    );

    expect(resp.status).toBe(404);
  });
});
