import * as express from 'express';
import * as jsonld from 'jsonld';
import { UserRequest } from '../types';
import { PoolClient } from 'pg';
import { pgPool } from 'common/pool';
import { NotFoundError, UnauthorizedError } from '../errors';
import { bucketName, deleteFile, getObjectSignedUrl } from './files';
import { generateIRIFromGraph } from 'iri-gen/iri-gen';
import {
  SUPPORTED_IMAGE_TYPES,
  getS3ImageCachedUrl,
} from '../middleware/imageOptimizer';

const router = express.Router();

type Privacy = 'private' | 'private_files' | 'private_locations' | 'public';
export type Post = {
  iri: string;
  created_at: Date;
  creator_account_id: string;
  project_id: string;
  privacy: Privacy;
  contents: jsonld.JsonLdDocument;
};

// GET post by IRI
router.get('/:iri', async (req: UserRequest, res, next) => {
  let client: PoolClient | null;
  try {
    client = await pgPool.connect();
    const iri = req.params.iri;
    const postRes = await client.query('SELECT * FROM post WHERE iri = $1', [
      iri,
    ]);
    if (postRes.rowCount !== 1) {
      throw new NotFoundError('post not found');
    }

    const post = postRes.rows[0];
    const isProjectAdmin = await getIsProjectAdmin({
      client,
      projectId: post.project_id,
      accountId: req.user?.accountId,
    });
    const reqProtocol = req.protocol;
    const reqHost = req.get('host');
    const postData = await getPostData({
      isProjectAdmin,
      post,
      client,
      reqProtocol,
      reqHost,
    });
    if (postData.privacy === 'private' && !isProjectAdmin) {
      throw new UnauthorizedError('private post');
    }
    return res.json(postData);
  } catch (e) {
    next(e);
  } finally {
    if (client) client.release();
  }
});

// GET posts by project id based on limit, offset, and optional year
router.get('/project/:projectId', async (req: UserRequest, res, next) => {
  let client: PoolClient | null;
  try {
    client = await pgPool.connect();
    const projectId = req.params.projectId;
    const year = req.query.year as string;

    // If year is not provided, we return the list of years containing posts
    // and the posts (based on limit and offset) from the most recent year
    if (!year) {
      const yearsQuery = await client.query(
        "SELECT DATE_PART('year', created_at) AS year FROM post WHERE project_id = $1 GROUP BY year ORDER BY year DESC",
        [projectId],
      );
      if (yearsQuery.rowCount > 0) {
        const mostRecentYear = yearsQuery.rows[0].year;
        const posts = await getPostsData({
          req,
          projectId,
          year: mostRecentYear,
          client,
        });
        res.json({ posts, years: yearsQuery.rows.map(({ year }) => year) });
      } else {
        throw new NotFoundError(`no posts for project ${projectId}`);
      }
    } else {
      // We return the posts (based on limit and offset) for the given year
      const posts = await getPostsData({
        req,
        projectId,
        year,
        client,
      });
      res.json({ posts });
    }
  } catch (e) {
    next(e);
  } finally {
    if (client) client.release();
  }
});

type GetPostsDataParams = {
  req: UserRequest;
  projectId: string;
  year: string;
  client: PoolClient;
};

async function getPostsData({
  projectId,
  year,
  client,
  req,
}: GetPostsDataParams) {
  const limit = req.query.limit;
  const offset = req.query.offset;

  const postsQuery = await client.query(
    "SELECT * FROM post WHERE DATE_PART('year', created_at) = $1 AND project_id = $2 ORDER BY created_at DESC LIMIT $3 OFFSET $4",
    [year, projectId, limit, offset],
  );

  const isProjectAdmin = await getIsProjectAdmin({
    client,
    projectId,
    accountId: req.user?.accountId,
  });

  const reqProtocol = req.protocol;
  const reqHost = req.get('host');
  return await Promise.all(
    postsQuery.rows?.map(
      async post =>
        await getPostData({
          isProjectAdmin,
          post,
          client,
          reqProtocol,
          reqHost,
        }),
    ) || [],
  );
}

type PostInsertInput = {
  projectId: string;
  privacy: string;
  contents: jsonld.JsonLdDocument;
};

// POST create post for a project
router.post('/', async (req: UserRequest, res, next) => {
  let client: PoolClient | null;
  try {
    client = await pgPool.connect();
    const accountId = req.user?.accountId;
    const { projectId, privacy, contents }: PostInsertInput = req.body;

    const isProjectAdmin = await getIsProjectAdmin({
      client,
      projectId,
      accountId,
    });
    if (!isProjectAdmin) {
      throw new UnauthorizedError('only the project admin can create post');
    }

    // Generate post IRI
    const iri = await generateIRIFromGraph(contents);

    await client.query(
      'INSERT INTO POST (iri, creator_account_id, project_id, privacy, contents) VALUES ($1, $2, $3, $4, $5)',
      [iri, accountId, projectId, privacy, contents],
    );

    // TODO Anchor post graph data on chain (#422)
    res.json({ iri });
  } catch (e) {
    next(e);
  } finally {
    if (client) client.release();
  }
});

type PostUpdateInput = {
  iri: string;
  privacy: string;
  contents: jsonld.JsonLdDocument;
};

// PUT update post privacy and contents by IRI
router.put('/', async (req: UserRequest, res, next) => {
  let client: PoolClient | null;
  try {
    client = await pgPool.connect();
    const { iri, privacy, contents }: PostUpdateInput = req.body;
    const accountId = req.user?.accountId;

    const postQuery = await client.query(
      'SELECT project_id FROM post WHERE iri = $1',
      [iri],
    );
    if (postQuery.rowCount !== 1) {
      throw new NotFoundError('post not found');
    }
    const projectId = postQuery.rows[0].project_id;
    const isProjectAdmin = await getIsProjectAdmin({
      client,
      projectId,
      accountId,
    });
    if (!isProjectAdmin) {
      throw new UnauthorizedError('only the project admin can update posts');
    }

    // Generate post new IRI
    const newIri = await generateIRIFromGraph(contents);

    await client.query(
      'UPDATE POST set iri = $1, privacy = $2, contents = $3 WHERE iri = $4',
      [newIri, privacy, contents, iri],
    );

    if (iri !== newIri) {
      // anchor updated post graph data (#422)
    }

    res.sendStatus(200);
  } catch (e) {
    next(e);
  } finally {
    if (client) {
      client.release();
    }
  }
});

// DELETE delete post by IRI
router.delete('/', async (req: UserRequest, res, next) => {
  let client: PoolClient | null;
  try {
    client = await pgPool.connect();
    const iri = req.body.iri;
    const accountId = req.user?.accountId;

    const postQuery = await client.query('SELECT * FROM post WHERE iri = $1', [
      iri,
    ]);
    if (postQuery.rowCount !== 1) {
      throw new NotFoundError('post not found');
    }
    const post = postQuery.rows[0];
    const projectId = post.project_id;
    const isProjectAdmin = await getIsProjectAdmin({
      client,
      projectId,
      accountId,
    });
    if (!isProjectAdmin) {
      throw new UnauthorizedError('only the project admin can delete posts');
    }

    // Delete files from S3 and tracking of those in the upload table
    // TODO update x:files, x:name once post schema defined
    await Promise.all(
      post.contents['x:files']?.map(async file => {
        await deleteFile({
          client,
          accountId: req.user?.accountId,
          fileName: file['x:name'],
          projectId: post.project_id,
          bucketName,
        });
      }) || [],
    );

    // Delete post
    await client.query('DELETE FROM post WHERE iri = $1', [iri]);
    res.sendStatus(200);
  } catch (e) {
    next(e);
  } finally {
    if (client) client.release();
  }
});

type GetPostDataParams = {
  isProjectAdmin: boolean;
  post: Post;
  client: PoolClient;
  reqProtocol: string;
  reqHost: string;
};

export type PostData = {
  iri?: string;
  createdAt?: Date;
  creatorAccountId?: string;
  projectId?: string;
  privacy: Privacy;
  contents?: jsonld.JsonLdDocument;
  filesUrls?: Array<{ [iri: string]: string }>;
};

export async function getPostData({
  isProjectAdmin,
  post,
  client,
  reqProtocol,
  reqHost,
}: GetPostDataParams): Promise<PostData> {
  // TODO compact JSON-LD contents and update field names once post schema is defined
  const files = post.contents['x:files'];

  const hasPrivateLocations = post.privacy === 'private_locations';
  if (isProjectAdmin || post.privacy === 'public' || hasPrivateLocations) {
    const filesUrls = await getFilesUrls({
      client,
      files,
      hasPrivateLocations,
      reqProtocol,
      reqHost,
    });
    if (!isProjectAdmin && post.privacy === 'private_locations') {
      // Filter post file locations
      post.contents['x:files'] = post.contents['x:files']?.map(
        ({ ['x:location']: _, ...keepAttrs }) => keepAttrs,
      );
    }
    return { ...postToCamelCase(post), filesUrls };
  } else {
    switch (post.privacy) {
      case 'private':
        return { privacy: 'private' };
      case 'private_files':
        // Only return files IRIs if files are private
        post.contents['x:files'] = files?.map(file => ({
          '@id': file['@id'],
        }));
        return postToCamelCase(post);
      default:
        throw new Error('unsupported post privacy');
    }
  }
}

type File = { '@id': string } & object;

type GetFilesWithSignedUrlsParams = {
  client: PoolClient;
  files: Array<File>;
  hasPrivateLocations: boolean;
  reqProtocol: string;
  reqHost: string;
};

/**
 * getFilesUrls returns a map of files IRIs to files URLs.
 * Such an URL is either provided by our express-sharp middleware in the case of image with private location
 * or an AWS S3 signed URL. A signed URL uses security credentials
 * to grant time-limited permission to access and download files.
 * https://docs.aws.amazon.com/AmazonS3/latest/userguide/ShareObjectPreSignedURL.html
 * @param getFilesUrls Params for getFilesUrls function
 * @param getFilesUrls.client The pg PoolClient
 * @param getFilesUrls.files The list of files to get the signed URL
 * @returns Promise<Array<{iri: signedUrl}>>
 */
async function getFilesUrls({
  client,
  files,
  hasPrivateLocations,
  reqProtocol,
  reqHost,
}: GetFilesWithSignedUrlsParams) {
  return await Promise.all(
    files?.map(async file => {
      const { '@id': fileIri } = file;
      const fileRes = await client.query(
        'SELECT * FROM upload WHERE iri = $1',
        [fileIri],
      );
      if (fileRes.rowCount !== 1) {
        throw new NotFoundError(`file with iri ${fileIri} not found`);
      }
      const [{ url, mimetype }] = fileRes.rows;
      let fileUrl: string | undefined;

      // If the file location is private and the file is an image,
      // we proxy the image through sharp so the resulting image
      // doesn't have any location metadata
      if (hasPrivateLocations && SUPPORTED_IMAGE_TYPES.includes(mimetype)) {
        fileUrl = getS3ImageCachedUrl({
          url,
          reqProtocol: reqProtocol,
          reqHost: reqHost,
        });
      } else {
        fileUrl = await getObjectSignedUrl({
          bucketName,
          fileUrl: url,
        });
      }
      return { fileIri: fileUrl };
    }) || [],
  );
}

type GetIsProjectAdminType = {
  client: PoolClient;
  projectId: string;
  accountId?: string;
};

async function getIsProjectAdmin({
  client,
  projectId,
  accountId,
}: GetIsProjectAdminType) {
  const projectQuery = await client.query(
    'SELECT admin_account_id FROM project WHERE id = $1',
    [projectId],
  );
  if (projectQuery.rowCount !== 1) {
    throw new NotFoundError('project not found');
  }
  return projectQuery.rows[0].admin_account_id === accountId;
}

export function postToCamelCase(post: Post) {
  return {
    iri: post.iri,
    createdAt: post.created_at,
    creatorAccountId: post.creator_account_id,
    projectId: post.project_id,
    privacy: post.privacy,
    contents: post.contents,
  };
}

export default router;
