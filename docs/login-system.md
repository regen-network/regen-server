# Login system specification

This document is a specification of the login system.
We currently support the following methods for login:

1. Keplr Wallet
2. Google OAuth 2.0
3. Email + OTPW

## Definitions

- <ins>Credentialed request</ins>: a request that uses the ["with-credentials"][1] feature of web browser HTTP requests.
  The "with-credentials" feature means that cookies for the domain are automatically saved and used in subsequent requests.

## Keplr Login

At high-level the steps to log-in a user with Keplr Wallet are:

1. Retrieve and save the CSRF token
2. Retrieve the nonce for the account by address
3. Generate the signature for the login request
4. Submit the signature to the login endpoint
5. Save the session info from the login endpoint response

### Step 1: Retrieve and save the CSRF token

Send a credentialed GET request to the `/marketplace/v1/csrfToken` endpoint:

```http
GET /marketplace/v1/csrfToken HTTP/1.1

HTTP/1.1 200 OK
Set-Cookie: regen-dev.x-csrf-token=b5763f7869e5cf55ca17b72629065a728661d476ce172b16a0845fac17c954ce; Path=/; HttpOnly; Secure; SameSite=Strict

{"token":"286c9007e5afe517f23afc68e2c1aff9c3c2848bc8544c94176c78bf5f9b3d7f459ff7cb132f5fedbf304bd39ced7770bd2d5c658c85cf225797aff3c6518f6c"}
```

The `token` in the JSON response body must also be saved.
The `token` and the cookie must be submitted together for all subsequent requests to the regen server.
The `token` will be submitted to the regen server in the `X-CSRF-TOKEN` header.

### Step 2: Retrieve a nonce for the account by address

Send a GET request to the `/marketplace/v1/wallet-auth/nonce` endpoint that includes the `userAddress` query parameter:

```http
GET /marketplace/v1/wallet-auth/nonce?userAddress=regen1yte5v5g6hez6zpplz7zffp5m5tcxajnpxpkh69 HTTP/1.1

HTTP/1.1 200 OK

{"nonce":"c5607b7d28d5236d5fb3bb4b077d178b"}
```

If the above request returns 404, then an empty string value must be used for the nonce.
This nonce must be included in the data to be signed in the next step.

### Step 3: Generate the signature for the login request

Generate the `signature` for the login request using the keplr wallet sign arbitrary API:

```javascript
  const signature = await window.keplr!.signArbitrary(
    "regen-1",
    key.bech32Address,
    JSON.stringify({
      title: 'Regen Network Login',
      description: 'This is a transaction that allows Regen Network to authenticate you with our application.',
      nonce: nonce,
    })
  );
```

Any `signature` conforming to [the `StdSignature` interface][2] and signed using Secp256k1 crypto and [ADR-036][3] should work.
Note: The data being signed must be identical between client and server, otherwise the login attempt will fail.

### Step 4: Submit the signature to the login endpoint

Send a credentialed POST request which includes the token and cookie acquired in step #1 and a JSON request body that includes the `signature`:

```http
POST /marketplace/v1/wallet-auth/login HTTP/1.1
X-CSRF-TOKEN: f809ffe71aa2d11ac4bbbb5d556b02e83eba97661743df88b9ca72369d8750975902aa0845154b1f36ec21e2b0f6e6acf04c4fe881917b3494ec9592d18de6d1
Cookie: regen-dev.x-csrf-token=09b4e531ea7e540cf93f73f0d03e464ae4326f4b4b28f34268b9daaa7f23d73f

{"signature":{"pub_key":{"type":"tendermint/PubKeySecp256k1","value":"A56RnHlm6rfDLIBdEAibUtRFwXB0HNP3pVU+9V9nvlMU"},"signature":"a9A8q+C6FsroiVOcIT+641RsDu0j6uylmNMOjGGyrGRuyu8eP4AJGOzoBcbcQw1ZH2VRmGhksdFQGR0dFopOeg=="}}
```

Pending success of that request the server will respond with a new cookie that sets the user session:

```http
HTTP/1.1 200 OK

Set-Cookie: session=eyJwYXNzcG9ydCI6eyJ1c2VyIjp7ImlkIjoiMWQ5MjgzNzYtYThjMy0xMWVkLTgwNjQtMDI0MmFjMTkwMDAzIiwiYWRkcmVzcyI6InJlZ2VuMW0zajB2cjRjbHd2YTkzcmN3am5yM25qd2w2a2V1eDdxOG1qMHA0In19fQ==; path=/; expires=Wed, 15 Feb 2023 20:27:22 GMT; samesite=lax; httponly; session.sig=ibs_sNvIKpF_t5P4B99VRRSuA7w; path=/; expires=Wed, 15 Feb 2023 20:27:22 GMT; samesite=lax; httponly

{"user":{"accountId":"1d928376-a8c3-11ed-8064-0242ac190003"},"message":"You have been signed in via keplr!"}
```

At this point the user is authenticated and any requests to protected endpoints will be allowed.

## Connect a Keplr wallet address to an existing web2 account

Users that have logged in via Google or Email (i.e. web2 accounts) can later on add a wallet address to their account. This means that [Keplr Login](#keplr-login) could then be used to authenticate, instead of using Google or Email.

The steps are:

1. Retrieve and save the CSRF token
1. Retrieve the nonce for the account by id
1. Generate the signature for the /connect-wallet request
1. Submit the signature to the /connect-wallet endpoint

### [Step 1: Retrieve and save the CSRF token](#step-1-retrieve-and-save-the-csrf-token)

### Step 2: Retrieve the nonce for the account by id

We can't use the `/marketplace/v1/wallet-auth/nonce` endpoint here since it looks for a nonce for an account by address. Instead, a graphql query `GetAccountById` can be used.

### Step 3: Generate the signature for the /connect-wallet request

Generate the `signature` for the login request using the keplr wallet sign arbitrary API:

```javascript
  const signature = await window.keplr!.signArbitrary(
    "regen-1",
    key.bech32Address,
    JSON.stringify({
      title: 'Regen Network Login',
      description: 'This is a transaction that allows Regen Network to connect a wallet address to your account.',
      nonce: nonce,
    })
  );
```

### Step 4: Submit the signature to the /connect-wallet endpoint

Send a credentialed POST request and a JSON request body that includes the `signature`:

```http
POST /marketplace/v1/wallet-auth/connect-wallet HTTP/1.1
X-CSRF-TOKEN: f809ffe71aa2d11ac4bbbb5d556b02e83eba97661743df88b9ca72369d8750975902aa0845154b1f36ec21e2b0f6e6acf04c4fe881917b3494ec9592d18de6d1
Cookie: regen-dev.x-csrf-token=09b4e531ea7e540cf93f73f0d03e464ae4326f4b4b28f34268b9daaa7f23d73f; session=eyJwYXNzcG9ydCI6eyJ1c2VyIjp7ImlkIjoiMWQ5MjgzNzYtYThjMy0xMWVkLTgwNjQtMDI0MmFjMTkwMDAzIiwiYWRkcmVzcyI6InJlZ2VuMW0zajB2cjRjbHd2YTkzcmN3am5yM25qd2w2a2V1eDdxOG1qMHA0In19fQ==; session.sig=ibs_sNvIKpF_t5P4B99VRRSuA7w

{"signature":{"pub_key":{"type":"tendermint/PubKeySecp256k1","value":"A56RnHlm6rfDLIBdEAibUtRFwXB0HNP3pVU+9V9nvlMU"},"signature":"a9A8q+C6FsroiVOcIT+641RsDu0j6uylmNMOjGGyrGRuyu8eP4AJGOzoBcbcQw1ZH2VRmGhksdFQGR0dFopOeg=="}}
```

Pending success of that request the server will respond with the following:

```http
HTTP/1.1 200 OK
{"message":"'Wallet address successfully connected'"}
```

## Google OAuth 2.0 Login

Navigate to `/marketplace/v1/auth/google`.
This redirects to the Google OAuth consent screen.

After authorization is granted, the callback URL `/marketplace/v1/auth/google/callback` is invoked. If an existing account is found with either the same email or google id, it logs the user in, else a new account is created and logged in. Finally, the user is redirected to the profile page on the marketplace app.

```http
GET /marketplace/v1/auth/google/callback?code=... HTTP/1.1

HTTP/1.1 302 Found
Set-Cookie: session=eyJwYXNzcG9ydCI6e319; path=/; expires=Wed, 15 Feb 2023 20:53:22 GMT; samesite=lax; httponly; session.sig=WpB-0vaD29iX-zcdgNrc9EfJUXI; path=/; expires=Wed, 15 Feb 2023 20:53:22 GMT; samesite=lax; httponly
```

## Connect a Google account to an existing account

The process is very similar to the once for [logging in with Google](#google-oauth-20-login), but the callback function logic is different since we don't need to create any new account in this case.

While being logged in, navigate to `/marketplace/v1/auth/google/connect`.
This redirects to the Google OAuth consent screen.

After authorization is granted, the callback URL `/marketplace/v1/auth/google/connect/callback` is invoked. If there's no existing account with the same google id and google email, it updates the account google id and google email, which could be different from the account main email if the user has logged in with email previously. Finally, it redirects to the account settings page on the marketplace app.

```http
GET /marketplace/v1/auth/google/connect/callback?code=... HTTP/1.1

HTTP/1.1 302 Found
Set-Cookie: session=eyJwYXNzcG9ydCI6e319; path=/; expires=Wed, 15 Feb 2023 20:53:22 GMT; samesite=lax; httponly; session.sig=WpB-0vaD29iX-zcdgNrc9EfJUXI; path=/; expires=Wed, 15 Feb 2023 20:53:22 GMT; samesite=lax; httponly
```

## Disconnect from Google

Send a credentialed POST request to the google disconnect endpoint:

```http
POST /marketplace/v1/auth/google/disconnect HTTP/1.1
X-CSRF-TOKEN: f809ffe71aa2d11ac4bbbb5d556b02e83eba97661743df88b9ca72369d8750975902aa0845154b1f36ec21e2b0f6e6acf04c4fe881917b3494ec9592d18de6d1
Cookie: regen-dev.x-csrf-token=09b4e531ea7e540cf93f73f0d03e464ae4326f4b4b28f34268b9daaa7f23d73f; session=eyJwYXNzcG9ydCI6eyJ1c2VyIjp7ImlkIjoiMWQ5MjgzNzYtYThjMy0xMWVkLTgwNjQtMDI0MmFjMTkwMDAzIiwiYWRkcmVzcyI6InJlZ2VuMW0zajB2cjRjbHd2YTkzcmN3am5yM25qd2w2a2V1eDdxOG1qMHA0In19fQ==; session.sig=ibs_sNvIKpF_t5P4B99VRRSuA7w

HTTP/1.1 200 OK
Set-Cookie: session=eyJwYXNzcG9ydCI6e319; path=/; expires=Wed, 15 Feb 2023 20:53:22 GMT; samesite=lax; httponly; session.sig=WpB-0vaD29iX-zcdgNrc9EfJUXI; path=/; expires=Wed, 15 Feb 2023 20:53:22 GMT; samesite=lax; httponly
{"message":"Account disconnected from google"}
```

At this point the user is no longer able to log in with Google.

## Email Login with One-Time Password

### Step 1: Request a One-Time Password

Send a credentialed POST request to the passcode endpoint with the user email:

```http
POST /marketplace/v1/auth/passcode HTTP/1.1
X-CSRF-TOKEN: f809ffe71aa2d11ac4bbbb5d556b02e83eba97661743df88b9ca72369d8750975902aa0845154b1f36ec21e2b0f6e6acf04c4fe881917b3494ec9592d18de6d1
Cookie: regen-dev.x-csrf-token=09b4e531ea7e540cf93f73f0d03e464ae4326f4b4b28f34268b9daaa7f23d73f

{"email":"john@doe.com"}

HTTP/1.1 200 OK
{"message":"Email sent with passcode"}
```

A temporary password will be sent to the user email.

### Step 2: Verify the Password

Send a credentialed POST request to the passcode verify endpoint with the user email and temporary password from step 1:

```http
POST /marketplace/v1/auth/passcode/verify HTTP/1.1
X-CSRF-TOKEN: f809ffe71aa2d11ac4bbbb5d556b02e83eba97661743df88b9ca72369d8750975902aa0845154b1f36ec21e2b0f6e6acf04c4fe881917b3494ec9592d18de6d1
Cookie: regen-dev.x-csrf-token=09b4e531ea7e540cf93f73f0d03e464ae4326f4b4b28f34268b9daaa7f23d73f

{"email":"john@doe.com", "passcode": 123456}
```

Pending success of that request the server will respond with a new cookie that sets the user session:

```http
HTTP/1.1 200 OK

Set-Cookie: session=eyJwYXNzcG9ydCI6eyJ1c2VyIjp7ImlkIjoiMWQ5MjgzNzYtYThjMy0xMWVkLTgwNjQtMDI0MmFjMTkwMDAzIiwiYWRkcmVzcyI6InJlZ2VuMW0zajB2cjRjbHd2YTkzcmN3am5yM25qd2w2a2V1eDdxOG1qMHA0In19fQ==; path=/; expires=Wed, 15 Feb 2023 20:27:22 GMT; samesite=lax; httponly; session.sig=ibs_sNvIKpF_t5P4B99VRRSuA7w; path=/; expires=Wed, 15 Feb 2023 20:27:22 GMT; samesite=lax; httponly
{"message":"You have been signed in via email!"}
```

## Logout

Send a credentialed POST request to the logout endpoint:

```http
POST /marketplace/v1/wallet-auth/logout HTTP/1.1
X-CSRF-TOKEN: f809ffe71aa2d11ac4bbbb5d556b02e83eba97661743df88b9ca72369d8750975902aa0845154b1f36ec21e2b0f6e6acf04c4fe881917b3494ec9592d18de6d1
Cookie: regen-dev.x-csrf-token=09b4e531ea7e540cf93f73f0d03e464ae4326f4b4b28f34268b9daaa7f23d73f; session=eyJwYXNzcG9ydCI6eyJ1c2VyIjp7ImlkIjoiMWQ5MjgzNzYtYThjMy0xMWVkLTgwNjQtMDI0MmFjMTkwMDAzIiwiYWRkcmVzcyI6InJlZ2VuMW0zajB2cjRjbHd2YTkzcmN3am5yM25qd2w2a2V1eDdxOG1qMHA0In19fQ==; session.sig=ibs_sNvIKpF_t5P4B99VRRSuA7w

HTTP/1.1 200 OK
Set-Cookie: session=eyJwYXNzcG9ydCI6e319; path=/; expires=Wed, 15 Feb 2023 20:53:22 GMT; samesite=lax; httponly; session.sig=WpB-0vaD29iX-zcdgNrc9EfJUXI; path=/; expires=Wed, 15 Feb 2023 20:53:22 GMT; samesite=lax; httponly
{"message":"You have been logged out!"}
```

At this point the user is no longer allowed to make requests to protected endpoints.
Additionally, the user is logged out of any accounts that they have authenticated with previously, see "Multiple logins per session".

## Multiple logins per session

The login system supports multiple logins per session.
Practically, this means that a user can sign in with multiple accounts in the same browser.

### Example of multiple logins

Suppose that the "Keplr Login" process above has been completed with wallet address "A".
The user session has been established and it is stored in the users browser in an http-only cookie.

Now imagine that the user wants to sign-in with wallet address "B".
At this point, we just need to complete Step 3 through Step 5 for wallet address "B".
Because all login requests are credentialed requests, each new login will be added to the same user session.

### Getting the authenticated accounts and the active account

We provide an API endpoint for retreiving a JSON representation of the authenticated accounts and the active account.
You must send a credentialed GET request to the following endpoint:

```
GET /auth/accounts HTTP/1.1
X-CSRF-TOKEN: f809ffe71aa2d11ac4bbbb5d556b02e83eba97661743df88b9ca72369d8750975902aa0845154b1f36ec21e2b0f6e6acf04c4fe881917b3494ec9592d18de6d1
Cookie: regen-dev.x-csrf-token=09b4e531ea7e540cf93f73f0d03e464ae4326f4b4b28f34268b9daaa7f23d73f; session=eyJwYXNzcG9ydCI6eyJ1c2VyIjp7ImlkIjoiMWQ5MjgzNzYtYThjMy0xMWVkLTgwNjQtMDI0MmFjMTkwMDAzIiwiYWRkcmVzcyI6InJlZ2VuMW0zajB2cjRjbHd2YTkzcmN3am5yM25qd2w2a2V1eDdxOG1qMHA0In19fQ==; session.sig=ibs_sNvIKpF_t5P4B99VRRSuA7w
```

In the example provided above, we would expect the following response:

```
HTTP/1.1 200 OK

{
  activeAccountId: '7907fede-71d1-11ee-bd77-c26700a3bae4',
  authenticatedAccounts: [
    { id: '7907fede-71d1-11ee-bd77-c26700a3bae4', email: 'some@email.com', google: null },
    { id: '7916a88a-71d1-11ee-bd77-c26700a3bae4', email: null, google: '12345' },
  ]
}
```

### Switching the active account

In order for the server to know which account the user wants to request data for, the server needs to have a single active account id.
Since we allow the user to sign-in with multiple accounts, we need to allow the application to set the active account id.
To set the active account id you must send a credentialed POST request to the following endpoint:

```
POST /auth/accounts?accountId=7916a88a-71d1-11ee-bd77-c26700a3bae4 HTTP/1.1
X-CSRF-TOKEN: f809ffe71aa2d11ac4bbbb5d556b02e83eba97661743df88b9ca72369d8750975902aa0845154b1f36ec21e2b0f6e6acf04c4fe881917b3494ec9592d18de6d1
Cookie: regen-dev.x-csrf-token=09b4e531ea7e540cf93f73f0d03e464ae4326f4b4b28f34268b9daaa7f23d73f; session=eyJwYXNzcG9ydCI6eyJ1c2VyIjp7ImlkIjoiMWQ5MjgzNzYtYThjMy0xMWVkLTgwNjQtMDI0MmFjMTkwMDAzIiwiYWRkcmVzcyI6InJlZ2VuMW0zajB2cjRjbHd2YTkzcmN3am5yM25qd2w2a2V1eDdxOG1qMHA0In19fQ==; session.sig=ibs_sNvIKpF_t5P4B99VRRSuA7w
```

In the example provided above, we would expect the following response (notice how the active account has been switched):

```
HTTP/1.1 200 OK

{
  activeAccountId: '7916a88a-71d1-11ee-bd77-c26700a3bae4',
  authenticatedAccounts: [
    { id: '7907fede-71d1-11ee-bd77-c26700a3bae4', email: 'some@email.com', google: null },
    { id: '7916a88a-71d1-11ee-bd77-c26700a3bae4', email: null, google: '12345' },
  ]
}
```

## References

- [withCredentials][1]
- [StdSignature][2]
- [ADR-036][3]

[1]: https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/withCredentials
[2]: https://github.com/chainapsis/keplr-wallet/blob/master/packages/types/src/cosmjs.ts#L49
[3]: https://github.com/cosmos/cosmos-sdk/blame/main/docs/architecture/adr-036-arbitrary-signature.md
