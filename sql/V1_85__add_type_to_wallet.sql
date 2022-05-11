/*
This adds a type to the wallet. This type will be either a user
or an organization.
*/

CREATE TYPE wallet_type AS ENUM
(
  'user',
  'organization'
);

ALTER TABLE wallet ADD COLUMN IF NOT EXISTS wallet_type wallet_type; 
