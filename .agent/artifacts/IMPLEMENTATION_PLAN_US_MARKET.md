# StudyBud → ElevenFolks US Market Implementation Plan

**Generated:** 2026-01-31  
**Status:** Strategic Roadmap for User Retention & Value Creation  
**Target Market:** US High School & College Students (SAT, ACT, AP, College Prep)

---

## 🎯 Executive Summary

### What You're Building
You're building **ATLAS** — an AI-powered study companion that combines:
1. **AI Study Buddy** — Conversational learning with study plan generation
2. **SAT Simulator** — Adaptive testing aligned with Digital SAT specs
3. **Feynman Board** — Voice-based concept explanation for active learning
4. **Neural Journal** — AI-enhanced note-taking with auto-insights
5. **Video Lessons** — Manim-generated visual explanations
6. **Teacher/Student Classes** — Classroom management system

### The Problem
The app has **many features** but lacks the **cohesive habit loop** that makes students return daily. Features feel disconnected, and there's no clear "daily ritual" that delivers compounding value.

### The Solution
Transform from a **feature collection** into a **daily study operating system** with:
- **Clear daily ritual** (5-minute daily engagement)
- **Visible progress trajectory** (XP, streaks, mastery levels)
- **Social accountability** (study groups, leaderboards)
- **Personalized AI coach** that adapts to the student's goals

---

## 📊 Current State Analysis

### Strengths (Keep & Enhance)
| Feature | Current State | Retention Impact |
|---------|--------------|------------------|
| **SAT Simulator** | Already US-aligned, adaptive difficulty | ⭐ HIGH - Core value prop |
| **Feynman Board** | Voice-based learning, unique | ⭐ HIGH - Differentiated |
| **ATLAS AI** | Solid chat + plan generation | ⭐ MEDIUM - Needs personality |
| **Vibe Check** | Clever daily mood check | ⭐ MEDIUM - Good hook |
| **Streak System** | Basic implementation exists | ⭐ LOW - Not prominent |

### Weaknesses (Fix Immediately)
| Issue | Impact | Priority |
|-------|--------|----------|
| CBSE/CUET references still in code | Confuses US users | 🔴 CRITICAL |
| No onboarding flow for goals | Users don't understand value | 🔴 CRITICAL |
| Progress feels invisible | No XP, levels, or rewards | 🔴 CRITICAL |
| Features are siloed | No connected experience | 🟡 HIGH |
| No social/community | No accountability | 🟡 HIGH |

### Dead/Legacy Code to Remove
- `/cuet-simulator` route (Indian exam)
- CBSE syllabi tables
- CUET question banks
- Indian payment (Razorpay) — keep PayPal only
- `CBSE_EXAM_SYSTEM_SUMMARY.md`, `CBSE_SECTION_PATTERNS_ALL_SUBJECTS.md`

---

## 🏗️ Implementation Phases

## Phase 1: Foundation Clean-Up (Week 1)
*Goal: Remove Indian market artifacts, establish US-first experience*

### 1.1 Remove CBSE/CUET References
```
Files to modify:
- src/App.tsx → Remove /cbse-*, /cuet-* routes
- src/pages/ → Archive or delete CBSE/CUET pages
- supabase/migrations/ → Mark CUET tables as deprecated
- CODEBASE_EXPLAINED.md → Update documentation
```

### 1.2 US Exam Focus Setup
```sql
-- New table: us_exam_types
CREATE TABLE us_exam_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL, -- 'sat', 'act', 'ap_calc', 'ap_bio', etc.
  name TEXT NOT NULL,
  description TEXT,
  total_score_max INT,
  sections JSONB -- {"reading": 800, "math": 800}
);

-- Seed data
INSERT INTO us_exam_types (code, name, total_score_max, sections) VALUES
('sat', 'SAT (Digital)', 1600, '{"reading_writing": 800, "math": 800}'),
('act', 'ACT', 36, '{"english": 36, "math": 36, "reading": 36, "science": 36}'),
('psat', 'PSAT/NMSQT', 1520, '{"reading_writing": 760, "math": 760}'),
('ap_calc_ab', 'AP Calculus AB', 5, null),
('ap_calc_bc', 'AP Calculus BC', 5, null),
('ap_physics_1', 'AP Physics 1', 5, null),
('ap_chemistry', 'AP Chemistry', 5, null),
('ap_biology', 'AP Biology', 5, null),
('ap_us_history', 'AP US History', 5, null),
('ap_english_lang', 'AP English Language', 5, null),
('ap_english_lit', 'AP English Literature', 5, null);
```

### 1.3 Update Onboarding Flow
Goal-setting onboarding that captures:
1. **Target exam** (SAT, ACT, AP, or General)
2. **Target score** (e.g., 1400+ SAT)
3. **Exam date** (creates urgency)
4. **Study hours/week available**
5. **Weakest subjects** (personalization)

```typescript
// src/pages/Onboarding.tsx - Enhanced Flow
interface OnboardingData {
  targetExam: 'sat' | 'act' | 'psat' | 'ap' | 'general';
  apExams?: string[]; // If AP selected
  targetScore: number;
  examDate: Date;
  hoursPerWeek: number;
  weakAreas: string[];
  studyStyle: 'visual' | 'auditory' | 'reading' | 'kinesthetic';
}
```

---

## Phase 2: Habit Loop System (Week 2-3)
*Goal: Create irresistible daily engagement pattern*

### 2.1 The Daily Check-In (Hero Feature)
**Concept:** 5-minute daily ritual that becomes habit

```
┌─────────────────────────────────────────────────┐
│  🌅 GOOD MORNING, ALEX                          │
│  Day 12 of your SAT Journey                     │
│                                                 │
│  ┌───────────────────────────────────────────┐ │
│  │  TODAY'S POWER QUESTION                   │ │
│  │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │ │
│  │  [Math: Quadratics]                       │ │
│  │                                           │ │
│  │  If f(x) = x² - 4x + 3, what is the sum  │ │
│  │  of the x-intercepts?                    │ │
│  │                                           │ │
│  │  [A] 2   [B] 3   [C] 4   [D] 5           │ │
│  └───────────────────────────────────────────┘ │
│                                                 │
│  📊 Your Recent Accuracy: 73% Algebra          │
│  💡 This question targets your weak area       │
│                                                 │
│  [ ANSWER → GET TODAY'S MISSION ]              │
└─────────────────────────────────────────────────┘
```

**Flow:**
1. Answer 1 diagnostic question (based on weak areas)
2. See result + micro-explanation
3. Get today's personalized mission
4. Start studying → Earn XP

### 2.2 XP & Leveling System

```typescript
// src/lib/gamification.ts
export const XP_REWARDS = {
  daily_checkin: 50,
  question_correct: 10,
  question_incorrect: 3, // Still reward effort
  streak_bonus: (days: number) => days * 10, // Day 7 = 70 XP bonus
  feynman_session: 100, // Explaining concepts
  practice_test_complete: 200,
  video_watched: 25,
  flashcard_reviewed: 5,
  notes_saved: 15,
};

export const LEVELS = [
  { level: 1, name: 'Rookie', xp: 0, badge: '🌱' },
  { level: 2, name: 'Learner', xp: 500, badge: '📚' },
  { level: 3, name: 'Scholar', xp: 1500, badge: '🎓' },
  { level: 4, name: 'Expert', xp: 4000, badge: '🧠' },
  { level: 5, name: 'Master', xp: 8000, badge: '⚡' },
  { level: 6, name: 'Sage', xp: 15000, badge: '🔮' },
  { level: 7, name: 'Legend', xp: 30000, badge: '👑' },
];
```

### 2.3 Streak System Enhancement

```sql
-- Enhanced streak tracking
CREATE TABLE user_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users ON DELETE CASCADE,
  activity_date DATE NOT NULL,
  activity_type TEXT NOT NULL, -- 'daily_checkin', 'practice', 'review'
  xp_earned INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, activity_date, activity_type)
);

CREATE TABLE user_gamification (
  user_id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  total_xp INT DEFAULT 0,
  current_level INT DEFAULT 1,
  current_streak INT DEFAULT 0,
  longest_streak INT DEFAULT 0,
  last_activity_date DATE,
  streak_shield_active BOOLEAN DEFAULT FALSE, -- Premium feature
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Phase 3: Personalized AI Coach (Week 3-4)
*Goal: ATLAS becomes your personal tutor who knows your weaknesses*

### 3.1 Weakness Tracking System

```sql
CREATE TABLE user_subject_mastery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users ON DELETE CASCADE,
  exam_type TEXT NOT NULL, -- 'sat', 'act'
  domain TEXT NOT NULL, -- 'Algebra', 'Reading Comprehension'
  subdomain TEXT, -- 'Quadratic Equations'
  questions_attempted INT DEFAULT 0,
  questions_correct INT DEFAULT 0,
  mastery_score DECIMAL(3,2) DEFAULT 0, -- 0.00 to 1.00
  last_practiced TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, exam_type, domain, subdomain)
);
```

### 3.2 Adaptive Question Selection

```typescript
// src/lib/adaptiveEngine.ts
export async function selectNextQuestion(userId: string, examType: 'sat' | 'act'): Promise<Question> {
  // 1. Get user's mastery scores
  const mastery = await getUserMastery(userId, examType);
  
  // 2. Identify weakest domains (mastery < 0.6)
  const weakDomains = mastery.filter(m => m.mastery_score < 0.6);
  
  // 3. Weighted random selection (60% from weak, 40% from all)
  const targetDomain = Math.random() < 0.6 && weakDomains.length > 0
    ? weightedRandom(weakDomains)
    : weightedRandom(mastery);
  
  // 4. Select difficulty based on mastery
  const difficulty = getMasteryDifficulty(targetDomain.mastery_score);
  
  // 5. Fetch question
  return fetchQuestion(examType, targetDomain.domain, difficulty);
}

function getMasteryDifficulty(mastery: number): 'easy' | 'medium' | 'hard' {
  if (mastery < 0.4) return 'easy';
  if (mastery < 0.7) return 'medium';
  return 'hard';
}
```

### 3.3 Smart Study Plan Generation
Enhance the existing `generate-study-plan` edge function:

```typescript
// supabase/functions/generate-study-plan/index.ts

// Add to context before GPT call:
const masteryContext = await supabase
  .from('user_subject_mastery')
  .select('*')
  .eq('user_id', userId)
  .eq('exam_type', examType);

const prompt = `
Generate a personalized SAT study plan for a student with:
- Target Score: ${targetScore}
- Exam Date: ${examDate} (${daysUntilExam} days away)
- Available Hours/Week: ${hoursPerWeek}
- Key Weaknesses: ${weaknesses.join(', ')}

Mastery Data:
${JSON.stringify(masteryContext, null, 2)}

Focus 70% of practice on weak areas. Include:
1. Daily topics with time estimates
2. Specific practice question counts
3. Weekly practice test schedules
4. Rest days built in

Output as structured JSON...
`;
```

---

## Phase 4: Social & Accountability (Week 4-5)
*Goal: Students study with friends, not alone*

### 4.1 Study Groups

```sql
CREATE TABLE study_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  exam_type TEXT NOT NULL,
  target_date DATE,
  invite_code TEXT UNIQUE DEFAULT nanoid(8),
  created_by UUID REFERENCES auth.users,
  max_members INT DEFAULT 10,
  is_public BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE study_group_members (
  group_id UUID REFERENCES study_groups ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE,
  role TEXT DEFAULT 'member', -- 'admin', 'member'
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (group_id, user_id)
);

CREATE TABLE group_activity_feed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES study_groups ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE,
  activity_type TEXT NOT NULL, -- 'streak_milestone', 'test_completed', 'level_up'
  message TEXT NOT NULL,
  xp_earned INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 4.2 Leaderboards

```
┌─────────────────────────────────────────────────┐
│  🏆 THIS WEEK'S TOP PERFORMERS                  │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                                 │
│  1. 🥇 Sarah K.        +2,450 XP    🔥 23 days  │
│  2. 🥈 Marcus T.       +2,180 XP    🔥 15 days  │
│  3. 🥉 Emily R.        +1,920 XP    🔥 12 days  │
│  -------------------------------------------    │
│  14. You              +840 XP      🔥 5 days   │
│                                                 │
│  [ JOIN A STUDY GROUP ] [ INVITE FRIENDS ]     │
└─────────────────────────────────────────────────┘
```

### 4.3 Friend Challenges
- Challenge friends to 1-week sprints
- Compare practice test scores
- Compete on daily streaks
- Celebrate each other's wins (confetti animations!)

---

## Phase 5: Premium Value Prop (Week 5-6)
*Goal: Clear differentiation that justifies subscription*

### 5.1 Free vs Premium Tier

| Feature | Free | Premium ($9.99/mo) |
|---------|------|-------------------|
| Daily Check-In | ✅ | ✅ |
| Basic Practice (20 Qs/day) | ✅ | Unlimited |
| SAT Simulator | 1 Full Test/month | Unlimited |
| Feynman Board | 3 Sessions/day | Unlimited |
| Video Lessons | Sample Only | Full Access |
| AI Chat (ATLAS) | 10 msgs/day | Unlimited |
| Study Groups | Join Only | Create + Manage |
| Streak Shield | ❌ | ✅ (1/week) |
| Advanced Analytics | ❌ | ✅ |
| Score Predictor | ❌ | ✅ |
| Priority Support | ❌ | ✅ |

### 5.2 Score Prediction Feature (Premium)

```typescript
// Predict SAT score based on practice performance
export async function predictSATScore(userId: string): Promise<ScorePrediction> {
  const performance = await getPerformanceHistory(userId);
  const mastery = await getUserMastery(userId, 'sat');
  
  // Weighted calculation based on:
  // - Practice test scores (60%)
  // - Domain mastery progression (25%)
  // - Question accuracy trends (15%)
  
  return {
    predictedTotal: calculatePrediction(performance, mastery),
    confidenceRange: { low: score - 50, high: score + 50 },
    readingWritingPrediction: rwScore,
    mathPrediction: mathScore,
    improvementAreas: getTopWeaknesses(mastery, 3),
    daysToExam: getDaysUntilExam(userId),
    progressTrend: calculateTrend(performance), // 'improving', 'stable', 'declining'
  };
}
```

---

## Phase 6: College Prep Integration (Week 6-7)
*Goal: Expand value beyond test prep*

### 6.1 College Roadmaps Enhancement
Update existing `CollegeRoadmaps.tsx`:

- **College Match Quiz** — Based on scores, interests, budget
- **Application Timeline** — When to do what
- **Essay Brainstorm Tool** — AI-assisted Common App essay ideas
- **Scholarship Finder** — Based on profile

### 6.2 Score-to-College Mapping

```typescript
const COLLEGE_TIERS = {
  ivy_plus: { minSAT: 1500, colleges: ['Harvard', 'Yale', 'Princeton', 'MIT', 'Stanford'] },
  top_30: { minSAT: 1400, colleges: ['Duke', 'Northwestern', 'UCLA', 'Michigan'] },
  top_50: { minSAT: 1300, colleges: ['Boston U', 'Wisconsin', 'Illinois'] },
  selective: { minSAT: 1200, colleges: ['Penn State', 'Ohio State', 'Arizona State'] },
};

// Show user which colleges are "in range" vs "reach" vs "safety"
```

---

## 🔧 Technical Implementation Details

### Database Schema Updates

```sql
-- Run these migrations in order

-- 1. User Goals & Preferences
CREATE TABLE user_study_goals (
  user_id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  target_exam TEXT NOT NULL,
  target_score INT,
  exam_date DATE,
  hours_per_week INT,
  weak_areas TEXT[],
  study_style TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Gamification
CREATE TABLE user_gamification (
  user_id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  total_xp INT DEFAULT 0,
  current_level INT DEFAULT 1,
  current_streak INT DEFAULT 0,
  longest_streak INT DEFAULT 0,
  last_activity_date DATE,
  streak_shields_remaining INT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Daily Check-Ins
CREATE TABLE daily_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users ON DELETE CASCADE,
  checkin_date DATE NOT NULL,
  question_id UUID,
  user_answer TEXT,
  is_correct BOOLEAN,
  xp_earned INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, checkin_date)
);

-- 4. XP Transactions (Audit Log)
CREATE TABLE xp_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users ON DELETE CASCADE,
  amount INT NOT NULL,
  reason TEXT NOT NULL,
  source_type TEXT, -- 'question', 'test', 'streak', 'achievement'
  source_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Achievements
CREATE TABLE achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  xp_reward INT DEFAULT 0,
  rarity TEXT DEFAULT 'common' -- 'common', 'rare', 'epic', 'legendary'
);

CREATE TABLE user_achievements (
  user_id UUID REFERENCES auth.users ON DELETE CASCADE,
  achievement_id UUID REFERENCES achievements ON DELETE CASCADE,
  unlocked_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, achievement_id)
);
```

### New React Components Needed

```
src/components/
├── DailyCheckin/
│   ├── CheckinQuestion.tsx
│   ├── CheckinResult.tsx
│   └── TodaysMission.tsx
├── Gamification/
│   ├── XPCounter.tsx
│   ├── LevelBadge.tsx
│   ├── StreakDisplay.tsx
│   ├── AchievementPopup.tsx
│   └── LeaderboardCard.tsx
├── Social/
│   ├── StudyGroupCard.tsx
│   ├── GroupActivityFeed.tsx
│   ├── FriendsList.tsx
│   └── ChallengeCard.tsx
├── ScorePredictor/
│   ├── PredictionDashboard.tsx
│   └── ImprovementRoadmap.tsx
└── Onboarding/
    ├── GoalSelector.tsx
    ├── ExamPicker.tsx
    ├── ScheduleBuilder.tsx
    └── WeaknessAssessment.tsx
```

### Updated Navigation Structure

```typescript
// src/App.tsx - New Route Structure
<Routes>
  {/* Daily Experience */}
  <Route path="/" element={<DailyHome />} />  // New: Daily check-in + mission
  <Route path="/atlas" element={<AtlasWorkspace />} />
  
  {/* Practice */}
  <Route path="/practice" element={<PracticeHub />} />  // New: Unified practice
  <Route path="/sat-simulator" element={<SATSimulator />} />
  <Route path="/act-simulator" element={<ACTSimulator />} />  // New
  <Route path="/ap/:subject" element={<APPractice />} />  // New
  
  {/* Learning */}
  <Route path="/feynman" element={<FeynmanBoard />} />
  <Route path="/videos" element={<VideoLessons />} />
  <Route path="/flashcards" element={<Flashcards />} />  // Promote existing
  
  {/* Progress */}
  <Route path="/progress" element={<ProgressDashboard />} />  // Enhanced
  <Route path="/score-predictor" element={<ScorePredictor />} />  // New, Premium
  
  {/* Social */}
  <Route path="/groups" element={<StudyGroups />} />  // New
  <Route path="/groups/:id" element={<GroupDetail />} />  // New
  <Route path="/leaderboard" element={<Leaderboard />} />  // New
  
  {/* College */}
  <Route path="/college" element={<CollegeHub />} />  // Enhanced
  <Route path="/college/match" element={<CollegeMatch />} />  // New
  
  {/* Settings */}
  <Route path="/profile" element={<Profile />} />
  <Route path="/settings" element={<Settings />} />
</Routes>
```

---

## 📈 Success Metrics

### Retention KPIs
| Metric | Target (90 days) |
|--------|-----------------|
| D1 Retention | 60% |
| D7 Retention | 40% |
| D30 Retention | 25% |
| Weekly Active Users | 50% of signups |
| Avg Session Duration | 15+ minutes |
| Streak > 7 days | 30% of active users |

### Engagement KPIs
| Metric | Target |
|--------|--------|
| Daily Check-In Rate | 70% of DAU |
| Practice Questions/User/Day | 25 |
| Feynman Sessions/Week | 3 |
| Study Group Join Rate | 40% of users |

### Revenue KPIs
| Metric | Target |
|--------|--------|
| Free → Trial Conversion | 25% |
| Trial → Paid Conversion | 15% |
| Monthly Churn | < 8% |
| LTV:CAC Ratio | > 3:1 |

---

## 🚀 Launch Checklist

### Week 1-2: Foundation
- [ ] Remove CBSE/CUET code
- [ ] Create US exam types table
- [ ] Build enhanced onboarding
- [ ] Implement goal-setting flow

### Week 3-4: Habit Loop
- [ ] Build daily check-in system
- [ ] Implement XP/leveling
- [ ] Create streak tracking
- [ ] Add achievement system

### Week 5-6: Personalization
- [ ] Implement mastery tracking
- [ ] Build adaptive engine
- [ ] Enhance study plan AI
- [ ] Create weakness heatmap

### Week 7-8: Social
- [ ] Build study groups
- [ ] Create leaderboards
- [ ] Add friend system
- [ ] Implement challenges

### Week 9-10: Polish
- [ ] Premium features complete
- [ ] Score predictor
- [ ] College match tool
- [ ] Performance optimization

### Week 11-12: Launch Prep
- [ ] Beta testing
- [ ] Bug fixes
- [ ] Marketing site
- [ ] App Store assets (if mobile)

---

## 💡 Quick Wins (Do This Week)

1. **Remove "CBSE" and "CUET" from all user-facing text**
2. **Make the SAT Simulator the hero feature on landing**
3. **Add prominent streak counter to navbar**
4. **Send daily reminder push notifications**
5. **Add share buttons after practice tests (for social proof)**

---

## Questions to Validate

Before building, validate with target users:
1. Would you use an app that helps you study SAT daily in 5-10 minutes?
2. What's more motivating: competing with friends or personal goals?
3. Would you pay $10/month for unlimited practice + score prediction?
4. What's missing from current SAT prep apps?

---

*This plan is designed to be executed iteratively. Start with Phase 1-2 for immediate impact, then layer on complexity.*
