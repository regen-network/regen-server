DROP TABLE IF EXISTS post;
DROP TYPE IF EXISTS post_privacy;

CREATE TYPE post_privacy AS ENUM (
    'public',
    'private',
    'private_files',
    'private_locations'
);
COMMENT ON TYPE post_privacy IS 
  'public: post data including files are public,
   private: post data including files are private,
   private_files: files including location data are private,
   private_locations: location data is private';

CREATE TABLE post (
  iri text PRIMARY KEY,
  created_at timestamp with time zone DEFAULT now(),
  account_id uuid NOT NULL,
  project_id uuid NOT NULL,
  privacy post_privacy NOT NULL DEFAULT 'private',
  metadata jsonb NOT NULL,
  CONSTRAINT fk_account_id
    FOREIGN KEY(account_id) 
	  REFERENCES account(id),
  CONSTRAINT fk_project_id
    FOREIGN KEY(project_id) 
	  REFERENCES project(id)
);
COMMENT ON TABLE post IS 'Project posts';

CREATE INDEX IF NOT EXISTS post_account_id_idx ON post (account_id);
CREATE INDEX IF NOT EXISTS post_project_id_idx ON post (project_id);



