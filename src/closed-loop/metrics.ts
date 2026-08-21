export interface AssignmentAudience {
  assignee_ids?: string[] | null;
}

export interface LearningSessionEvidence {
  duration_seconds: number;
  mastery_delta: number | null;
}

export interface VerifiedMasteryEvidence extends LearningSessionEvidence {
  mastery_after?: number | null;
  evidence_quality?: number | null;
}

export function summarizeVerifiedMastery(
  sessions: VerifiedMasteryEvidence[],
  threshold = 0.7,
) {
  const verified = sessions.filter(
    (session) =>
      session.mastery_after != null &&
      Number(session.evidence_quality ?? 0) >= threshold,
  );
  const score = verified.length
    ? Math.round((verified.reduce((sum, session) => sum + Number(session.mastery_after), 0) / verified.length) * 100)
    : null;
  return {
    score,
    evidenceCount: verified.length,
    improvedCount: verified.filter((session) => Number(session.mastery_delta) > 0).length,
  };
}

export interface AssignmentProgressInput extends AssignmentAudience {
  id: string;
}

export interface SubmissionProgressInput {
  assignment_id: string;
  graded_at?: string | null;
  feedback?: string | null;
  assessment_details?: {
    evidence_quality?: number | null;
  } | null;
}

export function calculateExpectedSubmissions(
  assignments: AssignmentAudience[],
  rosterSize: number,
) {
  return assignments.reduce(
    (sum, assignment) =>
      sum +
      (Array.isArray(assignment.assignee_ids) && assignment.assignee_ids.length
        ? assignment.assignee_ids.length
        : rosterSize),
    0,
  );
}

export function calculateAssignmentProgress<T extends AssignmentProgressInput>(
  assignments: T[],
  submissions: SubmissionProgressInput[],
  rosterSize: number,
  limit = 6,
) {
  return assignments.slice(0, limit).map((assignment) => {
    const expected = Array.isArray(assignment.assignee_ids) && assignment.assignee_ids.length
      ? assignment.assignee_ids.length
      : rosterSize;
    const submitted = submissions.filter(
      (submission) => submission.assignment_id === assignment.id,
    ).length;
    return {
      ...assignment,
      expected,
      submitted,
      percent: expected ? Math.min(100, Math.round((submitted / expected) * 100)) : 0,
    };
  });
}

export function submissionNeedsHumanReview(submission: SubmissionProgressInput) {
  const feedback = String(submission.feedback || '').toLowerCase();
  const evidenceQuality = submission.assessment_details?.evidence_quality;
  const wasFlaggedForVisualReview = feedback.includes('visual review');
  const hasWeakAssessmentEvidence =
    evidenceQuality != null && Number(evidenceQuality) < 0.5;

  return wasFlaggedForVisualReview || hasWeakAssessmentEvidence || !submission.graded_at;
}

export function calculateMasteryPerMinute(sessions: LearningSessionEvidence[]) {
  const measured = sessions.filter(
    (session) => session.mastery_delta != null && Number(session.duration_seconds) > 0,
  );
  const minutes = measured.reduce(
    (sum, session) => sum + Number(session.duration_seconds) / 60,
    0,
  );
  if (!minutes) return null;
  const delta = measured.reduce(
    (sum, session) => sum + Number(session.mastery_delta),
    0,
  );
  return (delta * 100) / minutes;
}

export function gapAssigneesFromKnowledge(
  knowledge: Array<{ user_id?: string; topic?: string; confidence?: number }>,
  topic: string | string[],
  threshold = 0.65,
) {
  const needles = (Array.isArray(topic) ? topic : [topic])
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  const ids = new Set<string>();
  for (const row of knowledge) {
    if (!row.user_id) continue;
    const rowTopic = String(row.topic || '').toLowerCase();
    const matches = !needles.length || needles.some(
      (needle) => !rowTopic || rowTopic.includes(needle) || needle.includes(rowTopic),
    );
    if (!matches) continue;
    if (Number(row.confidence ?? 1) < threshold) ids.add(row.user_id);
  }
  return Array.from(ids);
}

/** Student-safe projection — never persist answer keys or explanations. */
export function sanitizeDraftQuestions(
  questions: Array<Record<string, unknown>>,
  topic?: string | null,
) {
  return questions
    .map((question) => ({
      id: typeof question.id === 'string' ? question.id : undefined,
      question: String(question.question || question.question_text || question.prompt || '').trim(),
      options: Array.isArray(question.options) ? (question.options as string[]) : null,
      difficulty: typeof question.difficulty === 'string' ? question.difficulty : null,
      topic: (typeof question.topic === 'string' ? question.topic : null) || topic || null,
    }))
    .filter((question) => question.question);
}
