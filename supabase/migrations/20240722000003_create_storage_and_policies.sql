-- Create the assignments bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('assignments', 'assignments', true)
ON CONFLICT (id) DO NOTHING;
-- Allow anyone (public) to read files from assignments bucket
CREATE POLICY "Allow public to view assignments"
ON storage.objects FOR SELECT
TO public
USING (
    bucket_id = 'assignments'
);
-- Allow authenticated users to upload files to assignments bucket
CREATE POLICY "Allow authenticated upload to assignments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'assignments'
);
