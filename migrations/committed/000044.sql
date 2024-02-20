--! Previous: sha1:5263978960b83c0c1a41221b190e228751e31efc
--! Hash: sha1:3b42ef8f9ef3c4bee383f705fb6b54653c05e9df

ALTER TABLE IF EXISTS private.account
ADD COLUMN IF NOT EXISTS google_email TEXT UNIQUE;
COMMENT ON COLUMN private.account.google_email IS 'Email corresponding to the google account used for logging in, which can be different from the main account email';
