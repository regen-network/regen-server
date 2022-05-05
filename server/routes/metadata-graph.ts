import * as express from 'express';
import { PoolClient } from 'pg';

import { pgPool } from 'common/pool';
import { MetadataGraph } from 'common/metadata_graph';
import { generateIRI } from 'iri-gen/iri-gen';

const router = express.Router();

router.get('/metadata-graph/:iri', async (req, res, next) => {
  const { iri } = req.params;
  const iri_re = new RegExp('regen:.+.rdf');
  let client: PoolClient;
  if (!iri_re.test(iri)) {
    return res
      .status(400)
      .send('Invalid IRI, it must be of the form regen:<iri-hash>.rdf');
  }
  try {
    client = await pgPool.connect();
    const metadataGraph = new MetadataGraph(client);
    const metadata = await metadataGraph.fetchByIri(iri);
    return res.json(metadata);
  } catch (err) {
    next(err);
  } finally {
    if (client) {
      client.release();
    }
  }
});

router.get('/iri-gen', async (req, res, next) => {
  try {
    const iri = await generateIRI(req.body);
    return res.json({ iri });
  } catch (err) {
    next(err);
  }
});

router.post('/iri-gen', async (req, res, next) => {
  let client: PoolClient;
  try {
    client = await pgPool.connect();
    const metadataGraph = new MetadataGraph(client);
    const resp = await metadataGraph.insertDoc(req.body);
    return res.status(201).json(resp);
  } catch (err) {
    next(err);
  } finally {
    if (client) {
      client.release();
    }
  }
});

export default router;
