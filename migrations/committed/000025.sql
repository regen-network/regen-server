--! Previous: sha1:b564c65c68a54103dd92a7c45245f4cd06c0afa7
--! Hash: sha1:55954f28989762683574dda00d7f1a1a2788dc71

-- Enter migration here
ALTER TABLE project
DROP COLUMN IF EXISTS admin_wallet_id;

ALTER TABLE party
DROP COLUMN IF EXISTS wallet_id;

DROP TABLE IF EXISTS wallet;
