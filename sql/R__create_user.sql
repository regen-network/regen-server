drop function if exists public.really_create_user_if_needed;
create or replace function public.really_create_user_if_needed(
  user_email text,
  name text,
  image text,
  auth0_sub text,
  roles text[] default null,
  address jsonb default null,
  wallet_addr text default null,
  updates boolean default false,
  description text default null,
  phone_number text default null
) returns "user" as $$
declare
  v_user "user";
begin
  select * from "user"
  into v_user
  where email = user_email;

  if v_user.id is not null then 
    return v_user;
  else
    select * from public.really_create_user(user_email, name, image, auth0_sub, roles, address, wallet_addr, updates, description, phone_number)
    into v_user;
    return v_user;
  end if;
end;
$$ language plpgsql volatile set search_path to pg_catalog, public, pg_temp;

drop function if exists public.really_create_user;
create or replace function public.really_create_user(
  email text,
  name text,
  image text,
  auth0_sub text,
  roles text[] default null,
  address jsonb default null,
  wallet_addr text default null,
  updates boolean default false,
  description text default null,
  phone_number text default null
) returns "user" as $$
declare
  v_user "user";
  v_party party;
  v_wallet wallet;
  v_address address;
begin
  if email is null then
    raise exception 'Email is required' using errcode = 'MODAT';
  end if;

  -- Insert the user's address if not null
  if address is not null then
    insert into "address"
      (feature)
    values
      (address)
    returning * into v_address;
  end if;

  -- Insert the new party corresponding to the user
  insert into party
    (type, name, image, roles, address_id)
  values
    ('user', name, image, roles, v_address.id)
  returning * into v_party;

  -- Insert the new user's wallet if not null
  if wallet_addr is not null then
    insert into wallet
      (addr, party_id, wallet_type)
    values
      (wallet_addr, v_party.id, 'user')
    returning * into v_wallet;
  end if;

  -- Insert the new user
  insert into "user"
    (email, auth0_sub, party_id, updates)
  values
    (email, auth0_sub, v_party.id, updates)
  returning * into v_user;

  -- Refresh the user
  select *
  into v_user
  from "user"
  where id = v_user.id;

  return v_user;
end;
$$ language plpgsql volatile set search_path to pg_catalog, public, pg_temp;

drop function if exists private.really_create_user_if_needed;
create or replace function private.really_create_user_if_needed(
  email text,
  name text,
  image text,
  sub text,
  roles text[] default null
) returns "user" as $$
declare
  v_db_user "user";
  v_auth_user_id uuid;
  v_email text;
  v_user "user";
begin
  v_email := email;

  select *
  into v_db_user
  from "user" u
  where u.email = v_email;

  select id
  into v_auth_user_id
  from "user"
  where auth0_sub = sub;

  if v_db_user.id is not null then
    -- if user already exists but has no auth0_sub yet, update its auth0 sub
    -- (eg pre-created users from pilot projects)
    if v_db_user.auth0_sub is null then
      update "user" set auth0_sub = sub
      where id = v_db_user.id
      returning * into v_user;
    else
      v_user := v_db_user;
    end if;
  else
    -- if no user yet with this auth0 sub, create it with default wallet
    if v_auth_user_id is null then
      select *
      into v_user
      from public.really_create_user(email, name, image, sub, roles, null, name, false);
    end if;
  end if;

  return v_user;
end;
$$ language plpgsql volatile set search_path to pg_catalog, public, pg_temp;
