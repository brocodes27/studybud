import type { SemesterPlan } from './contracts';

export const SEMESTER_STAGES = [
  { id: 'early', label: 'Early Semester' },
  { id: 'mid', label: 'Mid-Semester' },
  { id: 'late', label: 'Late Semester' },
  { id: 'finals', label: 'Finals Countdown' },
] as const;

export function SemesterContextFields({ semester, stage, semesters = [], onSemester, onStage }: {
  semester: string; stage: SemesterPlan['stage'] | ''; semesters?: string[];
  onSemester: (value: string) => void; onStage: (value: SemesterPlan['stage']) => void;
}) {
  const options = [...new Set([...semesters, ...Array.from({ length: 12 }, (_, i) => `Semester ${i + 1}`)])];
  return <div className="journey-fields">
    <label className="journey-field">Which semester are you in?
      <select value={semester} onChange={e => onSemester(e.target.value)}><option value="">Choose your current semester</option>{options.map(value => <option key={value}>{value}</option>)}</select>
    </label>
    <label className="journey-field">Where are you in this semester?
      <select value={stage} onChange={e => onStage(e.target.value as SemesterPlan['stage'])}><option value="">Choose your current stage</option>{SEMESTER_STAGES.map(value => <option key={value.id} value={value.id}>{value.label}</option>)}</select>
    </label>
    <p className="journey-small">We’ll use this semester’s syllabus. You’ll confirm the topics covered in class or included in your current exam.</p>
  </div>;
}
