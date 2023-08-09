/* DEPRECATED - this code is no longer in use.
 *  At time of writing we wish to keep this code around a bit longer.
 * */
import * as express from 'express';
import axios from 'axios';
import * as bodyParser from 'body-parser';

const router = express.Router();
const recaptchaKey = process.env.RECAPTCHA_SECRET_KEY;
const recaptchaV3Key = process.env.RECAPTCHA_V3_SECRET_KEY;

function verify(request, response: express.Response, key: string): void {
  const body = request.body;

  axios
    .post(
      `https://www.google.com/recaptcha/api/siteverify?secret=${key}&response=${body.userResponse}`,
      {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
        },
      },
    )
    .then(res => {
      response.send(res.data);
    })
    .catch(error => {
      console.error(error);
      response.status(500).send(error);
    });
}

router.post(
  '/recaptcha/verify',
  bodyParser.json(),
  (request, response: express.Response) => {
    verify(request, response, recaptchaKey);
  },
);

router.post(
  '/recaptcha/v3/verify',
  bodyParser.json(),
  (request, response: express.Response) => {
    verify(request, response, recaptchaV3Key);
  },
);

export default router;
