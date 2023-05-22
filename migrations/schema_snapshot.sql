--
-- PostgreSQL database dump
--

-- Dumped from database version 14.8 (Debian 14.8-1.pgdg110+1)
-- Dumped by pg_dump version 14.8 (Homebrew)

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
-- Name: project_state; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.project_state AS ENUM (
    'proposed',
    'pending_approval',
    'active',
    'hold',
    'ended'
);


--
-- Name: purchase_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.purchase_type AS ENUM (
    'stripe_invoice',
    'stripe_checkout',
    'offline'
);


--
-- Name: transaction_state; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.transaction_state AS ENUM (
    'hold',
    'processing',
    'succeeded',
    'payment_failed',
    'revoked'
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
-- Name: add_addr_to_account(uuid, text, public.party_type); Type: FUNCTION; Schema: private; Owner: -
--

CREATE FUNCTION private.add_addr_to_account(account_id uuid, addr text, v_party_type public.party_type) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_account_id uuid = account_id;
    v_addr text = addr;
    can_be_added boolean;
    v_wallet_id uuid;
    v_party_id uuid;
    v_current_user name;
BEGIN
    RAISE LOG 'v_account_id %', v_account_id;
    can_be_added := public.addr_can_be_added (v_account_id, v_addr);
    IF can_be_added THEN
        INSERT INTO wallet (addr)
            VALUES (v_addr)
        ON CONFLICT ON CONSTRAINT wallet_addr_key DO UPDATE SET
            addr = v_addr
        RETURNING
            id INTO v_wallet_id;
        RAISE LOG '_wallet_id %', v_wallet_id;

        SELECT
            party.id INTO v_party_id
        FROM
            party
        JOIN
            wallet
        ON
            wallet.id = party.wallet_id
        WHERE
            wallet.addr = v_addr;
        RAISE LOG 'v_party_id %', v_party_id;

        IF v_party_id is null THEN
          RAISE LOG 'creating new party...';
          SELECT * INTO v_party_id from uuid_generate_v1();
          INSERT INTO party (id, account_id, TYPE, wallet_id)
               VALUES (v_party_id, v_account_id, v_party_type, v_wallet_id);
          RAISE LOG 'new _party_id %', v_party_id;
        ELSE
          RAISE LOG 'associating preexisting party...';
          UPDATE party SET account_id = v_account_id, type = v_party_type WHERE id = v_party_id ;
        END IF;
    END IF;
END;
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
-- Name: create_new_account(text, public.party_type); Type: FUNCTION; Schema: private; Owner: -
--

CREATE FUNCTION private.create_new_account(addr text, v_party_type public.party_type) RETURNS uuid
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_addr text = addr;
    can_be_added boolean;
    v_account_id uuid;
    v_wallet_id uuid;
    v_party_id uuid;
BEGIN
    can_be_added := public.addr_can_be_added (v_addr);
    IF can_be_added THEN
        RAISE LOG 'trying to create new account for this addr';

        INSERT INTO account DEFAULT
            VALUES
            RETURNING
                id INTO v_account_id;

        INSERT INTO wallet (addr)
            VALUES (v_addr)
        ON CONFLICT ON CONSTRAINT
            wallet_addr_key
        DO UPDATE SET
            addr = v_addr
        RETURNING
            id INTO v_wallet_id;

        INSERT INTO party (account_id, TYPE, wallet_id)
            VALUES (v_account_id, v_party_type, v_wallet_id)
        RETURNING
            id INTO v_party_id;

        RAISE LOG 'new account_id %', v_account_id;
        RAISE LOG 'new party_id %', v_party_id;
        RAISE LOG 'new wallet_id %', v_wallet_id;
	RETURN v_account_id;
    END IF;
END;
$$;


--
-- Name: get_account_by_addr(text); Type: FUNCTION; Schema: private; Owner: -
--

CREATE FUNCTION private.get_account_by_addr(addr text) RETURNS TABLE(id uuid)
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_addr text = addr;
BEGIN
    RETURN query
    SELECT
        account.id
    FROM
        wallet
        JOIN party ON party.wallet_id = wallet.id
        JOIN account ON account.id = party.account_id
    WHERE
        wallet.addr = v_addr;
END;
$$;


--
-- Name: get_addrs_by_account_id(uuid); Type: FUNCTION; Schema: private; Owner: -
--

CREATE FUNCTION private.get_addrs_by_account_id(account_id uuid) RETURNS TABLE(addr text)
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_account_id uuid = account_id;
BEGIN
    RETURN query
    SELECT
        wallet.addr
    FROM
        account
        JOIN party ON party.account_id = account.id
        JOIN wallet ON party.wallet_id = wallet.id
    WHERE
        account.id = v_account_id;
END;
$$;


--
-- Name: get_parties_by_account_id(uuid); Type: FUNCTION; Schema: private; Owner: -
--

CREATE FUNCTION private.get_parties_by_account_id(account_id uuid) RETURNS TABLE(id uuid)
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_account_id uuid = account_id;
BEGIN
    RETURN query
    SELECT
        party.id
    FROM
        account
        JOIN party ON party.account_id = account.id
    WHERE
        account.id = v_account_id;
END;
$$;


--
-- Name: remove_addr_from_account(uuid, text); Type: FUNCTION; Schema: private; Owner: -
--

CREATE FUNCTION private.remove_addr_from_account(v_account_id uuid, v_addr text) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_num_addrs bigint;
	v_removed int;
BEGIN
    --- figure out if the given address belongs to the given account
    SELECT
        count(q.addr) INTO v_num_addrs
    FROM
        private.get_addrs_by_account_id (v_account_id) q
    WHERE
        q.addr = v_addr;

    --- if the given address does not belong to the given account
    --- throw an error because you cannot remove the address from this account
    IF v_num_addrs = 0 THEN
        RAISE 'cannot remove, this address is not associated to the given account id';
    END IF;

    WITH update_confirm AS (
      UPDATE
        party p
      SET
        account_id = null
      WHERE
        p.id in (
          SELECT
            p.id AS pid
          FROM
            party p
            JOIN wallet w on p.wallet_id = w.id
          WHERE
            w.addr = v_addr
        ) RETURNING 1
    )
    SELECT
      count(*) INTO v_removed
    FROM
      update_confirm;

    IF v_removed = 1 THEN
        raise notice 'party association has been removed';
    ELSE
        raise 'error removing the address';
    END IF;
END;
$$;


--
-- Name: addr_can_be_added(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.addr_can_be_added(addr text, OUT can_be_added boolean) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
DECLARE
    v_addr text = addr;
    associated_account_id uuid;
BEGIN
    associated_account_id := private.get_account_by_addr (addr);
    IF associated_account_id IS NULL THEN
        can_be_added := true;
    ELSE
        RAISE EXCEPTION 'this addr belongs to a different account';
    END IF;
END;
$$;


--
-- Name: addr_can_be_added(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.addr_can_be_added(account_id uuid, addr text, OUT can_be_added boolean) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    AS $$
DECLARE
    v_account_id uuid = account_id;
    v_addr text = addr;
    associated_account_id uuid;
BEGIN
    PERFORM
        id
    FROM
        account
    WHERE
        id = v_account_id;
    IF NOT found THEN
        RAISE EXCEPTION
            USING message = 'no account found for given account_id', hint = 'check the account_id', errcode = 'NTFND';
    END IF;
    associated_account_id := private.get_account_by_addr (v_addr);
    IF associated_account_id IS NULL THEN
        can_be_added := true;
    ELSE
        IF associated_account_id = account_id THEN
            RAISE EXCEPTION 'this addr already belongs to this account';
        ELSE
            RAISE EXCEPTION 'this addr belongs to a different account';
        END IF;
    END IF;
END;
$$;


--
-- Name: get_current_account(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_current_account(OUT account_id uuid) RETURNS uuid
    LANGUAGE plpgsql STABLE
    AS $$ 
DECLARE
BEGIN
    SELECT * INTO account_id FROM get_current_account_id();
END;
$$;


--
-- Name: get_current_account_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_current_account_id() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
  select current_setting('account.id', true)::uuid;
$$;


--
-- Name: get_current_addrs(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_current_addrs() RETURNS TABLE(wallet_id uuid, addr text, profile_type public.party_type)
    LANGUAGE plpgsql STABLE
    AS $$ 
DECLARE
    v_account_id uuid;
BEGIN
    SELECT * INTO v_account_id FROM get_current_account();
    RETURN query
    SELECT
        wallet.id, wallet.addr, party.type
    FROM
        account
        JOIN party ON party.account_id = account.id
        JOIN wallet ON party.wallet_id = wallet.id
    WHERE
        account.id = v_account_id;
END;
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
-- Name: account; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account (
    id uuid DEFAULT public.uuid_generate_v1() NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    nonce text DEFAULT md5(public.gen_random_bytes(256)) NOT NULL
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
    account_id uuid,
    bg_image text,
    twitter_link text,
    website_link text,
    CONSTRAINT party_type_check CHECK ((type = ANY (ARRAY['user'::public.party_type, 'organization'::public.party_type])))
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
    handle text,
    on_chain_id text,
    admin_wallet_id uuid,
    verifier_id uuid
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
-- Name: account account_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account
    ADD CONSTRAINT account_pkey PRIMARY KEY (id);


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
-- Name: project project_handle_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project
    ADD CONSTRAINT project_handle_key UNIQUE (handle);


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
-- Name: party_account_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX party_account_id_idx ON public.party USING btree (account_id);


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
-- Name: project_handle_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX project_handle_idx ON public.project USING btree (handle);


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
-- Name: party party_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.party
    ADD CONSTRAINT party_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.account(id) ON DELETE CASCADE;


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
-- Name: party party_update_only_by_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY party_update_only_by_owner ON public.party FOR UPDATE USING ((id IN ( SELECT p.id
   FROM public.party p
  WHERE (p.account_id IN ( SELECT get_current_account.account_id
           FROM public.get_current_account() get_current_account(account_id))))));


--
-- Name: project; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.project ENABLE ROW LEVEL SECURITY;

--
-- Name: project project_insert_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY project_insert_policy ON public.project FOR INSERT TO auth_user WITH CHECK ((admin_wallet_id IN ( SELECT get_current_addrs.wallet_id
   FROM public.get_current_addrs() get_current_addrs(wallet_id, addr, profile_type))));


--
-- Name: project project_select_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY project_select_all ON public.project FOR SELECT USING (true);


--
-- Name: project project_update_policy; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY project_update_policy ON public.project FOR UPDATE TO auth_user USING ((admin_wallet_id IN ( SELECT get_current_addrs.wallet_id
   FROM public.get_current_addrs() get_current_addrs(wallet_id, addr, profile_type)))) WITH CHECK (true);


--
-- Name: wallet; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.wallet ENABLE ROW LEVEL SECURITY;

--
-- Name: wallet wallet_select_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY wallet_select_all ON public.wallet FOR SELECT USING (true);


--
-- Name: TABLE account; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.account TO auth_user;


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
-- Name: TABLE project; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.project TO app_user;


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

