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
import * as env from 'env-var';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import * as Sentry from '@sentry/node';

import cookieParser from 'cookie-parser';
import cookieSession from 'cookie-session';
import passport from 'passport';

import { UserIncomingMessage } from './types';
import { BaseHTTPError } from './errors';

if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

/* eslint-disable import/first */
// we disable this lint rule for these import statements
// w/o this the application does not start locally
// these imports require env vars which are available only after dotenv.config is called
import getJwt from './middleware/jwt';
import imageOptimizer from './middleware/imageOptimizer';
import { initializePassport } from './middleware/passport';
import { pgPool, pgPoolIndexer } from 'common/pool';
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
import { web3auth } from './routes/web3auth';
import { csrfRouter } from './routes/csrf';
import { graphiqlRouter, indexerGraphiqlRouter } from './routes/graphiql';

import { doubleCsrfProtection, invalidCsrfTokenError } from './middleware/csrf';
import { sameSiteFromEnv } from './utils';
/* eslint-enable import/first */

const REGEN_HOSTNAME_PATTERN = /regen\.network$/;
const GROUPS_HOSTNAME_PATTERN = /groups\.regen\.network$/;
const WEBSITE_PREVIEW_HOSTNAME_PATTERN =
  /deploy-preview-\d+--regen-website\.netlify\.app$/;
const REGISTRY_PREVIEW_HOSTNAME_PATTERN =
  /deploy-preview-\d+--regen-registry\.netlify\.app$/;
const GROUPS_PREVIEW_HOSTNAME_PATTERN =
  /deploy-preview-\d+--regen-groups-ui\.netlify\.app$/;
const GROUPS_BRANCH_HOSTNAME_PATTERN =
  /[a-z0-9]+--regen-groups-ui\.netlify\.app$/;
const MAIN_PREVIEW_HOSTNAME_PATTERN =
  /[a-z0-9]+--regen-registry\.netlify\.app$/;
const DEFAULT_SUBDOMAIN_HOSTNAME_PATTERN = /regen-registry\.netlify\.app$/;
const MAIN_APP_HOSTNAME_PATTERN = /[a-z0-9]+\.app\.regen\.network$/;
const AUTH0_HOSTNAME_PATTERN = /regen-network-registry\.auth0\.com$/;

// docs for values in corsOptions:
// https://github.com/expressjs/cors#configuration-options
const corsOptions = (req, callback): void => {
  let options;
  if (
    process.env.NODE_ENV !== 'production' ||
    process.env.ALLOW_CORS_ALL_DOMAINS === 'true'
  ) {
    console.log(
      'WARNING: protection from cross-origin requests is turned off...',
    );
    options = { origin: true };
  } else {
    const originURL = req.header('Origin') && url.parse(req.header('Origin'));
    if (
      originURL &&
      (originURL.hostname.match(REGEN_HOSTNAME_PATTERN) ||
        originURL.hostname.match(GROUPS_HOSTNAME_PATTERN) ||
        originURL.hostname.match(WEBSITE_PREVIEW_HOSTNAME_PATTERN) ||
        originURL.hostname.match(REGISTRY_PREVIEW_HOSTNAME_PATTERN) ||
        originURL.hostname.match(GROUPS_PREVIEW_HOSTNAME_PATTERN) ||
        originURL.hostname.match(GROUPS_BRANCH_HOSTNAME_PATTERN) ||
        originURL.hostname.match(MAIN_PREVIEW_HOSTNAME_PATTERN) ||
        originURL.hostname.match(MAIN_APP_HOSTNAME_PATTERN) ||
        originURL.hostname.match(DEFAULT_SUBDOMAIN_HOSTNAME_PATTERN) ||
        originURL.hostname.match(AUTH0_HOSTNAME_PATTERN))
    ) {
      options = { origin: true }; // reflect (enable) the requested origin in the CORS response
    } else {
      options = { origin: false }; // disable CORS for this request
    }
  }
  // why the credentials option is added below:
  // https://web.dev/cross-origin-resource-sharing/#share-credentials-with-cors
  options['credentials'] = true;
  callback(null, options); // callback expects two parameters: error and options
};

const app = express();

app.set('trust proxy', true);

if (process.env.SENTRY_ENABLED) {
  Sentry.init({
    dsn: 'https://92594830df5944ae87656e33c98f36fc@o1377530.ingest.sentry.io/6688455',
    environment: process.env.SENTRY_ENVIRONMENT || 'development',
  });
  app.use(Sentry.Handlers.requestHandler());
}

app.use(fileUpload());

const SESSION_MAX_AGE_IN_HOURS = env
  .get('SESSION_MAX_AGE_IN_HOURS')
  .default('24')
  .asIntPositive();
const SESSION_MAX_AGE_IN_MILLIS = SESSION_MAX_AGE_IN_HOURS * 60 * 60 * 1000;
const SESSION_SECRET_KEY = env
  .get('SESSION_SECRET_KEY')
  .default('supersecret')
  .asString();
const SESSION_SAMESITE = sameSiteFromEnv('SESSION_SAMESITE');
const SESSION_SECURE = env
  .get('SESSION_SECURE')
  .default('false')
  .asBoolStrict();
// docs for values in cookieSessionConfig:
// https://github.com/expressjs/cookie-session#cookie-options
const cookieSessionConfig = {
  name: 'session',
  keys: [SESSION_SECRET_KEY],
  maxAge: SESSION_MAX_AGE_IN_MILLIS,
  sameSite: SESSION_SAMESITE,
  secure: SESSION_SECURE,
};
app.use(cookieSession(cookieSessionConfig));
app.use(function (request: any, _, next) {
  // this middleware is a workaround for express cookie session.
  // express cookie session does not implement the regenerate and save callbacks.
  // newer versions of passport.js expected these to be implemented.
  // this workaround was found in the passport.js issue tracker:
  // https://github.com/jaredhanson/passport/issues/904#issuecomment-1307558283
  // in the future, we can likely do away with this when there is an update to express cookie session.
  // or if a newer cookie session library is implemented.
  if (request.session && !request.session.regenerate) {
    request.session.regenerate = (cb: any) => {
      cb();
    };
  }
  if (request.session && !request.session.save) {
    request.session.save = (cb: any) => {
      cb();
    };
  }
  next();
});

initializePassport(app, passport);
app.use(cors(corsOptions));
app.use(cookieParser());

app.use(getJwt(false));

app.use(express.json());

app.use('/marketplace/v1/image', imageOptimizer());

if (process.env.LEDGER_TENDERMINT_RPC) {
  app.use(
    '/ledger',
    createProxyMiddleware({
      target: process.env.LEDGER_TENDERMINT_RPC,
      pathRewrite: { '^/ledger': '/' },
      onProxyReq: fixRequestBody,
    }),
  );
}

if (process.env.LEDGER_REST_ENDPOINT) {
  app.use(
    '/ledger-rest',
    createProxyMiddleware({
      target: process.env.LEDGER_REST_ENDPOINT,
      pathRewrite: { '^/ledger-rest': '/' },
    }),
  );
}

app.use('/marketplace/v1/graphql', doubleCsrfProtection);
app.use(
  '/marketplace/v1',
  postgraphile(pgPool, 'public', {
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
        return settings;
      } else if (req.user && req.user.address && req.user.id) {
        return {
          role: req.user.address,
          'account.id': req.user.id,
        };
      } else {
        return {
          role: 'app_user',
        };
      }
    },
  }),
);
app.use('/website/v1', mailerlite);
app.use('/website/v1', contact);
app.use('/marketplace/v1', buyersInfo);
app.use('/marketplace/v1', stripe);
app.use('/marketplace/v1', auth);
app.use('/marketplace/v1', recaptcha);
app.use('/marketplace/v1', files);
app.use('/data/v1', metadataGraph);
app.use('/marketplace/v1/web3auth', web3auth);
app.use('/marketplace/v1', csrfRouter);
app.use('/marketplace/v1/graphiql', graphiqlRouter);

if (!process.env.CI) {
  console.log('setting up the indexer db graphql connection...');
  app.use(
    '/indexer/v1',
    postgraphile(pgPoolIndexer, 'public', {
      watchPg: true,
      dynamicJson: true,
      appendPlugins: [PgManyToManyPlugin],
    }),
  );
  app.use('/indexer/v1/graphiql', indexerGraphiqlRouter);
}

const swaggerOptions = {
  definition: {
    openapi: '3.0.n',
    info: {
      title: 'regen-server',
      version: '0.1.0',
      description: 'API docs for the regen-server',
      contact: {
        name: 'regen-network/regen-server',
        url: 'https://github.com/regen-network/regen-server',
      },
    },
  },
  apis: ['./routes/*.ts'],
};
const specs = swaggerJsdoc(swaggerOptions);
app.get('/api-docs/swagger.json', (_, res) => res.json(specs));
app.use(
  '/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(specs, {
    swaggerOptions: {
      supportedSubmitMethods: [], // disable the "try it out" button for all methods
    },
  }),
);

app.use((req, res, next) => {
  if (req.hostname.endsWith('.registry.regen.network')) {
    if (
      req.path.startsWith('/metadata-graph') ||
      req.path.startsWith('/iri-gen')
    ) {
      return res.redirect(308, `/data/v1${req.originalUrl}`);
    } else if (!req.path.startsWith('/marketplace/v1') && req.path !== '/') {
      return res.redirect(308, `/marketplace/v1${req.originalUrl}`);
    }
  }
  next();
});

app.use((err, req, _, next) => {
  if (err.stack) {
    console.error(err.stack);
  }
  const { params, query, body, path } = req;
  console.error('req info:', { params, query, body, path });
  next(err);
});

app.use((err, _, res, next) => {
  const errResponse = { error: err.message };
  if (err instanceof BaseHTTPError) {
    res.status(err.status_code).send(errResponse);
  } else if (err instanceof MetadataNotFound) {
    res.status(404).send(errResponse);
  } else if (err instanceof InvalidJSONLD) {
    res.status(400).send(errResponse);
  } else if (err == invalidCsrfTokenError) {
    res.status(403).send(errResponse);
  } else {
    next(err);
  }
});

// this is the last error handler to register because we only want the uncaught exceptions to be sent to sentry.
app.use(Sentry.Handlers.errorHandler());

const port = process.env.PORT || 5000;

app.listen(port);

console.log('Started server on port ' + port);
console.log('Graphiql UI at http://localhost:' + port + '/graphiql');
