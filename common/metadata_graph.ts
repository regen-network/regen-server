import { JsonLdDocument } from 'jsonld';
import { PoolClient, Client } from 'pg';
import { generateIRIFromGraph } from 'iri-gen/iri-gen';

export class MetadataNotFound extends Error {
  constructor(message: string) {
    super(message);
  }
}

type MetadataGraphRow = {
  iri: string;
  metadata: JsonLdDocument;
};

export class MetadataGraph {
  client: PoolClient | Client;

  constructor(client: PoolClient | Client) {
    this.client = client;
  }

  async insert(
    iri: string,
    metadata: JsonLdDocument,
  ): Promise<MetadataGraphRow> {
    const resp = await this.client.query(
      'INSERT INTO metadata_graph (iri, metadata) VALUES ($1, $2) ON CONFLICT (iri) DO UPDATE SET iri=$1, metadata=$2 RETURNING iri, metadata',
      [iri, metadata],
    );
    return resp.rows[0];
  }

  async insertIriDoc(
    iri: string,
    metadata: JsonLdDocument,
  ): Promise<MetadataGraphRow> {
    return await this.insert(iri, metadata);
  }

  async insertDoc(metadata: JsonLdDocument): Promise<MetadataGraphRow> {
    const iri = await generateIRIFromGraph(metadata);
    return await this.insert(iri, metadata);
  }

  async fetchByIri(iri: string): Promise<JsonLdDocument> {
    const { rows } = await this.client.query(
      'SELECT metadata FROM metadata_graph WHERE iri=$1 LIMIT 1',
      [iri],
    );
    if (rows.length === 0) {
      throw new MetadataNotFound('Metadata not found');
    } else {
      const [row] = rows;
      return row.metadata;
    }
  }
}
