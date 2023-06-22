import * as express from 'express';
import path from 'path';

export const graphiqlRouter = express.Router();

graphiqlRouter.get('/', (req, res) => {
  // https://github.com/graphql/graphiql/tree/main/examples/graphiql-cdn
  res.sendFile(path.join(__dirname, '../views/graphiql.html'));
});

export const analyticsGraphiqlRouter = express.Router();

analyticsGraphiqlRouter.get('/', (req, res) => {
  // https://github.com/graphql/graphiql/tree/main/examples/graphiql-cdn
  res.sendFile(path.join(__dirname, '../views/analyticsGraphiql.html'));
});
