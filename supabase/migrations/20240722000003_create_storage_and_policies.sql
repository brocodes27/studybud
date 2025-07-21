-- Create a bucket for assignments with public access
INSERT INTO storage.buckets (id, name, public)
VALUES ('assignments', 'assignments', true)
ON CONFLICT (id) DO NOTHING;

-- Policies for 'assignments' bucket
-- Allow teachers to upload files to their class folder
CREATE POLICY "Allow teachers to upload assignments"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'assignments' AND
    auth.uid() = (
        SELECT teacher_id
        FROM public.classes
        WHERE id = (string_to_array(name, '/'))[2]::uuid
    )
);

-- Allow authenticated users to view assignments
CREATE POLICY "Allow authenticated users to view assignments"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'assignments'
); 