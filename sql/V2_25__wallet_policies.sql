ALTER TABLE wallet ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wallet_select_all ON wallet;

CREATE POLICY wallet_select_all ON wallet FOR
SELECT
  USING (TRUE);
