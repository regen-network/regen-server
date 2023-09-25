import MagicLoginStrategy from 'passport-magic-login';
import { runnerPromise } from '../runner';

let runner;
runnerPromise.then(res => {
  runner = res;
});

export const MAGIC_LOGIN_CALLBACK_URL = '/magiclogin/callback';

export const magicLogin = new MagicLoginStrategy({
  // Used to encrypt the authentication token. Needs to be long, unique and (duh) secret.
  secret: process.env.MAGIC_LINK_SECRET,

  // The authentication callback URL
  callbackUrl: `/marketplace/v1/auth/${MAGIC_LOGIN_CALLBACK_URL}`,

  // Called with the generated magic link so you can send it to the user
  // "destination" is what you POST-ed from the client
  // "href" is your confirmUrl with the confirmation token,
  // for example "/auth/magiclogin/confirm?token=<longtoken>"
  sendMagicLink: async (destination, href, verificationCode) => {
    console.log('MAGIC LINK', href);
    console.log('verificationCode', verificationCode);
    if (runner) {
      await runner.addJob('send_email', {
        options: {
          to: destination,
          subject: 'Login with magic link',
          text: `Click this link to finish logging in: http://localhost:3000${href}`,
        },
      });
    }
  },

  // Once the user clicks on the magic link and verifies their login attempt,
  // you have to match their email to a user record in the database.
  // If it doesn't exist yet they are trying to sign up so you have to create a new one.
  // "payload" contains { "destination": "email" }
  // In standard passport fashion, call callback with the error as the first argument (if there was one)
  // and the user data as the second argument!
  verify: (payload, callback) => {
    // Get or create a user with the provided email from the database
    // getOrCreateUserWithEmail(payload.destination)
    //   .then(user => {
    callback(null, { id: payload.destination });
    // })
    // .catch(err => {
    //   callback(err);
    // });
  },
});
