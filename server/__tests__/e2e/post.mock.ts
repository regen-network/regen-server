export const privacy = 'public';
export const contents = {
  title: 'Post title',
  comment: 'Post description',
  files: [
    {
      iri: 'regen:1111.png',
      name: 'Image file name',
      description: 'Image description',
      location: {
        wkt: 'POINT(1 2)',
      },
      credit: 'Paul',
    },
    {
      iri: 'regen:2222.pdf',
      name: 'File name',
      description: 'File description',
      credit: 'Paul',
    },
  ],
  '@type': 'ProjectPost',
  '@context': {
    dcterms: 'http://purl.org/dc/terms/',
    geo: 'http://www.opengis.net/ont/geosparql#',
    linkml: 'https://w3id.org/linkml/',
    regenschema: 'https://schema.regen.network/',
    '@vocab': 'https://schema.regen.network/',
    credit: {
      '@id': 'dcterms:creator',
    },
    description: {
      '@id': 'dcterms:description',
    },
    iri: '@id',
    location: {
      '@type': '@id',
      '@id': 'geo:hasGeometry',
    },
    name: {
      '@id': 'dcterms:title',
    },
    wkt: {
      '@id': 'geo:asWKT',
    },
    comment: {
      '@id': 'dcterms:description',
    },
    files: {
      '@type': '@id',
      '@id': 'dcterms:references',
    },
    title: {
      '@id': 'dcterms:title',
    },
    FileLocation: {
      '@id': 'geo:Geometry',
    },
  },
};
export const expIri =
  'regen:13toVgWWVAh3YLkoM2oMjKqT5c4yQu74odDBi78c4rhjzeD2exbC9gV.rdf';

export const updatedPrivacy = 'private_files';
export const updatedContents = { ...contents, title: 'New post title' };
export const updatedExpIri =
  'regen:13toVhS2UPapYsD1E3PgrXzgDuARYXfrDLYB1HjpJh4kdzBRp5qhcU4.rdf';
export const commit = true;
