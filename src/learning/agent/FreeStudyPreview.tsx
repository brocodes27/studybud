import { LearningPageFrame } from '../LearningPageFrame';
import { passPrice } from '../../../supabase/functions/_shared/curve-billing';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { fetchLibrary, learningAction } from '../api';
import type { Material } from '../model';
import type { StudyPreferences } from '../Onboarding';
import { MaterialUpload } from '../Workspace';
import type { SemesterPlan, StudyPlan } from './contracts';
import { localDate } from './semesterPlanner';
import { SemesterIntake } from './SemesterIntake';
import './dashboard.css';
import './free-preview.css';

export function FreeStudyPreview({ preferences }: { preferences: StudyPreferences }) {
  const { user } = useAuth();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [claimed, setClaimed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const saved = preferences.onboarding_answers as unknown as { semester_plan?: SemesterPlan; day_one_plan?: StudyPlan } | undefined;
  const [plan, setPlan] = useState(saved?.semester_plan || null);
  const [dayOne, setDayOne] = useState(saved?.day_one_plan || null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetchLibrary(user.id),
      supabase.from('curve_free_syllabus_uploads').select('material_id').eq('user_id', user.id).maybeSingle(),
    ]).then(([library, claim]) => {
      if (claim.error) throw claim.error;
      if (cancelled) return;
      setMaterials(library.materials);
      setClaimed(!!claim.data);
      setError('');
    }).catch(() => { if (!cancelled) setError('Your preview could not load. Please retry.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [user?.id, revision]);

  async function retryTopics(material: Material) {
    setBusy(true);
    setError('');
    try {
      const analysis = await learningAction<{ topics: string[]; summary: string }>({ action: 'analyze', material_id: material.id });
      setMaterials(current => current.map(m => m.id === material.id ? { ...m, metadata: { ...m.metadata, ...analysis } } : m));
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not parse your syllabus. Try again.'); }
    finally { setBusy(false); }
  }

  async function savePlan(semesterPlan: SemesterPlan, studyPlan: StudyPlan) {
    setError('');
    const { data: current, error: readError } = await supabase.from('curve_study_preferences')
      .select('onboarding_answers').eq('user_id', user!.id).single();
    if (readError) throw new Error('Could not load your preferences. Please retry.');
    const { error: saveError } = await supabase.from('curve_study_preferences').update({
      courses: semesterPlan.courses.map(c => c.course),
      exam_date: semesterPlan.exams.filter(e => !e.isRecent && e.date >= localDate()).sort((a, b) => a.date.localeCompare(b.date))[0]?.date || null,
      onboarding_answers: { ...current.onboarding_answers, semester_plan: semesterPlan, day_one_plan: studyPlan },
    }).eq('user_id', user!.id);
    if (saveError) throw new Error('Could not save your plan. Please retry.');
    setPlan(semesterPlan);
    setDayOne(studyPlan);
    setEditing(false);
  }

  return <LearningPageFrame className="free-study-preview" label="Your study plan">
    <div className="curve-dashboard">
      <span className="intake-badge">YOUR FREE STUDY PREVIEW</span>
      <h1>See your plan. Start Day 1.</h1>
      <p>I’ll guide you from your semester and taught topics to your next steps. You can upload one syllabus for free, or enter your topics yourself.</p>
      {error && <div role="alert"><p>{error}</p><button className="learn-button subtle" onClick={() => setRevision(v => v + 1)}>Retry preview</button></div>}
      {loading ? <p role="status">Loading your study preview…</p> : <>
        {!claimed && materials.length === 0 && <button className="learn-button dark" onClick={() => setUploading(true)}>Upload my free syllabus</button>}
        {claimed && materials.length === 0 && <p>Your free upload has been used. Choose a plan to upload another syllabus.</p>}
        {materials.map(material => <div className="free-preview-material" key={material.id}>
          <strong>{material.title}</strong><p>{material.metadata.topics?.length || 0} parsed topics</p>
          {!material.metadata.topics?.length && <button className="learn-button subtle" disabled={busy} onClick={() => void retryTopics(material)}>{busy ? 'Parsing…' : 'Retry topic extraction'}</button>}
        </div>)}
        {(!plan || editing) && <SemesterIntake
          materials={materials} initialCourses={preferences.courses} initialPlan={plan} initialDailyMinutes={preferences.daily_minutes}
          onUploadSyllabusClick={!claimed && materials.length === 0 ? () => setUploading(true) : undefined}
          onSavePlan={savePlan} onCancel={plan ? () => setEditing(false) : undefined} />}
        {plan && !editing && <section className="free-preview-plan" aria-label="Your generated study plan">
          <h2>Your {plan.stageLabel.toLowerCase()} study plan</h2>
          <button className="learn-button subtle" onClick={() => setEditing(true)}>Adjust plan & exams</button>
          <h3>Day 1 · Your actionables</h3>
          <p>Use your course notes for these tasks. Your plan follows the topics you confirmed have been taught.</p>
          {!dayOne?.steps.length && <p>{plan.roadmap[0]?.type === 'exam' ? 'Today is exam day. Keep preparation light and protect time to rest.' : 'Today is a scheduled rest day. Recharge; your next study block is already planned.'}</p>}
          <ol>{dayOne?.steps.map((step, index) => <li key={index}>
            <strong>{step.topic} · {step.minutes} min</strong>
            <p>{step.kind === 'learn' ? 'Review your course notes and write a short explanation in your own words.' : step.kind === 'practice' ? 'Work through examples from your notes, then solve a similar problem without looking.' : 'Close your notes, recall the main ideas, and list what you still need to review.'}</p>
          </li>)}</ol>
          <h3>Your roadmap</h3>
          <div className="free-preview-days">{plan.roadmap.slice(0, 14).map((day, index) => <div className="free-preview-day" key={day.date}>
            <strong>Day {index + 1} · {day.dayLabel}</strong>
            {index === 0 ? <p>{day.topics?.join(', ') || day.title}{day.minutes ? ` · ${day.minutes} min` : ''}</p> : <Link to="/subscription">🔒 Unlock Day {index + 1}</Link>}
          </div>)}</div>
        </section>}
        <aside className="free-preview-upgrade"><h2>Keep the momentum going.</h2><p>Unlock Day 2+, dynamic assessments, and more uploads.</p><Link className="learn-button dark" to="/subscription">${passPrice.monthly / 100} / month or ${passPrice.semester / 100} / semester</Link></aside>
      </>}
    </div>
    {uploading && <MaterialUpload singleUpload onClose={() => setUploading(false)} onSaved={material => {
      setMaterials([material]); setClaimed(true); setUploading(false); setEditing(true);
      if (material.topicAnalysisError) setError(material.topicAnalysisError);
    }} />}
  </LearningPageFrame>;
}
