-- US Market Foundation Migration
-- Establishes core tables for US-focused exam prep and gamification

-- ============================================
-- 1. US Exam Types
-- ============================================
CREATE TABLE IF NOT EXISTS us_exam_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  total_score_max INT,
  sections JSONB,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed US exam types
INSERT INTO us_exam_types (code, name, description, total_score_max, sections) VALUES
('sat', 'SAT (Digital)', 'College Board standardized test for college admissions', 1600, '{"reading_writing": 800, "math": 800}'),
('act', 'ACT', 'Alternative standardized test accepted by all US colleges', 36, '{"english": 36, "math": 36, "reading": 36, "science": 36}'),
('psat', 'PSAT/NMSQT', 'Preliminary SAT and National Merit Scholarship Qualifying Test', 1520, '{"reading_writing": 760, "math": 760}'),
('ap_calc_ab', 'AP Calculus AB', 'Advanced Placement Calculus AB', 5, NULL),
('ap_calc_bc', 'AP Calculus BC', 'Advanced Placement Calculus BC', 5, NULL),
('ap_physics_1', 'AP Physics 1', 'Algebra-based physics course', 5, NULL),
('ap_physics_2', 'AP Physics 2', 'Algebra-based physics course (continuation)', 5, NULL),
('ap_physics_c_mech', 'AP Physics C: Mechanics', 'Calculus-based mechanics', 5, NULL),
('ap_physics_c_em', 'AP Physics C: E&M', 'Calculus-based electricity and magnetism', 5, NULL),
('ap_chemistry', 'AP Chemistry', 'College-level chemistry', 5, NULL),
('ap_biology', 'AP Biology', 'College-level biology', 5, NULL),
('ap_us_history', 'AP US History', 'Survey of American history', 5, NULL),
('ap_world_history', 'AP World History: Modern', 'Global history from 1200 CE', 5, NULL),
('ap_euro_history', 'AP European History', 'European history from 1450', 5, NULL),
('ap_english_lang', 'AP English Language', 'Rhetoric and composition', 5, NULL),
('ap_english_lit', 'AP English Literature', 'Literary analysis', 5, NULL),
('ap_psychology', 'AP Psychology', 'Introduction to psychology', 5, NULL),
('ap_stats', 'AP Statistics', 'College-level statistics', 5, NULL),
('ap_cs_a', 'AP Computer Science A', 'Java programming', 5, NULL),
('ap_cs_principles', 'AP Computer Science Principles', 'Computing concepts', 5, NULL)
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- 2. User Study Goals (Enhanced Onboarding)
-- ============================================
CREATE TABLE IF NOT EXISTS user_study_goals (
  user_id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  target_exam TEXT NOT NULL,
  target_score INT,
  exam_date DATE,
  hours_per_week INT DEFAULT 10,
  weak_areas TEXT[] DEFAULT '{}',
  study_style TEXT DEFAULT 'balanced', -- 'visual', 'auditory', 'reading', 'kinesthetic', 'balanced'
  timezone TEXT DEFAULT 'America/New_York',
  daily_reminder_time TIME DEFAULT '18:00',
  onboarding_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 3. Gamification System
-- ============================================

-- User gamification state
CREATE TABLE IF NOT EXISTS user_gamification (
  user_id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  total_xp INT DEFAULT 0,
  current_level INT DEFAULT 1,
  current_streak INT DEFAULT 0,
  longest_streak INT DEFAULT 0,
  last_activity_date DATE,
  streak_shields_remaining INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- XP transaction log (audit trail)
CREATE TABLE IF NOT EXISTS xp_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  amount INT NOT NULL,
  reason TEXT NOT NULL,
  source_type TEXT, -- 'question', 'test', 'streak', 'achievement', 'daily_checkin'
  source_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_xp_transactions_user ON xp_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_xp_transactions_created ON xp_transactions(created_at DESC);

-- Daily activity log
CREATE TABLE IF NOT EXISTS user_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  activity_date DATE NOT NULL,
  activity_type TEXT NOT NULL, -- 'daily_checkin', 'practice', 'test', 'video', 'feynman'
  xp_earned INT DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, activity_date, activity_type)
);

CREATE INDEX IF NOT EXISTS idx_activity_log_user_date ON user_activity_log(user_id, activity_date DESC);

-- ============================================
-- 4. Achievements System
-- ============================================

-- Drop existing achievements table if schema is incompatible and recreate
-- First, add missing columns if the table exists (safe migration)
DO $$
BEGIN
    -- Add code column if missing
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'achievements' AND table_schema = 'public') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'achievements' AND column_name = 'code') THEN
            ALTER TABLE achievements ADD COLUMN code TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'achievements' AND column_name = 'category') THEN
            ALTER TABLE achievements ADD COLUMN category TEXT DEFAULT 'general';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'achievements' AND column_name = 'requirement_type') THEN
            ALTER TABLE achievements ADD COLUMN requirement_type TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'achievements' AND column_name = 'requirement_value') THEN
            ALTER TABLE achievements ADD COLUMN requirement_value INT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'achievements' AND column_name = 'is_active') THEN
            ALTER TABLE achievements ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'achievements' AND column_name = 'rarity') THEN
            ALTER TABLE achievements ADD COLUMN rarity TEXT DEFAULT 'common';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'achievements' AND column_name = 'xp_reward') THEN
            ALTER TABLE achievements ADD COLUMN xp_reward INT DEFAULT 50;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'achievements' AND column_name = 'icon') THEN
            ALTER TABLE achievements ADD COLUMN icon TEXT DEFAULT '🏆';
        END IF;
    END IF;
END $$;

-- Create table if it doesn't exist at all
CREATE TABLE IF NOT EXISTS achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT '🏆',
  xp_reward INT DEFAULT 50,
  rarity TEXT DEFAULT 'common', -- 'common', 'rare', 'epic', 'legendary'
  category TEXT DEFAULT 'general', -- 'streak', 'practice', 'mastery', 'social'
  requirement_type TEXT, -- 'streak_days', 'questions_answered', 'xp_earned', etc.
  requirement_value INT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add unique constraint on code if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'achievements_code_key') THEN
        ALTER TABLE achievements ADD CONSTRAINT achievements_code_key UNIQUE (code);
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL; -- Ignore if already exists
END $$;

-- User unlocked achievements
CREATE TABLE IF NOT EXISTS user_achievements (
  user_id UUID REFERENCES auth.users ON DELETE CASCADE,
  achievement_id UUID REFERENCES achievements ON DELETE CASCADE,
  unlocked_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, achievement_id)
);

-- Seed achievements
INSERT INTO achievements (code, name, description, icon, xp_reward, rarity, category, requirement_type, requirement_value) VALUES
-- Streak achievements
('first_day', 'First Steps', 'Complete your first day of studying', '🌱', 50, 'common', 'streak', 'streak_days', 1),
('streak_3', 'Getting Started', 'Maintain a 3-day streak', '🔥', 100, 'common', 'streak', 'streak_days', 3),
('streak_7', 'Week Warrior', 'Maintain a 7-day streak', '⚡', 200, 'rare', 'streak', 'streak_days', 7),
('streak_14', 'Fortnight Fighter', 'Maintain a 14-day streak', '💪', 400, 'rare', 'streak', 'streak_days', 14),
('streak_30', 'Monthly Master', 'Maintain a 30-day streak', '🏆', 1000, 'epic', 'streak', 'streak_days', 30),
('streak_60', 'Dedicated Scholar', 'Maintain a 60-day streak', '👑', 2500, 'legendary', 'streak', 'streak_days', 60),
('streak_100', 'Centurion', 'Maintain a 100-day streak', '🌟', 5000, 'legendary', 'streak', 'streak_days', 100),

-- Practice achievements
('first_question', 'Question Crusher', 'Answer your first practice question', '❓', 25, 'common', 'practice', 'questions_answered', 1),
('questions_50', 'Practice Makes Perfect', 'Answer 50 practice questions', '📝', 150, 'common', 'practice', 'questions_answered', 50),
('questions_100', 'Century Club', 'Answer 100 practice questions', '💯', 300, 'rare', 'practice', 'questions_answered', 100),
('questions_500', 'Question Champion', 'Answer 500 practice questions', '🎯', 750, 'epic', 'practice', 'questions_answered', 500),
('questions_1000', 'Question Legend', 'Answer 1000 practice questions', '🔮', 2000, 'legendary', 'practice', 'questions_answered', 1000),

-- XP achievements
('xp_1000', 'Rising Star', 'Earn 1,000 XP', '⭐', 0, 'common', 'mastery', 'xp_earned', 1000),
('xp_5000', 'Shooting Star', 'Earn 5,000 XP', '🌠', 0, 'rare', 'mastery', 'xp_earned', 5000),
('xp_10000', 'Superstar', 'Earn 10,000 XP', '✨', 0, 'epic', 'mastery', 'xp_earned', 10000),
('xp_25000', 'Cosmic Force', 'Earn 25,000 XP', '🌌', 0, 'legendary', 'mastery', 'xp_earned', 25000),

-- Test achievements
('first_test', 'Test Taker', 'Complete your first practice test', '📋', 100, 'common', 'practice', 'tests_completed', 1),
('tests_5', 'Serial Tester', 'Complete 5 practice tests', '📊', 300, 'rare', 'practice', 'tests_completed', 5),
('tests_10', 'Test Master', 'Complete 10 practice tests', '🎓', 500, 'epic', 'practice', 'tests_completed', 10),

-- Feynman achievements
('first_feynman', 'Teacher Mode', 'Complete your first Feynman session', '🧠', 75, 'common', 'practice', 'feynman_sessions', 1),
('feynman_10', 'Explain It All', 'Complete 10 Feynman sessions', '💡', 300, 'rare', 'practice', 'feynman_sessions', 10)
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- 5. Daily Check-In System
-- ============================================
CREATE TABLE IF NOT EXISTS daily_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  checkin_date DATE NOT NULL,
  question_id UUID,
  question_domain TEXT,
  user_answer TEXT,
  correct_answer TEXT,
  is_correct BOOLEAN,
  xp_earned INT DEFAULT 0,
  time_spent_seconds INT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, checkin_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_checkins_user_date ON daily_checkins(user_id, checkin_date DESC);

-- ============================================
-- 6. Subject Mastery Tracking
-- ============================================
CREATE TABLE IF NOT EXISTS user_subject_mastery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  exam_type TEXT NOT NULL,
  domain TEXT NOT NULL,
  subdomain TEXT DEFAULT '',
  questions_attempted INT DEFAULT 0,
  questions_correct INT DEFAULT 0,
  mastery_score DECIMAL(4,3) DEFAULT 0.000, -- 0.000 to 1.000
  last_practiced TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create unique index for user mastery per domain/subdomain
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_mastery_unique 
  ON user_subject_mastery(user_id, exam_type, domain, COALESCE(subdomain, ''));

CREATE INDEX IF NOT EXISTS idx_user_mastery_lookup ON user_subject_mastery(user_id, exam_type);

-- ============================================
-- 7. Study Groups (Social)
-- ============================================
CREATE TABLE IF NOT EXISTS study_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  exam_type TEXT NOT NULL,
  target_date DATE,
  invite_code TEXT UNIQUE DEFAULT substring(md5(random()::text) from 1 for 8),
  created_by UUID REFERENCES auth.users ON DELETE SET NULL,
  max_members INT DEFAULT 10,
  is_public BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS study_group_members (
  group_id UUID REFERENCES study_groups ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE,
  role TEXT DEFAULT 'member', -- 'admin', 'member'
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (group_id, user_id)
);

CREATE TABLE IF NOT EXISTS group_activity_feed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES study_groups ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE,
  activity_type TEXT NOT NULL,
  message TEXT NOT NULL,
  xp_earned INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_group_feed_recent ON group_activity_feed(group_id, created_at DESC);

-- ============================================
-- 8. RLS Policies
-- ============================================

-- User study goals
ALTER TABLE user_study_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own goals" ON user_study_goals
  FOR ALL USING (auth.uid() = user_id);

-- User gamification
ALTER TABLE user_gamification ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view all gamification" ON user_gamification
  FOR SELECT USING (true);
CREATE POLICY "Users can update their own gamification" ON user_gamification
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own gamification" ON user_gamification
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- XP transactions
ALTER TABLE xp_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own XP" ON xp_transactions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own XP" ON xp_transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Activity log
ALTER TABLE user_activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own activity" ON user_activity_log
  FOR ALL USING (auth.uid() = user_id);

-- Achievements (public read)
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read achievements" ON achievements
  FOR SELECT USING (true);

-- User achievements
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view all achievements" ON user_achievements
  FOR SELECT USING (true);
CREATE POLICY "Users can unlock their own achievements" ON user_achievements
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Daily check-ins
ALTER TABLE daily_checkins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own check-ins" ON daily_checkins
  FOR ALL USING (auth.uid() = user_id);

-- Subject mastery
ALTER TABLE user_subject_mastery ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own mastery" ON user_subject_mastery
  FOR ALL USING (auth.uid() = user_id);

-- Study groups (members can view their groups)
ALTER TABLE study_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public groups visible to all" ON study_groups
  FOR SELECT USING (is_public = true);
CREATE POLICY "Members can view their groups" ON study_groups
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM study_group_members WHERE group_id = id AND user_id = auth.uid())
  );
CREATE POLICY "Users can create groups" ON study_groups
  FOR INSERT WITH CHECK (auth.uid() = created_by);

ALTER TABLE study_group_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view group members" ON study_group_members
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM study_group_members sgm WHERE sgm.group_id = group_id AND sgm.user_id = auth.uid())
  );
CREATE POLICY "Users can join groups" ON study_group_members
  FOR INSERT WITH CHECK (auth.uid() = user_id);

ALTER TABLE group_activity_feed ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view group feed" ON group_activity_feed
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM study_group_members WHERE group_id = group_activity_feed.group_id AND user_id = auth.uid())
  );

-- ============================================
-- 9. Helper Functions
-- ============================================

-- Function to award XP and update gamification
CREATE OR REPLACE FUNCTION award_xp(
  p_user_id UUID,
  p_amount INT,
  p_reason TEXT,
  p_source_type TEXT DEFAULT NULL,
  p_source_id UUID DEFAULT NULL
) RETURNS INT AS $$
DECLARE
  v_new_total INT;
  v_new_level INT;
BEGIN
  -- Insert XP transaction
  INSERT INTO xp_transactions (user_id, amount, reason, source_type, source_id)
  VALUES (p_user_id, p_amount, p_reason, p_source_type, p_source_id);
  
  -- Update user gamification
  INSERT INTO user_gamification (user_id, total_xp, updated_at)
  VALUES (p_user_id, p_amount, NOW())
  ON CONFLICT (user_id) DO UPDATE SET
    total_xp = user_gamification.total_xp + p_amount,
    updated_at = NOW();
  
  -- Get new total and calculate level
  SELECT total_xp INTO v_new_total FROM user_gamification WHERE user_id = p_user_id;
  
  -- Simple level calculation: level = floor(sqrt(xp/100)) + 1, capped at 50
  v_new_level := LEAST(50, FLOOR(SQRT(v_new_total / 100.0)) + 1);
  
  -- Update level if changed
  UPDATE user_gamification SET current_level = v_new_level WHERE user_id = p_user_id;
  
  RETURN v_new_total;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update streak
CREATE OR REPLACE FUNCTION update_streak(p_user_id UUID) RETURNS INT AS $$
DECLARE
  v_last_date DATE;
  v_today DATE := CURRENT_DATE;
  v_streak INT;
  v_longest INT;
BEGIN
  -- Get current state
  SELECT last_activity_date, current_streak, longest_streak
  INTO v_last_date, v_streak, v_longest
  FROM user_gamification WHERE user_id = p_user_id;
  
  -- If no record, create one
  IF v_last_date IS NULL THEN
    INSERT INTO user_gamification (user_id, current_streak, longest_streak, last_activity_date)
    VALUES (p_user_id, 1, 1, v_today);
    RETURN 1;
  END IF;
  
  -- Already logged today
  IF v_last_date = v_today THEN
    RETURN v_streak;
  END IF;
  
  -- Consecutive day
  IF v_last_date = v_today - INTERVAL '1 day' THEN
    v_streak := v_streak + 1;
    v_longest := GREATEST(v_longest, v_streak);
  ELSE
    -- Streak broken
    v_streak := 1;
  END IF;
  
  -- Update
  UPDATE user_gamification SET
    current_streak = v_streak,
    longest_streak = v_longest,
    last_activity_date = v_today,
    updated_at = NOW()
  WHERE user_id = p_user_id;
  
  RETURN v_streak;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to record daily check-in
CREATE OR REPLACE FUNCTION record_daily_checkin(
  p_user_id UUID,
  p_question_domain TEXT,
  p_is_correct BOOLEAN
) RETURNS JSONB AS $$
DECLARE
  v_xp INT;
  v_streak INT;
  v_streak_bonus INT;
  v_total_xp INT;
BEGIN
  -- Base XP for check-in
  v_xp := CASE WHEN p_is_correct THEN 60 ELSE 40 END;
  
  -- Update streak first
  v_streak := update_streak(p_user_id);
  
  -- Streak bonus (10 XP per day of streak)
  v_streak_bonus := v_streak * 10;
  v_xp := v_xp + v_streak_bonus;
  
  -- Award XP
  v_total_xp := award_xp(p_user_id, v_xp, 'Daily check-in', 'daily_checkin', NULL);
  
  -- Log activity
  INSERT INTO user_activity_log (user_id, activity_date, activity_type, xp_earned)
  VALUES (p_user_id, CURRENT_DATE, 'daily_checkin', v_xp)
  ON CONFLICT (user_id, activity_date, activity_type) DO NOTHING;
  
  RETURN jsonb_build_object(
    'xp_earned', v_xp,
    'streak', v_streak,
    'streak_bonus', v_streak_bonus,
    'total_xp', v_total_xp
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 10. Enable Realtime for key tables
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE user_gamification;
ALTER PUBLICATION supabase_realtime ADD TABLE user_achievements;
