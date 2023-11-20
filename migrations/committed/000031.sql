--! Previous: sha1:0710e45b03548e685ca1e45abb0911e97a00e8fe
--! Hash: sha1:e4097448a1587b5a4501be4963825b96f5e27794

DROP POLICY IF EXISTS project_update_policy ON public.project;

DROP POLICY IF EXISTS account_admin_with_addr_can_update_onchain_projects ON public.project;

CREATE POLICY account_admin_with_addr_can_update_onchain_projects ON public.project FOR
UPDATE TO auth_user USING (
  EXISTS (
    SELECT
      1
    FROM
      project
      JOIN party ON project.admin_party_id = party.id
    WHERE
      project.on_chain_id IS NOT NULL
      AND party.addr IS NOT NULL
      AND party = get_current_party ()
  )
);

DROP POLICY IF EXISTS account_admin_can_update_offchain_projects ON public.project;

CREATE POLICY account_admin_can_update_offchain_projects ON public.project FOR
UPDATE TO auth_user USING (
  EXISTS (
    SELECT
      1
    FROM
      project
      JOIN party ON project.admin_party_id = party.id
    WHERE
      project.on_chain_id IS NULL
      AND party = get_current_party ()
  )
);
