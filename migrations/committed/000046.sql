--! Previous: sha1:a38c8e478d6d4efa0a0c01805cd4030c059f241a
--! Hash: sha1:59c7d3d8f53b052345bbacafba5d712e77f22e58

DROP TABLE IF EXISTS upload;
CREATE TABLE upload (
  iri text PRIMARY KEY,
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
