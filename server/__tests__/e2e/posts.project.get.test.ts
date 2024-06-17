import fetch from 'node-fetch';
import {
  createNewUserAndLogin,
  createProjectAndPosts,
  getMarketplaceURL,
} from '../utils';
import { withRootDb } from '../db/helpers';
import { commit } from './post.mock';

const nbPosts = 4;

describe('/posts/project/:projectId GET endpoint', () => {
  it('returns the list of years with posts and the first posts from the most recent year if year is not provided', async () => {
    const { authHeaders } = await createNewUserAndLogin();

    // Create project and post administered by this account
    const { projectId } = await createProjectAndPosts({
      initAuthHeaders: authHeaders,
      nbPosts,
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
    expect(data.years.length).toEqual(1);
    expect(data.years[0]).toEqual(new Date().getFullYear());
    // returned posts contents based on privacy settings tested in unit test for getPostData function
    expect(data.posts.length).toEqual(nbPosts);
    expect(data.total).toEqual(nbPosts);

    await withRootDb(async client => {
      // Cleaning up
      await client.query('delete from post where project_id = $1', [projectId]);
    }, commit);
  });
  it('returns the posts from the provided year with limit and offset', async () => {
    const { authHeaders } = await createNewUserAndLogin();

    // Create project and post administered by this account
    const { projectId, iris } = await createProjectAndPosts({
      initAuthHeaders: authHeaders,
      nbPosts,
    });

    const year = new Date().getFullYear();
    const offset = 2;
    const limit = 2;
    const resp = await fetch(
      `${getMarketplaceURL()}/posts/project/${projectId}?year=${year}&offset=${offset}&limit=${limit}`,
      {
        method: 'GET',
        headers: authHeaders,
      },
    );

    expect(resp.status).toBe(200);
    const data = await resp.json();
    expect(data.posts.length).toEqual(limit);
    const irisReversed = iris.reverse(); // reversing to get the most recent posts iris first
    expect(data.posts[0].iri).toEqual(irisReversed[offset]);
    expect(new Date(data.posts[0].createdAt).getFullYear()).toEqual(year);
    expect(data.posts[1].iri).toEqual(irisReversed[offset + 1]);
    expect(new Date(data.posts[1].createdAt).getFullYear()).toEqual(year);

    await withRootDb(async client => {
      // Cleaning up
      await client.query('delete from post where project_id = $1', [projectId]);
    }, commit);
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
