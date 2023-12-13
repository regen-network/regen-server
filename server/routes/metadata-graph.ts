import * as express from 'express';
import { PoolClient } from 'pg';

import { pgPool } from 'common/pool';
import { MetadataGraph } from 'common/metadata_graph';
import { generateIRIFromGraph } from 'iri-gen/iri-gen';

const router = express.Router();

/**
 * @openapi
 * /data/v1/metadata-graph/{iri}:
 *   get:
 *     summary: fetch a metadata graph for a given iri
 *     tags:
 *     - metadata graph
 *     parameters:
 *       - name: iri
 *         in: path
 *         schema:
 *           type: string
 *           example: regen:13toVh9VgHfMJUDXSFTMQiDwRtiWQvhyeBpZe3jYpGMRnkZZB7jQyN8.rdf
 *         required: true
 *         description: the iri for a given resource, of the form regen:<iri-hash>.rdf
 *     responses:
 *       200:
 *         description: the metadata object associated to the given iri
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               example:
 *                 "@context": "https://json-ld.org/contexts/person.jsonld"
 *                 "@id": "http://dbpedia.org/resource/John_Lennon"
 *                 name: "John Lennon"
 *                 born: "1940-10-09"
 *                 spouse: "http://dbpedia.org/resource/Cynthia_Lennon"
 *       400:
 *         description: invalid iri, it must be of the form regen:<iri-hash>.rdf
 *       404:
 *         description: no metadata found for the given iri
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *               example:
 *                 error: "Error message"
 */
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

/**
 * @openapi
 * /data/v1/iri-gen:
 *   get:
 *     summary: generate an iri for a given JSON-LD metadata graph
 *     tags:
 *     - iri gen
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *           example:
 *             "@context": "https://json-ld.org/contexts/person.jsonld"
 *             "@id": "http://dbpedia.org/resource/John_Lennon"
 *             name: "John Lennon"
 *             born: "1940-10-09"
 *             spouse: "http://dbpedia.org/resource/Cynthia_Lennon"
 *     responses:
 *       200:
 *         description: successfully generate the iri for the given metadata
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *             properties:
 *               iri:
 *                 type: string
 *             example:
 *               iri: regen:13toVh9VgHfMJUDXSFTMQiDwRtiWQvhyeBpZe3jYpGMRnkZZB7jQyN8.rdf
 *       400:
 *         description: bad request, check that you have submitted valid JSON-LD
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *             properties:
 *               error:
 *                 type: string
 *             example:
 *               error: "Error message"
 */
router.get('/iri-gen', async (req, res, next) => {
  try {
    const iri = await generateIRIFromGraph(req.body);
    return res.json({ iri });
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /data/v1/iri-gen:
 *   post:
 *     summary: generate and save an iri and JSON-LD metadata graph pair
 *     tags:
 *     - iri gen
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *           example:
 *             "@context": "https://json-ld.org/contexts/person.jsonld"
 *             "@id": "http://dbpedia.org/resource/John_Lennon"
 *             name: "John Lennon"
 *             born: "1940-10-09"
 *             spouse: "http://dbpedia.org/resource/Cynthia_Lennon"
 *     responses:
 *       201:
 *         description: successfully generate and save the iri-metadata pair
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *             properties:
 *               iri:
 *                 type: string
 *               metadata:
 *                 type: object
 *             example:
 *               iri: regen:13toVh9VgHfMJUDXSFTMQiDwRtiWQvhyeBpZe3jYpGMRnkZZB7jQyN8.rdf
 *               metadata:
 *                 "@context": "https://json-ld.org/contexts/person.jsonld"
 *                 "@id": "http://dbpedia.org/resource/John_Lennon"
 *                 name: "John Lennon"
 *                 born: "1940-10-09"
 *                 spouse: "http://dbpedia.org/resource/Cynthia_Lennon"
 *       400:
 *         description: bad request, check that you have submitted valid JSON-LD
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *             properties:
 *               error:
 *                 type: string
 *             example:
 *               error: "Error message"
 */
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
