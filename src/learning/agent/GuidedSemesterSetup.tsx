import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { fetchLibrary } from '../api';
import type { Material } from '../model';
import { SetupFrame, type StudyPreferences } from '../Onboarding';
import { MaterialUpload } from '../Workspace';
import type { SemesterPlan } from './contracts';
import { SemesterIntake } from './SemesterIntake';
import './dashboard.css';
import './free-preview.css';

export function GuidedSemesterSetup({ initial, onSave, demo = false }: {
  initial: StudyPreferences; onSave: (preferences: StudyPreferences) => Promise<void>; demo?: boolean;
}) {
  const { user } = useAuth();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(!demo && !!user);
  const initialPlan = (initial.onboarding_answers as unknown as { semester_plan?: SemesterPlan })?.semester_plan;
  useEffect(() => {
    if (demo || !user) return;
    let cancelled = false;
    fetchLibrary(user.id).then(library => { if (!cancelled) setMaterials(library.materials); })
      .catch(() => { if (!cancelled) setError('Your syllabus could not load. You can enter your subjects and taught topics below.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [demo, user?.id]);
  return <SetupFrame step={0} demo={demo}>
    <div className="guided-semester-setup">
      {error && <p role="alert">{error}</p>}
      {loading ? <p role="status">Preparing your semester setup…</p> : <SemesterIntake
        materials={materials} initialCourses={initial.courses} initialPlan={initialPlan}
        initialDailyMinutes={initial.daily_minutes} busy={busy}
        onUploadSyllabusClick={!demo && materials.length === 0 ? () => setUploading(true) : undefined}
        onSavePlan={async (semesterPlan, studyPlan) => {
          setBusy(true);
          try {
            await onSave({ ...initial, completed: true, goal: semesterPlan.exams.some(e => !e.isRecent) ? 'exam' : 'routine',
              courses: semesterPlan.courses.map(c => c.course),
              daily_minutes: [10, 20, 30, 45].includes(semesterPlan.dailyMinutes || 0) ? semesterPlan.dailyMinutes! : initial.daily_minutes,
              exam_date: semesterPlan.exams.filter(e => !e.isRecent).sort((a, b) => a.date.localeCompare(b.date))[0]?.date || '',
              onboarding_answers: { ...initial.onboarding_answers, semester_plan: semesterPlan, day_one_plan: studyPlan } as unknown as StudyPreferences['onboarding_answers'],
            });
          } finally { setBusy(false); }
        }} />}
    </div>
    {uploading && <MaterialUpload singleUpload onClose={() => setUploading(false)} onSaved={material => {
      setMaterials([material]); setUploading(false); if (material.topicAnalysisError) setError(material.topicAnalysisError);
    }} />}
  </SetupFrame>;
}
