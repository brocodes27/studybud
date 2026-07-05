-- Add HeyGen tracking fields to saved_videos
ALTER TABLE saved_videos
  ADD COLUMN IF NOT EXISTS heygen_video_id TEXT,
  ADD COLUMN IF NOT EXISTS heygen_video_url TEXT,
  ADD COLUMN IF NOT EXISTS heygen_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS heygen_error TEXT,
  ADD COLUMN IF NOT EXISTS heygen_last_checked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS heygen_notified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS heygen_notified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS heygen_requested_at TIMESTAMPTZ DEFAULT NOW();
-- Indexes to help lookups
CREATE INDEX IF NOT EXISTS idx_saved_videos_heygen_status ON saved_videos(heygen_status);
CREATE INDEX IF NOT EXISTS idx_saved_videos_user_status ON saved_videos(user_id, heygen_status);
-- Trigger to notify users when HeyGen video is ready
CREATE OR REPLACE FUNCTION notify_user_when_heygen_ready()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.heygen_status = 'ready' AND COALESCE(NEW.heygen_notified, FALSE) = FALSE THEN
    NEW.heygen_notified := TRUE;
    NEW.heygen_notified_at := COALESCE(NEW.heygen_notified_at, NOW());

    INSERT INTO notifications (user_id, class_id, type, title, message, action_url, priority, is_read)
    VALUES (
      NEW.user_id,
      NULL,
      'system',
      'Your blackboard video is ready',
      COALESCE(NEW.subject, 'Your lesson') || ' - "' || COALESCE(NEW.topic, 'Untitled') || '" video is ready to watch.',
      '/videos',
      'high',
      FALSE
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_notify_heygen_ready ON saved_videos;
CREATE TRIGGER trg_notify_heygen_ready
BEFORE INSERT OR UPDATE ON saved_videos
FOR EACH ROW
WHEN (NEW.heygen_status = 'ready')
EXECUTE FUNCTION notify_user_when_heygen_ready();
