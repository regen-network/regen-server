--! Previous: sha1:a58fb3e1e8903316f04d32223bd9f6dbf0008099
--! Hash: sha1:ff22fe1dbd4e24de86cf0b884398556faf57bdaa

-- Enter migration here
DROP POLICY IF EXISTS party_update_only_by_owner on public.party;

CREATE POLICY party_update_only_by_owner ON public.party FOR
UPDATE USING (
  (
    id IN (
      SELECT
        public.get_current_party ()
    )
  )
);
