import * as jsonld from 'jsonld';
import * as blake from 'blakejs';

const { binary_to_base58 } = require('base58-js')

// TODO get doc from input file
const myDoc = {
  "http://schema.org/name": [{"@value": "Manu Sporny"}],
  "http://schema.org/url": [{"@id": "http://manu.sporny.org/"}],
  "http://schema.org/image": [{"@id": "http://manu.sporny.org/images/manu.png"}]
};

const IriPrefixGraph = 1;
const GraphCanonicalizationAlgorithmURDNA2015 = 1;
const GraphMerkleTreeUnspecified = 0;
const DigestAlgorithmBLAKE2b256 = 1;
const iriVersion0 = 0;

/**
 * toIRI converts a hash to an IRI (internationalized URI) based on the following
 * pattern: regen:{base58check(concat(byte(0x1), byte(canonicalization_algorithm),
 * byte(merkle_tree), byte(digest_algorithm), hash))}.rdf
 * where canonicalization_algorithm is URDNA2015,
 * digest_algorithm is BLAKE2b-256
 * and no merkle_tree
 * This is more or less copied from regen-ledger data module.
 * @param  {string} hash represents the hash of some JSON-LD data based on BLAKE2b-256
 * @returns string 
 */
function toIRI(hash: Uint8Array): string {
  const bz = new Uint8Array(4);
  bz[0] = IriPrefixGraph;
	bz[1] = GraphCanonicalizationAlgorithmURDNA2015;
	bz[2] = GraphMerkleTreeUnspecified;
	bz[3] = DigestAlgorithmBLAKE2b256;
  const hashStr = binary_to_base58([iriVersion0, ...hash, ...bz]);

	return `regen:${hashStr}.rdf`
}

/**
 * generateIRI canonizes a JSON-LD doc and generates a hash for it using BLAKE2b (256 bits)
 * then converts this hash into an IRI based on the pattern described in toIRI function
 * @param  {jsonld.JsonLdDocument} doc
 * @returns Promise
 */
async function generateIRI(doc: jsonld.JsonLdDocument): Promise<string> {
  try {
    // Canonize JSON-LD to n-quads
    const canonized = await jsonld.canonize(doc, {
      algorithm: 'URDNA2015',
      format: 'application/n-quads'
    });
    console.log(canonized);

    // Generate BLAKE2b with 256 bits (32 bytes) length hash
    const hash = blake.blake2b(canonized, null, 32);

    const iri = toIRI(hash);
    console.log(iri);
    return iri;
  } catch (e) {
    console.error(e);
  }
}

generateIRI(myDoc);
