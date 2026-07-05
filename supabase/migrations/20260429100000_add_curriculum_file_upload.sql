-- ============================================
-- Curriculum File Upload: Storage Bucket + Column
-- ============================================

-- 1. Create curriculums storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('curriculums', 'curriculums', true)
ON CONFLICT (id) DO NOTHING;
-- 2. Allow public read access to curriculum files
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Allow public to view curriculums'
  ) THEN
    CREATE POLICY "Allow public to view curriculums"
    ON storage.objects FOR SELECT
    TO public
    USING (
        bucket_id = 'curriculums'
    );
  END IF;
END $$;
-- 3. Allow authenticated teachers to upload curriculum files
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Allow authenticated upload to curriculums'
  ) THEN
    CREATE POLICY "Allow authenticated upload to curriculums"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'curriculums'
    );
  END IF;
END $$;
-- 4. Allow owners to update/delete their own curriculum files
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Allow owners to manage curriculums'
  ) THEN
    CREATE POLICY "Allow owners to manage curriculums"
    ON storage.objects FOR ALL
    TO authenticated
    USING (
        bucket_id = 'curriculums'
        AND owner = auth.uid()
    )
    WITH CHECK (
        bucket_id = 'curriculums'
        AND owner = auth.uid()
    );
  END IF;
END $$;
-- 5. Add curriculum file URL column to classes
ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS curriculum_file_url TEXT DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_classes_curriculum_file_url ON public.classes(curriculum_file_url) WHERE curriculum_file_url IS NOT NULL;
