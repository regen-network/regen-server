import { PoolClient } from 'pg';
import { genRandomRegenAddress } from '../utils';
import {
  becomeAuthUser,
  createAccountWithAuthUser,
  withAuthUserDb,
  withRootDb,
} from './helpers';

describe('the UPDATE RLS policy for the project table...', () => {
  it('should allow a user to update a project they are admin for...', async () => {
    const walletAddr = genRandomRegenAddress();
    await withAuthUserDb(walletAddr, async (client: PoolClient) => {
      const query = await client.query('select id from get_current_account()');
      const [{ id: accountId }] = query.rows;
      const insQuery = await client.query(
        'INSERT INTO project (admin_account_id) VALUES ($1) RETURNING id AS project_id',
        [accountId],
      );
      const [{ project_id }] = insQuery.rows;
      const updQuery = await client.query(
        'UPDATE project SET metadata = $2 WHERE id=$1',
        [project_id, { foo: 'bar' }],
      );
      expect(updQuery.rowCount).toBe(1);
    });
  });

  it('does allow superusers to update the approved column...', async () => {
    await withRootDb(async (client: PoolClient) => {
      const insQuery = await client.query(
        'INSERT INTO project DEFAULT VALUES RETURNING id AS project_id',
      );
      const [{ project_id }] = insQuery.rows;
      const updQuery = await client.query(
        "UPDATE project SET approved = 't' WHERE id=$1",
        [project_id],
      );
      expect(updQuery.rowCount).toBe(1);
    });
  });

  it('does not allow non-superusers to update the approved column...', async () => {
    const walletAddr = genRandomRegenAddress();
    await withAuthUserDb(walletAddr, async (client: PoolClient) => {
      const query = await client.query('select id from get_current_account()');
      const [{ id: accountId }] = query.rows;
      const insQuery = await client.query(
        'INSERT INTO project (admin_account_id) VALUES ($1) RETURNING id AS project_id',
        [accountId],
      );
      const [{ project_id }] = insQuery.rows;
      expect(
        client.query("UPDATE project SET approved = 't' WHERE id=$1", [
          project_id,
        ]),
      ).rejects.toThrow('permission denied for table project');
    });
  });

  it('should NOT allow a user to update another users project...', async () => {
    const walletAddr = genRandomRegenAddress();
    const walletAddr2 = genRandomRegenAddress();
    await withRootDb(async (client: PoolClient) => {
      const { accountId } = await createAccountWithAuthUser(client, walletAddr);
      const { accountId: accountId2 } = await createAccountWithAuthUser(
        client,
        walletAddr2,
      );
      // become the first user...
      await becomeAuthUser(client, accountId);
      const insQuery = await client.query(
        'INSERT INTO project (admin_account_id) VALUES ($1) RETURNING id AS project_id',
        [accountId],
      );
      const [{ project_id }] = insQuery.rows;
      // become the second user...
      await becomeAuthUser(client, accountId2);
      // try to update the first users project...
      const updQuery = await client.query(
        'UPDATE project SET metadata = $2 WHERE id=$1',
        [project_id, { foo: 'bar' }],
      );
      // expect that no rows are modified...
      expect(updQuery.rowCount).toBe(0);
    });
  });

  it('an admin WITH an address SHOULD be able to update an on chain project...', async () => {
    const walletAddr = genRandomRegenAddress();
    await withAuthUserDb(walletAddr, async (client: PoolClient) => {
      const query = await client.query('select id from get_current_account()');
      const [{ id: accountId }] = query.rows;
      const insQuery = await client.query(
        'INSERT INTO project (admin_account_id, on_chain_id) VALUES ($1, $2) RETURNING id AS project_id',
        [accountId, 'FOO-ONCHAIN-ID'],
      );
      const [{ project_id }] = insQuery.rows;
      const updQuery = await client.query(
        'UPDATE project SET metadata = $2 WHERE id=$1',
        [project_id, { foo: 'bar' }],
      );
      expect(updQuery.rowCount).toBe(1);
    });
  });

  it('an admin WITHOUT an address SHOULD NOT be able to update an on chain project...', async () => {
    const walletAddr = genRandomRegenAddress();
    await withAuthUserDb(walletAddr, async (client: PoolClient) => {
      const query = await client.query('select id from get_current_account()');
      // this test requires an account that does not have an address...
      await client.query('UPDATE account SET addr=null');
      const [{ id: accountId }] = query.rows;
      const insQuery = await client.query(
        'INSERT INTO project (admin_account_id, on_chain_id) VALUES ($1, $2) RETURNING id AS project_id',
        [accountId, 'FOO-ONCHAIN-ID'],
      );
      const [{ project_id }] = insQuery.rows;
      const updQuery = await client.query(
        'UPDATE project SET metadata = $2 WHERE id=$1',
        [project_id, { foo: 'bar' }],
      );
      expect(updQuery.rowCount).toBe(0);
    });
  });
});
