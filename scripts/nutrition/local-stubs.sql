-- ============================================================
-- LOCAL DRY RUNS ONLY — never run this against a Supabase project.
--
-- Minimal stand-ins for the platform objects the 20260905* nutrition
-- migrations reference (roles, auth/storage/extensions schemas, app RPCs,
-- and the three tables verify_checkin touches), so the migrations can be
-- applied to a throwaway Homebrew Postgres without Docker / `supabase start`.
--
-- One-time (needs a real server; the `libpq` keg has no `postgres` binary):
--   brew install postgresql@17          # ships pg_trgm + unaccent
--   export PATH=/opt/homebrew/opt/postgresql@17/bin:$PATH
-- Cluster (scratch dir of your choice, port 5499, unix socket in /tmp):
--   initdb -D "$PGDATA" -U postgres --auth=trust
--   pg_ctl -D "$PGDATA" -o "-p 5499 -k /tmp" -l "$PGDATA/../pg.log" start
-- Fresh database + stubs + migrations + checks (run from the repo root):
--   psql -h /tmp -p 5499 -U postgres -c 'DROP DATABASE IF EXISTS wf' -c 'CREATE DATABASE wf'
--   psql -h /tmp -p 5499 -U postgres -d wf -v ON_ERROR_STOP=1 -f scripts/nutrition/local-stubs.sql
--   for f in supabase/migrations/20260905*.sql; do psql -h /tmp -p 5499 -U postgres -d wf -v ON_ERROR_STOP=1 -f "$f" || break; done
--   for f in contract-check calc-check rls-check; do psql -h /tmp -p 5499 -U postgres -d wf -v ON_ERROR_STOP=1 -f scripts/nutrition/$f.sql || break; done
--   pg_ctl -D "$PGDATA" stop
-- ============================================================

-- ---------- roles ----------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')          THEN CREATE ROLE anon          NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role')  THEN CREATE ROLE service_role  NOLOGIN BYPASSRLS; END IF;
END $$;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- Supabase grants ALL on every new public table/function/sequence to these roles
-- (this repo's own tables carry no GRANTs and rely on it). Mirror it so the RLS
-- checks exercise policies, not merely missing grants.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES    TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;

-- ---------- extensions schema (the migration runs CREATE EXTENSION itself) ----------
CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO anon, authenticated, service_role;

-- ---------- auth ----------
CREATE SCHEMA IF NOT EXISTS auth;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
CREATE TABLE IF NOT EXISTS auth.users (id uuid PRIMARY KEY, email text);
GRANT SELECT ON auth.users TO anon, authenticated, service_role;

-- Same shape as Supabase's: reads request.jwt.claims set via
--   SET LOCAL request.jwt.claims = '{"sub":"<uuid>","role":"authenticated"}';
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
  )::uuid
$$;
CREATE OR REPLACE FUNCTION auth.role() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'
  )
$$;

-- ---------- storage ----------
CREATE SCHEMA IF NOT EXISTS storage;
GRANT USAGE ON SCHEMA storage TO anon, authenticated, service_role;
CREATE TABLE IF NOT EXISTS storage.buckets (
  id text PRIMARY KEY, name text, public boolean DEFAULT false,
  file_size_limit bigint, allowed_mime_types text[]
);
CREATE TABLE IF NOT EXISTS storage.objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id text, name text, owner uuid, created_at timestamptz DEFAULT now()
);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
GRANT ALL ON storage.buckets, storage.objects TO anon, authenticated, service_role;

-- Supabase's implementation: path segments minus the file name.
CREATE OR REPLACE FUNCTION storage.foldername(name text) RETURNS text[]
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE _parts text[];
BEGIN
  SELECT string_to_array(name, '/') INTO _parts;
  RETURN _parts[1:array_length(_parts, 1) - 1];
END $$;

-- ---------- app RPCs the engine calls ----------
CREATE OR REPLACE FUNCTION public.has_active_access(_user_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER AS $$ SELECT true $$;
CREATE OR REPLACE FUNCTION public.bump_ai_usage(p_limit int, p_kind text DEFAULT 'coach') RETURNS boolean
LANGUAGE sql SECURITY DEFINER AS $$ SELECT true $$;
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER AS $$ SELECT false $$;

-- ---------- tables verify_checkin (20260905100600) reads/writes ----------
-- Only the columns it touches; types copied from the original migrations.
CREATE TABLE IF NOT EXISTS public.profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  xp int NOT NULL DEFAULT 0,
  level int NOT NULL DEFAULT 1,
  is_elite boolean NOT NULL DEFAULT false,
  membership_credits_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.daily_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sleep_hours numeric(3,1) NOT NULL DEFAULT 0,
  workout boolean NOT NULL DEFAULT false,
  protein_intake boolean NOT NULL DEFAULT false,
  meditation_morning boolean NOT NULL DEFAULT false,
  meditation_evening boolean NOT NULL DEFAULT false,
  checked_in_at timestamptz NOT NULL DEFAULT now(),
  verified_at timestamptz,
  verified_signals jsonb,
  verified_bonus_xp int NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS public.health_sync_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  snapshot_date date NOT NULL,
  steps int,
  workout_minutes int,
  workout_count int,
  sleep_hours numeric(4,2),
  mindful_minutes int,
  UNIQUE (user_id, snapshot_date)
);
