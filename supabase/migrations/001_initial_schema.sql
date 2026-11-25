-- Reference PostgreSQL & Row-Level Security (RLS) Migration
-- Note: Live runtime uses Drizzle ORM against Cloud SQL PostgreSQL (src/db/schema.ts).

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS research_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  project_name text NOT NULL,
  description text NOT NULL DEFAULT '',
  research_objective text NOT NULL DEFAULT '',
  region text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'active',
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS datasets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  file_name text NOT NULL,
  storage_path text NOT NULL,
  file_format text NOT NULL,
  file_size integer NOT NULL,
  record_count integer NOT NULL DEFAULT 0,
  sample_type text NOT NULL,
  sampling_location text NOT NULL DEFAULT '',
  collection_date text NOT NULL,
  latitude double precision,
  longitude double precision,
  processing_status text NOT NULL DEFAULT 'uploaded',
  created_at timestamp NOT NULL DEFAULT now()
);

-- Example RLS Policies for Supabase / Multi-Tenant PostgreSQL deployments
ALTER TABLE research_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE datasets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own projects" ON research_projects
  FOR ALL USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users manage own datasets" ON datasets
  FOR ALL USING (auth.uid()::text = user_id::text);
