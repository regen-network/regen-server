create policy project_creator_update_address on address
for update to app_user using (
  exists (
    SELECT 1 from project
    WHERE project.address_id = address.id
    AND project.creator_id = public.get_current_user_id()
  )
);