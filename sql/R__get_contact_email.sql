create or replace function get_wallet_contact_email
(
  v_wallet_id uuid
) returns text as $$
declare
  v_party party;
  v_organization organization;
  v_email text;
begin
  select *
  into v_party
  from party
  where wallet_id = v_wallet_id;

  if v_party.type = 'user' then
    select email
    into v_email
    from "user"
    where party_id = v_party.id;
  else
    select *
    into v_organization
    from organization
    where party_id = v_party.id;

    select email
    into v_email
    from "user"
    inner join organization_member on organization_member.member_id = "user".id
    where organization_member.organization_id = v_organization.id and organization_member.is_owner is true;
  end if;
  return v_email;
end;
$$ language plpgsql strict volatile
set search_path
to pg_catalog, public, pg_temp;