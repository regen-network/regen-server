--! Previous: sha1:854455b4dfefc488a97a9c54cd783ad2b4696192
--! Hash: sha1:743101ef074f93b273f51fc53407cd97e97473b2

ALTER TABLE credit_class
ADD COLUMN IF NOT EXISTS registry_id UUID REFERENCES party (id) ON DELETE SET NULL;

ALTER TABLE project
ADD COLUMN IF NOT EXISTS verifier_id UUID REFERENCES party (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS credit_class_registry_id_key ON credit_class (registry_id);

CREATE INDEX IF NOT EXISTS project_verifier_id_key ON project (verifier_id);
