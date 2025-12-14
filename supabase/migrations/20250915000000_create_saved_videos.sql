-- Create saved_videos table for BlackboardPlayer caching
CREATE TABLE IF NOT EXISTS saved_videos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  subject TEXT NOT NULL,
  script JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Ensure unique video per user per topic/subject to avoid duplicates
  UNIQUE(user_id, topic, subject)
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_saved_videos_user_id ON saved_videos(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_videos_lookup ON saved_videos(user_id, topic, subject);

-- Enable RLS
ALTER TABLE saved_videos ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own saved videos" ON saved_videos
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own saved videos" ON saved_videos
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own saved videos" ON saved_videos
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own saved videos" ON saved_videos
  FOR DELETE USING (auth.uid() = user_id);
