-- Project creator can update project stakeholders user
create policy user_project_creator_update on "user"
for update to app_user using (
  exists (
    select 1
    from project
    where ("user".party_id = project.steward_id
    or "user".party_id = project.developer_id
    or "user".party_id = project.originator_id
    or "user".party_id = project.land_owner_id)
    and project.creator_id = public.get_current_user_id()
  )
);

create policy user_organization_member_project_creator_update on "user"
for update to app_user using (
  exists (
    select 1
    from project
    where (exists(
      select 1
      from organization_member
      inner join party on (party.id = project.steward_id
      or party.id = project.developer_id
      or party.id = project.originator_id
      or party.id = project.land_owner_id)
      inner join organization on organization_member.member_id = "user".id
      where organization_member.organization_id = organization.id
      and member_id = "user".id
      and is_owner is true
      and organization.party_id = party.id
    ))
    and project.creator_id = public.get_current_user_id()
  )
);

-- Project creator can update project stakeholders organization
create policy organization_project_creator_update on organization
for update to app_user using (
  exists (
    select 1
    from project
    where (organization.party_id = project.steward_id
    or organization.party_id = project.developer_id
    or organization.party_id = project.originator_id
    or organization.party_id = project.land_owner_id)
    and project.creator_id = public.get_current_user_id()
  )
);

-- Project creator can update project stakeholders organization address
create policy organization_address_project_creator_update on address
for update to app_user using (
  exists (
    select 1
    from project
    inner join party on (party.id = project.steward_id
    or party.id = project.developer_id
    or party.id = project.originator_id
    or party.id = project.land_owner_id) and
    address.id = party.address_id
    where project.creator_id = public.get_current_user_id()
  )
);

-- Project creator can update project stakeholders party
create policy party_project_creator_update on party
for update to app_user using (
  exists (
    select 1
    from project
    where (party.id = project.steward_id
    or party.id = project.developer_id
    or party.id = project.originator_id
    or party.id = project.land_owner_id)
    and project.creator_id = public.get_current_user_id()
  )
);

create policy party_organization_member_project_creator_update on party
for update to app_user using (
  exists (
    select 1
    from project
    where (exists(
      select 1
      from organization_member
      inner join "user" on party.id = "user".party_id
      inner join organization on organization_member.member_id = "user".id
      where organization_member.organization_id = organization.id
      and member_id = "user".id
      and is_owner is true
      and (organization.party_id = project.steward_id
      or organization.party_id = project.developer_id
      or organization.party_id = project.originator_id
      or organization.party_id = project.land_owner_id)
    ))
    and project.creator_id = public.get_current_user_id()
  )
);