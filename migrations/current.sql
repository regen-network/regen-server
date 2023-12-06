DROP TABLE IF EXISTS upload;
CREATE TABLE upload (
  id uuid DEFAULT public.uuid_generate_v1() NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  url text UNIQUE NOT NULL,
  size int NOT NULL,
  mimetype text NOT NULL,
  account_id uuid NOT NULL,
  project_id uuid NOT NULL,
  CONSTRAINT fk_account_id
    FOREIGN KEY(account_id) 
	  REFERENCES account(id),
  CONSTRAINT fk_project_id
    FOREIGN KEY(project_id) 
	  REFERENCES project(id)
);
COMMENT ON TABLE upload IS 'Storage tracking for project media uploads';

CREATE INDEX IF NOT EXISTS upload_account_id_idx ON upload (account_id);
CREATE INDEX IF NOT EXISTS upload_project_id_idx ON upload (project_id);
