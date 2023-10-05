--! Previous: sha1:1034555b3cba2e23812c95f65f8556952cef1c4e
--! Hash: sha1:b564c65c68a54103dd92a7c45245f4cd06c0afa7

-- Enter migration here
UPDATE project
SET
  admin_party_id = t.admin_party_id
FROM
  (
    select
      project.id as project_id,
      admin_wallet_id,
      party.wallet_id,
      party.id as admin_party_id
    from
      project
      join party on project.admin_wallet_id = party.wallet_id
  ) t
WHERE
  project.id = t.project_id;
