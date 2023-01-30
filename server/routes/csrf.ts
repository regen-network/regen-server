import * as express from 'express';
import { generateToken, doubleCsrfProtection } from '../middleware/csrf';

export const csrfRouter = express.Router();

csrfRouter.get('/csrfToken', (req, res) => {
  const token = generateToken(res, req);
  return res.send({ token });
});

csrfRouter.post('/csrfToken', doubleCsrfProtection, (_, res) => {
  return res.status(200).send();
});
