--! Previous: sha1:c91904717572ef673c9e3b74f8d937d8dda75364
--! Hash: sha1:d867d67bd7c5432019e3785db957b7f6fdc3d623

ALTER POLICY project_insert_policy ON project
TO auth_user
WITH CHECK (true);
