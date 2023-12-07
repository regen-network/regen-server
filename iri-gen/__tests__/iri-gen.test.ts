import { generateIRIFromGraph, generateIRIFromRaw } from '../iri-gen';

describe('generateIRIFromGraph', () => {
  it('generates correct IRI for JSON-LD data', () => {
    const doc = {
      'http://schema.org/name': [{ '@value': 'Manu Sporny' }],
      'http://schema.org/url': [{ '@id': 'http://manu.sporny.org/' }],
      'http://schema.org/image': [
        { '@id': 'http://manu.sporny.org/images/manu.png' },
      ],
    };

    expect(generateIRIFromGraph(doc)).resolves.toBe(
      'regen:13toVgutDdVPL4Q3s8hqgSSm7ZwfhiCtmXFpNn9vevxyLFFUT6HN1QD.rdf',
    );
  });
  it('generates the same IRI for the same JSON-LD data', () => {
    // This represents the same RDF data as in the first test but with different formatting
    const doc = {
      '@context': {
        '@vocab': 'http://schema.org/',
      },
      image: {
        '@id': 'http://manu.sporny.org/images/manu.png',
      },
      name: 'Manu Sporny',
      url: {
        '@id': 'http://manu.sporny.org/',
      },
    };

    expect(generateIRIFromGraph(doc)).resolves.toBe(
      'regen:13toVgutDdVPL4Q3s8hqgSSm7ZwfhiCtmXFpNn9vevxyLFFUT6HN1QD.rdf',
    );
  });
  it('throws an error for an invalid JSON-LD document', async () => {
    const doc = {
      foo: 'bar',
    };
    await expect(generateIRIFromGraph(doc)).rejects.toThrow(
      'Invalid JSON-LD document',
    );
  });
});

describe('generateIRIFromRaw', () => {
  it('generates correct IRI for raw data', () => {
    const data = new Uint8Array([1, 2, 3, 4, 5]);
    const extension = 'bin';

    expect(generateIRIFromRaw(data, extension)).resolves.toBe(
      'regen:112xweSfenTPX2GkbhescHosnL2KfTx1xW7zL9fjrY7apDeZkA3h.bin',
    );
  });
});
