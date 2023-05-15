-- Custom SQL migration file, put you code below! --
CREATE TABLE
  IF NOT EXISTS signups (email TEXT);

ALTER TABLE signups ENABLE ROW LEVEL SECURITY;

GRANT
SELECT
  ON signups TO app_user;

ALTER TABLE signups
ADD COLUMN IF NOT EXISTS api_key TEXT;
