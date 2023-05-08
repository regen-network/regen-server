--! Previous: -
--! Hash: sha1:28ab5499d9a4520daa9428681a9bf1152f9887af

-- Enter migration here
CREATE TABLE
  IF NOT EXISTS signups (email TEXT);

ALTER TABLE signups ENABLE ROW LEVEL SECURITY;

GRANT
SELECT
  ON signups TO app_user;

ALTER TABLE signups
ADD COLUMN IF NOT EXISTS api_key TEXT;
