import * as fs from 'fs';
import { generateIRI } from './iri-gen';

// Make sure we got a filename on the command line.
if (process.argv.length < 3) {
  console.log('You should provide the path to a JSON file');
  process.exit(1);
}

async function readFileAndGenerateIRI() {
  try {
    const path = process.argv[2];
    const rawdata = fs.readFileSync(path);
    const doc = JSON.parse(rawdata.toString());

    const iri = await generateIRI(doc);
    if (iri) console.log(`The IRI for ${path} is: ${iri}`);
  } catch (e) {
    console.error(e);
  }
}

readFileAndGenerateIRI();
