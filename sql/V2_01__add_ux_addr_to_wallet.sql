ALTER TABLE wallet DROP CONSTRAINT IF EXISTS wallet_addr_key;
ALTER TABLE wallet ADD UNIQUE ( addr );
