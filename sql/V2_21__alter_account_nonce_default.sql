ALTER TABLE account ALTER COLUMN nonce SET DEFAULT (md5(gen_random_bytes(256)));
