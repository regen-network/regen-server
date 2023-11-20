--! Previous: sha1:7a9123e95f186b72acb48de63be650f638aa2636
--! Hash: sha1:0710e45b03548e685ca1e45abb0911e97a00e8fe

-- Enter migration here
CREATE OR REPLACE FUNCTION public.get_current_party() RETURNS public.party
    LANGUAGE sql STABLE
    AS $$
  SELECT party.* from party where id=nullif(current_user,'')::uuid LIMIT 1;
$$;

DROP FUNCTION IF EXISTS public.get_current_user();
