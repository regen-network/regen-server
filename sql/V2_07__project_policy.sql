DROP POLICY IF EXISTS project_creator_update ON project;
DROP POLICY IF EXISTS project_update_admin ON project;

CREATE POLICY project_app_user_update ON project
FOR UPDATE TO app_user USING (true);