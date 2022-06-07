ALTER TABLE party DROP CONSTRAINT IF EXISTS party_wallet_id_key;
ALTER TABLE party ADD UNIQUE (wallet_id);
