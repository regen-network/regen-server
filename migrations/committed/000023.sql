--! Previous: sha1:1796a6a17e1cddfdf1faff0e4f9b918e9c6e6c73
--! Hash: sha1:1034555b3cba2e23812c95f65f8556952cef1c4e

-- Enter migration here
ALTER TABLE project
ADD COLUMN IF NOT EXISTS admin_party_id uuid;

ALTER TABLE project
DROP CONSTRAINT IF EXISTS project_admin_party_id_fkey;

ALTER TABLE project ADD CONSTRAINT project_admin_party_id_fkey FOREIGN KEY (admin_party_id) REFERENCES party (id);

CREATE INDEX IF NOT EXISTS project_admin_party_id_idx ON project (admin_party_id);
