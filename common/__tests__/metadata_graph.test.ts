import { Client } from 'pg';
import { MetadataGraph } from '../metadata_graph';

describe('MetadataGraph', () => {
  const dburl = process.env.TEST_DATABASE_URL;
  const client = new Client({
    connectionString: dburl,
  });

  beforeAll(async () => {
    return await client.connect();
  });
  beforeEach(async () => {
    return await client.query('BEGIN');
  });
  afterEach(async () => {
    return await client.query('ROLLBACK');
  });
  afterAll(async () => {
    return await client.end();
  });

  test('inserts a doc', async () => {
    const doc = {
      'http://schema.org/name': 'Bucky Fuller',
      'http://schema.org/url': {
        '@id': 'http://www.wikidata.org/wiki/Q102289/',
      },
    };
    const { iri, metadata } = await MetadataGraph.insert_doc(client, doc);
    expect(iri).toBe(
      'regen:13toVhNei4y1Tt2Ebf2ZkCM1vQ3hcudK4miVKpaqgkc1mmaETcC3jjQ.rdf',
    );
    expect(metadata).toMatchObject(doc);
  });
  test('inserting the same doc works idempotently', async () => {
    const doc = {
      'http://schema.org/name': 'Bucky Fuller',
      'http://schema.org/url': {
        '@id': 'http://www.wikidata.org/wiki/Q102289/',
      },
    };
    const doc1 = await MetadataGraph.insert_doc(client, doc);
    const doc2 = await MetadataGraph.insert_doc(client, doc);
    expect(doc1).toMatchObject(doc2);
  });
});
