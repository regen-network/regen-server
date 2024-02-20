--! Previous: sha1:09d1f97119d30a2788e70643906a169bc1774161
--! Hash: sha1:1104b194ab8b88772c510db5d88bc719a9e93f8c

-- Enter migration here
DROP FUNCTION IF EXISTS get_current_party() CASCADE;

CREATE FUNCTION public.get_current_party() RETURNS party 
    LANGUAGE sql STABLE
    AS $$
  SELECT party.* from party where id=nullif(current_setting('party.id', true),'')::uuid LIMIT 1;
$$;

CREATE POLICY party_update_only_by_owner ON public.party FOR UPDATE USING ((id IN ( SELECT id FROM public.get_current_party() AS get_current_party)));

CREATE POLICY party_update_only_by_creator ON public.party FOR UPDATE USING ((creator_id IN ( SELECT id FROM public.get_current_party() AS get_current_party)));
