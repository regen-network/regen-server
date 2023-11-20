--! Previous: sha1:16c1ec9289efcfd79df2f3486b9d1933d03516f3
--! Hash: sha1:ce3204a9d9c8a36c037c5f8f1283d61e4d0b103e

-- Enter migration here
ALTER TABLE party
DROP CONSTRAINT IF EXISTS party_account_id_fkey;

ALTER TABLE party
DROP COLUMN IF EXISTS account_id;

DROP TABLE IF EXISTS account;
