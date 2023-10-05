import { PoolClient } from 'pg';
import { withRootDb } from '../db/helpers';
import { verify } from '../../middleware/googleStrategy';

const email = 'john@doe.com';
const google = '12345';

describe('auth google strategy verify', () => {
  it('should create a new party and role', async () => {
    await withRootDb(async (client: PoolClient) => {
      const id = await verify(email, 'true', google, client);
      const partyQuery = await client.query(
        'SELECT * FROM party WHERE id = $1',
        [id],
      );
      expect(partyQuery.rowCount).toBe(1);
      expect(partyQuery.rows[0].email).toEqual(email);
      expect(partyQuery.rows[0].google).toEqual(google);

      const roleQuery = await client.query(
        'SELECT 1 FROM pg_roles WHERE rolname = $1',
        [id],
      );
      expect(roleQuery.rowCount).toBe(1);
    });
  });
  it('should update a party with same email but no google id', async () => {
    await withRootDb(async (client: PoolClient) => {
      const insertQuery = await client.query(
        'INSERT INTO party (type, email) values ($1, $2) returning id',
        ['user', email],
      );
      const [{ id: newId }] = insertQuery.rows;
      await client.query('select private.create_auth_user($1)', [newId]);

      const id = await verify(email, 'true', google, client);
      const partyQuery = await client.query(
        'SELECT * FROM party WHERE id = $1',
        [id],
      );
      expect(newId).toEqual(id);
      expect(partyQuery.rowCount).toBe(1);
      expect(partyQuery.rows[0].email).toEqual(email);
      expect(partyQuery.rows[0].google).toEqual(google);
    });
  });
  it('should verify an existing party', async () => {
    await withRootDb(async (client: PoolClient) => {
      const insertQuery = await client.query(
        'INSERT INTO party (type, email, google) values ($1, $2, $3) returning id',
        ['user', email, google],
      );
      const [{ id: newId }] = insertQuery.rows;
      await client.query('select private.create_auth_user($1)', [newId]);

      const id = await verify(email, 'true', google, client);
      expect(newId).toEqual(id);
    });
  });
  it('should throw an error if email not verified', async () => {
    await withRootDb(async (client: PoolClient) => {
      expect(verify(email, 'false', google, client)).rejects.toThrow(
        'Email not verified',
      );
    });
  });
});
