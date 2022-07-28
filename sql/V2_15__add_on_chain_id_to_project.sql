ALTER TABLE project
    ADD COLUMN IF NOT EXISTS on_chain_id text unique;
CREATE INDEX IF NOT EXISTS on_chain_id_idx ON project (on_chain_id);
