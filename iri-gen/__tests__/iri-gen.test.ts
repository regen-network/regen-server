import { generateIRI } from '../iri-gen';

describe('generateIRI', () => {
  it('generates correct IRI for JSON-LD data', () => {
    const doc = {
      "http://schema.org/name": [{"@value": "Manu Sporny"}],
      "http://schema.org/url": [{"@id": "http://manu.sporny.org/"}],
      "http://schema.org/image": [{"@id": "http://manu.sporny.org/images/manu.png"}]
    };

    expect(generateIRI(doc)).resolves.toBe('regen:13toVgutDdVPL4Q3s8hqgSSm7ZwfhiCtmXFpNn9vevxyLFFUT6HN1QD.rdf');
  });
  it('generates the same IRI for the same JSON-LD data', () => {
    // This represents the same RDF data as in the first test but with different formatting
    const doc = {
      "@context": {
        "@vocab": "http://schema.org/"
      },
      "image": {
        "@id": "http://manu.sporny.org/images/manu.png"
      },
      "name": "Manu Sporny",
      "url": {
        "@id": "http://manu.sporny.org/"
      }
    };

    expect(generateIRI(doc)).resolves.toBe('regen:13toVgutDdVPL4Q3s8hqgSSm7ZwfhiCtmXFpNn9vevxyLFFUT6HN1QD.rdf');
  });
});