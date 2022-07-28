ALTER TABLE project
    ADD COLUMN on_chain_id text unique;
CREATE INDEX ON project ("on_chain_id");
