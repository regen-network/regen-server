import * as express from 'express';
import { UserRequest } from '../types';

import { PoolClient } from 'pg';
import { pgPool } from 'common/pool';
import { NotFoundError, UnauthorizedError, ForbiddenError } from '../errors';
import { getIsProjectAdmin } from './posts';
import { bucketName, deleteFile } from './files';

const router = express.Router();

// DELETE project and dependent resources by id
router.delete('/', async (req: UserRequest, res, next) => {
  let client: PoolClient | null;
  try {
    client = await pgPool.connect();
    const { id: projectId } = req.body;
    const { accountId } = req.user;
    const projectQuery = await client.query(
      'SELECT * FROM project WHERE id = $1',
      [projectId],
    );

    if (projectQuery.rowCount !== 1) {
      throw new NotFoundError('project not found');
    }
    const project = projectQuery.rows[0];
    const isProjectAdmin = await getIsProjectAdmin({
      client,
      projectId,
      accountId,
    });
    if (!isProjectAdmin) {
      throw new UnauthorizedError('only the project admin can delete projects');
    }

    if (project.on_chain_id) {
      throw new ForbiddenError(
        'projects that exist on chain cannot be deleted',
      );
    }

    // Find all resources associated with a project and delete them

    // Documents
    const documentQuery = await client.query(
      'SELECT id, url FROM document WHERE project_id = $1',
      [projectId],
    );
    // Delete document S3 files
    await Promise.all(
      documentQuery.rows.map(async ({ url }) => {
        await deleteFile({
          client,
          currentAccountId: accountId,
          fileName: url,
          projectId: projectId,
          bucketName,
        });
      }),
    );
    // Delete document rows in db
    // const documentIdsToDelete = documentQuery.rows.map(({ id }) => id);
    // if (documentIdsToDelete.length > 0) {
    //   const documentPlaceholders = documentIdsToDelete
    //     .map((_, i) => `$${i + 1}`)
    //     .join(', ');
    //   await client.query(
    //     `DELETE FROM document WHERE id IN (${documentPlaceholders})`,
    //     documentIdsToDelete,
    //   );
    // }
    await client.query('DELETE FROM document WHERE project_id = $1', [
      projectId,
    ]);

    // Uploads
    const uploadQuery = await client.query(
      'SELECT url, id FROM upload WHERE project_id = $1',
      [projectId],
    );

    // Delete upload S3 files
    await Promise.all(
      uploadQuery.rows.map(async ({ url }) => {
        await deleteFile({
          client,
          currentAccountId: accountId,
          fileName: url,
          projectId: projectId,
          bucketName,
        });
      }),
    );
    // Delete upload rows
    // const uploadIdsToDelete = uploadQuery.rows.map(({ id }) => id);
    // if (uploadIdsToDelete.length > 0) {
    //   const uploadPlaceholders = uploadIdsToDelete
    //     .map((_, i) => `$${i + 1}`)
    //     .join(', ');
    //   await client.query(
    //     `DELETE FROM upload WHERE id IN (${uploadPlaceholders})`,
    //     [uploadIdsToDelete],
    //   );
    // }
    await client.query('DELETE FROM upload WHERE project_id = $1', [projectId]);

    // Posts
    // Is there a way to confirm it hasn't been anchored?
    // Presumably on chain posts are only allowed for on chain projects?
    const postQuery = await client.query(
      'SELECT iri, contents FROM post WHERE project_id = $1',
      [projectId],
    );
    // const postIris = postQuery.rows.map(({ iri }) => iri);
    const postFiles = postQuery.rows
      .flatMap(post => post.contents['x:files'])
      // remove any undefineds (from posts that don't have 'x:files' field)
      .filter(x => Boolean(x));

    // Delete files from S3 and tracking of those in the upload table
    // TODO update x:files, x:name once post schema defined
    await Promise.all(
      postFiles.map(async file => {
        await deleteFile({
          client,
          currentAccountId: accountId,
          fileName: file['x:name'],
          projectId: projectId,
          bucketName,
        });
      }),
    );
    // Delete posts
    await client.query('DELETE FROM post WHERE project_id = $1', [projectId]);

    // Project Partner
    await client.query('DELETE FROM project_partner WHERE project_id = $1', [
      projectId,
    ]);

    // Credit batches: ignore because I assume you can only create these if the project is on chain

    // Delete project
    await client.query('DELETE FROM project WHERE id = $1', [projectId]);
    res.sendStatus(200);
  } catch (e) {
    next(e);
  } finally {
    if (client) client.release();
  }
});

export default router;
