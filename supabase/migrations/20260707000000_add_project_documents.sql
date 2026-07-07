-- Create project_documents table
CREATE TABLE IF NOT EXISTS public.project_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  file_path text NOT NULL,
  size bigint NOT NULL,
  mime_type text,
  uploaded_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.project_documents ENABLE ROW LEVEL SECURITY;

-- Index
CREATE INDEX IF NOT EXISTS idx_project_documents_project_id ON public.project_documents(project_id);

-- Drop existing policies if any
DROP POLICY IF EXISTS "documents_select" ON public.project_documents;
DROP POLICY IF EXISTS "documents_insert" ON public.project_documents;
DROP POLICY IF EXISTS "documents_delete" ON public.project_documents;

-- Create policies
CREATE POLICY "documents_select" ON public.project_documents FOR SELECT
TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.projects p WHERE p.id = project_id
    AND (
      public.get_my_role() IN ('admin', 'finance_officer')
      OR (public.get_my_role() = 'director_pm' AND p.assigned_to = auth.uid())
    )
  )
);

CREATE POLICY "documents_insert" ON public.project_documents FOR INSERT
TO authenticated WITH CHECK (
  public.get_my_role() = 'finance_officer'
);

CREATE POLICY "documents_delete" ON public.project_documents FOR DELETE
TO authenticated USING (
  public.get_my_role() = 'finance_officer'
);

-- Ensure storage bucket exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('project-documents', 'project-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for the bucket
DROP POLICY IF EXISTS "Allow users to view project documents" ON storage.objects;
CREATE POLICY "Allow users to view project documents" ON storage.objects FOR SELECT
TO authenticated USING (
  bucket_id = 'project-documents' AND (
    public.get_my_role() IN ('admin', 'finance_officer')
    OR (
      public.get_my_role() = 'director_pm' AND EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id::text = split_part(name, '/', 1)
        AND p.assigned_to = auth.uid()
      )
    )
  )
);

DROP POLICY IF EXISTS "Allow finance officer to upload documents" ON storage.objects;
CREATE POLICY "Allow finance officer to upload documents" ON storage.objects FOR INSERT
TO authenticated WITH CHECK (
  bucket_id = 'project-documents' AND
  public.get_my_role() = 'finance_officer'
);

DROP POLICY IF EXISTS "Allow finance officer to delete documents" ON storage.objects;
CREATE POLICY "Allow finance officer to delete documents" ON storage.objects FOR DELETE
TO authenticated USING (
  bucket_id = 'project-documents' AND
  public.get_my_role() = 'finance_officer'
);
