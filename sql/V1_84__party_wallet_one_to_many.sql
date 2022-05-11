/*
This set of changes is flipping the one-to-many relationship
between which previously defined that one wallet can have many
parties. This relationship now states that one party can have many
wallets.
*/
ALTER TABLE wallet ADD COLUMN IF NOT EXISTS party_id uuid;

ALTER TABLE wallet DROP CONSTRAINT IF EXISTS wallet_party_id_fkey;
ALTER TABLE wallet ADD FOREIGN KEY (party_id) REFERENCES party (id);

ALTER TABLE party DROP CONSTRAINT IF EXISTS party_wallet_id_fkey;
ALTER TABLE party DROP COLUMN IF EXISTS wallet_id;
