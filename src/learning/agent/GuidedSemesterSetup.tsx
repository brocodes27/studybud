import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { confirmMaterial, fetchLibrary, fetchMaterial } from '../api';
import type { Material } from '../model';
import { SetupFrame, type StudyPreferences } from '../Onboarding';
import { MaterialUpload } from '../Workspace';
import type { SemesterPlan, StudyPlan } from './contracts';
import { SemesterIntake } from './SemesterIntake';
import { MaterialFirstSetup } from './MaterialJourney';
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
  const [manual, setManual] = useState(!!initialPlan);
  useEffect(() => {
    if (demo || !user) return;
    let cancelled = false;
    fetchLibrary(user.id).then(library => { if (!cancelled) setMaterials(library.materials); })
      .catch(() => { if (!cancelled) setError('Your materials could not load. You can upload again or set up your topics manually.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [demo, user?.id]);
  async function savePlan(semesterPlan: SemesterPlan, studyPlan: StudyPlan) {
    setBusy(true);
    try {
      await onSave({ ...initial, completed: true, goal: semesterPlan.exams.some(e => !e.isRecent) ? 'exam' : 'routine',
        courses: semesterPlan.courses.map(c => c.course),
        daily_minutes: [10, 20, 30, 45].includes(semesterPlan.dailyMinutes || 0) ? semesterPlan.dailyMinutes! : initial.daily_minutes,
        exam_date: semesterPlan.exams.filter(e => !e.isRecent).sort((a, b) => a.date.localeCompare(b.date))[0]?.date || '',
        onboarding_answers: { ...initial.onboarding_answers, semester_plan: semesterPlan, day_one_plan: studyPlan } as unknown as StudyPreferences['onboarding_answers'],
      });
    } finally { setBusy(false); }
  }
  return <SetupFrame step={0} demo={demo}>
    <div className="guided-semester-setup">
      {error && <p role="alert">{error}</p>}
      {loading ? <p role="status">Preparing your course materials…</p> : manual ? <>
        {!initialPlan && <button className="learn-button subtle" onClick={() => setManual(false)}><ArrowLeft size={16} /> Start with my material</button>}
        <SemesterIntake materials={materials} initialCourses={initial.courses} initialPlan={initialPlan}
          initialDailyMinutes={initial.daily_minutes} busy={busy}
          onUploadSyllabusClick={!demo && user ? () => setUploading(true) : undefined}
          onSavePlan={savePlan} />
      </> : <MaterialFirstSetup materials={materials} initialDailyMinutes={initial.daily_minutes} busy={busy}
        onUploadClick={!demo && user ? () => setUploading(true) : undefined}
        onManualSetup={() => setManual(true)} onSavePlan={savePlan}
        onLoadMaterial={async material => user ? fetchMaterial(material.id, user.id) : material}
        onConfirmMaterial={async material => {
          if (!user || demo) throw new Error('Sign in to save your course material.');
          const saved = await confirmMaterial(user.id, material);
          setMaterials(current => current.map(item => item.id === saved.id ? saved : item));
        }} />}
    </div>
    {uploading && <MaterialUpload onClose={() => setUploading(false)} onSaved={material => {
      setMaterials(current => [material, ...current.filter(item => item.id !== material.id)]); setUploading(false); setError('');
      if (user) {
        setLoading(true);
        fetchLibrary(user.id).then(library => setMaterials(library.materials.map(item => item.id === material.id ? material : item)))
          .catch(() => setError('Your upload is saved. Reload setup to see all imported subjects.'))
          .finally(() => setLoading(false));
      }
    }} />}
  </SetupFrame>;
}
