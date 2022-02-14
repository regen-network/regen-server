import * as jsonld from 'jsonld';
import * as blake from 'blakejs';

const { binary_to_base58 } = require('base58-js');
const createHash = require('sha256-uint8array').createHash;

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
 * This is more or less copied from regen-ledger data module:
 * https://github.com/regen-network/regen-ledger/blob/87d2035d0e1815a65abc7ce6f68c535dd845a23e/x/data/iri.go#L60
 * @param  {string} hash represents the hash of some JSON-LD data based on BLAKE2b-256
 * @returns string 
 */
function toIRI(hash: Uint8Array): string {
  const bz = new Uint8Array(4);
  bz[0] = IriPrefixGraph;
	bz[1] = GraphCanonicalizationAlgorithmURDNA2015;
	bz[2] = GraphMerkleTreeUnspecified;
	bz[3] = DigestAlgorithmBLAKE2b256;
  const input = Uint8Array.from([...bz, ...hash]);

  const hashStr = checkEncode(input, iriVersion0);
  
	return `regen:${hashStr}.rdf`
}

/**
 * checkEncode prepends a version byte and appends a four byte checksum,
 * returns a base58 string
 * This is based on CheckEncode function from github.com/btcsuite/btcd/tree/master/btcutil/base58
 * @param  {Uint8Array} input
 * @param  {number} version
 * @returns string
 */
function checkEncode(input: Uint8Array, version: number): string {
  if (version > 255) {
    throw 'version is greater than 255';
  }
  const b = Uint8Array.from([version, ...input]);
  const cksum = checksum(b);
  
  return binary_to_base58([...b, ...cksum]);
}

/**
 * checksum returns the first four bytes of sha256^2
 * This is based on checksum function from github.com/btcsuite/btcutil/base58
 * @param  {Uint8Array} input
 * @returns Uint8Array
 */
function checksum(input: Uint8Array): Uint8Array {
  const h = createHash().update(input).digest();
  const h2 = createHash().update(h).digest();
  return h2.slice(0, 4);
}

/**
 * generateIRI canonizes a JSON-LD doc and generates a hash for it using BLAKE2b (256 bits)
 * then converts this hash into an IRI based on the pattern described in toIRI function
 * @param  {jsonld.JsonLdDocument} doc
 * @returns Promise
 */
export async function generateIRI(doc: jsonld.JsonLdDocument): Promise<string> {
  try {
    // Canonize JSON-LD to n-quads
    const canonized = await jsonld.canonize(doc, {
      algorithm: 'URDNA2015',
      format: 'application/n-quads'
    });

    // Generate BLAKE2b with 256 bits (32 bytes) length hash
    const hash = blake.blake2b(canonized, null, 32);

    // Get IRI from hash
    const iri = toIRI(hash);
    return iri;
  } catch (e) {
    console.error(e);
  }
}