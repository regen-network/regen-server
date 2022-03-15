import express from 'express';
import { postgraphile } from 'postgraphile';
import fileUpload from 'express-fileupload';
import cors from 'cors';
import { createProxyMiddleware } from 'http-proxy-middleware';

import { UserIncomingMessage } from './types';
import getJwt from './middleware/jwt';
import imageOptimizer from './middleware/imageOptimizer';

// To get this many-to-many plugin import statement working, we
// needed to add esModuleInterop to the tsconfig compiler settings.
// Per this issue: https://github.com/graphile-contrib/pg-many-to-many/issues/64
import PgManyToManyPlugin from '@graphile-contrib/pg-many-to-many';
import url from 'url';
import { pgPool } from './pool';
import dotenv from 'dotenv';

if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

import { pgPool } from 'common/pool';
const REGEN_HOSTNAME_PATTERN = /regen\.network$/;
const WEBSITE_PREVIEW_HOSTNAME_PATTERN =
  /deploy-preview-\d+--regen-website\.netlify\.app$/;
const REGISTRY_PREVIEW_HOSTNAME_PATTERN =
  /deploy-preview-\d+--regen-registry\.netlify\.app$/;
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

app.use(fileUpload());
app.use(cors(corsOptions));

app.use(getJwt(false));

app.use('/image', imageOptimizer());

app.use(
  '/ledger',
  createProxyMiddleware({
    target: process.env.LEDGER_TENDERMINT_RPC || 'http://13.59.81.92:26657/',
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

app.use(
  postgraphile(pgPool, 'public', {
    graphiql: true,
    watchPg: true,
    dynamicJson: true,
    appendPlugins: [PgManyToManyPlugin],
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
app.use(mailerlite);
app.use(contact);
app.use(buyersInfo);
app.use(stripe);
app.use(auth);
app.use(recaptcha);
app.use(files);
app.use(metadataGraph);

const port = process.env.PORT || 5000;

app.listen(port);

console.log('Started server on port ' + port);
console.log('Graphiql UI at http://localhost:' + port + '/graphiql');
