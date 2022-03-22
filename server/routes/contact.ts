import * as express from 'express';
import * as bodyParser from 'body-parser';
import Airtable from 'airtable';

import { runnerPromise } from '../runner';

let runner;
runnerPromise.then(res => {
  runner = res;
});

const router = express.Router();
const airtable = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY });
const airtableContactBase = airtable.base(process.env.AIRTABLE_CONTACT_BASE);

router.post('/contact', bodyParser.json(), (req, res: express.Response) => {
  const { email, name, orgName, requestType, message } = req.body;
  airtableContactBase(process.env.AIRTABLE_CONTACT_TABLE).create(
    [
      {
        fields: {
          'Full name': name,
          'Email address': email,
          'Organization name': orgName,
          'Type of request': requestType,
          Message: message,
        },
      },
    ],
    function (err) {
      if (err) {
        console.error(err);
        res.status(400).send(err);
      } else {
        if (runner) {
          runner
            .addJob('send_email', {
              options: {
                to: requestType,
                subject: 'New contact submission',
                text: `Name: ${name}\n\nEmail address: ${email}\n\nOrganisation: ${orgName}\n\nMessage: ${message}`,
              },
            })
            .then(
              () => {
                res.sendStatus(200);
              },
              err => {
                res.status(400).send(err);
              },
            );
        } else {
          res.sendStatus(200);
        }
      }
    },
  );
});

export default router;
