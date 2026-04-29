# Ranjan Sir Execution Control Room Design

Date: 2026-04-29

## Summary

Ranjan Sir should become the school/coaching execution layer for exam preparation: a system that turns class truth into student-specific daily missions, watches whether execution is actually happening, and automatically repairs drift before it becomes damage.

The first institutional version focuses on two daily operators:

- Teachers, who provide the fresh class signal and need fast classroom action.
- Student-success mentors, whose recovery work should be mostly automated for routine cases and escalated only when patterns become serious.

The north-star metric is daily mission completion. Backlog reduction, post-test improvement, and teacher time saved are proof metrics that show the platform is superior to passive dashboards, LMS tools, and generic AI tutors.

## Product Positioning

Ranjan Sir is not an AI tutor, generic planner, LMS, or doubt solver. It is an Execution OS for exam preparation.

The core promise is:

> Never ask "aaj kya karna hai" again.

Students fail when daily clarity, revision, test correction, consistency, and emotional regulation break across months of preparation. The product should reduce choices and increase action by deciding the exact next step from coaching curriculum, student state, and recent execution signals.

## Existing Codebase Fit

The current repo already has many pieces needed for this direction:

- Student daily surface: `src/components/DailyBriefing/DailyBriefing.tsx`
- Teacher/class surface: `src/pages/TeacherClassDashboard.tsx`
- Parent visibility: `src/pages/ParentDashboard.tsx`
- Daily mission engine: `supabase/functions/plan-daily-mission/index.ts`
- Daily prescription wrapper: `supabase/functions/generate-daily-prescription/index.ts`
- Task completion source of truth: `task_completions_v2`
- Behavioral profile refresh: `refresh_behavioral_profile`
- User memory: `user_memory`
- Test diagnosis: `analyse-test-result`, `classify-test-error`
- Correction sprint generation: `generate-correction-sprint`
- Mastery/proof loops: Prove-It, mastery reports, receipts, and outcome dashboards
- Coaching/school schema: classes, class sessions, attendance, parent links, school roadmaps, curriculum upload

This design should reuse those systems and add only the missing institutional execution glue.

## Scope

### In Scope

- Upgrade the teacher daily loop so teachers can log class truth and trigger proof work quickly.
- Generate student missions from class sessions, roadmaps, mastery, backlog, behavior, and tests.
- Add an automated intervention ladder for missed missions, avoidance, backlog growth, and post-test repair.
- Add a mentor/risk queue inside the school/coaching experience.
- Measure daily mission completion, backlog health, correction sprint progress, post-test movement, and teacher time saved.
- Keep parent visibility as a downstream proof surface, not the primary operator experience.

### Out Of Scope

- Marketplace features.
- A large content library.
- Chatbot-first product flows.
- Generic AI tutoring as the main product.
- Fully autonomous sensitive escalation without human visibility.
- A separate admin-first academic operating system in this first spec.

## Operators

### Teacher Lane

The teacher keeps the system grounded in daily reality.

Core teacher actions:

- Log today's class: subject, topic, subtopics, homework, module range, DPP, duration, attendance, and optional test context.
- Assign proof work: Prove-It attempt, worksheet, timed set, recall check, or reading/task proof.
- Review classroom heatmap: mastered, fragile, stuck, absent, low adherence, and post-test repair needed.
- Send targeted class actions: group rescue block, correction sprint reminder, proof requirement, or assignment.

The teacher lane should be fast. If it feels like maintaining another LMS, the product loses.

### Student-Success Mentor Lane

The mentor lane is mostly automated.

The system should automatically detect routine execution drift, take small corrective action, and expose a queue for cases that need human attention.

Core mentor signals:

- Missed missions.
- Subject avoidance.
- Shrinking session duration.
- Backlog growth.
- Test avoidance.
- Correction sprint avoidance.
- Attendance risk.
- Repeated low adherence.

Core mentor actions:

- Compress tomorrow's mission.
- Insert a rescue block.
- Require proof of completion.
- Trigger or prioritize correction sprints.
- Escalate repeated failures to a human mentor or teacher.

## Student Loop

The student experience should remain centered on one thing: today's mission.

The mission should contain:

- Three finite tasks where possible.
- A visible total duration.
- Low-energy, normal, and beast-mode variants.
- A "why this today" explanation based on class, test, backlog, mastery, and behavior signals.
- Proof requirements when intervention level requires proof.
- Clear completion state.
- Optional task output upload.

The product should avoid showing many competing choices. Exploration can exist after completion, but execution comes first.

## Automated Intervention Ladder

### Level 0: Normal Execution

Student receives and completes the daily mission.

System behavior:

- Track completion.
- Update streaks and mission metrics.
- Refresh behavioral profile.
- Keep risk state clear.

### Level 1: Gentle Recovery

Trigger examples:

- One missed mission.
- Low engagement.
- Shorter-than-usual session.

Automated action:

- Compress the next mission into a minimum-required version.
- Explain the reason in plain language.
- Keep the action small enough to restart momentum.

### Level 2: Avoidance Repair

Trigger examples:

- Repeatedly skipped subject.
- Backlog increase.
- Missed correction task.
- Two or more missed missions in a short window.

Automated action:

- Insert a 15-25 minute rescue block.
- Prefer one specific task over a broad recommendation.
- Add proof requirement when appropriate.
- Mark the intervention as active and track outcome.

### Level 3: Proof Escalation

Trigger examples:

- Level 1-2 intervention failed.
- Student claims completion but no proof exists for a high-risk task.
- Post-test correction sprint not started.

System action:

- Require proof upload, Prove-It attempt, or timed-set submission.
- Add the student to the mentor risk queue.
- Recommend the next human action but do not silently escalate externally.

### Level 4: Human Escalation

Trigger examples:

- Repeated absences.
- Sharp adherence collapse.
- Serious backlog growth.
- Repeated bad-test avoidance.
- Multiple unresolved Level 3 items.

System action:

- Add high-priority mentor/teacher queue item.
- Show the root cause, automatic actions already taken, and suggested next action.
- Prepare a parent-ready summary where parent linkage exists.

## UI Design

### Teacher Daily Teaching Loop

Location: `TeacherClassDashboard`, inside the existing Daily Teaching Loop tab for the MVP.

Key modules:

- Class log form with topic, subtopics, homework, duration, attendance, and proof assignment.
- Today's class execution summary.
- Student completion table for today's mission.
- Skill/readiness heatmap connected to class topics.
- One-click interventions for selected students or groups.

### Mentor Risk Queue

Location: teacher/class dashboard for MVP.

Columns:

- Student.
- Trigger.
- Severity.
- Automatic action taken.
- Outcome status.
- Suggested next action.
- Last mission status.
- Backlog count.
- Correction sprint status.

Risk groups:

- Missed mission.
- Subject avoidance.
- Backlog growth.
- Post-test repair needed.
- Attendance risk.
- Proof pending.

### Student Today Mission

Location: existing Daily Briefing.

Improvements:

- More explicit "why this today."
- Low, normal, and beast-mode mission variants.
- Proof upload when required.
- Clear connection to class session or correction sprint.
- Stronger completed-state feedback.

### Parent Surface

Location: existing Parent Dashboard.

Parent view should stay proof-oriented:

- Mission completion.
- Backlog health.
- Latest test/correction progress.
- Attendance risk.
- Short Ranjan Sir summary.

The parent view should not become a command center in this first version.

## Data Model

### New Table: `interventions`

Purpose: record automated and human intervention attempts.

Suggested fields:

- `id`
- `student_user_id`
- `class_id`
- `roadmap_id`
- `trigger_type`
- `trigger_source`
- `severity`
- `intervention_level`
- `action_type`
- `action_payload`
- `status`
- `created_by`
- `created_by_type`
- `created_at`
- `resolved_at`
- `outcome`
- `outcome_metric`

Trigger types:

- `missed_mission`
- `subject_avoidance`
- `shrinking_sessions`
- `backlog_growth`
- `test_avoidance`
- `correction_sprint_stalled`
- `attendance_risk`
- `proof_pending`

Action types:

- `compress_plan`
- `rescue_block`
- `proof_required`
- `correction_sprint_priority`
- `teacher_review`
- `parent_summary`

### Existing Tables To Reuse

- `class_sessions`: teacher class truth.
- `daily_prescriptions`: generated missions.
- `task_completions_v2`: completion source of truth.
- `task_outputs`: proof and submissions.
- `student_behavioral_profiles`: adherence, backlog, risk signals.
- `test_results`: score and weak-topic context.
- `test_attempt_questions`: classified per-question telemetry.
- `correction_sprints`: post-test repair plan.
- `student_roadmaps`: active curriculum flow.
- `user_subject_mastery` and related mastery tables: weak/strong areas.
- `parent_student_links`: parent visibility.

### Metric Aggregation

Add class-level aggregation either as RPCs, views, or materialized summaries after implementation details are chosen.

Core metrics:

- Daily mission completion rate.
- Mission completion by class, subject, and student.
- Backlog count and backlog burn-down.
- Correction sprint start/completion rate.
- Test readiness or score movement after correction sprint.
- Teacher actions saved: automated interventions, grouped recommendations, and pre-filled risk explanations.
- Unresolved risk count.
- Intervention success/failure rate.

## Agentic Behavior

The platform is agentic when it does more than explain.

Minimum agentic behaviors for this spec:

- Generates daily missions from current class and student state.
- Detects execution drift without waiting for student self-report.
- Chooses Level 1-2 intervention automatically.
- Creates an auditable intervention record.
- Updates the next daily mission based on intervention state.
- Surfaces only unresolved or serious issues to humans.
- Measures whether the intervention worked.

The system should make small reversible decisions automatically and keep high-stakes actions visible to teachers or mentors.

## Error Handling

- If no class session exists, generate from roadmap and previous mission context.
- If behavioral profile is missing, create or refresh a default profile.
- If mission generation fails, show a deterministic fallback mission rather than a blank day.
- If proof upload fails, preserve completion intent locally and retry or show a clear error.
- If intervention generation fails, log the failure and keep the student visible in the risk queue.
- If metric aggregation fails, never block teacher logging or student mission completion.

## Testing Strategy

Unit and integration tests should focus on behavior, not just rendering.

Important checks:

- Class log creates or updates the expected class session signal.
- Mission generation uses class session context when available.
- Missed mission creates Level 1 intervention.
- Repeated subject avoidance creates Level 2 rescue block.
- Failed Level 2 intervention appears in the mentor risk queue.
- Proof-required tasks cannot be marked fully resolved without proof or teacher override.
- Completion metrics count `task_completions_v2` correctly.
- Backlog metrics ignore completed tasks and count overdue work.
- Teacher dashboard handles empty classes, missing profiles, and partially migrated schemas.
- Student daily mission remains usable with fallback data.

## Rollout Plan

1. Add the intervention data model and helper APIs.
2. Upgrade teacher class logging and proof assignment flow.
3. Add automated Level 1-2 intervention generation.
4. Add mentor risk queue inside the teacher dashboard.
5. Tighten student mission UI around variants, reasons, and proof.
6. Add class-level metric cards and aggregation.
7. Connect parent-ready proof summaries.

## Open Decisions For Implementation Planning

- Whether intervention generation should run on mission fetch, task completion, scheduled cron, or all three with idempotency.
- Whether class-level metrics should be SQL views, RPCs, or cached summary rows.
- How strict proof-required completion should be for the first release.
- Whether the risk queue lives as a new route or as a tab inside `TeacherClassDashboard`.
- How to represent low, normal, and beast-mode variants in `daily_prescriptions.tasks` without breaking existing UI.
