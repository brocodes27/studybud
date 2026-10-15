# Plan: Proactive Semester Intake & Break-Respectful Exam Planner

## Context & User Goal
The user observed that Curve currently does nothing when a new student arrives, leaving them self-dependent until they manually prompt. A student needs the app to proactively take initiative:
1. Ask: "Where are you in your semester, and what has been taught to you?"
2. Ask: "Do you have an exam recently, or do you want to enlist an upcoming exam (or multiple exams, multiple subjects, specific topics)?"
3. Append exams and topics with break-respectful pacing (rest intervals and pre-exam buffers).
4. Automatically synthesize and dynamically update the student's personal Study Plan so everything happens for them.
*Strict Constraint:* The existing beautiful onboarding flow (`/onboarding`, `OnboardingJourney.tsx`) MUST NOT be removed.

---

## Tasks

### Phase 1: Interactive Semester & Exam Intake Component
- [ ] Create `src/learning/agent/SemesterIntake.tsx`
  - Two-stage progressive intake:
    - **Stage 1 (Semester Position & Topics Taught)**:
      - Semester stage selection: Early Term (Weeks 1–4), Mid-Semester (Weeks 5–8), Late Term (Weeks 9–12), Finals Countdown.
      - Course & topic capture: Automatically pre-fills courses from `curve_study_preferences` / onboarding answers. Allows entering/tagging topics taught so far, with syllabus drop option.
    - **Stage 2 (Exam Enlistment & Break-Respectful Pacing)**:
      - Multi-exam builder: Add multiple exams with subject, target date, and topic scope (all taught vs specific chapters).
      - Break-respectful pacing controls: Weekly rest day scheduling, pre-exam 48h buffer, and daily minutes allocation.
  - Plan synthesis engine: Converts the intake into a structured `StudyPlan` with realistic spaced learn/practice/checkpoint steps and designated rest breaks.

### Phase 2: Workspace Integration & Proactive Opening
- [ ] Update `src/learning/agent/DashboardHome.tsx`:
  - When no active plan exists, feature the `SemesterIntake` prominently as the primary action hub instead of the generic passive "Add your first material" card.
  - When a plan exists, display the active semester roadmap: upcoming exam countdown badges, progress through taught topics, and today's study block.
- [ ] Update `src/learning/agent/AgentWorkspace.tsx`:
  - When `messages.length === 0`, proactive opening greeting from Curve asking about semester position and topics taught, with responsive quick chips.
  - Provide an option to re-open or edit the semester plan & exams at any time from the workspace options.
  - On plan creation from intake, seamlessly dispatch `build_plan` / update `thread.state.plan`, light up `StudyPlanBanner`, and announce the plan in the conversation.

### Phase 3: Visual Polish & Aesthetics
- [ ] Style `SemesterIntake` in `src/learning/agent/workspace.css`:
  - Match Curve's aesthetic design system: clean cards, soft glass atmosphere, Inter typography, warm accents (`#252824`, `#f5f8f5`, `#e2defa`, `#e4f5cf`, `#f8e8d9`), subtle transitions, and accessible form controls.

### Phase 4: Verification & Testing
- [ ] Verify TypeScript build (`npm run build` or `tsc --noEmit`).
- [ ] Verify that existing onboarding (`/onboarding`) remains untouched and fully functional.
- [ ] Verify the complete first-time user experience in `AgentWorkspace`: proactive greeting, stage 1 intake, stage 2 multi-exam enlistment with break-respectful pacing, and instant study plan generation.
