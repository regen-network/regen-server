import express from 'express';
import { postgraphile } from 'postgraphile';
import fileUpload from 'express-fileupload';
import cors from 'cors';
import { createProxyMiddleware, fixRequestBody } from 'http-proxy-middleware';
// To get this many-to-many plugin import statement working, we
// needed to add esModuleInterop to the tsconfig compiler settings.
// Per this issue: https://github.com/graphile-contrib/pg-many-to-many/issues/64
import PgManyToManyPlugin from '@graphile-contrib/pg-many-to-many';
import ConnectionFilterPlugin from 'postgraphile-plugin-connection-filter';
import url from 'url';
import dotenv from 'dotenv';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import * as Sentry from '@sentry/node';
import * as Tracing from '@sentry/tracing';

import { UserIncomingMessage } from './types';
import getJwt from './middleware/jwt';
import imageOptimizer from './middleware/imageOptimizer';

if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

import { pgPool } from 'common/pool';
const REGEN_HOSTNAME_PATTERN = /regen\.network$/;
const WEBSITE_PREVIEW_HOSTNAME_PATTERN =
  /deploy-preview-\d+--regen-website\.netlify\.app$/;
const REGISTRY_PREVIEW_HOSTNAME_PATTERN =
  /deploy-preview-\d+--regen-registry\.netlify\.app$/;
const REGISTRY_REDWOOD_HOSTNAME_PATTERN =
  /redwood--regen-registry\.netlify\.app$/;
const REGISTRY_HAMBACH_HOSTNAME_PATTERN =
  /hambach--regen-registry\.netlify\.app$/;
const REGISTRY_V4_HOSTNAME_PATTERN = /v4--regen-registry\.netlify\.app$/;
const AUTH0_HOSTNAME_PATTERN = /regen-network-registry\.auth0\.com$/;

const corsOptions = (req, callback): void => {
  let options;
  if (process.env.NODE_ENV !== 'production') {
    options = { origin: true };
  } else {
    const originURL = req.header('Origin') && url.parse(req.header('Origin'));
    if (
      originURL &&
      (originURL.hostname.match(REGEN_HOSTNAME_PATTERN) ||
        originURL.hostname.match(WEBSITE_PREVIEW_HOSTNAME_PATTERN) ||
        originURL.hostname.match(REGISTRY_PREVIEW_HOSTNAME_PATTERN) ||
        originURL.hostname.match(REGISTRY_REDWOOD_HOSTNAME_PATTERN) ||
        originURL.hostname.match(REGISTRY_HAMBACH_HOSTNAME_PATTERN) ||
        originURL.hostname.match(REGISTRY_V4_HOSTNAME_PATTERN) ||
        originURL.hostname.match(AUTH0_HOSTNAME_PATTERN))
    ) {
      options = { origin: true }; // reflect (enable) the requested origin in the CORS response
    } else {
      options = { origin: false }; // disable CORS for this request
    }
  }

  callback(null, options); // callback expects two parameters: error and options
};

const app = express();

// this flag is used to enable sentry
// we only want this set in the production environment
// without this set we will use too much of our sentry quota
// it can also be used in local dev when testing sentry
if (process.env.SENTRY_ENABLED) {
  Sentry.init({
    dsn: 'https://92594830df5944ae87656e33c98f36fc@o1377530.ingest.sentry.io/6688455',
    integrations: [
      // enable HTTP calls tracing
      new Sentry.Integrations.Http({ tracing: true }),
      // enable Express.js middleware tracing
      new Tracing.Integrations.Express({ app }),
    ],
    // Set tracesSampleRate to 1.0 to capture 100%
    // of transactions for performance monitoring.
    // We recommend adjusting this value in production
    tracesSampleRate: 1.0,
    environment: process.env.SENTRY_ENVIRONMENT || 'development',
  });
  // RequestHandler creates a separate execution context using domains, so that every
  // transaction/span/breadcrumb is attached to its own Hub instance
  app.use(Sentry.Handlers.requestHandler());
  // TracingHandler creates a trace for every incoming request
  app.use(Sentry.Handlers.tracingHandler());
}

app.use(fileUpload());
app.use(cors(corsOptions));

app.use(getJwt(false));

app.use(express.json());

app.use('/image', imageOptimizer());

app.use(
  '/ledger',
  createProxyMiddleware({
    target: process.env.LEDGER_TENDERMINT_RPC,
    pathRewrite: { '^/ledger': '/' },
    onProxyReq: fixRequestBody,
  }),
);

app.use(
  '/ledger-rest',
  createProxyMiddleware({
    target: process.env.LEDGER_REST_ENDPOINT,
    pathRewrite: { '^/ledger-rest': '/' },
  }),
);

if (process.env.EXP_LEDGER_TENDERMINT_RPC) {
  app.use(
    '/exp-ledger',
    createProxyMiddleware({
      target: process.env.EXP_LEDGER_TENDERMINT_RPC,
      pathRewrite: { '^/exp-ledger': '/' },
    }),
  );
}

if (process.env.EXP_LEDGER_REST_ENDPOINT) {
  app.use(
    '/exp-ledger-rest',
    createProxyMiddleware({
      target: process.env.EXP_LEDGER_REST_ENDPOINT,
      pathRewrite: { '^/exp-ledger-rest': '/' },
    }),
  );
}

if (process.env.V4_LEDGER_TENDERMINT_RPC) {
  app.use(
    '/v4-ledger',
    createProxyMiddleware({
      target: process.env.V4_LEDGER_TENDERMINT_RPC,
      pathRewrite: { '^/v4-ledger': '/' },
    }),
  );
}

if (process.env.V4_LEDGER_REST_ENDPOINT) {
  app.use(
    '/v4-ledger-rest',
    createProxyMiddleware({
      target: process.env.V4_LEDGER_REST_ENDPOINT,
      pathRewrite: { '^/v4-ledger-rest': '/' },
    }),
  );
}

app.use(
  postgraphile(pgPool, 'public', {
    graphiql: true,
    watchPg: true,
    dynamicJson: true,
    graphileBuildOptions: {
      connectionFilterAllowedFieldTypes: ['JSON'],
      connectionFilterAllowedOperators: ['contains'],
      connectionFilterComputedColumns: false,
      connectionFilterArrays: false,
      connectionFilterSetofFunctions: false,
    },
    appendPlugins: [PgManyToManyPlugin, ConnectionFilterPlugin],
    pgSettings: (req: UserIncomingMessage) => {
      if (req.user && req.user.sub) {
        const { sub } = req.user;
        const settings = { role: sub };
        // TODO need to deal with keys that aren't strings properly
        // Object.keys(user).map(k =>
        //   settings['jwt.claims.' + k] = user[k]
        // );
        return settings;
      } else return { role: 'app_user' };
    },
  }),
);

import mailerlite from './routes/mailerlite';
import contact from './routes/contact';
import buyersInfo from './routes/buyers-info';
import stripe from './routes/stripe';
import auth from './routes/auth';
import recaptcha from './routes/recaptcha';
import files from './routes/files';
import metadataGraph from './routes/metadata-graph';
import { MetadataNotFound } from 'common/metadata_graph';
import { InvalidJSONLD } from 'iri-gen/iri-gen';
app.use(mailerlite);
app.use(contact);
app.use(buyersInfo);
app.use(stripe);
app.use(auth);
app.use(recaptcha);
app.use(files);
app.use(metadataGraph);

const swaggerOptions = {
  definition: {
    openapi: '3.0.n',
    info: {
      title: 'registry-server',
      version: '0.1.0',
      description: 'API docs for the registry-server',
      contact: {
        name: 'regen-network/registry-server',
        url: 'https://github.com/regen-network/registry-server',
      },
    },
  },
  apis: ['./routes/*.ts'],
};
const specs = swaggerJsdoc(swaggerOptions);
app.get('/api-docs/swagger.json', (req, res) => res.json(specs));
app.use(
  '/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(specs, {
    swaggerOptions: {
      supportedSubmitMethods: [], // disable the "try it out" button for all methods
    },
  }),
);

app.use((err, req, res, next) => {
  console.error(err.stack);
  const { params, query, body, path } = req;
  console.error('req info:', { params, query, body, path });
  next(err);
});
app.use((err, req, res, next) => {
  const errResponse = { error: err.message };
  if (err instanceof MetadataNotFound) {
    res.status(404).send(errResponse);
  } else if (err instanceof InvalidJSONLD) {
    res.status(400).send(errResponse);
  } else {
    next(err);
  }
});

// this is the last error handler to register we only want the
// uncaught exceptions to be sent to sentry. otherwise we end
// up with a lot of noise in sentry.
app.use(Sentry.Handlers.errorHandler());

const port = process.env.PORT || 5000;

app.listen(port);

console.log('Started server on port ' + port);
console.log('Graphiql UI at http://localhost:' + port + '/graphiql');
