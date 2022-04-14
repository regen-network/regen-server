import { JsonLdDocument } from 'jsonld';
import { PoolClient, Client } from 'pg';
import { generateIRI } from 'iri-gen/iri-gen';

export class MetadataNotFound extends Error {
  constructor(message: string) {
    super(message);
  }
}

export const MetadataGraph = {
  insert: async function (
    client: PoolClient | Client,
    iri: string,
    metadata: JsonLdDocument,
  ) {
    const resp = await client.query(
      'INSERT INTO metadata_graph (iri, metadata) VALUES ($1, $2) ON CONFLICT (iri) DO UPDATE SET iri=$1, metadata=$2 RETURNING iri, metadata',
      [iri, metadata],
    );
    return resp.rows[0];
  },
  insertIriDoc: async function (
    client: PoolClient | Client,
    iri: string,
    metadata: JsonLdDocument,
  ) {
    return await this.insert(client, iri, metadata);
  },
  insertDoc: async function (
    client: PoolClient | Client,
    metadata: JsonLdDocument,
  ) {
    const iri = await generateIRI(metadata);
    return await this.insert(client, iri, metadata);
  },
  fetchByIri: async function (client: PoolClient | Client, iri: string) {
    const { rows } = await client.query(
      'SELECT metadata FROM metadata_graph WHERE iri=$1 LIMIT 1',
      [iri],
    );
    if (rows.length === 0) {
      throw new MetadataNotFound('Metadata not found');
    } else {
      const [row] = rows;
      return row.metadata;
    }
  },
};
