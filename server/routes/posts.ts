import * as express from 'express';
import * as jsonld from 'jsonld';
import { mapKeys, camelCase } from 'lodash';
import { UserRequest } from '../types';
import { PoolClient } from 'pg';
import { pgPool } from 'common/pool';
import { NotFoundError, UnauthorizedError } from '../errors';
import { bucketName, deleteFile, getObjectSignedUrl } from './files';
import { generateIRIFromGraph } from 'iri-gen/iri-gen';

const router = express.Router();

type Post = {
  iri: string;
  created_at: Date;
  creator_account_id: string;
  project_id: string;
  privacy: 'private' | 'private_files' | 'private_locations' | 'public';
  metadata: jsonld.JsonLdDocument;
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
    const postData = await getPostData({ isProjectAdmin, post, client });
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
    if (year) {
      const yearsQuery = await client.query(
        "SELECT DATE_TRUNC('year', created_at) AS year FROM post WHERE project_id = $1 GROUP BY year ORDER BY year DESC",
        [projectId],
      );
      if (yearsQuery.rowCount > 0) {
        const mostRecentYear = yearsQuery.rows[0];

        const posts = await getPostsData({
          req,
          projectId,
          year: mostRecentYear,
          client,
        });
        res.json({ posts, years: yearsQuery.rows });
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
  req,
  projectId,
  year,
  client,
}: GetPostsDataParams) {
  const limit = req.query.limit;
  const offset = req.query.offset;

  const postsQuery = await client.query(
    "SELECT * FROM post WHERE DATE_TRUNC('year', created_at) = $1 AND project_id = $2 ORDER BY created_at DESC LIMIT $3 OFFSET $4",
    [year, projectId, limit, offset],
  );

  const isProjectAdmin = await getIsProjectAdmin({
    client,
    projectId,
    accountId: req.user?.accountId,
  });

  return await Promise.all(
    postsQuery.rows?.map(
      async post =>
        await getPostData({
          isProjectAdmin,
          post,
          client,
        }),
    ),
  );
}

type PostInsertInput = {
  projectId: string;
  privacy: string;
  metadata: jsonld.JsonLdDocument;
};

// POST create post for a project
router.post('/', async (req: UserRequest, res, next) => {
  let client: PoolClient | null;
  try {
    client = await pgPool.connect();
    const accountId = req.user?.accountId;
    const { projectId, privacy, metadata }: PostInsertInput = req.body;

    const isProjectAdmin = await getIsProjectAdmin({
      client,
      projectId,
      accountId,
    });
    if (!isProjectAdmin) {
      throw new UnauthorizedError('only the project admin can create post');
    }

    // Generate post IRI
    const iri = await generateIRIFromGraph(metadata);

    await client.query(
      'INSERT INTO POST (iri, creator_account_id, project_id, privacy, metadata) VALUES ($1, $2, $3, $4, $5)',
      [iri, accountId, projectId, privacy, metadata],
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
  metadata: jsonld.JsonLdDocument;
};

// PUT update post privacy and metadata by IRI
router.put('/', async (req: UserRequest, res, next) => {
  let client: PoolClient | null;
  try {
    client = await pgPool.connect();
    const { iri, privacy, metadata }: PostUpdateInput = req.body;
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
      throw new UnauthorizedError('only the project admin can update post');
    }

    // Generate post new IRI
    const newIri = await generateIRIFromGraph(metadata);

    await client.query(
      'UPDATE POST set iri = $1, privacy = $2, metadata = $3 WHERE iri = $4',
      [newIri, privacy, metadata, iri],
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
router.delete('/:iri', async (req: UserRequest, res, next) => {
  let client: PoolClient | null;
  try {
    client = await pgPool.connect();
    const iri = req.params.iri;

    const postQuery = await client.query('SELECT * FROM post WHERE iri = $1', [
      iri,
    ]);
    if (postQuery.rowCount !== 1) {
      throw new NotFoundError('post not found');
    }
    const post = postQuery.rows[0];

    // Delete files from S3 and tracking of those in the upload table
    // TODO update x:files, x:name once post schema defined
    await Promise.all(
      post.metadata['x:files'].map(async file => {
        await deleteFile({
          client,
          accountId: req.user?.accountId,
          fileName: file['x:name'],
          projectId: post.project_id,
          bucketName,
        });
      }),
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
};

async function getPostData({
  isProjectAdmin,
  post,
  client,
}: GetPostDataParams) {
  // TODO compact JSON-LD metadata and update field names once post schema is defined
  const files = post.metadata['x:files'];

  if (
    isProjectAdmin ||
    post.privacy === 'public' ||
    post.privacy === 'private_locations'
  ) {
    post.metadata['x:files'] = await getFilesWithSignedUrls({
      client,
      files,
    });
    if (post.privacy === 'private_locations') {
      // Filter post file locations
      post.metadata['x:files'] = files?.map(
        ({ ['x:location']: _, ...keepAttrs }) => keepAttrs,
      );
    }
    return mapKeys(post, (_, key) => camelCase(key));
  } else {
    switch (post.privacy) {
      case 'private':
        throw new UnauthorizedError('private post');
      case 'private_files':
        // Only return files IRIs if files are private
        post.metadata['x:files'] = files?.map(file => ({
          '@id': file['@id'],
        }));
        return mapKeys(post, (_, key) => camelCase(key));
      default:
        throw new Error('unsupported post privacy');
    }
  }
}

type File = { '@id': string; signedUrl?: string } & object;

type GetFilesWithSignedUrlsParams = {
  client: PoolClient;
  files: Array<File>;
};

async function getFilesWithSignedUrls({
  client,
  files,
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
      const [{ url }] = fileRes.rows;
      const signedUrl = await getObjectSignedUrl({
        bucketName,
        fileUrl: url,
      });
      return { ...file, signedUrl };
    }),
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

export default router;
