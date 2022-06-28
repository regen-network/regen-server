DROP POLICY IF EXISTS party_select_admin ON party;
DROP POLICY IF EXISTS party_insert_admin ON party;
DROP POLICY IF EXISTS party_insert_all ON party;
DROP POLICY IF EXISTS party_select_all ON party;
DROP POLICY IF EXISTS user_party_self_update ON party;
DROP POLICY IF EXISTS owner_update_organization_party ON party;
DROP POLICY IF EXISTS party_project_creator_update ON party;
DROP POLICY IF EXISTS party_organization_member_project_creator_update ON party;
