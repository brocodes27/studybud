-- Create meeting_notes table
CREATE TABLE IF NOT EXISTS public.meeting_notes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL,
    notes TEXT,
    screenshots JSONB,
    saved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- Enable Row Level Security
ALTER TABLE public.meeting_notes ENABLE ROW LEVEL SECURITY;
-- Policy: Authenticated users can select their own notes
CREATE POLICY "Users can view their own meeting notes" ON public.meeting_notes
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
-- Policy: Authenticated users can insert their own notes
CREATE POLICY "Users can insert their own meeting notes" ON public.meeting_notes
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
-- Policy: Authenticated users can update their own notes
CREATE POLICY "Users can update their own meeting notes" ON public.meeting_notes
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);
-- Policy: Authenticated users can delete their own notes
CREATE POLICY "Users can delete their own meeting notes" ON public.meeting_notes
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
