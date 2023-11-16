--! Previous: sha1:40d3ac2d637042a763de8cb291ebf797bfa651c3
--! Hash: sha1:5263978960b83c0c1a41221b190e228751e31efc

ALTER TABLE IF EXISTS account
ALTER COLUMN nonce SET DEFAULT encode(sha256(gen_random_bytes(256)), 'hex');
