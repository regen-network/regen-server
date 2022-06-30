import * as jwks from 'jwks-rsa';
import { expressjwt } from 'express-jwt';

export default function getJwt(
  credentialsRequired: boolean,
) {
  return expressjwt({
    secret: jwks.expressJwtSecret({
      cache: true,
      rateLimit: true,
      jwksRequestsPerMinute: 5,
      jwksUri: `https://${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`,
    }),
    credentialsRequired,
    audience: 'https://regen-registry-server.herokuapp.com/',
    issuer: `https://${process.env.AUTH0_DOMAIN}/`,
    algorithms: ['RS256'],
  });
}
