import express from 'express';
import { postgraphile } from 'postgraphile';
import fileUpload from 'express-fileupload';
import cors from 'cors';
import { createProxyMiddleware } from 'http-proxy-middleware';
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

import cookieParser from 'cookie-parser';
import cookieSession from 'cookie-session';
import passport from 'passport';

import { UserIncomingMessage } from './types';
import getJwt from './middleware/jwt';
import imageOptimizer from './middleware/imageOptimizer';
import {
  initializePassport,
} from './middleware/passport';
import { BaseHTTPError } from './errors';

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
  options['credentials'] = true;
  callback(null, options); // callback expects two parameters: error and options
};

const app = express();

app.use(fileUpload());

const SESSION_MAX_AGE_IN_HOURS = env.get("SESSION_MAX_AGE_IN_HOURS").default("24").asIntPositive();
const SESSION_MAX_AGE_IN_MILLIS = SESSION_MAX_AGE_IN_HOURS * 60 * 60 * 1000;
const SESSION_SECRET_KEY = env.get("SESSION_SECRET_KEY").default("supersecret").asString(); 
const _SESSION_SAMESITE = env.get("SESSION_SAMESITE").default("lax").asEnum(["true", "false", "lax", "strict", "none"]); 
let SESSION_SAMESITE: boolean|"lax"|"strict"|"none";
if (_SESSION_SAMESITE === "true" || _SESSION_SAMESITE === "false") {
  SESSION_SAMESITE = _SESSION_SAMESITE === "true";
} else {
  SESSION_SAMESITE = _SESSION_SAMESITE;
} 
const SESSION_SECURE = env.get("SESSION_SECURE").default("false").asBoolStrict(); 
const cookieSessionConfig = {
  name: 'session',
  keys: [SESSION_SECRET_KEY],
  maxAge: SESSION_MAX_AGE_IN_MILLIS,
  sameSite: SESSION_SAMESITE,
  secure: SESSION_SECURE,
};
app.use(
  cookieSession(cookieSessionConfig),
);

initializePassport(app, passport);
app.use(cors(corsOptions));
app.use(cookieParser());

app.use(getJwt(false));

app.use(express.json());

app.use('/image', imageOptimizer());

app.use(
  '/ledger',
  createProxyMiddleware({
    target: process.env.LEDGER_TENDERMINT_RPC,
    pathRewrite: { '^/ledger': '/' },
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
      } else if (req.user && req.user.address) {
        return { role: req.user.address };
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
import { web3auth } from './routes/web3auth';
app.use(mailerlite);
app.use(contact);
app.use(buyersInfo);
app.use(stripe);
app.use(auth);
app.use(recaptcha);
app.use(files);
app.use(metadataGraph);
app.use('/web3auth', web3auth);

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
  if (err.stack) {
    console.error(err.stack);
  }
  const { params, query, body, path } = req;
  console.error('req info:', { params, query, body, path });
  next(err);
});
app.use((err, req, res, next) => {
  const errResponse = { error: err.message };
  if (err instanceof BaseHTTPError) {
    res.status(err.status_code).send(errResponse);
  } else if (err instanceof MetadataNotFound) {
    res.status(404).send(errResponse);
  } else if (err instanceof InvalidJSONLD) {
    res.status(400).send(errResponse);
  } else {
    next(err);
  }
});

const port = process.env.PORT || 5000;

app.listen(port);

console.log('Started server on port ' + port);
console.log('Graphiql UI at http://localhost:' + port + '/graphiql');
