--! Previous: sha1:d867d67bd7c5432019e3785db957b7f6fdc3d623
--! Hash: sha1:1fcd1733c6fab18564bde744ad2c10ffad3de609

DO $$
BEGIN
  ALTER TABLE project 
  RENAME COLUMN handle TO slug;
EXCEPTION
    WHEN undefined_column THEN
      RAISE NOTICE '%, skipping', SQLERRM USING ERRCODE = SQLSTATE;
END$$;

DO $$
BEGIN
  ALTER TABLE project
  RENAME CONSTRAINT project_handle_key TO project_slug_key;
EXCEPTION
    WHEN undefined_object THEN
      RAISE NOTICE '%, skipping', SQLERRM USING ERRCODE = SQLSTATE;
END$$;

ALTER INDEX IF EXISTS project_handle_idx RENAME TO project_slug_idx;
