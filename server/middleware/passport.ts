import { Application, Request, Response, NextFunction } from 'express';
import { PassportStatic } from 'passport';
import { User } from '../types';
import { KeplrStrategy } from './keplrStrategy';
import { UnauthorizedError } from '../errors';
import { magicLogin } from './magicLoginStrategy';

export function initializePassport(
  app: Application,
  passport: PassportStatic,
): void {
  app.use(passport.initialize());
  app.use(passport.session());

  passport.serializeUser(function (user: User, done) {
    // todo: it's possible that code in serialize/deserialize
    // should be wrapped in process.nextTick (there's references
    // to this in the passport.js docs, probably just performance
    // related).
    //
    // serialize is about what will end up in the http-only session
    // cookie in terms of user data. very important to not include
    // private information here.
    console.log(`serializeUser user: ${JSON.stringify(user)}`);
    done(null, { id: user.id, address: user.address, partyId: user.partyId });
  });

  passport.deserializeUser(function (user: User, done) {
    // deserialize is about what ends up in req.user when the session
    // cookie gets parsed. private info should be carefully handled
    // here, as it could potentially expose that info if this is being
    // used in a response.
    console.log(`deserializeUser user: ${JSON.stringify(user)}`);
    const { id, address, partyId } = user;
    // todo: add more fields here probably based on a lookup in db...
    done(null, { id, address, partyId });
  });

  passport.use(magicLogin);
  passport.use('keplr', KeplrStrategy());
}

export function ensureLoggedIn() {
  // reference: https://github.com/jaredhanson/connect-ensure-login
  return function (req: Request, res: Response, next: NextFunction) {
    if (!req.isAuthenticated()) {
      throw new UnauthorizedError('unauthorized');
    }
    next();
  };
}
