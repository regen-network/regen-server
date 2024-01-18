import { PoolClient } from 'pg';
import { withRootDb } from '../db/helpers';
import { Post, PostData, getPostData } from '../../routes/posts';
import { getFileUrl } from '../../routes/files';

// TODO update once post schema is finalized
const contents = {
  '@context': { x: 'http://some.schema' },
  'x:title': 'post title',
  'x:files': [
    {
      '@id': 'regen:123.jpg',
      'x:name': 'filename.jpg',
      'x:location': 'POINT(12 34)',
    },
  ],
};
const reqProtocol = 'http';
const reqHost = 'test';

const projectId = 'c47cfd74-9e54-11ee-a131-0242ac120002';
const creatorAccountId = '86400484-9e54-11ee-8e9c-0242ac120002';
const post = {
  iri: 'regen:123.rdf',
  created_at: new Date(),
  creator_account_id: creatorAccountId,
  project_id: projectId,
  contents,
};
const privatePost: Post = { ...post, privacy: 'private' };
const privateFilesPost: Post = { ...post, privacy: 'private_files' };
const privateLocationsPost: Post = { ...post, privacy: 'private_locations' };
const publicPost: Post = { ...post, privacy: 'public' };
const fileName = 'filename.jpg';
const commit = true;

describe('posts getPostData', () => {
  beforeAll(async () => {
    await withRootDb(async (client: PoolClient) => {
      const accQuery = await client.query(
        "insert into account (type) values ('user') returning id",
      );
      const [{ id: accountId }] = accQuery.rows;
      const projectQuery = await client.query(
        'insert into project (admin_account_id) values ($1) returning id',
        [accountId],
      );
      const [{ id: projectId }] = projectQuery.rows;
      await client.query(
        'insert into upload (iri, url, size, mimetype, account_id, project_id) values ($1, $2, $3, $4, $5, $6)',
        [
          fileName,
          getFileUrl({
            bucketName: process.env.AWS_S3_BUCKET,
            path: `/projects/${projectId}/posts`,
            fileName,
          }),
          123,
          'image/jpeg',
          accountId,
          projectId,
        ],
      );
    }, commit);
  });
  afterAll(async () => {
    await withRootDb(async (client: PoolClient) => {
      await client.query('delete from upload where iri = $1', [
        'regen:123.jpg',
      ]);
    }, commit);
  });
  describe('if user is project admin', () => {
    it('returns the whole post data if private', async () => {
      await withRootDb(async (client: PoolClient) => {
        const postData = await getPostData({
          isProjectAdmin: true,
          post: privatePost,
          client,
          reqProtocol,
          reqHost,
        });

        checkPostData({ postData });
        expect(postData.privacy).toEqual(privatePost.privacy);
      });
    });
    it('returns the whole post data if private files', async () => {
      await withRootDb(async (client: PoolClient) => {
        const postData = await getPostData({
          isProjectAdmin: true,
          post: privateFilesPost,
          client,
          reqProtocol,
          reqHost,
        });

        checkPostData({ postData });
        expect(postData.privacy).toEqual(privateFilesPost.privacy);
      });
    });
    it('returns the whole post data if private locations', async () => {
      await withRootDb(async (client: PoolClient) => {
        const postData = await getPostData({
          isProjectAdmin: true,
          post: privateLocationsPost,
          client,
          reqProtocol,
          reqHost,
        });

        checkPostData({ postData });
        expect(postData.privacy).toEqual(privateLocationsPost.privacy);
      });
    });
    it('returns the whole post data if public', async () => {
      await withRootDb(async (client: PoolClient) => {
        const postData = await getPostData({
          isProjectAdmin: true,
          post: publicPost,
          client,
          reqProtocol,
          reqHost,
        });

        checkPostData({ postData });
        expect(postData.privacy).toEqual(publicPost.privacy);
      });
    });
  });
  describe('if user is not project admin', () => {
    it('only returns post privacy if private', async () => {
      await withRootDb(async (client: PoolClient) => {
        const postData = await getPostData({
          isProjectAdmin: false,
          post: privatePost,
          client,
          reqProtocol,
          reqHost,
        });

        expect(postData).toEqual({ privacy: privatePost.privacy });
      });
    });
    it('only returns the files IRIs if private files', async () => {
      await withRootDb(async (client: PoolClient) => {
        const postData = await getPostData({
          isProjectAdmin: false,
          post: privateFilesPost,
          client,
          reqProtocol,
          reqHost,
        });

        expect(postData.iri).toEqual(privateFilesPost.iri);
        expect(postData.createdAt).toEqual(privateFilesPost.created_at);
        expect(postData.creatorAccountId).toEqual(
          privateFilesPost.creator_account_id,
        );
        expect(postData.projectId).toEqual(privateFilesPost.project_id);
        expect(postData.privacy).toEqual(privateFilesPost.privacy);
        expect(postData.contents['x:files'].length).toEqual(1);
        expect(postData.contents['x:files'][0]).toEqual({
          '@id': privateFilesPost.contents['x:files'][0]['@id'],
        });
      });
    });
    it("returns the post data without files' locations if private locations", async () => {
      await withRootDb(async (client: PoolClient) => {
        const postData = await getPostData({
          isProjectAdmin: false,
          post: privateLocationsPost,
          client,
          reqProtocol,
          reqHost,
        });

        checkPostData({ postData, privateLocations: true });
      });
    });
    it('returns the whole post data if public', async () => {
      await withRootDb(async (client: PoolClient) => {
        const postData = await getPostData({
          isProjectAdmin: false,
          post: publicPost,
          client,
          reqProtocol,
          reqHost,
        });

        checkPostData({ postData });
      });
    });
  });
});

type CheckPostDataParams = {
  postData: PostData;
  privateLocations?: boolean;
};
function checkPostData({
  postData,
  privateLocations = false,
}: CheckPostDataParams) {
  expect(postData.iri).toEqual(privatePost.iri);
  expect(postData.createdAt).toEqual(privatePost.created_at);
  expect(postData.creatorAccountId).toEqual(privatePost.creator_account_id);
  expect(postData.projectId).toEqual(privatePost.project_id);
  expect(postData.contents['x:files'].length).toEqual(1);

  const fileIri = privatePost.contents['x:files'][0]['@id'];
  expect(postData.contents['x:files'][0]['@id']).toEqual(fileIri);
  expect(postData.contents['x:files'][0]['x:name']).toEqual(
    privatePost.contents['x:files'][0]['x:name'],
  );
  expect(postData.filesUrls).toHaveLength(contents['x:files'].length);
  if (!privateLocations)
    expect(postData.contents['x:files'][0]['x:location']).toEqual(
      privatePost.contents['x:files'][0]['x:location'],
    );
  else {
    expect(postData.contents['x:files'][0]['x:location']).not.toBeTruthy();
    // In the case of private data locations,
    // the file URL is a proxy URL using our express-sharp imageOptimizer middleware
    expect(postData.filesUrls[0][fileIri]).toEqual(
      `${reqProtocol}://${reqHost}/marketplace/v1/image/${fileName}`,
    );
  }
}
