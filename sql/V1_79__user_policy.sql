drop policy if exists user_select_all on "user";
create policy user_self_select on "user" for select
using (auth0_sub = public.get_current_user());