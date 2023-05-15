-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migraitons
/*
DO $$ BEGIN
 CREATE TYPE "project_state" AS ENUM('proposed', 'pending_approval', 'active', 'hold', 'ended');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "party_type" AS ENUM('user', 'organization');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "transaction_state" AS ENUM('hold', 'processing', 'succeeded', 'payment_failed', 'revoked');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 CREATE TYPE "purchase_type" AS ENUM('stripe_invoice', 'stripe_checkout', 'offline');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "geography_columns" (
	"f_table_catalog" name,
	"f_table_schema" name,
	"f_table_name" name,
	"f_geography_column" name,
	"coord_dimension" integer,
	"srid" integer,
	"type" text
);

CREATE TABLE IF NOT EXISTS "geometry_columns" (
	"f_table_catalog" varchar(256),
	"f_table_schema" name,
	"f_table_name" name,
	"f_geometry_column" name,
	"coord_dimension" integer,
	"srid" integer,
	"type" varchar(30)
);

CREATE TABLE IF NOT EXISTS "account" (
	"id" uuid DEFAULT uuid_generate_v1() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"nonce" text DEFAULT md5(gen_random_bytes(256)) NOT NULL
);

CREATE TABLE IF NOT EXISTS "shacl_graph" (
	"uri" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"graph" jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS "metadata_graph" (
	"iri" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS "wallet" (
	"id" uuid DEFAULT uuid_generate_v1() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"addr" text NOT NULL
);

CREATE TABLE IF NOT EXISTS "credit_class" (
	"id" uuid DEFAULT uuid_generate_v1() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"uri" text DEFAULT '' NOT NULL,
	"on_chain_id" text
);

CREATE TABLE IF NOT EXISTS "credit_class_version" (
	"id" uuid DEFAULT uuid_generate_v1() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"metadata" jsonb
);
--> statement-breakpoint
ALTER TABLE "credit_class_version" ADD CONSTRAINT "credit_class_version_pkey" PRIMARY KEY("id","created_at");

CREATE TABLE IF NOT EXISTS "spatial_ref_sys" (
	"srid" integer NOT NULL,
	"auth_name" varchar(256),
	"auth_srid" integer,
	"srtext" varchar(2048),
	"proj4text" varchar(2048)
);

CREATE TABLE IF NOT EXISTS "credit_batch" (
	"id" uuid DEFAULT uuid_generate_v1() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"project_id" uuid,
	"units" numeric,
	"credit_class_version_id" uuid,
	"credit_class_version_created_at" timestamp with time zone,
	"metadata" jsonb,
	"batch_denom" text
);

CREATE TABLE IF NOT EXISTS "document" (
	"id" uuid DEFAULT uuid_generate_v1() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"date" timestamp with time zone NOT NULL,
	"url" text NOT NULL,
	"project_id" uuid
);

CREATE TABLE IF NOT EXISTS "organization" (
	"id" uuid DEFAULT uuid_generate_v1() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"party_id" uuid NOT NULL,
	"legal_name" text DEFAULT '' NOT NULL
);

CREATE TABLE IF NOT EXISTS "project" (
	"id" uuid DEFAULT uuid_generate_v1() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"developer_id" uuid,
	"credit_class_id" uuid,
	"metadata" jsonb,
	"handle" text,
	"on_chain_id" text,
	"admin_wallet_id" uuid
);

CREATE TABLE IF NOT EXISTS "party" (
	"id" uuid DEFAULT uuid_generate_v1() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"type" party_type NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"wallet_id" uuid,
	"description" char(160),
	"image" text DEFAULT '',
	"account_id" uuid,
	"bg_image" text,
	"twitter_link" text,
	"website_link" text
);

CREATE TABLE IF NOT EXISTS "flyway_schema_history" (
	"installed_rank" integer NOT NULL,
	"version" varchar(50),
	"description" varchar(200) NOT NULL,
	"type" varchar(20) NOT NULL,
	"script" varchar(1000) NOT NULL,
	"checksum" integer,
	"installed_by" varchar(100) NOT NULL,
	"installed_on" timestamp DEFAULT now() NOT NULL,
	"execution_time" integer NOT NULL,
	"success" boolean NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "credit_class_version" ADD CONSTRAINT "credit_class_version_id_fkey" FOREIGN KEY ("id") REFERENCES "credit_class"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "credit_batch" ADD CONSTRAINT "credit_batch_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "credit_batch" ADD CONSTRAINT "credit_batch_credit_class_version_id_credit_class_versio_fkey" FOREIGN KEY ("credit_class_version_id","credit_class_version_created_at") REFERENCES "credit_class_version"("id","created_at") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "document" ADD CONSTRAINT "document_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "organization" ADD CONSTRAINT "organization_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "party"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "project" ADD CONSTRAINT "project_developer_id_fkey" FOREIGN KEY ("developer_id") REFERENCES "party"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "project" ADD CONSTRAINT "project_credit_class_id_fkey" FOREIGN KEY ("credit_class_id") REFERENCES "credit_class"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "project" ADD CONSTRAINT "project_admin_wallet_id_fkey" FOREIGN KEY ("admin_wallet_id") REFERENCES "wallet"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "party" ADD CONSTRAINT "party_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallet"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "party" ADD CONSTRAINT "party_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "account"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "wallet_addr_key" ON "wallet" ("addr");
CREATE UNIQUE INDEX IF NOT EXISTS "credit_class_on_chain_id_key" ON "credit_class" ("on_chain_id");
CREATE UNIQUE INDEX IF NOT EXISTS "credit_class_uri_key" ON "credit_class" ("uri");
CREATE UNIQUE INDEX IF NOT EXISTS "credit_batch_batch_denom_key" ON "credit_batch" ("batch_denom");
CREATE INDEX IF NOT EXISTS "credit_batch_credit_class_version_id_credit_class_version_idx" ON "credit_batch" ("credit_class_version_id","credit_class_version_created_at");
CREATE INDEX IF NOT EXISTS "credit_batch_project_id_idx" ON "credit_batch" ("project_id");
CREATE INDEX IF NOT EXISTS "document_project_id_idx" ON "document" ("project_id");
CREATE UNIQUE INDEX IF NOT EXISTS "organization_party_id_key" ON "organization" ("party_id");
CREATE INDEX IF NOT EXISTS "on_chain_id_idx" ON "project" ("on_chain_id");
CREATE INDEX IF NOT EXISTS "project_admin_wallet_id_idx" ON "project" ("admin_wallet_id");
CREATE INDEX IF NOT EXISTS "project_credit_class_id_idx" ON "project" ("credit_class_id");
CREATE INDEX IF NOT EXISTS "project_developer_id_idx" ON "project" ("developer_id");
CREATE INDEX IF NOT EXISTS "project_handle_idx" ON "project" ("handle");
CREATE UNIQUE INDEX IF NOT EXISTS "project_handle_key" ON "project" ("handle");
CREATE UNIQUE INDEX IF NOT EXISTS "project_on_chain_id_key" ON "project" ("on_chain_id");
CREATE INDEX IF NOT EXISTS "party_account_id_idx" ON "party" ("account_id");
CREATE INDEX IF NOT EXISTS "party_wallet_id_idx" ON "party" ("wallet_id");
CREATE UNIQUE INDEX IF NOT EXISTS "party_wallet_id_key" ON "party" ("wallet_id");
CREATE INDEX IF NOT EXISTS "flyway_schema_history_s_idx" ON "flyway_schema_history" ("success");
*/