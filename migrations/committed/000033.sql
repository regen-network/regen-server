--! Previous: sha1:b6e6afd558df8de31f583ceacedca491fe0c49f3
--! Hash: sha1:95217cabbcc6a585fc4d8c51a94932391ab75b8c

DROP POLICY IF EXISTS account_update_only_by_creator ON public.account;

CREATE POLICY account_update_only_by_creator ON public.account FOR
UPDATE USING (
  (
    creator_id IN (
      SELECT
        get_current_account.id
      FROM
        public.get_current_account ()
    ) AND (NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname=id::text))
  ));
