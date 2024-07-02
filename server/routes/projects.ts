import * as express from 'express';
import { UserRequest } from '../types';

import { PoolClient } from 'pg';
import { pgPool } from 'common/pool';
import { NotFoundError, UnauthorizedError, ForbiddenError } from '../errors';
import { bucketName } from './files';
import { ensureLoggedIn } from '../middleware/passport';

const router = express.Router();

function getS3KeyFromUrl(url: string) {
  return url.split(`https://${bucketName}.s3.amazonaws.com/`).pop();
}

// DELETE project and dependent resources by id
router.delete('/:id', ensureLoggedIn(), async (req: UserRequest, res, next) => {
  let client: PoolClient | null = null;
  try {
    client = await pgPool.connect();
    const projectId = req.params.id;
    const accountId = req.user?.accountId;

    const projectQuery = await client.query(
      'SELECT * FROM project WHERE id = $1',
      [projectId],
    );

    if (projectQuery.rowCount !== 1) {
      throw new NotFoundError('project not found');
    }
    const project = projectQuery.rows[0];
    if (project.admin_account_id !== accountId) {
      throw new UnauthorizedError('only the project admin can delete projects');
    }

    if (project.on_chain_id) {
      throw new ForbiddenError(
        'projects that exist on chain cannot be deleted',
      );
    }

    const creditBatchQuery = await client.query(
      'SELECT id FROM credit_batch WHERE project_id = $1',
      [projectId],
    );
    if (creditBatchQuery.rowCount !== 0) {
      throw new ForbiddenError(
        'projects with credit batches cannot be deleted',
      );
    }
    // query files
    // Post files
    const postQuery = await client.query(
      'SELECT contents FROM post WHERE project_id = $1',
      [projectId],
    );
    const postFileKeys = postQuery.rows
      .flatMap(post => post.contents.files)
      // remove any undefineds (from posts that don't have 'x:files' field)
      .filter(x => Boolean(x))
      .map(file => file.name);

    // Document files
    const documentQuery = await client.query(
      'SELECT url FROM document WHERE project_id = $1',
      [projectId],
    );
    const documentFileKeys = documentQuery.rows.map(({ url }) =>
      getS3KeyFromUrl(url),
    );

    // Upload files
    const uploadQuery = await client.query(
      'SELECT url FROM upload WHERE project_id = $1',
      [projectId],
    );
    const uploadFileKeys = uploadQuery.rows.map(({ url }) =>
      getS3KeyFromUrl(url),
    );

    // Query tables and columns where public.project.id is used as foreign key
    const dependentResourcesQueryString = `SELECT DISTINCT 
  tc.table_schema,
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_schema AS foreign_table_schema,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND ccu.table_schema='public'
  AND ccu.table_name='project'
  AND ccu.column_name='id'`;
    const dependentResourcesQuery = await client.query(
      dependentResourcesQueryString,
    );
    // Initialize db transaction
    try {
      // DELETE FROM document WHERE project_id = $1
      await client.query('BEGIN');
      await client.query('SAVEPOINT delete_project_resources');
      for (const row of dependentResourcesQuery.rows) {
        await client.query(
          `DELETE FROM ${row.table_schema}.${row.table_name} WHERE ${row.column_name} = $1`,
          [projectId],
        );
      }

      // Delete project now that all dependencies have been removed
      await client.query('DELETE FROM project WHERE id = $1', [projectId]);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK TO delete_project_resources');
      await client.query('COMMIT');
      throw e;
    }

    // Add rows to s3_deletion table
    const filesToDelete = [
      ...postFileKeys,
      ...uploadFileKeys,
      ...documentFileKeys,
    ];
    const addToS3DeletionTable = (key: string) =>
      client?.query('insert into s3_deletion (bucket, key) values ($1, $2)', [
        bucketName,
        key,
      ]);
    await Promise.all(filesToDelete.map(addToS3DeletionTable));

    res.sendStatus(200);
  } catch (e) {
    next(e);
  } finally {
    if (client) client.release();
  }
});

export default router;
