--! Previous: sha1:9898781f8e81956d17a3918ddbdecd6ae0a8a48e
--! Hash: sha1:16c1ec9289efcfd79df2f3486b9d1933d03516f3

-- Enter migration here
ALTER TABLE public.party
ADD COLUMN IF NOT EXISTS nonce text DEFAULT md5 (public.gen_random_bytes (256)) NOT NULL;

ALTER TABLE IF EXISTS public.account
DROP COLUMN IF EXISTS nonce;
