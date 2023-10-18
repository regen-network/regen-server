--! Previous: sha1:e575f87fc60d23fc7b9dc583f16890953be6027d
--! Hash: sha1:a58fb3e1e8903316f04d32223bd9f6dbf0008099

-- Enter migration here
DROP FUNCTION IF EXISTS public.get_current_party;
CREATE FUNCTION public.get_current_party() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
    SELECT current_setting('party.id', true)::uuid;
$$;
