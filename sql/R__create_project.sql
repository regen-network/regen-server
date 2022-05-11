drop function if exists public.create_user_organization_if_needed;
create or replace function public.create_user_organization_if_needed
(
  email text,
  name text,
  image text,
  org_name text,
  wallet_addr text,
  roles text[] default null,
  org_address jsonb default null,
  updates boolean default false
) returns organization as $$
declare
  v_user "user";
  v_org organization;
begin
  v_user := public.really_create_user_if_needed
(email, name, image, null, roles, null, wallet_addr, updates);
  v_org := public.really_create_organization_if_needed
(org_name, org_name, wallet_addr, v_user.id, image, null, roles, org_address);

return v_org;
end;
$$ language plpgsql volatile
set search_path
= pg_catalog, public, pg_temp;

drop function if exists public.create_user_organization;
create or replace function public.create_user_organization
(
  email text,
  name text,
  image text,
  org_name text,
  wallet_addr text,
  roles text[] default null,
  org_address jsonb default null
) returns organization as $$
declare
  v_user "user";
  v_org organization;
begin
  v_user := public.really_create_user(
    email,
    name,
    image,
    null,
    roles,
    null,
    null,
    false
  );
  v_org := public.really_create_organization(
    org_name,
    org_name,
    wallet_addr,
    v_user.id,
    image,
    null,
    roles,
    org_address
  );

return v_org;
end;
$$ language plpgsql volatile
set search_path
= pg_catalog, public, pg_temp;

drop function if exists private.really_create_project;
create or replace function private.really_create_project
(
  methodology_developer_id uuid,
  project_developer_id uuid,
  land_steward_id uuid,
  application_date timestamptz,
  start_date timestamptz,
  end_date timestamptz,
  state project_state
) returns project as $$
declare
  v_methodology methodology;
  v_credit_class credit_class;
  v_project project;
begin
  -- Insert new methodology
  insert into methodology
    (author_id)
  values
    (methodology_developer_id)
  returning * into v_methodology;

-- Insert new credit class with this methodology
insert into credit_class
  (methodology_id)
values
  (v_methodology.id)
returning * into v_credit_class;

-- Insert new project with this credit class
insert into project
  (developer_id, steward_id, credit_class_id, application_date, start_date, end_date, state)
values
  (project_developer_id, land_steward_id, v_credit_class.id, application_date, start_date, end_date, state)
returning * into v_project;

return v_project;
end;
$$ language plpgsql volatile
set search_path
= pg_catalog, public, pg_temp;

create or replace function private.create_project_stakeholder(
  metadata jsonb
) returns uuid as $$
declare
  v_user "user";
  v_org organization;
begin
  if metadata is not null then
    if (metadata->'@type')::jsonb ? 'http://regen.network/Organization' then
      v_user := really_create_user_if_needed(
        metadata->>'http://schema.org/email',
        metadata->>'http://regen.network/responsiblePerson', null, null, null, null, null, false, null,
        metadata->>'http://schema.org/telephone'
      );
      v_org := really_create_organization_if_needed(
        metadata->>'http://schema.org/legalName',
        metadata->>'http://schema.org/name', '', 'c0bcb70a-935f-11ea-86d1-0ab192efaa7b',
        metadata->'http://schema.org/logo'->>'@value',
        metadata->>'http://schema.org/description', null,
        (metadata->'http://schema.org/location')::jsonb
      );
      return v_org.party_id;
    end if;
    if (metadata->'@type')::jsonb ? 'http://regen.network/Individual' then
      v_user := really_create_user_if_needed(
        metadata->>'http://schema.org/email',
        metadata->>'http://regen.network/name',
        metadata->'http://schema.org/image'->>'@value', null, null, null, null, false,
        metadata->>'http://schema.org/description',
        metadata->>'http://schema.org/telephone'
      );
      return v_user.party_id;
    end if;
  end if;
end;
$$ language plpgsql strict volatile
set search_path
to pg_catalog, public, pg_temp;
