import * as express from 'express';
import { PoolClient } from 'pg';

import { pgPool } from 'common/pool';
import { MetadataNotFound, MetadataGraph } from 'common/metadata_graph';
import { generateIRI } from 'iri-gen/iri-gen';

const router = express.Router();

router.get('/metadata-graph/:iri', async (req, res) => {
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
    const metadata = await MetadataGraph.fetch_by_iri(client, iri);
    return res.json(metadata);
  } catch (err) {
    if (err instanceof MetadataNotFound) {
      console.error(err);
      return res.status(404).send(`metadata_graph with the iri ${iri} not found`);
    } else {
      console.error(err);
      return res.sendStatus(500);
    }
  } finally {
    if (client) {
      client.release();
    }
  }
});

router.get('/iri-gen', async (req, res) => {
  const iri = await generateIRI(req.body);
  return res.json({ iri });
});

router.post('/iri-gen', async (req, res) => {
  let client: PoolClient;
  try {
    client = await pgPool.connect();
    const resp = await MetadataGraph.insert_doc(client, req.body);
    return res.status(201).json(resp);
  } catch (err) {
    res.sendStatus(500);
  } finally {
    if (client) {
      client.release();
    }
  }
});

export default router;
