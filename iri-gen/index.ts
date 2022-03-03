import * as fs from 'fs';
import { Pool, Client, PoolConfig } from 'pg';
import { generateIRI } from './iri-gen';
import 'dotenv/config'

function setupPgPool() {
  const poolConfig: PoolConfig = {
    connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/regen_registry',
  };

  if (process.env.NODE_ENV === 'production') {
    poolConfig.ssl = {
      ca: fs.readFileSync(`${__dirname}/../config/rds-combined-ca-bundle.pem`),
    };
  }

  const pool = new Pool(poolConfig);
  return pool;
}

async function readFileAndGenerateIRI(path) {
    const rawdata = fs.readFileSync(path);
    const doc = JSON.parse(rawdata.toString());
    const iri = await generateIRI(doc);
    return {doc, iri};
}

async function main() {
  // Make sure we got a filename on the command line.
  if (process.argv.length < 3) {
    console.log('You should provide the path to a JSON file');
    process.exit(1);
  }
  const insert_flag = process.argv.includes('--insert');
  if (insert_flag) {
    // remove --insert flag if it was specified
    const idx = process.argv.indexOf('--insert');
    process.argv.splice(idx, 1);
  }
  const path = process.argv[2];
  const {iri, doc} = await readFileAndGenerateIRI(path);
  if (iri) {
    console.log(`The IRI for ${path} is: ${iri}`)
  }
  if (insert_flag) {
    try {
      var pool = setupPgPool();
    } catch (err) {
      console.error(err);
      process.exit(1);
    }
    try {
      var client = await pool.connect();
      console.log('Inserting IRI, and metadata into metadata_graph table.');
      const res = await client.query('INSERT INTO metadata_graph (iri, metadata) VALUES ($1, $2)', [iri, doc]);
      console.log('IRI and metadata inserted successfully.');
      process.exit(0);
    } catch(err) {
      console.error(err);
      process.exit(0);
    } finally {
      // Make sure to release the client before any error handling,
      // just in case the error handling itself throws an error.
      client.release();
    }
  }
}

main()
