import { PoolClient } from 'pg';
import { withRootDb } from '../db/helpers';
import { PostData, PostFile, getPostData } from '../../routes/posts';
import { getFileUrl } from '../../routes/files';
import {
  commit,
  contents,
  privateFilesPost,
  privateLocationsPost,
  privatePost,
  publicPost,
} from '../e2e/post.mock';

const reqProtocol = 'http';
const reqHost = 'test';

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
      for (let i = 0; i < contents.files.length; i++) {
        const iri = contents.files[i].iri;
        const fileName = contents.files[i].name;
        await client.query(
          'insert into upload (iri, url, size, mimetype, account_id, project_id) values ($1, $2, $3, $4, $5, $6)',
          [
            iri,
            getFileUrl({
              bucketName: process.env.AWS_S3_BUCKET,
              path: `projects/${projectId}/posts`,
              fileName,
            }),
            123,
            'image/jpeg',
            accountId,
            projectId,
          ],
        );
      }
    }, commit);
  });
  afterAll(async () => {
    await withRootDb(async (client: PoolClient) => {
      for (let i = 0; i < contents.files.length; i++) {
        await client.query('delete from upload where iri = $1', [
          contents.files[i].iri,
        ]);
      }
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
        expect(postData.contents?.files?.length).toEqual(contents.files.length);
        for (let i = 0; i < contents.files.length; i++)
          expect(postData.contents?.files?.[i]).toEqual({
            iri: privateFilesPost.contents.files?.[i]?.iri,
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

  expect(postData.contents?.files?.length).toEqual(
    privatePost.contents?.files?.length,
  );
  expect(postData.filesUrls).toHaveLength(
    privatePost.contents?.files?.length as number,
  );

  for (let i = 0; i < contents.files.length; i++) {
    const file = postData.contents?.files?.[i] as PostFile;
    const expectedFile = privatePost.contents.files?.[i] as PostFile;
    if (file) {
      const fileIri = file.iri;

      expect(postData.contents?.files?.[i]?.iri).toEqual(fileIri);
      expect(file.name).toEqual(expectedFile?.name);
      expect(file.description).toEqual(expectedFile?.description);
      expect(file?.credit).toEqual(expectedFile?.credit);

      if (!privateLocations)
        expect(file?.location).toEqual(expectedFile?.location);
      else {
        expect(file?.location).not.toBeTruthy();
        // In the case of private data locations,
        // the file URL is a proxy URL using our express-sharp imageOptimizer middleware
        expect(postData.filesUrls?.[i]?.[fileIri]).toContain(
          `${reqProtocol}://${reqHost}/marketplace/v1/image/`,
        );
      }
    }
  }
}
