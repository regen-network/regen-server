import * as express from 'express';
import { UserRequest } from '../types';
import { PoolClient } from 'pg';
import { pgPool } from 'common/pool';
import { NotFoundError, UnauthorizedError } from '../errors';
import { bucketName, getObjectSignedUrl } from './files';

const router = express.Router();

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
    // TODO compact JSON-LD metadata and update field names once post schema is defined
    const files = post.metadata['x:files'];
    const currentAccountId = req.user?.accountId;

    if (
      post.account_id === currentAccountId ||
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
      res.json(post);
    } else {
      switch (post.privacy) {
        case 'private':
          throw new UnauthorizedError('private post');
        case 'private_files':
          // Only return files IRIs if files are private
          post.metadata['x:files'] = files?.map(file => ({
            '@id': file['@id'],
          }));
          return res.json(post);
        default:
          throw new Error('unsupported post privacy');
      }
    }
  } catch (e) {
    next(e);
  } finally {
    if (client) client.release();
  }
});

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

// GET posts by project id
router.get('/project/:projectId', async (req: UserRequest, res, next) => {
  let client: PoolClient | null;
  try {
    client = await pgPool.connect();
    const projectId = req.params.projectId;
    const year = req.query.year;
    // TODO
  } catch (e) {
    next(e);
  } finally {
    if (client) client.release();
  }
});

// POST create post for a project
router.post('/project/:projectId', async (req: UserRequest, res, next) => {
  let client: PoolClient | null;
  try {
    client = await pgPool.connect();
    // TODO
  } catch (e) {
    next(e);
  } finally {
    if (client) client.release();
  }
});

// PUT update post by IRI
router.put('/:iri', async (req: UserRequest, res, next) => {
  let client: PoolClient | null;
  try {
    client = await pgPool.connect();
    // TODO
  } catch (e) {
    next(e);
  } finally {
    if (client) client.release();
  }
});

// DELETE delete post by IRI
router.delete('/:iri', async (req: UserRequest, res, next) => {
  let client: PoolClient | null;
  try {
    client = await pgPool.connect();
    // TODO delete from tables post and upload, delete files from S3
  } catch (e) {
    next(e);
  } finally {
    if (client) client.release();
  }
});

export default router;
