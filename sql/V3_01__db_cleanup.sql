DROP POLICY IF EXISTS credit_vintage_insert_admin ON credit_vintage;
DROP POLICY IF EXISTS credit_vintage_select_all ON credit_vintage;
ALTER TABLE IF EXISTS credit_vintage DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS organization_insert_admin ON organization;
DROP POLICY IF EXISTS organization_update_admin ON organization;
DROP POLICY IF EXISTS owner_update_organization ON organization;
DROP POLICY IF EXISTS organization_insert ON organization;
DROP POLICY IF EXISTS organization_select_all ON organization;
ALTER TABLE IF EXISTS organization DISABLE ROW LEVEL SECURITY;
ALTER TABLE credit_class DROP COLUMN IF EXISTS designer_id;
ALTER TABLE credit_class DROP COLUMN IF EXISTS standard;
ALTER TABLE credit_class_version DROP COLUMN IF EXISTS date_developed;
ALTER TABLE credit_class_version DROP COLUMN IF EXISTS description;
ALTER TABLE credit_class_version DROP COLUMN IF EXISTS document_id;
ALTER TABLE credit_class_version DROP COLUMN IF EXISTS image;
ALTER TABLE credit_class_version DROP COLUMN IF EXISTS state_machine;
ALTER TABLE credit_class_version DROP COLUMN IF EXISTS version;
ALTER TABLE IF EXISTS credit_vintage DROP COLUMN IF EXISTS certificate_link;
ALTER TABLE IF EXISTS credit_vintage DROP COLUMN IF EXISTS credit_class_id;
ALTER TABLE IF EXISTS credit_vintage DROP COLUMN IF EXISTS end_date;
ALTER TABLE IF EXISTS credit_vintage DROP COLUMN IF EXISTS event_id;
ALTER TABLE IF EXISTS credit_vintage DROP COLUMN IF EXISTS initial_distribution;
ALTER TABLE IF EXISTS credit_vintage DROP COLUMN IF EXISTS issuer_id;
ALTER TABLE IF EXISTS credit_vintage DROP COLUMN IF EXISTS methodology_version_created_at;
ALTER TABLE IF EXISTS credit_vintage DROP COLUMN IF EXISTS methodology_version_id;
ALTER TABLE IF EXISTS credit_vintage DROP COLUMN IF EXISTS reseller_id;
ALTER TABLE IF EXISTS credit_vintage DROP COLUMN IF EXISTS start_date;
ALTER TABLE IF EXISTS credit_vintage DROP COLUMN IF EXISTS tokenizer_id;
ALTER TABLE IF EXISTS credit_vintage DROP COLUMN IF EXISTS tx_hash;
ALTER TABLE document DROP COLUMN IF EXISTS event_id;
ALTER TABLE organization DROP COLUMN IF EXISTS type;
ALTER TABLE party DROP COLUMN IF EXISTS roles;
ALTER TABLE project DROP COLUMN IF EXISTS address_id;
ALTER TABLE project DROP COLUMN IF EXISTS application_date;
ALTER TABLE project DROP COLUMN IF EXISTS end_date;
ALTER TABLE project DROP COLUMN IF EXISTS issuer_id;
ALTER TABLE project DROP COLUMN IF EXISTS land_owner_id;
ALTER TABLE project DROP COLUMN IF EXISTS last_event_index;
ALTER TABLE project DROP COLUMN IF EXISTS map;
ALTER TABLE project DROP COLUMN IF EXISTS originator_id;
ALTER TABLE project DROP COLUMN IF EXISTS registry_id;
ALTER TABLE project DROP COLUMN IF EXISTS reseller_id;
ALTER TABLE project DROP COLUMN IF EXISTS start_date;
ALTER TABLE project DROP COLUMN IF EXISTS state;
ALTER TABLE project DROP COLUMN IF EXISTS steward_id;
ALTER TABLE project DROP COLUMN IF EXISTS type;
DROP TABLE IF EXISTS account_balance CASCADE;
DROP TABLE IF EXISTS address CASCADE;
DROP TABLE IF EXISTS admin CASCADE;
DROP TABLE IF EXISTS credit_class_issuer CASCADE;
DROP TABLE IF EXISTS event CASCADE;
DROP TABLE IF EXISTS methodology_version CASCADE;
DROP TABLE IF EXISTS methodology CASCADE;
DROP TABLE IF EXISTS mrv CASCADE;
DROP TABLE IF EXISTS organization_member CASCADE;
DROP TABLE IF EXISTS project_broker CASCADE;
DROP TABLE IF EXISTS purchase CASCADE;
DROP TABLE IF EXISTS retirement CASCADE;
DROP TABLE IF EXISTS transaction CASCADE;
DROP TABLE IF EXISTS "user" CASCADE;
DROP FUNCTION IF EXISTS get_available_credits;
DROP FUNCTION IF EXISTS get_available_credits_record;
DROP FUNCTION IF EXISTS get_current_user_id;
DROP FUNCTION IF EXISTS get_user_first_organization;
DROP FUNCTION IF EXISTS get_wallet_contact_email;
DROP FUNCTION IF EXISTS is_admin;
DROP FUNCTION IF EXISTS issue_credits;
DROP FUNCTION IF EXISTS private.create_app_user_if_needed;
DROP FUNCTION IF EXISTS private.create_project_stakeholder;
DROP FUNCTION IF EXISTS private.really_create_project;
DROP FUNCTION IF EXISTS private.really_create_user_if_needed;
DROP FUNCTION IF EXISTS public.create_user_organization;
DROP FUNCTION IF EXISTS public.create_user_organization_if_needed;
DROP FUNCTION IF EXISTS public.really_create_organization;
DROP FUNCTION IF EXISTS public.really_create_organization_if_needed;
DROP FUNCTION IF EXISTS public.really_create_user;
DROP FUNCTION IF EXISTS public.really_create_user_if_needed;
DROP FUNCTION IF EXISTS retire_credits;
DROP FUNCTION IF EXISTS send_transfer_credits_confirmation;
DROP FUNCTION IF EXISTS transfer_credits;
ALTER TABLE IF EXISTS credit_vintage RENAME TO credit_batch;
ALTER INDEX IF EXISTS credit_vintage_pkey RENAME TO credit_batch_pkey;
ALTER INDEX IF EXISTS credit_vintage_batch_denom_key RENAME TO credit_batch_batch_denom_key;
ALTER INDEX IF EXISTS credit_vintage_credit_class_version_id_credit_class_version_idx RENAME TO credit_batch_credit_class_version_id_credit_class_version_idx;
ALTER INDEX IF EXISTS credit_vintage_project_id_idx RENAME TO credit_batch_project_id_idx;

DO $$
BEGIN
  ALTER TABLE IF EXISTS credit_batch RENAME CONSTRAINT credit_vintage_credit_class_version_id_credit_class_versio_fkey TO credit_batch_credit_class_version_id_credit_class_versio_fkey;
EXCEPTION
  WHEN undefined_object THEN
    RAISE NOTICE 'skipping...';
END$$;

DO $$
BEGIN
  ALTER TABLE IF EXISTS credit_batch RENAME CONSTRAINT credit_vintage_project_id_fkey TO credit_batch_project_id_fkey;
EXCEPTION
  WHEN undefined_object THEN
    RAISE NOTICE 'skipping...';
END$$;
