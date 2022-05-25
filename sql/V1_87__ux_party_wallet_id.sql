ALTER TABLE party
ADD CONSTRAINT ux_party_wallet_id UNIQUE (wallet_id);
