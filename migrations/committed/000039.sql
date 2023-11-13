--! Previous: sha1:91560c4e038e79b7b7b8bc48328ef76c9a325c6d
--! Hash: sha1:916abdf20ac846cb9860cbcf5ef7f67327ab2aca

ALTER TABLE public.account
DROP COLUMN IF EXISTS email;

ALTER TABLE public.account
DROP COLUMN IF EXISTS google;
