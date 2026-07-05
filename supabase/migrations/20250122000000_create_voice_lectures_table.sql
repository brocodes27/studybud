-- Create lessons table first
CREATE TABLE IF NOT EXISTS lessons (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT DEFAULT 'theory',
  xp_reward INTEGER DEFAULT 50,
  estimated_time INTEGER DEFAULT 15,
  difficulty TEXT DEFAULT 'medium',
  module_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- Create voice_lectures table
CREATE TABLE IF NOT EXISTS voice_lectures (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lesson_id UUID REFERENCES lessons(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  conversation_history JSONB DEFAULT '[]'::jsonb,
  progress INTEGER DEFAULT 0,
  accuracy DECIMAL(5,2) DEFAULT 0,
  xp_earned INTEGER DEFAULT 0,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- Create user_progress table
CREATE TABLE IF NOT EXISTS user_progress (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id UUID REFERENCES lessons(id) ON DELETE CASCADE,
  progress INTEGER DEFAULT 0,
  xp_earned INTEGER DEFAULT 0,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, lesson_id)
);
-- Create ai_tutor_personalities table
CREATE TABLE IF NOT EXISTS ai_tutor_personalities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  voice_settings JSONB DEFAULT '{}'::jsonb,
  teaching_style TEXT DEFAULT 'friendly',
  specialty TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- Create user_voice_preferences table
CREATE TABLE IF NOT EXISTS user_voice_preferences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  preferred_personality_id UUID REFERENCES ai_tutor_personalities(id),
  voice_settings JSONB DEFAULT '{}'::jsonb,
  language TEXT DEFAULT 'en-US',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);
-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_lessons_module_id ON lessons(module_id);
CREATE INDEX IF NOT EXISTS idx_voice_lectures_user_id ON voice_lectures(user_id);
CREATE INDEX IF NOT EXISTS idx_voice_lectures_lesson_id ON voice_lectures(lesson_id);
CREATE INDEX IF NOT EXISTS idx_user_progress_user_id ON user_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_progress_lesson_id ON user_progress(lesson_id);
-- Enable RLS
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_lectures ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_tutor_personalities ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_voice_preferences ENABLE ROW LEVEL SECURITY;
-- Create RLS policies
CREATE POLICY "Everyone can view lessons" ON lessons
  FOR SELECT USING (true);
CREATE POLICY "Users can view their own voice lectures" ON voice_lectures
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own voice lectures" ON voice_lectures
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own voice lectures" ON voice_lectures
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can view their own progress" ON user_progress
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own progress" ON user_progress
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own progress" ON user_progress
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Everyone can view AI personalities" ON ai_tutor_personalities
  FOR SELECT USING (true);
CREATE POLICY "Users can view their own voice preferences" ON user_voice_preferences
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own voice preferences" ON user_voice_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own voice preferences" ON user_voice_preferences
  FOR UPDATE USING (auth.uid() = user_id);
-- Insert default AI personalities
INSERT INTO ai_tutor_personalities (name, description, voice_settings, teaching_style, specialty) VALUES
('Sarah', 'Encouraging and patient tutor who celebrates every small success', 
 '{"rate": 0.9, "pitch": 1.1, "voice": "samantha"}', 'encouraging', 
 ARRAY['physics', 'math', 'chemistry']),

('Dr. Johnson', 'Strict but fair professor who expects excellence', 
 '{"rate": 0.8, "pitch": 0.9, "voice": "alex"}', 'strict', 
 ARRAY['advanced physics', 'calculus', 'engineering']),

('Mike', 'Friendly tutor who makes learning fun and relatable', 
 '{"rate": 1.0, "pitch": 1.0, "voice": "tom"}', 'friendly', 
 ARRAY['general science', 'biology', 'earth science']),

('Sophia', 'Socratic tutor who guides you to discover answers yourself', 
 '{"rate": 0.85, "pitch": 1.05, "voice": "victoria"}', 'socratic', 
 ARRAY['philosophy', 'critical thinking', 'problem solving']);
-- Insert sample lessons
INSERT INTO lessons (id, title, description, type, xp_reward, estimated_time, difficulty, module_id) VALUES
(gen_random_uuid(), 'Motion Basics', 'Understand the fundamentals of motion and velocity', 'theory', 50, 15, 'easy', 'mechanics'),
(gen_random_uuid(), 'Forces Introduction', 'Explore different types of forces and their effects', 'theory', 60, 20, 'medium', 'mechanics'),
(gen_random_uuid(), 'Energy Concepts', 'Learn about kinetic and potential energy', 'theory', 70, 25, 'medium', 'mechanics'),
(gen_random_uuid(), 'Wave Properties', 'Understand amplitude, frequency, and wavelength', 'theory', 55, 18, 'medium', 'waves'),
(gen_random_uuid(), 'Sound Waves', 'Explore how sound travels and behaves', 'theory', 65, 22, 'medium', 'waves');
