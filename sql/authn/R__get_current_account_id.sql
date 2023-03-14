CREATE OR REPLACE FUNCTION public.get_current_account_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE
AS $function$
  select current_setting('account.id', true)::uuid;
$function$
