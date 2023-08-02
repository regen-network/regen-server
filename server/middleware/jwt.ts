import * as jwks from 'jwks-rsa';
import { expressjwt } from 'express-jwt';

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export default function getJwt(credentialsRequired: boolean) {
  return expressjwt({
    secret: jwks.expressJwtSecret({
      cache: true,
      rateLimit: true,
      jwksRequestsPerMinute: 5,
      jwksUri: `https://${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`,
    }),
    credentialsRequired,
    audience: 'https://api.regen.network/',
    issuer: `https://${process.env.AUTH0_DOMAIN}/`,
    algorithms: ['RS256'],
  });
}
