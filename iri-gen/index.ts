import * as fs from 'fs';
import { generateIRI } from './iri-gen';
import 'dotenv/config';
import { pgPool } from 'common/pool';
import minimist from 'minimist';
import { PoolClient } from 'pg';
import { MetadataGraph } from 'common/metadata_graph';

async function readDocument(
  path: fs.PathOrFileDescriptor,
): Promise<{ doc: { [key: string]: number | string | boolean }; iri: string }> {
  const rawdata = fs.readFileSync(path);
  const doc = JSON.parse(rawdata.toString());
  return doc;
}

async function main(): Promise<void> {
  const argv = minimist(process.argv.slice(2), { boolean: true });
  // Make sure we got a filename on the command line.
  if (argv._.length < 1) {
    console.log('You should provide the path to a JSON file');
    process.exit(1);
  }
  const insertFlag = argv.insert;
  const path = argv._[0];
  let client: PoolClient;
  try {
    const doc = await readDocument(path);
    const iri = await generateIRI(doc);
    if (iri) {
      console.log(`The IRI for ${path} is: ${iri}`);
      if (insertFlag) {
        client = await pgPool.connect();
        console.log('Inserting IRI, and metadata into metadata_graph table.');
        const metadataGraph = new MetadataGraph(client);
        await metadataGraph.insertIriDoc(iri, doc);
        console.log('IRI and metadata inserted successfully.');
        process.exit(0);
      } else {
        process.exit(0);
      }
    }
  } catch (e) {
    console.log(e);
    process.exit(1);
  } finally {
    if (client) client.release();
  }
}

main();
