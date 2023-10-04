--
-- PostgreSQL database dump
--

-- Dumped from database version 14.9 (Homebrew)
-- Dumped by pg_dump version 14.9 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: graphile_migrate; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA graphile_migrate;


--
-- Name: postgraphile_watch; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA postgraphile_watch;


--
-- Name: private; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA private;


--
-- Name: tiger; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA tiger;


--
-- Name: tiger_data; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA tiger_data;


--
-- Name: topology; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA topology;


--
-- Name: SCHEMA topology; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA topology IS 'PostGIS Topology schema';


--
-- Name: utilities; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA utilities;


--
-- Name: citext; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA public;


--
-- Name: EXTENSION citext; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION citext IS 'data type for case-insensitive character strings';


--
-- Name: fuzzystrmatch; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS fuzzystrmatch WITH SCHEMA public;


--
-- Name: EXTENSION fuzzystrmatch; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION fuzzystrmatch IS 'determine similarities and distance between strings';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: postgis; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA public;


--
-- Name: EXTENSION postgis; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION postgis IS 'PostGIS geometry and geography spatial types and functions';


--
-- Name: postgis_tiger_geocoder; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS postgis_tiger_geocoder WITH SCHEMA tiger;


--
-- Name: EXTENSION postgis_tiger_geocoder; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION postgis_tiger_geocoder IS 'PostGIS tiger geocoder and reverse geocoder';


--
-- Name: postgis_topology; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS postgis_topology WITH SCHEMA topology;


--
-- Name: EXTENSION postgis_topology; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION postgis_topology IS 'PostGIS topology spatial types and functions';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: party_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.party_type AS ENUM (
    'user',
    'organization'
);


--
-- Name: notify_watchers_ddl(); Type: FUNCTION; Schema: postgraphile_watch; Owner: -
--

CREATE FUNCTION postgraphile_watch.notify_watchers_ddl() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
begin
  perform pg_notify(
    'postgraphile_watch',
    json_build_object(
      'type',
      'ddl',
      'payload',
      (select json_agg(json_build_object('schema', schema_name, 'command', command_tag)) from pg_event_trigger_ddl_commands() as x)
    )::text
  );
end;
$$;


--
-- Name: notify_watchers_drop(); Type: FUNCTION; Schema: postgraphile_watch; Owner: -
--

CREATE FUNCTION postgraphile_watch.notify_watchers_drop() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
begin
  perform pg_notify(
    'postgraphile_watch',
    json_build_object(
      'type',
      'drop',
      'payload',
      (select json_agg(distinct x.schema_name) from pg_event_trigger_dropped_objects() as x)
    )::text
  );
end;
$$;


--
-- Name: create_auth_user(text); Type: FUNCTION; Schema: private; Owner: -
--

CREATE FUNCTION private.create_auth_user(role text) RETURNS void
    LANGUAGE plpgsql
    AS $$
begin
  EXECUTE format('CREATE ROLE %I IN ROLE auth_user', role);
end;
$$;


--
-- Name: create_new_account_with_wallet(text, public.party_type); Type: FUNCTION; Schema: private; Owner: -
--

CREATE FUNCTION private.create_new_account_with_wallet(addr text, v_party_type public.party_type) RETURNS uuid
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_addr text = addr;
    v_wallet_id uuid;
    v_party_id uuid;
BEGIN
    INSERT INTO wallet (addr)
        VALUES (v_addr)
    ON CONFLICT ON CONSTRAINT
        wallet_addr_key
    DO UPDATE SET
        addr = v_addr
    RETURNING
        id INTO v_wallet_id;

    INSERT INTO party (TYPE, wallet_id)
        VALUES (v_party_type, v_wallet_id)
    ON CONFLICT ON CONSTRAINT
        party_wallet_id_key
    DO UPDATE SET
        creator_id = null
    RETURNING
        id INTO v_party_id;

    RAISE LOG 'new party_id %', v_party_id;
    RAISE LOG 'new wallet_id %', v_wallet_id;
    RETURN v_party_id;
END;
$$;


--
-- Name: get_current_party(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_current_party() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
    SELECT current_setting('party.id', true)::uuid;
$$;


--
-- Name: get_current_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_current_user() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  SELECT current_user::text;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: party; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.party (
    id uuid DEFAULT public.uuid_generate_v1() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    type public.party_type NOT NULL,
    name text DEFAULT ''::text NOT NULL,
    wallet_id uuid,
    description character(160),
    image text DEFAULT ''::text,
    bg_image text,
    twitter_link text,
    website_link text,
    creator_id uuid,
    email public.citext,
    nonce text DEFAULT md5(public.gen_random_bytes(256)) NOT NULL,
    CONSTRAINT party_type_check CHECK ((type = ANY (ARRAY['user'::public.party_type, 'organization'::public.party_type])))
);


--
-- Name: get_parties_by_name_or_addr(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_parties_by_name_or_addr(input text) RETURNS SETOF public.party
    LANGUAGE sql STABLE
    AS $$
  SELECT
    p.*
  FROM
    party as p
  LEFT JOIN wallet ON wallet.id = p.wallet_id
  WHERE
    p.name ILIKE CONCAT('%', input, '%') OR wallet.addr ILIKE CONCAT('%', input, '%');
$$;


--
-- Name: current; Type: TABLE; Schema: graphile_migrate; Owner: -
--

CREATE TABLE graphile_migrate.current (
    filename text DEFAULT 'current.sql'::text NOT NULL,
    content text NOT NULL,
    date timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: migrations; Type: TABLE; Schema: graphile_migrate; Owner: -
--

CREATE TABLE graphile_migrate.migrations (
    hash text NOT NULL,
    previous_hash text,
    filename text NOT NULL,
    date timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: credit_batch; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.credit_batch (
    id uuid DEFAULT public.uuid_generate_v1() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    project_id uuid,
    units numeric,
    credit_class_version_id uuid,
    credit_class_version_created_at timestamp with time zone,
    metadata jsonb,
    batch_denom text,
    CONSTRAINT units CHECK ((units > (0)::numeric))
);


--
-- Name: credit_class; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.credit_class (
    id uuid DEFAULT public.uuid_generate_v1() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    uri text DEFAULT ''::text NOT NULL,
    on_chain_id text,
    registry_id uuid
);


--
-- Name: credit_class_version; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.credit_class_version (
    id uuid DEFAULT public.uuid_generate_v1() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    name text NOT NULL,
    metadata jsonb
);


--
-- Name: document; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document (
    id uuid DEFAULT public.uuid_generate_v1() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    name text NOT NULL,
    type text NOT NULL,
    date timestamp with time zone NOT NULL,
    url text NOT NULL,
    project_id uuid
);


--
-- Name: metadata_graph; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.metadata_graph (
    iri text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    metadata jsonb NOT NULL
);


--
-- Name: organization; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organization (
    id uuid DEFAULT public.uuid_generate_v1() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    party_id uuid NOT NULL,
    legal_name text DEFAULT ''::text NOT NULL
);


--
-- Name: project; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project (
    id uuid DEFAULT public.uuid_generate_v1() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    developer_id uuid,
    credit_class_id uuid,
    metadata jsonb,
    slug text,
    on_chain_id text,
    admin_wallet_id uuid,
    verifier_id uuid,
    approved boolean DEFAULT false,
    published boolean DEFAULT false
);


--
-- Name: shacl_graph; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shacl_graph (
    uri text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    graph jsonb NOT NULL
);


--
-- Name: wallet; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wallet (
    id uuid DEFAULT public.uuid_generate_v1() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    addr text NOT NULL
);


--
-- Name: current current_pkey; Type: CONSTRAINT; Schema: graphile_migrate; Owner: -
--

ALTER TABLE ONLY graphile_migrate.current
    ADD CONSTRAINT current_pkey PRIMARY KEY (filename);


--
-- Name: migrations migrations_pkey; Type: CONSTRAINT; Schema: graphile_migrate; Owner: -
--

ALTER TABLE ONLY graphile_migrate.migrations
    ADD CONSTRAINT migrations_pkey PRIMARY KEY (hash);


--
-- Name: credit_batch credit_batch_batch_denom_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_batch
    ADD CONSTRAINT credit_batch_batch_denom_key UNIQUE (batch_denom);


--
-- Name: credit_batch credit_batch_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_batch
    ADD CONSTRAINT credit_batch_pkey PRIMARY KEY (id);


--
-- Name: credit_class credit_class_on_chain_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_class
    ADD CONSTRAINT credit_class_on_chain_id_key UNIQUE (on_chain_id);


--
-- Name: credit_class credit_class_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_class
    ADD CONSTRAINT credit_class_pkey PRIMARY KEY (id);


--
-- Name: credit_class credit_class_uri_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_class
    ADD CONSTRAINT credit_class_uri_key UNIQUE (uri);


--
-- Name: credit_class_version credit_class_version_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_class_version
    ADD CONSTRAINT credit_class_version_pkey PRIMARY KEY (id, created_at);


--
-- Name: document document_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document
    ADD CONSTRAINT document_pkey PRIMARY KEY (id);


--
-- Name: metadata_graph metadata_graph_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.metadata_graph
    ADD CONSTRAINT metadata_graph_pkey PRIMARY KEY (iri);


--
-- Name: organization organization_party_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization
    ADD CONSTRAINT organization_party_id_key UNIQUE (party_id);


--
-- Name: organization organization_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization
    ADD CONSTRAINT organization_pkey PRIMARY KEY (id);


--
-- Name: party party_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.party
    ADD CONSTRAINT party_email_key UNIQUE (email);


--
-- Name: party party_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.party
    ADD CONSTRAINT party_pkey PRIMARY KEY (id);


--
-- Name: party party_wallet_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.party
    ADD CONSTRAINT party_wallet_id_key UNIQUE (wallet_id);


--
-- Name: project project_on_chain_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project
    ADD CONSTRAINT project_on_chain_id_key UNIQUE (on_chain_id);


--
-- Name: project project_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project
    ADD CONSTRAINT project_pkey PRIMARY KEY (id);


--
-- Name: project project_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project
    ADD CONSTRAINT project_slug_key UNIQUE (slug);


--
-- Name: shacl_graph shacl_graph_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shacl_graph
    ADD CONSTRAINT shacl_graph_pkey PRIMARY KEY (uri);


--
-- Name: wallet wallet_addr_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallet
    ADD CONSTRAINT wallet_addr_key UNIQUE (addr);


--
-- Name: wallet wallet_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wallet
    ADD CONSTRAINT wallet_pkey PRIMARY KEY (id);


--
-- Name: credit_batch_credit_class_version_id_credit_class_version_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX credit_batch_credit_class_version_id_credit_class_version_idx ON public.credit_batch USING btree (credit_class_version_id, credit_class_version_created_at);


--
-- Name: credit_batch_project_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX credit_batch_project_id_idx ON public.credit_batch USING btree (project_id);


--
-- Name: credit_class_registry_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX credit_class_registry_id_key ON public.credit_class USING btree (registry_id);


--
-- Name: document_project_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX document_project_id_idx ON public.document USING btree (project_id);


--
-- Name: on_chain_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX on_chain_id_idx ON public.project USING btree (on_chain_id);


--
-- Name: party_creator_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX party_creator_id_key ON public.party USING btree (creator_id);


--
-- Name: party_wallet_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX party_wallet_id_idx ON public.party USING btree (wallet_id);


--
-- Name: project_admin_wallet_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX project_admin_wallet_id_idx ON public.project USING btree (admin_wallet_id);


--
-- Name: project_credit_class_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX project_credit_class_id_idx ON public.project USING btree (credit_class_id);


--
-- Name: project_developer_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX project_developer_id_idx ON public.project USING btree (developer_id);


--
-- Name: project_slug_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX project_slug_idx ON public.project USING btree (slug);


--
-- Name: project_verifier_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX project_verifier_id_key ON public.project USING btree (verifier_id);


--
-- Name: migrations migrations_previous_hash_fkey; Type: FK CONSTRAINT; Schema: graphile_migrate; Owner: -
--

ALTER TABLE ONLY graphile_migrate.migrations
    ADD CONSTRAINT migrations_previous_hash_fkey FOREIGN KEY (previous_hash) REFERENCES graphile_migrate.migrations(hash);


--
-- Name: credit_batch credit_batch_credit_class_version_id_credit_class_versio_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_batch
    ADD CONSTRAINT credit_batch_credit_class_version_id_credit_class_versio_fkey FOREIGN KEY (credit_class_version_id, credit_class_version_created_at) REFERENCES public.credit_class_version(id, created_at);


--
-- Name: credit_batch credit_batch_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_batch
    ADD CONSTRAINT credit_batch_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.project(id);


--
-- Name: credit_class credit_class_registry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_class
    ADD CONSTRAINT credit_class_registry_id_fkey FOREIGN KEY (registry_id) REFERENCES public.party(id) ON DELETE SET NULL;


--
-- Name: credit_class_version credit_class_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_class_version
    ADD CONSTRAINT credit_class_version_id_fkey FOREIGN KEY (id) REFERENCES public.credit_class(id);


--
-- Name: document document_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document
    ADD CONSTRAINT document_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.project(id);


--
-- Name: organization organization_party_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization
    ADD CONSTRAINT organization_party_id_fkey FOREIGN KEY (party_id) REFERENCES public.party(id);


--
-- Name: party party_creator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.party
    ADD CONSTRAINT party_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public.party(id);


--
-- Name: party party_wallet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.party
    ADD CONSTRAINT party_wallet_id_fkey FOREIGN KEY (wallet_id) REFERENCES public.wallet(id);


--
-- Name: project project_admin_wallet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project
    ADD CONSTRAINT project_admin_wallet_id_fkey FOREIGN KEY (admin_wallet_id) REFERENCES public.wallet(id);


--
-- Name: project project_credit_class_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project
    ADD CONSTRAINT project_credit_class_id_fkey FOREIGN KEY (credit_class_id) REFERENCES public.credit_class(id);


--
-- Name: project project_developer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project
    ADD CONSTRAINT project_developer_id_fkey FOREIGN KEY (developer_id) REFERENCES public.party(id);


--
-- Name: project project_verifier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project
    ADD CONSTRAINT project_verifier_id_fkey FOREIGN KEY (verifier_id) REFERENCES public.party(id) ON DELETE SET NULL;


--
-- Name: party; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.party ENABLE ROW LEVEL SECURITY;

--
-- Name: party party_insert_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY party_insert_all ON public.party FOR INSERT WITH CHECK (true);


--
-- Name: party party_select_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY party_select_all ON public.party FOR SELECT USING (true);


--
-- Name: party party_update_only_by_creator; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY party_update_only_by_creator ON public.party FOR UPDATE USING ((creator_id IN ( SELECT public.get_current_party() AS get_current_party)));


--
-- Name: party party_update_only_by_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY party_update_only_by_owner ON public.party FOR UPDATE USING ((id IN ( SELECT public.get_current_party() AS get_current_party)));


--
-- Name: project; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.project ENABLE ROW LEVEL SECURITY;

--
-- Name: project project_insert_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY project_insert_policy ON public.project FOR INSERT TO auth_user WITH CHECK (true);


--
-- Name: project project_select_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY project_select_all ON public.project FOR SELECT USING (true);


--
-- Name: project project_update_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY project_update_policy ON public.project FOR UPDATE TO auth_user USING (true) WITH CHECK (true);


--
-- Name: wallet; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.wallet ENABLE ROW LEVEL SECURITY;

--
-- Name: wallet wallet_insert_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY wallet_insert_policy ON public.wallet FOR INSERT TO auth_user WITH CHECK (true);


--
-- Name: wallet wallet_select_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY wallet_select_all ON public.wallet FOR SELECT USING (true);


--
-- Name: TABLE party; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT ON TABLE public.party TO app_user;
GRANT SELECT,INSERT,UPDATE ON TABLE public.party TO auth_user;


--
-- Name: COLUMN party.name; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(name) ON TABLE public.party TO app_user;


--
-- Name: COLUMN party.wallet_id; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(wallet_id) ON TABLE public.party TO app_user;


--
-- Name: COLUMN party.description; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(description) ON TABLE public.party TO app_user;


--
-- Name: COLUMN party.image; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(image) ON TABLE public.party TO app_user;


--
-- Name: TABLE credit_batch; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT ON TABLE public.credit_batch TO app_user;


--
-- Name: TABLE credit_class; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.credit_class TO app_user;


--
-- Name: TABLE credit_class_version; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.credit_class_version TO app_user;


--
-- Name: TABLE document; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.document TO app_user;


--
-- Name: TABLE metadata_graph; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.metadata_graph TO app_user;


--
-- Name: TABLE organization; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.organization TO app_user;


--
-- Name: COLUMN organization.legal_name; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(legal_name) ON TABLE public.organization TO app_user;


--
-- Name: TABLE project; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE ON TABLE public.project TO app_user;


--
-- Name: COLUMN project.developer_id; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(developer_id) ON TABLE public.project TO auth_user;


--
-- Name: COLUMN project.credit_class_id; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(credit_class_id) ON TABLE public.project TO auth_user;


--
-- Name: COLUMN project.metadata; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(metadata) ON TABLE public.project TO auth_user;


--
-- Name: COLUMN project.slug; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(slug) ON TABLE public.project TO auth_user;


--
-- Name: COLUMN project.on_chain_id; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(on_chain_id) ON TABLE public.project TO auth_user;


--
-- Name: COLUMN project.admin_wallet_id; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(admin_wallet_id) ON TABLE public.project TO auth_user;


--
-- Name: COLUMN project.verifier_id; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(verifier_id) ON TABLE public.project TO auth_user;


--
-- Name: TABLE shacl_graph; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.shacl_graph TO app_user;


--
-- Name: TABLE wallet; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT ON TABLE public.wallet TO app_user;
GRANT SELECT,INSERT,UPDATE ON TABLE public.wallet TO auth_user;


--
-- Name: postgraphile_watch_ddl; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER postgraphile_watch_ddl ON ddl_command_end
         WHEN TAG IN ('ALTER AGGREGATE', 'ALTER DOMAIN', 'ALTER EXTENSION', 'ALTER FOREIGN TABLE', 'ALTER FUNCTION', 'ALTER POLICY', 'ALTER SCHEMA', 'ALTER TABLE', 'ALTER TYPE', 'ALTER VIEW', 'COMMENT', 'CREATE AGGREGATE', 'CREATE DOMAIN', 'CREATE EXTENSION', 'CREATE FOREIGN TABLE', 'CREATE FUNCTION', 'CREATE INDEX', 'CREATE POLICY', 'CREATE RULE', 'CREATE SCHEMA', 'CREATE TABLE', 'CREATE TABLE AS', 'CREATE VIEW', 'DROP AGGREGATE', 'DROP DOMAIN', 'DROP EXTENSION', 'DROP FOREIGN TABLE', 'DROP FUNCTION', 'DROP INDEX', 'DROP OWNED', 'DROP POLICY', 'DROP RULE', 'DROP SCHEMA', 'DROP TABLE', 'DROP TYPE', 'DROP VIEW', 'GRANT', 'REVOKE', 'SELECT INTO')
   EXECUTE FUNCTION postgraphile_watch.notify_watchers_ddl();


--
-- Name: postgraphile_watch_drop; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER postgraphile_watch_drop ON sql_drop
   EXECUTE FUNCTION postgraphile_watch.notify_watchers_drop();


--
-- PostgreSQL database dump complete
--

