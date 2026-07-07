-- Grant write policies to the 'admin' role

-- 1. project_engineers (insert)
DROP POLICY IF EXISTS "engineers_insert" ON public.project_engineers;
CREATE POLICY "engineers_insert" ON public.project_engineers FOR INSERT
TO authenticated WITH CHECK (
  public.get_my_role() = 'admin'
  OR (
    public.get_my_role() = 'director_pm'
    AND EXISTS (
      SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.assigned_to = auth.uid()
    )
  )
);

-- 2. claims (insert and update)
DROP POLICY IF EXISTS "claims_insert" ON public.claims;
CREATE POLICY "claims_insert" ON public.claims FOR INSERT
TO authenticated WITH CHECK (
  public.get_my_role() = 'admin'
  OR (
    public.get_my_role() = 'director_pm'
    AND EXISTS (
      SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.assigned_to = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS "claims_update" ON public.claims;
CREATE POLICY "claims_update" ON public.claims FOR UPDATE
TO authenticated
USING (public.get_my_role() IN ('finance_officer', 'admin'))
WITH CHECK (public.get_my_role() IN ('finance_officer', 'admin'));

-- 3. project_documents (insert and delete)
DROP POLICY IF EXISTS "documents_insert" ON public.project_documents;
CREATE POLICY "documents_insert" ON public.project_documents FOR INSERT
TO authenticated WITH CHECK (
  public.get_my_role() IN ('finance_officer', 'admin')
);

DROP POLICY IF EXISTS "documents_delete" ON public.project_documents;
CREATE POLICY "documents_delete" ON public.project_documents FOR DELETE
TO authenticated USING (
  public.get_my_role() IN ('finance_officer', 'admin')
);

-- 4. project_inbox_messages (select and insert)
DROP POLICY IF EXISTS "inbox_select" ON public.project_inbox_messages;
CREATE POLICY "inbox_select" ON public.project_inbox_messages FOR SELECT
TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.projects p WHERE p.id = project_id
    AND (
      public.get_my_role() IN ('finance_officer', 'admin')
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
      public.get_my_role() IN ('finance_officer', 'admin')
      OR (public.get_my_role() = 'director_pm' AND p.assigned_to = auth.uid())
    )
  )
);

-- 5. projects (insert and update)
DROP POLICY IF EXISTS "projects_insert" ON public.projects;
CREATE POLICY "projects_insert" ON public.projects FOR INSERT
TO authenticated WITH CHECK (
  public.get_my_role() IN ('finance_officer', 'admin')
);

DROP POLICY IF EXISTS "projects_update" ON public.projects;
CREATE POLICY "projects_update" ON public.projects FOR UPDATE
TO authenticated
USING (public.get_my_role() IN ('finance_officer', 'admin'))
WITH CHECK (public.get_my_role() IN ('finance_officer', 'admin'));

-- 6. storage.objects (upload and delete policies for 'project-documents' bucket)
DROP POLICY IF EXISTS "Allow finance officer to upload documents" ON storage.objects;
CREATE POLICY "Allow finance officer to upload documents" ON storage.objects FOR INSERT
TO authenticated WITH CHECK (
  bucket_id = 'project-documents' AND
  public.get_my_role() IN ('finance_officer', 'admin')
);

DROP POLICY IF EXISTS "Allow finance officer to delete documents" ON storage.objects;
CREATE POLICY "Allow finance officer to delete documents" ON storage.objects FOR DELETE
TO authenticated USING (
  bucket_id = 'project-documents' AND
  public.get_my_role() IN ('finance_officer', 'admin')
);
