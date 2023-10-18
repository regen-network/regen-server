--! Previous: sha1:e85c0080463f82d21455b8390edb43ef995f43dc
--! Hash: sha1:3dd6808797e38b3d56a481872c81292adca3d190

-- Adds a new column to the account table for storing the google id
-- that the user can use to authenticate with
ALTER TABLE IF EXISTS account
ADD COLUMN IF NOT EXISTS google TEXT UNIQUE;
COMMENT ON COLUMN account.google IS 'Unique google identifier for the account.';
