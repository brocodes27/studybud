import { scopeLibrary } from '../../../supabase/functions/_shared/semester-scope';
import type { Material, StudySession } from '../model';
import type { SemesterPlan } from './contracts';
import { localDate, plannedSessionContext, semesterExamTimeline } from './semesterPlanner';

const normalized = (value: string) => value.trim().toLowerCase();

export function sessionEvidence(session: StudySession) {
  const results = session.results || [];
  return {
    total: results.length,
    correct: results.filter(result => result.correct).length,
    missed: results.filter(result => !result.correct).length,
    assisted: results.filter(result => result.correct && result.assisted).length,
  };
}

/** Recommends within the scheduled subject and exam scope; saved results are the evidence. */
export function dailyFocus(plan: SemesterPlan, materials: Material[], sessions: StudySession[], now = new Date()) {
  materials = scopeLibrary(materials, plan);
  const day = plan.roadmap.find(item => item.date === localDate(now));
  if (!day || !['study', 'buffer'].includes(day.type) || !day.course || !day.topics?.length) return null;
  const course = day.course;
  const exam = semesterExamTimeline(plan, now).upcoming.find(item => normalized(item.course) === normalized(course));
  const topics = exam?.topics.length ? exam.topics : plan.courses.find(item => normalized(item.course) === normalized(course))?.taughtTopics || day.topics;
  const allowed = new Set(topics.map(normalized));
  const materialIds = new Set(materials.filter(material => normalized(material.metadata.course || '') === normalized(course) && material.metadata.confirmed).map(material => material.id));
  const recent = sessions.filter(session => {
    const timestamp = Date.parse(session.completed_at || session.created_at);
    return materialIds.has(session.material_id) && allowed.has(normalized(session.topic)) && timestamp <= now.getTime() && timestamp >= now.getTime() - 14 * 86400000;
  }).sort((a, b) => Date.parse(b.completed_at || b.created_at) - Date.parse(a.completed_at || a.created_at));
  // Newer evidence replaces older struggles; don't repeatedly prescribe a resolved gap.
  const latest = recent.filter((session, index) => recent.findIndex(other => normalized(other.topic) === normalized(session.topic)) === index);
  const finishedToday = recent.find(session => session.completed_at && localDate(new Date(session.completed_at)) === localDate(now));
  const unfinished = latest.find(session => !session.completed_at && session.questions.length);
  const gap = latest.find(session => session.completed_at && session.results?.length && (sessionEvidence(session).missed > 0 || sessionEvidence(session).assisted > 0));
  const evidence = finishedToday || unfinished || gap;
  const topic = evidence?.topic || day.topics[0];
  const context = plannedSessionContext(course, topic, materials, recent, now);
  const result = evidence?.completed_at ? sessionEvidence(evidence) : null;
  const reason = finishedToday ? 'You’ve finished today’s session. Review what needs attention, then take a break.'
    : unfinished ? 'Your answers are saved. Continue from where you stopped.'
    : gap && result?.missed ? `You missed ${result.missed} of ${result.total} questions on this topic in your last session.`
    : gap && result?.assisted ? `You used help on ${result.assisted} correct answer${result.assisted === 1 ? '' : 's'} last time. Try recalling it again.`
    : exam ? `This topic is in your ${exam.title} scope.`
    : 'This is one of the topics you’ve covered in class. A short practice will show what you remember.';
  return { day, course, topic, exam, context, reason, evidence, result };
}
