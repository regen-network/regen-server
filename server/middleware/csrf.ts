import { doubleCsrf, DoubleCsrfConfigOptions } from 'csrf-csrf';
import { sameSiteFromEnv } from '../utils';
import * as env from 'env-var';

const secret = env.get('CSRF_SECRET').required().asString();
export const CSRF_COOKIE_NAME = env
  .get('CSRF_COOKIE_NAME')
  .required()
  .asString();
const httpOnly = env
  .get('CSRF_COOKIE_HTTP_ONLY')
  .default('true')
  .asBoolStrict();
const sameSite = sameSiteFromEnv('CSRF_COOKIE_SAMESITE');
const secure = env.get('CSRF_COOKIE_SECURE').default('true').asBoolStrict();

const options: DoubleCsrfConfigOptions = {
  getSecret: () => secret,
  cookieName: CSRF_COOKIE_NAME,
  cookieOptions: {
    httpOnly,
    sameSite,
    path: '/',
    secure,
  },
};

export const { generateToken, doubleCsrfProtection, invalidCsrfTokenError } =
  doubleCsrf(options);
