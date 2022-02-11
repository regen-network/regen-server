import { generateIRI } from './iri-gen';

// TODO get doc from input file
const myDoc = {
  "http://schema.org/name": [{"@value": "Manu Sporny"}],
  "http://schema.org/url": [{"@id": "http://manu.sporny.org/"}],
  "http://schema.org/image": [{"@id": "http://manu.sporny.org/images/manu.png"}]
};

generateIRI(myDoc);
