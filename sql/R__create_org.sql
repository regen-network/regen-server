drop function if exists public.really_create_organization_if_needed;
create or replace function public.really_create_organization_if_needed
(
  legal_name text,
  display_name text,
  wallet_addr text,
  owner_id uuid,
  image text,
  description text default null,
  roles text[] default null,
  org_address jsonb default null
) returns organization as $$
declare
  v_org organization;
  v_party party;
  v_wallet wallet;
  v_address address;
begin
  select *
  from party
  into v_party
  where name = legal_name and type = 'organization';

  if v_party is not null then
    select * from organization into v_org where party_id = v_party.id;
    return v_org;
  else
    v_org := public.really_create_organization(legal_name, display_name, wallet_addr, owner_id, image, description, roles, org_address);
    return v_org;
  end if;
end;
$$ language plpgsql volatile
set search_path
to pg_catalog, public, pg_temp;

drop function if exists public.really_create_organization;
create or replace function public.really_create_organization(
  legal_name text,
  display_name text,
  wallet_addr text,
  owner_id uuid,
  image text,
  description text default null,
  roles text[] default null,
  org_address jsonb default null
) returns organization as $$
declare
  v_org organization;
  v_party party;
  v_wallet wallet;
  v_address address;
begin

  -- Insert the organization's address if not null
  if org_address is not null then
    insert into address
      (feature)
    values
      (org_address)
    returning * into v_address;
  end if;

  -- Insert the new party corresponding to the organization
  insert into party
    (type, name, image, roles, address_id, description)
  values
    ('organization', display_name, image, roles, v_address.id, description)
  returning * into v_party;

  -- Insert the new organization's wallet
  insert into wallet
    (addr, party_id, wallet_type)
  values
    (wallet_addr, v_party.id, 'organization')
  returning * into v_wallet;

  -- Insert the new organization
  insert into organization
    (party_id, legal_name)
  values
    (v_party.id, legal_name)
  returning * into v_org;

  -- Add first member (owner)
  insert into organization_member
    (member_id, organization_id, is_owner)
  values
    (owner_id, v_org.id, true);

  return v_org;
end;
$$ language plpgsql volatile set search_path
to pg_catalog, public, pg_temp;
