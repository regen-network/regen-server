--! Previous: sha1:916abdf20ac846cb9860cbcf5ef7f67327ab2aca
--! Hash: sha1:d8859fd41878e61d175b5049567b4c433fc46709

ALTER TABLE private.account
DROP CONSTRAINT IF EXISTS account_pkey;

ALTER TABLE private.account
ADD CONSTRAINT account_pkey PRIMARY KEY (id);

ALTER TABLE private.passcode
DROP CONSTRAINT IF EXISTS passcode_pkey;

ALTER TABLE private.passcode
ADD CONSTRAINT passcode_pkey PRIMARY KEY (id);
