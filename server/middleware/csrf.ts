import { doubleCsrf, DoubleCsrfConfigOptions } from 'csrf-csrf';
import * as env from 'env-var';

const secret = env.get('CSRF_SECRET').required().asString();
const cookieName = env.get('CSRF_COOKIE_NAME').required().asString();

const options: DoubleCsrfConfigOptions = {
  getSecret: () => secret,
  cookieName: cookieName,
  cookieOptions: {
    httpOnly: true,
    sameSite: 'strict',
    path: '/',
    secure: true,
  },
};

export const { generateToken, doubleCsrfProtection, invalidCsrfTokenError } =
  doubleCsrf(options);
