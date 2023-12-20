--! Previous: sha1:59c7d3d8f53b052345bbacafba5d712e77f22e58
--! Hash: sha1:bc83279a356a9f18f123acbe0bf1284b5d769911

DROP TABLE IF EXISTS post;
DROP TYPE IF EXISTS post_privacy;

CREATE TYPE post_privacy AS ENUM (
    'private',
    'private_files',
    'private_locations',
    'public'
);
COMMENT ON TYPE post_privacy IS 
  'private: post data including files are private,
   private_files: files including location data are private,
   private_locations: location data is private,
   public: post data including files are public';

CREATE TABLE post (
  iri text PRIMARY KEY,
  created_at timestamp with time zone DEFAULT now(),
  creator_account_id uuid NOT NULL,
  project_id uuid NOT NULL,
  privacy post_privacy NOT NULL DEFAULT 'private',
  contents jsonb NOT NULL,
  CONSTRAINT fk_creator_account_id
    FOREIGN KEY(creator_account_id) 
	  REFERENCES account(id),
  CONSTRAINT fk_project_id
    FOREIGN KEY(project_id) 
	  REFERENCES project(id)
);
COMMENT ON TABLE post IS 'Project posts';

CREATE INDEX IF NOT EXISTS post_creator_account_id_idx ON post (creator_account_id);
CREATE INDEX IF NOT EXISTS post_project_id_idx ON post (project_id);
