import * as fs from 'fs';
import path from 'path';
import { generateIRIFromGraph, generateIRIFromRaw } from './iri-gen';
import 'dotenv/config';
import { pgPool } from 'common/pool';
import minimist from 'minimist';
import { PoolClient } from 'pg';
import { MetadataGraph } from 'common/metadata_graph';

async function readGraphDocument(
  filePath: fs.PathOrFileDescriptor,
): Promise<{ doc: { [key: string]: number | string | boolean }; iri: string }> {
  const rawdata = fs.readFileSync(filePath);
  const doc = JSON.parse(rawdata.toString());
  return doc;
}

async function runGraphIRIGen(
  filePath: string,
  insertFlag: boolean,
): Promise<void> {
  let client: PoolClient;
  try {
    const doc = await readGraphDocument(filePath);
    const iri = await generateIRIFromGraph(doc);
    if (iri) {
      console.log(`The IRI for ${filePath} is: ${iri}`);
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

async function runRawIRIGen(filePath: string): Promise<void> {
  try {
    // trim first character from extension, as "foo.json"
    // will return ".json" from path.extname()
    const extension = path.extname(filePath).slice(1);
    const rawdata = fs.readFileSync(filePath);

    const iri = await generateIRIFromRaw(rawdata, extension);
    if (iri) {
      console.log(`The IRI for ${filePath} is: ${iri}`);
      process.exit(0);
    }
  } catch (e) {
    console.log(e);
    process.exit(1);
  }
}

async function main(): Promise<void> {
  const argv = minimist(process.argv.slice(2), { boolean: true });
  // Make sure we got a filename on the command line.
  if (argv._.length < 1) {
    console.log('File path is required');
    process.exit(1);
  }
  const insertFlag = argv.insert;
  const rawFlag = argv.raw;
  const filePath = argv._[0];
  const extension = path.extname(filePath).slice(1);

  if (extension == 'json' && !rawFlag) {
    runGraphIRIGen(filePath, insertFlag);
  } else {
    runRawIRIGen(filePath);
  }
}

main();
