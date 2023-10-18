--! Previous: sha1:ff22fe1dbd4e24de86cf0b884398556faf57bdaa
--! Hash: sha1:9898781f8e81956d17a3918ddbdecd6ae0a8a48e

-- Enter migration here
UPDATE public.party
SET
  creator_id = null;

ALTER TABLE public.party
DROP CONSTRAINT IF EXISTS party_creator_id_fkey;

ALTER TABLE public.party ADD CONSTRAINT party_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public.party (id);

DROP POLICY IF EXISTS party_update_only_by_creator ON public.party;

CREATE POLICY party_update_only_by_creator ON public.party FOR
UPDATE USING (
  (
    creator_id IN (
      SELECT
        public.get_current_party ()
    )
  )
);
