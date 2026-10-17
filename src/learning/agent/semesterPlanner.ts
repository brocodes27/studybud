import type { Material, StudySession } from '../model';
import type { SemesterPlan, StudyPlan, StudyPlanStep } from './contracts';

export function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function semesterExamTimeline(plan: SemesterPlan, now = new Date()) {
  const today = localDate(now);
  return {
    upcoming: plan.exams.filter(e => !e.isRecent && e.date >= today).sort((a, b) => a.date.localeCompare(b.date)),
    elapsed: plan.exams.filter(e => e.date < today || (e.isRecent && e.date === today)).sort((a, b) => b.date.localeCompare(a.date)),
  };
}

/** Rebuild from the student's confirmed subjects, exam scopes, and rest preferences. */
export function buildSemesterSchedule(plan: SemesterPlan, dailyMinutes: number, now = new Date()): { semesterPlan: SemesterPlan; studyPlan: StudyPlan } {
  // Discard stale exam scope after a student removes topics or changes subjects.
  plan = { ...plan, exams: plan.exams.filter(exam => plan.courses.some(c => c.course === exam.course)).map(exam => ({
    ...exam, topics: exam.topics.filter(topic => plan.courses.find(c => c.course === exam.course)!.taughtTopics.includes(topic)),
  })) };
  const { upcoming } = semesterExamTimeline(plan, now);
  const allocations = new Map<string, number>();
  const topicOffsets = new Map<string, number>();
  const roadmap: SemesterPlan['roadmap'] = [];
  const restDays = (plan.breaks.preferredRestDays?.length ? plan.breaks.preferredRestDays : ['Sunday', 'Wednesday']).slice(0, plan.breaks.restDaysPerWeek);
  if (restDays.length < plan.breaks.restDaysPerWeek && !restDays.includes('Wednesday')) restDays.push('Wednesday');
  for (let index = 0; index < 14; index++) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + index, 12);
    const iso = localDate(date);
    const weekday = date.toLocaleDateString('en-US', { weekday: 'long' });
    const dayLabel = index === 0 ? 'Today' : index === 1 ? 'Tomorrow' : weekday.slice(0, 3);
    const base = { date: iso, dayLabel };
    const examsToday = upcoming.filter(e => e.date === iso);
    const pending = upcoming.filter(e => e.date > iso);
    const daysAway = (value: string) => Math.round((Date.parse(value) - Date.parse(iso)) / 86400000);
    const bufferExams = pending.filter(e => daysAway(e.date) <= plan.breaks.preExamBufferHours / 24);
    if (examsToday.length) {
      roadmap.push({ ...base, type: 'exam', title: examsToday.map(e => e.title).join(' · '), course: examsToday.map(e => e.course).join(', '), topics: [...new Set(examsToday.flatMap(e => e.topics))], minutes: 0 });
      continue;
    }
    // Keep rest days even when another subject has an approaching exam.
    if (restDays.includes(weekday)) {
      roadmap.push({ ...base, type: 'rest', title: 'Rest & recharge', minutes: 0 });
      continue;
    }
    const candidates = (bufferExams.length ? bufferExams : pending).map(exam => ({
      key: exam.id, course: exam.course,
      topics: exam.topics.length ? exam.topics : plan.courses.find(c => c.course === exam.course)?.taughtTopics || [],
      priority: 3 / (daysAway(exam.date) + 1),
    }));
    if (!bufferExams.length) {
      for (const exam of plan.exams.filter(e => e.isRecent && e.topics.length && !pending.some(p => p.course === e.course))) {
        candidates.push({ key: exam.id, course: exam.course, topics: exam.topics, priority: 0.3 });
      }
      for (const course of plan.courses) {
        if (!candidates.some(c => c.course === course.course)) candidates.push({ key: course.course, course: course.course, topics: course.taughtTopics, priority: 0.25 });
      }
    }
    const selected = candidates.filter(c => c.topics.length).sort((a, b) => b.priority / (1 + (allocations.get(b.key) || 0)) - a.priority / (1 + (allocations.get(a.key) || 0)))[0];
    if (!selected) {
      roadmap.push({ ...base, type: 'rest', title: 'Add taught topics to plan your next session', minutes: 0 });
      continue;
    }
    const offset = topicOffsets.get(selected.key) || 0;
    const topic = selected.topics[offset % selected.topics.length];
    topicOffsets.set(selected.key, offset + 1);
    allocations.set(selected.key, (allocations.get(selected.key) || 0) + 1);
    roadmap.push({ ...base, type: bufferExams.length ? 'buffer' : 'study', title: bufferExams.length ? `Light review: ${topic}` : `Study: ${topic}`, course: selected.course, topics: [topic], minutes: bufferExams.length ? Math.min(dailyMinutes, 20) : dailyMinutes });
  }
  const first = roadmap[0];
  const minutes = first.minutes || 0;
  const topic = first.topics?.[0];
  const learn = Math.round(minutes * 0.35);
  const check = Math.round(minutes * 0.15);
  const steps: StudyPlanStep[] = topic && minutes ? [
    { materialId: '', topic: `${topic} — Concept Clarification`, minutes: learn, kind: 'learn' },
    { materialId: '', topic: `${topic} — ${upcoming.length ? 'Exam Practice' : 'Spaced Practice'}`, minutes: minutes - learn - check, kind: 'practice' },
    { materialId: '', topic: `${topic} — Quick Gap Check`, minutes: check, kind: 'checkpoint' },
  ] : [];
  return { semesterPlan: { ...plan, dailyMinutes, roadmap, updatedAt: now.toISOString() }, studyPlan: { minutes, steps } };
}

/** Match both course and topic so identical topic names across subjects stay separate. */
export function plannedSessionContext(course: string, topic: string, materials: Material[], sessions: StudySession[], now = new Date()) {
  const normalize = (value: string) => value.trim().toLowerCase();
  const matches = materials.filter(material => normalize(material.metadata.course || '') === normalize(course) &&
    material.metadata.confirmed && material.metadata.topics?.some(t => normalize(t) === normalize(topic)));
  const ids = new Set(matches.map(material => material.id));
  const relevant = sessions.filter(session => ids.has(session.material_id) && normalize(session.topic) === normalize(topic));
  return {
    material: matches[0],
    pending: relevant.find(session => !session.completed_at && session.questions?.length),
    completed: relevant.find(session => session.completed_at && localDate(new Date(session.completed_at)) === localDate(now)),
  };
}
