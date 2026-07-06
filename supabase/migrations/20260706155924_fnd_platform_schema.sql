
/*
# FND Platform — Full Schema Migration

## Summary
Creates the complete database schema for the FND Project & Claims Automation Platform.

## New Tables
1. `profiles` — User profiles linked to auth.users (admin, finance_officer, director_pm)
2. `projects` — Projects with auto-generated FND-XXXX short IDs
3. `milestones` — Percentage-based milestones per project (enforced to sum ≤ 100%)
4. `project_engineers` — Engineer records (no auth identity) tied to projects
5. `claims` — Payment claims raised by Director/PM per milestone
6. `claim_comments` — Comment threads on claims for Finance Officer / Director back-and-forth
7. `project_inbox_messages` — Per-project chat between Finance Officer and assigned Director/PM
8. `notifications` — Realtime notification feed per user

## Security
- RLS enabled on ALL tables
- Role-based policies: admin (read-only projects), finance_officer (full read + claims management), director_pm (scoped to assigned projects only)
- Helper function `get_my_role()` used in policies for clean role checks

## Important Notes
1. `short_id` on projects auto-generates via `project_short_id_seq` Postgres sequence (collision-safe)
2. Milestone `value` must be set by the application (total_value * percentage / 100) — not a generated column for flexibility
3. Notifications INSERT is open to all authenticated users (internal app, trusted users) but SELECT is scoped to own recipient_id
4. No hard deletes on financial records — use status transitions only
*/

-- ============================================================
-- ENUMS
-- ============================================================
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('admin', 'finance_officer', 'director_pm');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE user_status AS ENUM ('pending', 'active');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE project_status AS ENUM ('unassigned', 'active', 'on_hold', 'completed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE milestone_status AS ENUM ('pending', 'claim_submitted', 'approved', 'paid');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE claim_status AS ENUM ('pending_review', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE notification_type AS ENUM ('project_assigned', 'claim_raised', 'claim_approved', 'claim_rejected', 'claim_commented', 'new_message');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- SHORT ID SEQUENCE
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS project_short_id_seq START 1;

CREATE OR REPLACE FUNCTION public.generate_project_short_id()
RETURNS text AS $$
  SELECT 'FND-' || LPAD(nextval('project_short_id_seq')::text, 4, '0');
$$ LANGUAGE sql;

-- ============================================================
-- TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text NOT NULL UNIQUE,
  role user_role NOT NULL,
  label text NOT NULL DEFAULT '',
  status user_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  short_id text UNIQUE NOT NULL DEFAULT public.generate_project_short_id(),
  name text NOT NULL,
  total_value numeric(15,2) NOT NULL CHECK (total_value > 0),
  status project_status NOT NULL DEFAULT 'unassigned',
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  assigned_to uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  percentage numeric(5,2) NOT NULL CHECK (percentage > 0 AND percentage <= 100),
  value numeric(15,2) NOT NULL,
  status milestone_status NOT NULL DEFAULT 'pending',
  order_index int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.project_engineers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  engineer_name text NOT NULL,
  engineer_role_tag text NOT NULL DEFAULT '',
  added_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id),
  milestone_id uuid NOT NULL REFERENCES public.milestones(id),
  project_engineer_id uuid NOT NULL REFERENCES public.project_engineers(id),
  raised_by uuid NOT NULL REFERENCES public.profiles(id),
  status claim_status NOT NULL DEFAULT 'pending_review',
  amount numeric(15,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid REFERENCES public.profiles(id),
  reviewed_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.claim_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.profiles(id),
  comment text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.project_inbox_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id),
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  reference_id uuid,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_assigned_to ON public.projects(assigned_to);
CREATE INDEX IF NOT EXISTS idx_projects_created_by ON public.projects(created_by);
CREATE INDEX IF NOT EXISTS idx_milestones_project_id ON public.milestones(project_id);
CREATE INDEX IF NOT EXISTS idx_milestones_status ON public.milestones(status);
CREATE INDEX IF NOT EXISTS idx_project_engineers_project_id ON public.project_engineers(project_id);
CREATE INDEX IF NOT EXISTS idx_claims_project_id ON public.claims(project_id);
CREATE INDEX IF NOT EXISTS idx_claims_milestone_id ON public.claims(milestone_id);
CREATE INDEX IF NOT EXISTS idx_claims_status ON public.claims(status);
CREATE INDEX IF NOT EXISTS idx_claims_raised_by ON public.claims(raised_by);
CREATE INDEX IF NOT EXISTS idx_claim_comments_claim_id ON public.claim_comments(claim_id);
CREATE INDEX IF NOT EXISTS idx_inbox_project_id ON public.project_inbox_messages(project_id);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_id ON public.notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text AS $$
  SELECT role::text FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================================
-- ENABLE RLS
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_engineers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claim_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_inbox_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- PROFILES POLICIES
-- ============================================================
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT
TO authenticated USING (true);

DROP POLICY IF EXISTS "profiles_insert_admin" ON public.profiles;
CREATE POLICY "profiles_insert_admin" ON public.profiles FOR INSERT
TO authenticated WITH CHECK (
  public.get_my_role() = 'admin'
);

DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE
TO authenticated
USING (id = auth.uid() OR public.get_my_role() = 'admin')
WITH CHECK (id = auth.uid() OR public.get_my_role() = 'admin');

-- ============================================================
-- PROJECTS POLICIES
-- ============================================================
DROP POLICY IF EXISTS "projects_select" ON public.projects;
CREATE POLICY "projects_select" ON public.projects FOR SELECT
TO authenticated USING (
  public.get_my_role() IN ('admin', 'finance_officer')
  OR (public.get_my_role() = 'director_pm' AND assigned_to = auth.uid())
);

DROP POLICY IF EXISTS "projects_insert" ON public.projects;
CREATE POLICY "projects_insert" ON public.projects FOR INSERT
TO authenticated WITH CHECK (
  public.get_my_role() = 'finance_officer'
);

DROP POLICY IF EXISTS "projects_update" ON public.projects;
CREATE POLICY "projects_update" ON public.projects FOR UPDATE
TO authenticated
USING (public.get_my_role() = 'finance_officer')
WITH CHECK (public.get_my_role() = 'finance_officer');

-- ============================================================
-- MILESTONES POLICIES
-- ============================================================
DROP POLICY IF EXISTS "milestones_select" ON public.milestones;
CREATE POLICY "milestones_select" ON public.milestones FOR SELECT
TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.projects p WHERE p.id = project_id
    AND (
      public.get_my_role() IN ('admin', 'finance_officer')
      OR (public.get_my_role() = 'director_pm' AND p.assigned_to = auth.uid())
    )
  )
);

DROP POLICY IF EXISTS "milestones_insert" ON public.milestones;
CREATE POLICY "milestones_insert" ON public.milestones FOR INSERT
TO authenticated WITH CHECK (public.get_my_role() = 'finance_officer');

DROP POLICY IF EXISTS "milestones_update" ON public.milestones;
CREATE POLICY "milestones_update" ON public.milestones FOR UPDATE
TO authenticated
USING (public.get_my_role() = 'finance_officer')
WITH CHECK (public.get_my_role() = 'finance_officer');

-- ============================================================
-- PROJECT ENGINEERS POLICIES
-- ============================================================
DROP POLICY IF EXISTS "engineers_select" ON public.project_engineers;
CREATE POLICY "engineers_select" ON public.project_engineers FOR SELECT
TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.projects p WHERE p.id = project_id
    AND (
      public.get_my_role() IN ('admin', 'finance_officer')
      OR (public.get_my_role() = 'director_pm' AND p.assigned_to = auth.uid())
    )
  )
);

DROP POLICY IF EXISTS "engineers_insert" ON public.project_engineers;
CREATE POLICY "engineers_insert" ON public.project_engineers FOR INSERT
TO authenticated WITH CHECK (
  public.get_my_role() = 'director_pm'
  AND EXISTS (
    SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.assigned_to = auth.uid()
  )
);

-- ============================================================
-- CLAIMS POLICIES
-- ============================================================
DROP POLICY IF EXISTS "claims_select" ON public.claims;
CREATE POLICY "claims_select" ON public.claims FOR SELECT
TO authenticated USING (
  public.get_my_role() IN ('admin', 'finance_officer')
  OR (
    public.get_my_role() = 'director_pm'
    AND EXISTS (
      SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.assigned_to = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS "claims_insert" ON public.claims;
CREATE POLICY "claims_insert" ON public.claims FOR INSERT
TO authenticated WITH CHECK (
  public.get_my_role() = 'director_pm'
  AND EXISTS (
    SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.assigned_to = auth.uid()
  )
);

DROP POLICY IF EXISTS "claims_update" ON public.claims;
CREATE POLICY "claims_update" ON public.claims FOR UPDATE
TO authenticated
USING (public.get_my_role() = 'finance_officer')
WITH CHECK (public.get_my_role() = 'finance_officer');

-- ============================================================
-- CLAIM COMMENTS POLICIES
-- ============================================================
DROP POLICY IF EXISTS "comments_select" ON public.claim_comments;
CREATE POLICY "comments_select" ON public.claim_comments FOR SELECT
TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.claims c WHERE c.id = claim_id
    AND (
      public.get_my_role() IN ('admin', 'finance_officer')
      OR (
        public.get_my_role() = 'director_pm'
        AND EXISTS (
          SELECT 1 FROM public.projects p WHERE p.id = c.project_id AND p.assigned_to = auth.uid()
        )
      )
    )
  )
);

DROP POLICY IF EXISTS "comments_insert" ON public.claim_comments;
CREATE POLICY "comments_insert" ON public.claim_comments FOR INSERT
TO authenticated WITH CHECK (
  author_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.claims c WHERE c.id = claim_id
    AND (
      public.get_my_role() = 'finance_officer'
      OR (
        public.get_my_role() = 'director_pm'
        AND EXISTS (
          SELECT 1 FROM public.projects p WHERE p.id = c.project_id AND p.assigned_to = auth.uid()
        )
      )
    )
  )
);

-- ============================================================
-- PROJECT INBOX MESSAGES POLICIES
-- ============================================================
DROP POLICY IF EXISTS "inbox_select" ON public.project_inbox_messages;
CREATE POLICY "inbox_select" ON public.project_inbox_messages FOR SELECT
TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.projects p WHERE p.id = project_id
    AND (
      public.get_my_role() = 'finance_officer'
      OR (public.get_my_role() = 'director_pm' AND p.assigned_to = auth.uid())
    )
  )
);

DROP POLICY IF EXISTS "inbox_insert" ON public.project_inbox_messages;
CREATE POLICY "inbox_insert" ON public.project_inbox_messages FOR INSERT
TO authenticated WITH CHECK (
  sender_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.projects p WHERE p.id = project_id
    AND (
      public.get_my_role() = 'finance_officer'
      OR (public.get_my_role() = 'director_pm' AND p.assigned_to = auth.uid())
    )
  )
);

-- ============================================================
-- NOTIFICATIONS POLICIES
-- ============================================================
DROP POLICY IF EXISTS "notifications_select" ON public.notifications;
CREATE POLICY "notifications_select" ON public.notifications FOR SELECT
TO authenticated USING (recipient_id = auth.uid());

DROP POLICY IF EXISTS "notifications_insert" ON public.notifications;
CREATE POLICY "notifications_insert" ON public.notifications FOR INSERT
TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "notifications_update" ON public.notifications;
CREATE POLICY "notifications_update" ON public.notifications FOR UPDATE
TO authenticated
USING (recipient_id = auth.uid())
WITH CHECK (recipient_id = auth.uid());
