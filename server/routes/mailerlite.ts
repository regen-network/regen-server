import * as express from 'express';
import * as bodyParser from 'body-parser';

const MailerLite = require('mailerlite-api-v2-node').default;
const router = express.Router();

const mailerLite = MailerLite(process.env.MAILERLITE_API_KEY);

router.post(
  '/mailerlite',
  bodyParser.json(),
  async (req, res: express.Response) => {
    const { email } = req.body;
    try {
      await mailerLite.addSubscriberToGroup(process.env.MAILERLITE_GROUP, {
        email,
      });
      res.sendStatus(200);
    } catch (e) {
      console.log(e);
      res.status(400).send(e);
    }
  },
);

export default router;
module.exports = router;
