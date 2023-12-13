import * as jsonld from 'jsonld';
import * as blake from 'blakejs';

import { binary_to_base58 } from 'base58-js';
import { createHash } from 'sha256-uint8array';
import {
  IriPrefixRaw,
  DigestAlgorithmBLAKE2b256,
  iriVersion0,
  IriPrefixGraph,
  GraphCanonicalizationAlgorithmURDNA2015,
  GraphMerkleTreeUnspecified,
  ApprovedRawExtensions,
} from './iri-gen.constants';

/**
 * contentHashRawToIRI converts a hash from raw content to an IRI (internationalized URI) based on the following
 * pattern: regen:{base58check(concat(byte(0x0), byte(digest_algorithm), hash))}.{media_type extension}
 * where digest_algorithm is BLAKE2b-256
 * This is more or less copied from regen-ledger data module:
 * https://github.com/regen-network/regen-ledger/blob/87d2035d0e1815a65abc7ce6f68c535dd845a23e/x/data/iri.go#L37
 * @param  {Uint8Array} hash represents the hash of some raw data based on BLAKE2b-256
 * @param  {string} extension represents the file extension of the raw data
 * @returns string
 */
function contentHashRawToIRI(hash: Uint8Array, extension: string): string {
  const bz = new Uint8Array(2);
  bz[0] = IriPrefixRaw;
  bz[1] = DigestAlgorithmBLAKE2b256;
  const input = Uint8Array.from([...bz, ...hash]);

  const hashStr = checkEncode(input, iriVersion0);

  return `regen:${hashStr}.${
    ApprovedRawExtensions.includes(extension) ? extension : 'bin'
  }`;
}

/**
 * contentHashGraphToIRI converts a hash from graph content to an IRI (internationalized URI) based on the following
 * pattern: regen:{base58check(concat(byte(0x1), byte(canonicalization_algorithm),
 * byte(merkle_tree), byte(digest_algorithm), hash))}.rdf
 * where canonicalization_algorithm is URDNA2015,
 * digest_algorithm is BLAKE2b-256
 * and no merkle_tree
 * This is more or less copied from regen-ledger data module:
 * https://github.com/regen-network/regen-ledger/blob/87d2035d0e1815a65abc7ce6f68c535dd845a23e/x/data/iri.go#L60
 * @param  {Uint8Array} hash represents the hash of some JSON-LD data based on BLAKE2b-256
 * @returns string
 */
function contentHashGraphToIRI(hash: Uint8Array): string {
  const bz = new Uint8Array(4);
  bz[0] = IriPrefixGraph;
  bz[1] = GraphCanonicalizationAlgorithmURDNA2015;
  bz[2] = GraphMerkleTreeUnspecified;
  bz[3] = DigestAlgorithmBLAKE2b256;
  const input = Uint8Array.from([...bz, ...hash]);

  const hashStr = checkEncode(input, iriVersion0);

  return `regen:${hashStr}.rdf`;
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
 * This is based on checksum function from github.com/btcsuite/btcd/tree/master/btcutil/base58
 * @param  {Uint8Array} input
 * @returns Uint8Array
 */
function checksum(input: Uint8Array): Uint8Array {
  const h = createHash().update(input).digest();
  const h2 = createHash().update(h).digest();
  return h2.slice(0, 4);
}

export class InvalidJSONLD extends Error {
  constructor(message: string) {
    super(message);
  }
}

/**
 * generateIRIFromGraph canonizes a JSON-LD doc and generates a hash for it using BLAKE2b (256 bits)
 * then converts this hash into an IRI based on the pattern described in contentHashGraphToIRI function
 * @param  {jsonld.JsonLdDocument} doc JSON-LD document
 * @returns Promise
 */
export async function generateIRIFromGraph(
  doc: jsonld.JsonLdDocument,
): Promise<string> {
  // Canonize JSON-LD to n-quads
  const canonized = await jsonld.canonize(doc, {
    algorithm: 'URDNA2015',
    format: 'application/n-quads',
  });
  if (canonized === '') {
    throw new InvalidJSONLD('Invalid JSON-LD document');
  }
  // Generate BLAKE2b with 256 bits (32 bytes) length hash
  const hash = blake.blake2b(canonized, null, 32);

  // Get IRI from hash
  const iri = contentHashGraphToIRI(hash);
  return iri;
}

/**
 * generateIRIFromRaw generates a hash for some raw data using BLAKE2b (256 bits)
 * then converts this hash into an IRI based on the pattern described in contentHashRawToIRI function
 * @param  {Uint8Array} data raw data
 * @param  {string} extension represents the file extension of the raw data
 * @returns Promise
 */
export async function generateIRIFromRaw(
  data: Uint8Array,
  extension: string,
): Promise<string> {
  // Generate BLAKE2b with 256 bits (32 bytes) length hash
  const hash = blake.blake2b(data, null, 32);

  // Get IRI from hash
  const iri = contentHashRawToIRI(hash, extension);
  return iri;
}
