CREATE OR REPLACE FUNCTION private.create_auth_user(role text)
returns void as $$
begin
  EXECUTE format('CREATE ROLE %I IN ROLE auth_user', role);
end;
$$ language plpgsql;
