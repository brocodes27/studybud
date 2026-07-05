-- Flow Sessions Table
CREATE TABLE flow_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES study_sessions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  flow_level TEXT CHECK (flow_level IN ('chill', 'push', 'intense', 'unknown')),
  pause_count INTEGER DEFAULT 0,
  hint_requests INTEGER DEFAULT 0,
  time_actual_minutes NUMERIC(5,2),
  time_expected_minutes NUMERIC(5,2),
  breath_prompt_shown BOOLEAN DEFAULT FALSE,
  difficulty_stepped_down BOOLEAN DEFAULT FALSE,
  detected_state TEXT CHECK (detected_state IN ('flow', 'drifting', 'stuck'))
);
ALTER TABLE flow_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can insert own flow sessions" ON flow_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can read own flow sessions" ON flow_sessions
  FOR SELECT USING (auth.uid() = user_id);
CREATE INDEX idx_flow_sessions_user_id ON flow_sessions(user_id);
CREATE INDEX idx_flow_sessions_created_at ON flow_sessions(created_at);
