--! Previous: sha1:3a912c9309b338cf9e46579224207a7c7f072b29
--! Hash: sha1:5666f1ac7ef6e4f614dc524337da6b535d0787a6

-- Enter migration here
ALTER TABLE IF EXISTS project
ADD COLUMN IF NOT EXISTS approved BOOLEAN DEFAULT 'f';

REVOKE
UPDATE ON project
FROM
  app_user;

GRANT
UPDATE (
  developer_id,
  credit_class_id,
  metadata,
  handle,
  on_chain_id,
  admin_wallet_id,
  verifier_id
) ON project TO auth_user;

UPDATE project
SET
  approved = 't';
