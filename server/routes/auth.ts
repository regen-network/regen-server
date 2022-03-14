import * as express from 'express';
import * as bodyParser from 'body-parser';

import { UserRequest } from '../types';
import { pgPool } from '../pool';
import { ManagementClient } from 'auth0';

const router = express.Router();

const auth0 = new ManagementClient({
  domain: process.env.AUTH0_DOMAIN,
  clientId: process.env.AUTH0_CLIENT_ID,
  clientSecret: process.env.AUTH0_CLIENT_SECRET,
});

router.post(
  '/auth/verification-email',
  bodyParser.json(),
  (req: express.Request, res: express.Response) => {
    const { email } = req.body;
    auth0.getUsersByEmail(email, function (err, users) {
      if (err) {
        console.log('err', err);
        res.status(400).send(err);
      } else {
        if (users.length) {
          auth0.sendEmailVerification(
            { user_id: users[0].user_id },
            function (err) {
              if (err) {
                res.status(400).send(err);
              } else {
                res.sendStatus(200);
              }
            },
          );
        } else {
          res.status(404).send(`cannot find ${email}`);
        }
      }
    });
  },
);

router.post(
  '/auth/login',
  bodyParser.json(),
  (req: UserRequest, res: express.Response) => {
    // Create Postgres ROLE for Auth0 user
    if (req.user && req.user.sub) {
      const sub = req.user.sub;
      pgPool.connect((err, client, release) => {
        if (err) {
          res.sendStatus(500);
          console.error('Error acquiring postgres client', err.stack);
        } else {
          client.query(
            'SELECT private.create_app_user_if_needed($1)',
            [sub],
            err => {
              if (err) {
                res.sendStatus(500);
                console.error('Error creating role', err.stack);
              } else {
                // create user and associated party if needed
                client.query(
                  'SELECT private.really_create_user_if_needed($1, $2, $3, $4, NULL)',
                  [req.body.email, req.body.nickname, req.body.picture, sub],
                  err => {
                    release();
                    if (err) {
                      res.sendStatus(500);
                      console.error('Error creating user', err.stack);
                    } else {
                      res.sendStatus(200);
                    }
                  },
                );
              }
            },
          );
        }
      });
    } else {
      res.sendStatus(200);
    }
  },
);

export default router;
