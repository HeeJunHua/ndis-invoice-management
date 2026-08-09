--
-- PostgreSQL database dump
--

\restrict ON0K8HbcIBc9vmNQNNDKrnTNTCtoVZFops7EibFmbT7NJSzFhVNfvA67NU6TN6p

-- Dumped from database version 16.14
-- Dumped by pg_dump version 16.14

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
-- Name: btree_gist; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA public;


--
-- Name: EXTENSION btree_gist; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION btree_gist IS 'support for indexing common datatypes in GiST';


--
-- Name: citext; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA public;


--
-- Name: EXTENSION citext; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION citext IS 'data type for case-insensitive character strings';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: client_set_name_parts(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.client_set_name_parts() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      NEW.name_parts :=
        array_remove(
          regexp_split_to_array(
            trim(lower(concat_ws(' ', NEW.first_name, NEW.last_name))),
            '[^[:alnum:]]+'
          ),
          ''
        );
      RETURN NEW;
    END;
    $$;


--
-- Name: provider_set_name_parts(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.provider_set_name_parts() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      NEW.name_parts :=
        array_remove(
          regexp_split_to_array(
            trim(lower(NEW.name)),
            '[^[:alnum:]]+'
          ),
          ''
        );
      RETURN NEW;
    END;
    $$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: app_user; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_user (
    id integer NOT NULL,
    email public.citext NOT NULL,
    full_name text NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deactivated_at timestamp with time zone,
    deleted_at timestamp with time zone
);


--
-- Name: app_user_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.app_user ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.app_user_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log (
    id bigint NOT NULL,
    actor_user_id integer,
    actor_role_id integer,
    action text NOT NULL,
    permission_code text,
    entity text NOT NULL,
    entity_id text,
    payload jsonb,
    changes_diff jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: audit_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.audit_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: audit_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.audit_log_id_seq OWNED BY public.audit_log.id;


--
-- Name: auth_password; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auth_password (
    user_id integer NOT NULL,
    password_hash text NOT NULL,
    password_updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: auth_session; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auth_session (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id integer NOT NULL,
    role_id integer NOT NULL,
    token_hash text NOT NULL,
    user_agent text,
    ip inet,
    expires_at timestamp with time zone NOT NULL,
    revoked_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: client; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.client (
    id integer NOT NULL,
    first_name text NOT NULL,
    last_name text NOT NULL,
    name_parts text[] NOT NULL,
    gender_id smallint NOT NULL,
    dob date NOT NULL,
    ndis_number text NOT NULL,
    email text NOT NULL,
    phone_number text,
    address text NOT NULL,
    unit_building text,
    pricing_region text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deactivated_at timestamp with time zone,
    deleted_at timestamp with time zone
);


--
-- Name: client_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.client ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.client_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: gender; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gender (
    id smallint NOT NULL,
    code text NOT NULL,
    label text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deactivated_at timestamp with time zone
);


--
-- Name: gender_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.gender ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.gender_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: invoice; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoice (
    id integer NOT NULL,
    client_id integer,
    provider_id integer,
    invoice_number text,
    invoice_date date,
    amount numeric(24,4),
    expected_amount numeric(24,4),
    status text DEFAULT 'drafted'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT invoice_number_trimmed CHECK (((invoice_number IS NULL) OR (invoice_number = btrim(invoice_number)))),
    CONSTRAINT invoice_status_chk CHECK ((status = ANY (ARRAY['drafted'::text, 'completed'::text])))
);


--
-- Name: invoice_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.invoice ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.invoice_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: invoice_item; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoice_item (
    id integer NOT NULL,
    invoice_id integer NOT NULL,
    rate_set_id integer,
    category_id integer,
    support_item_id integer,
    start_date timestamp with time zone,
    end_date timestamp with time zone,
    max_rate numeric(24,4),
    unit numeric(24,4),
    input_rate numeric(24,4),
    amount numeric(24,4),
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: invoice_item_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.invoice_item ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.invoice_item_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: invoice_upload_batch; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoice_upload_batch (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    uploaded_by integer NOT NULL,
    status text DEFAULT 'uploading'::text NOT NULL,
    file_count integer NOT NULL,
    total_size bigint NOT NULL,
    error_message text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT invoice_upload_batch_file_count_chk CHECK (((file_count >= 1) AND (file_count <= 20))),
    CONSTRAINT invoice_upload_batch_status_check CHECK ((status = ANY (ARRAY['uploading'::text, 'uploaded'::text, 'processing'::text, 'completed'::text, 'completed_with_errors'::text, 'failed'::text]))),
    CONSTRAINT invoice_upload_batch_total_size_chk CHECK (((total_size >= 1) AND (total_size <= 20971520)))
);


--
-- Name: invoice_upload_file; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoice_upload_file (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    batch_id uuid NOT NULL,
    original_name text NOT NULL,
    object_key text NOT NULL,
    content_type text NOT NULL,
    size bigint NOT NULL,
    etag text NOT NULL,
    processing_status text DEFAULT 'queued'::text NOT NULL,
    attempt_count integer DEFAULT 0 NOT NULL,
    error_message text,
    warnings jsonb DEFAULT '[]'::jsonb NOT NULL,
    extraction_result jsonb,
    invoice_id integer,
    ai_provider text,
    model text,
    prompt_tokens integer,
    completion_tokens integer,
    total_tokens integer,
    processing_started_at timestamp with time zone,
    processing_completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT invoice_upload_file_ai_provider_check CHECK (((ai_provider IS NULL) OR (ai_provider = ANY (ARRAY['openai'::text, 'openrouter'::text])))),
    CONSTRAINT invoice_upload_file_processing_status_check CHECK ((processing_status = ANY (ARRAY['queued'::text, 'processing'::text, 'draft_created'::text, 'needs_review'::text, 'failed'::text]))),
    CONSTRAINT invoice_upload_file_size_chk CHECK (((size >= 1) AND (size <= 10485760)))
);


--
-- Name: kysely_migration; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.kysely_migration (
    name character varying(255) NOT NULL,
    "timestamp" character varying(255) NOT NULL
);


--
-- Name: kysely_migration_lock; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.kysely_migration_lock (
    id character varying(255) NOT NULL,
    is_locked integer DEFAULT 0 NOT NULL
);


--
-- Name: provider; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.provider (
    id integer NOT NULL,
    abn text NOT NULL,
    name text NOT NULL,
    name_parts text[] NOT NULL,
    email text,
    phone_number text,
    address text,
    unit_building text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deactivated_at timestamp with time zone,
    deleted_at timestamp with time zone
);


--
-- Name: provider_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.provider ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.provider_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: rate_set; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rate_set (
    id integer NOT NULL,
    name text NOT NULL,
    description text,
    start_date timestamp with time zone NOT NULL,
    end_date timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deactivated_at timestamp with time zone,
    deleted_at timestamp with time zone,
    CONSTRAINT rate_set_valid_range_chk CHECK (((end_date IS NULL) OR (start_date <= end_date)))
);


--
-- Name: rate_set_category; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rate_set_category (
    id integer NOT NULL,
    rate_set_id integer NOT NULL,
    category_number text NOT NULL,
    category_name text NOT NULL,
    sorting integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deactivated_at timestamp with time zone,
    deleted_at timestamp with time zone
);


--
-- Name: rate_set_category_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.rate_set_category ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.rate_set_category_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: rate_set_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.rate_set ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.rate_set_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: rate_set_support_item; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rate_set_support_item (
    id integer NOT NULL,
    rate_set_id integer NOT NULL,
    category_id integer NOT NULL,
    item_number text NOT NULL,
    item_name text NOT NULL,
    unit text,
    sorting integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deactivated_at timestamp with time zone,
    deleted_at timestamp with time zone
);


--
-- Name: rate_set_support_item_attribute; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rate_set_support_item_attribute (
    id integer NOT NULL,
    support_item_id integer NOT NULL,
    attribute_code text NOT NULL,
    value boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: rate_set_support_item_attribute_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.rate_set_support_item_attribute ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.rate_set_support_item_attribute_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: rate_set_support_item_attribute_type; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rate_set_support_item_attribute_type (
    code text NOT NULL,
    label text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deactivated_at timestamp with time zone
);


--
-- Name: rate_set_support_item_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.rate_set_support_item ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.rate_set_support_item_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: rate_set_support_item_price; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rate_set_support_item_price (
    id integer NOT NULL,
    rate_set_id integer NOT NULL,
    support_item_id integer NOT NULL,
    type_id integer,
    pricing_region_code text,
    unit_price numeric(24,4),
    start_date timestamp with time zone NOT NULL,
    end_date timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: rate_set_support_item_price_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.rate_set_support_item_price ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.rate_set_support_item_price_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: rate_set_support_item_pricing_region; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rate_set_support_item_pricing_region (
    code text NOT NULL,
    label text NOT NULL,
    full_label text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deactivated_at timestamp with time zone
);


--
-- Name: rate_set_support_item_type; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rate_set_support_item_type (
    id integer NOT NULL,
    code text NOT NULL,
    label text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deactivated_at timestamp with time zone
);


--
-- Name: rate_set_support_item_type_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.rate_set_support_item_type ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.rate_set_support_item_type_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: rbac_permission; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rbac_permission (
    id integer NOT NULL,
    code text NOT NULL,
    label text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: rbac_permission_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.rbac_permission ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.rbac_permission_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: rbac_role; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rbac_role (
    id integer NOT NULL,
    code text NOT NULL,
    label text NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deactivated_at timestamp with time zone
);


--
-- Name: rbac_role_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.rbac_role ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.rbac_role_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: rbac_user_role; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rbac_user_role (
    user_id integer NOT NULL,
    role_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: rbac_user_role_permission; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rbac_user_role_permission (
    role_id integer NOT NULL,
    permission_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: audit_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log ALTER COLUMN id SET DEFAULT nextval('public.audit_log_id_seq'::regclass);


--
-- Name: app_user app_user_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_user
    ADD CONSTRAINT app_user_pkey PRIMARY KEY (id);


--
-- Name: audit_log audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);


--
-- Name: auth_password auth_password_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_password
    ADD CONSTRAINT auth_password_pkey PRIMARY KEY (user_id);


--
-- Name: auth_session auth_session_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_session
    ADD CONSTRAINT auth_session_pkey PRIMARY KEY (id);


--
-- Name: auth_session auth_session_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_session
    ADD CONSTRAINT auth_session_token_hash_key UNIQUE (token_hash);


--
-- Name: client client_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client
    ADD CONSTRAINT client_pkey PRIMARY KEY (id);


--
-- Name: gender gender_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gender
    ADD CONSTRAINT gender_code_key UNIQUE (code);


--
-- Name: gender gender_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gender
    ADD CONSTRAINT gender_pkey PRIMARY KEY (id);


--
-- Name: invoice_item invoice_item_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_item
    ADD CONSTRAINT invoice_item_pkey PRIMARY KEY (id);


--
-- Name: invoice invoice_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice
    ADD CONSTRAINT invoice_pkey PRIMARY KEY (id);


--
-- Name: invoice_upload_batch invoice_upload_batch_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_upload_batch
    ADD CONSTRAINT invoice_upload_batch_pkey PRIMARY KEY (id);


--
-- Name: invoice_upload_file invoice_upload_file_object_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_upload_file
    ADD CONSTRAINT invoice_upload_file_object_key_key UNIQUE (object_key);


--
-- Name: invoice_upload_file invoice_upload_file_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_upload_file
    ADD CONSTRAINT invoice_upload_file_pkey PRIMARY KEY (id);


--
-- Name: kysely_migration_lock kysely_migration_lock_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kysely_migration_lock
    ADD CONSTRAINT kysely_migration_lock_pkey PRIMARY KEY (id);


--
-- Name: kysely_migration kysely_migration_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kysely_migration
    ADD CONSTRAINT kysely_migration_pkey PRIMARY KEY (name);


--
-- Name: provider provider_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider
    ADD CONSTRAINT provider_pkey PRIMARY KEY (id);


--
-- Name: rate_set_category rate_set_category_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_set_category
    ADD CONSTRAINT rate_set_category_pkey PRIMARY KEY (id);


--
-- Name: rate_set rate_set_no_overlap_excl; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_set
    ADD CONSTRAINT rate_set_no_overlap_excl EXCLUDE USING gist (tstzrange(start_date, COALESCE(end_date, 'infinity'::timestamp with time zone), '[]'::text) WITH &&) WHERE ((deleted_at IS NULL));


--
-- Name: rate_set rate_set_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_set
    ADD CONSTRAINT rate_set_pkey PRIMARY KEY (id);


--
-- Name: rate_set_support_item_attribute rate_set_support_item_attribute_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_set_support_item_attribute
    ADD CONSTRAINT rate_set_support_item_attribute_pkey PRIMARY KEY (id);


--
-- Name: rate_set_support_item_attribute_type rate_set_support_item_attribute_type_label_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_set_support_item_attribute_type
    ADD CONSTRAINT rate_set_support_item_attribute_type_label_key UNIQUE (label);


--
-- Name: rate_set_support_item_attribute_type rate_set_support_item_attribute_type_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_set_support_item_attribute_type
    ADD CONSTRAINT rate_set_support_item_attribute_type_pkey PRIMARY KEY (code);


--
-- Name: rate_set_support_item rate_set_support_item_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_set_support_item
    ADD CONSTRAINT rate_set_support_item_pkey PRIMARY KEY (id);


--
-- Name: rate_set_support_item_price rate_set_support_item_price_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_set_support_item_price
    ADD CONSTRAINT rate_set_support_item_price_pkey PRIMARY KEY (id);


--
-- Name: rate_set_support_item_pricing_region rate_set_support_item_pricing_region_label_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_set_support_item_pricing_region
    ADD CONSTRAINT rate_set_support_item_pricing_region_label_key UNIQUE (label);


--
-- Name: rate_set_support_item_pricing_region rate_set_support_item_pricing_region_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_set_support_item_pricing_region
    ADD CONSTRAINT rate_set_support_item_pricing_region_pkey PRIMARY KEY (code);


--
-- Name: rate_set_support_item_type rate_set_support_item_type_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_set_support_item_type
    ADD CONSTRAINT rate_set_support_item_type_code_key UNIQUE (code);


--
-- Name: rate_set_support_item_type rate_set_support_item_type_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_set_support_item_type
    ADD CONSTRAINT rate_set_support_item_type_pkey PRIMARY KEY (id);


--
-- Name: rbac_permission rbac_permission_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rbac_permission
    ADD CONSTRAINT rbac_permission_code_key UNIQUE (code);


--
-- Name: rbac_permission rbac_permission_label_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rbac_permission
    ADD CONSTRAINT rbac_permission_label_key UNIQUE (label);


--
-- Name: rbac_permission rbac_permission_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rbac_permission
    ADD CONSTRAINT rbac_permission_pkey PRIMARY KEY (id);


--
-- Name: rbac_role rbac_role_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rbac_role
    ADD CONSTRAINT rbac_role_code_key UNIQUE (code);


--
-- Name: rbac_role rbac_role_label_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rbac_role
    ADD CONSTRAINT rbac_role_label_key UNIQUE (label);


--
-- Name: rbac_role rbac_role_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rbac_role
    ADD CONSTRAINT rbac_role_pkey PRIMARY KEY (id);


--
-- Name: rbac_user_role_permission rbac_user_role_permission_pk; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rbac_user_role_permission
    ADD CONSTRAINT rbac_user_role_permission_pk PRIMARY KEY (role_id, permission_id);


--
-- Name: rbac_user_role rbac_user_role_pk; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rbac_user_role
    ADD CONSTRAINT rbac_user_role_pk PRIMARY KEY (user_id, role_id);


--
-- Name: rate_set_support_item_attribute rssia_support_item_attribute_code_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_set_support_item_attribute
    ADD CONSTRAINT rssia_support_item_attribute_code_uq UNIQUE (support_item_id, attribute_code);


--
-- Name: rate_set_support_item_price rssip_unique_uq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_set_support_item_price
    ADD CONSTRAINT rssip_unique_uq UNIQUE (rate_set_id, support_item_id, type_id, pricing_region_code, start_date, end_date);


--
-- Name: app_user_unique_email_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX app_user_unique_email_idx ON public.app_user USING btree (email) WHERE (deleted_at IS NULL);


--
-- Name: audit_log_action_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_log_action_idx ON public.audit_log USING btree (action);


--
-- Name: audit_log_actor_role_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_log_actor_role_id_idx ON public.audit_log USING btree (actor_role_id);


--
-- Name: audit_log_actor_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_log_actor_user_id_idx ON public.audit_log USING btree (actor_user_id);


--
-- Name: audit_log_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_log_created_at_idx ON public.audit_log USING btree (created_at);


--
-- Name: audit_log_permission_code_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_log_permission_code_idx ON public.audit_log USING btree (permission_code);


--
-- Name: auth_session_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX auth_session_active_idx ON public.auth_session USING btree (user_id, expires_at) WHERE (revoked_at IS NULL);


--
-- Name: auth_session_expires_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX auth_session_expires_at_idx ON public.auth_session USING btree (expires_at);


--
-- Name: auth_session_role_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX auth_session_role_id_idx ON public.auth_session USING btree (role_id);


--
-- Name: auth_session_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX auth_session_user_id_idx ON public.auth_session USING btree (user_id);


--
-- Name: client_name_parts; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX client_name_parts ON public.client USING gin (name_parts) WHERE (deleted_at IS NULL);


--
-- Name: client_unique_ndis_number; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX client_unique_ndis_number ON public.client USING btree (ndis_number) WHERE (deleted_at IS NULL);


--
-- Name: invoice_client_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX invoice_client_id ON public.invoice USING btree (client_id);


--
-- Name: invoice_item_category_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX invoice_item_category_id ON public.invoice_item USING btree (category_id);


--
-- Name: invoice_item_invoice_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX invoice_item_invoice_id ON public.invoice_item USING btree (invoice_id);


--
-- Name: invoice_item_invoice_sort_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX invoice_item_invoice_sort_order ON public.invoice_item USING btree (invoice_id, sort_order, id);


--
-- Name: invoice_item_rate_set_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX invoice_item_rate_set_id ON public.invoice_item USING btree (rate_set_id);


--
-- Name: invoice_item_support_item_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX invoice_item_support_item_id ON public.invoice_item USING btree (support_item_id);


--
-- Name: invoice_provider_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX invoice_provider_id ON public.invoice USING btree (provider_id);


--
-- Name: invoice_unique_provider_invoice_number; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX invoice_unique_provider_invoice_number ON public.invoice USING btree (provider_id, lower(invoice_number)) WHERE ((deleted_at IS NULL) AND (provider_id IS NOT NULL) AND (invoice_number IS NOT NULL));


--
-- Name: invoice_unique_unmapped_invoice_number; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX invoice_unique_unmapped_invoice_number ON public.invoice USING btree (lower(invoice_number)) WHERE ((deleted_at IS NULL) AND (provider_id IS NULL) AND (invoice_number IS NOT NULL));


--
-- Name: invoice_upload_batch_uploaded_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX invoice_upload_batch_uploaded_by ON public.invoice_upload_batch USING btree (uploaded_by);


--
-- Name: invoice_upload_file_batch_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX invoice_upload_file_batch_id ON public.invoice_upload_file USING btree (batch_id);


--
-- Name: invoice_upload_file_invoice_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX invoice_upload_file_invoice_id ON public.invoice_upload_file USING btree (invoice_id);


--
-- Name: invoice_upload_file_processing_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX invoice_upload_file_processing_status ON public.invoice_upload_file USING btree (processing_status);


--
-- Name: provider_name_parts; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX provider_name_parts ON public.provider USING gin (name_parts) WHERE (deleted_at IS NULL);


--
-- Name: rbac_user_role_permission_permission_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rbac_user_role_permission_permission_idx ON public.rbac_user_role_permission USING btree (permission_id);


--
-- Name: rbac_user_role_role_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rbac_user_role_role_idx ON public.rbac_user_role USING btree (role_id);


--
-- Name: rsc_category_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rsc_category_id ON public.rate_set_category USING btree (rate_set_id);


--
-- Name: rsc_unique1_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX rsc_unique1_idx ON public.rate_set_category USING btree (rate_set_id, category_number) WHERE (deleted_at IS NULL);


--
-- Name: rssi_category_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rssi_category_id ON public.rate_set_support_item USING btree (category_id);


--
-- Name: rssi_rate_set_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rssi_rate_set_id ON public.rate_set_support_item USING btree (rate_set_id);


--
-- Name: rssi_unique1_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX rssi_unique1_idx ON public.rate_set_support_item USING btree (rate_set_id, category_id, item_number) WHERE (deleted_at IS NULL);


--
-- Name: rssia_attribute_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rssia_attribute_code ON public.rate_set_support_item_attribute USING btree (attribute_code);


--
-- Name: rssia_category_support_item_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rssia_category_support_item_id ON public.rate_set_support_item_attribute USING btree (support_item_id);


--
-- Name: rssip_category_support_item_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rssip_category_support_item_id ON public.rate_set_support_item_price USING btree (support_item_id);


--
-- Name: client client_set_name_parts; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER client_set_name_parts BEFORE INSERT OR UPDATE OF first_name, last_name ON public.client FOR EACH ROW EXECUTE FUNCTION public.client_set_name_parts();


--
-- Name: provider provider_set_name_parts; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER provider_set_name_parts BEFORE INSERT OR UPDATE OF name ON public.provider FOR EACH ROW EXECUTE FUNCTION public.provider_set_name_parts();


--
-- Name: audit_log audit_log_actor_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_actor_role_id_fkey FOREIGN KEY (actor_role_id) REFERENCES public.rbac_role(id);


--
-- Name: audit_log audit_log_actor_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES public.app_user(id);


--
-- Name: audit_log audit_log_permission_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_permission_code_fkey FOREIGN KEY (permission_code) REFERENCES public.rbac_permission(code);


--
-- Name: auth_password auth_password_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_password
    ADD CONSTRAINT auth_password_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.app_user(id) ON DELETE CASCADE;


--
-- Name: auth_session auth_session_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_session
    ADD CONSTRAINT auth_session_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.rbac_role(id) ON DELETE CASCADE;


--
-- Name: auth_session auth_session_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_session
    ADD CONSTRAINT auth_session_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.app_user(id) ON DELETE CASCADE;


--
-- Name: client client_gender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client
    ADD CONSTRAINT client_gender_id_fkey FOREIGN KEY (gender_id) REFERENCES public.gender(id);


--
-- Name: client client_pricing_region_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client
    ADD CONSTRAINT client_pricing_region_fkey FOREIGN KEY (pricing_region) REFERENCES public.rate_set_support_item_pricing_region(code);


--
-- Name: invoice invoice_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice
    ADD CONSTRAINT invoice_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.client(id);


--
-- Name: invoice_item invoice_item_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_item
    ADD CONSTRAINT invoice_item_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.rate_set_category(id);


--
-- Name: invoice_item invoice_item_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_item
    ADD CONSTRAINT invoice_item_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoice(id);


--
-- Name: invoice_item invoice_item_rate_set_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_item
    ADD CONSTRAINT invoice_item_rate_set_id_fkey FOREIGN KEY (rate_set_id) REFERENCES public.rate_set(id);


--
-- Name: invoice_item invoice_item_support_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_item
    ADD CONSTRAINT invoice_item_support_item_id_fkey FOREIGN KEY (support_item_id) REFERENCES public.rate_set_support_item(id);


--
-- Name: invoice invoice_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice
    ADD CONSTRAINT invoice_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.provider(id);


--
-- Name: invoice_upload_batch invoice_upload_batch_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_upload_batch
    ADD CONSTRAINT invoice_upload_batch_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.app_user(id);


--
-- Name: invoice_upload_file invoice_upload_file_batch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_upload_file
    ADD CONSTRAINT invoice_upload_file_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.invoice_upload_batch(id) ON DELETE CASCADE;


--
-- Name: invoice_upload_file invoice_upload_file_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_upload_file
    ADD CONSTRAINT invoice_upload_file_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoice(id) ON DELETE SET NULL;


--
-- Name: rate_set_category rate_set_category_rate_set_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_set_category
    ADD CONSTRAINT rate_set_category_rate_set_id_fkey FOREIGN KEY (rate_set_id) REFERENCES public.rate_set(id);


--
-- Name: rate_set_support_item_attribute rate_set_support_item_attribute_attribute_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_set_support_item_attribute
    ADD CONSTRAINT rate_set_support_item_attribute_attribute_code_fkey FOREIGN KEY (attribute_code) REFERENCES public.rate_set_support_item_attribute_type(code);


--
-- Name: rate_set_support_item_attribute rate_set_support_item_attribute_support_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_set_support_item_attribute
    ADD CONSTRAINT rate_set_support_item_attribute_support_item_id_fkey FOREIGN KEY (support_item_id) REFERENCES public.rate_set_support_item(id);


--
-- Name: rate_set_support_item rate_set_support_item_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_set_support_item
    ADD CONSTRAINT rate_set_support_item_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.rate_set_category(id);


--
-- Name: rate_set_support_item_price rate_set_support_item_price_pricing_region_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_set_support_item_price
    ADD CONSTRAINT rate_set_support_item_price_pricing_region_code_fkey FOREIGN KEY (pricing_region_code) REFERENCES public.rate_set_support_item_pricing_region(code);


--
-- Name: rate_set_support_item_price rate_set_support_item_price_rate_set_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_set_support_item_price
    ADD CONSTRAINT rate_set_support_item_price_rate_set_id_fkey FOREIGN KEY (rate_set_id) REFERENCES public.rate_set(id);


--
-- Name: rate_set_support_item_price rate_set_support_item_price_support_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_set_support_item_price
    ADD CONSTRAINT rate_set_support_item_price_support_item_id_fkey FOREIGN KEY (support_item_id) REFERENCES public.rate_set_support_item(id);


--
-- Name: rate_set_support_item_price rate_set_support_item_price_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_set_support_item_price
    ADD CONSTRAINT rate_set_support_item_price_type_id_fkey FOREIGN KEY (type_id) REFERENCES public.rate_set_support_item_type(id);


--
-- Name: rate_set_support_item rate_set_support_item_rate_set_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_set_support_item
    ADD CONSTRAINT rate_set_support_item_rate_set_id_fkey FOREIGN KEY (rate_set_id) REFERENCES public.rate_set(id);


--
-- Name: rbac_user_role_permission rbac_user_role_permission_permission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rbac_user_role_permission
    ADD CONSTRAINT rbac_user_role_permission_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES public.rbac_permission(id) ON DELETE CASCADE;


--
-- Name: rbac_user_role_permission rbac_user_role_permission_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rbac_user_role_permission
    ADD CONSTRAINT rbac_user_role_permission_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.rbac_role(id) ON DELETE CASCADE;


--
-- Name: rbac_user_role rbac_user_role_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rbac_user_role
    ADD CONSTRAINT rbac_user_role_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.rbac_role(id) ON DELETE CASCADE;


--
-- Name: rbac_user_role rbac_user_role_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rbac_user_role
    ADD CONSTRAINT rbac_user_role_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.app_user(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict ON0K8HbcIBc9vmNQNNDKrnTNTCtoVZFops7EibFmbT7NJSzFhVNfvA67NU6TN6p

