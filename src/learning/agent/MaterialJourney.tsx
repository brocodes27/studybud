import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Check, FileText, Loader2, Plus } from 'lucide-react';
import type { Material } from '../model';
import type { SemesterPlan, StudyPlan } from './contracts';
import { buildSemesterSchedule, localDate } from './semesterPlanner';
import './material-journey.css';
import { SemesterContextFields, SEMESTER_STAGES } from './SemesterContextFields';
import { detectSubjectsFromPages } from '../syllabusSegmenter';
import { sameSemester } from '../../../supabase/functions/_shared/semester-scope';

/** Course coverage is user context. It never awards learning-stage credit. */
export function MaterialJourney({ material, semester, stage, initialDailyMinutes, busy, onBack, onSave, onConfirmMaterial }: {
  material: Material;
  semester: string;
  stage: SemesterPlan['stage'];
  initialDailyMinutes: number;
  busy: boolean;
  onBack: () => void;
  onConfirmMaterial: (material: Material) => Promise<void>;
  onSave: (plan: SemesterPlan, studyPlan: StudyPlan) => Promise<void>;
}) {
  const [topics, setTopics] = useState(() => [...new Set([...(material.metadata.topics || []), ...(material.metadata.confirmed_topics || [])])]);
  const [selected, setSelected] = useState<string[]>([]);
  const [newTopic, setNewTopic] = useState('');
  const [course, setCourse] = useState(material.metadata.course || material.title);
  const [step, setStep] = useState<'topics' | 'pace'>('topics');
  const [dailyMinutes, setDailyMinutes] = useState([10, 20, 30, 45].includes(initialDailyMinutes) ? initialDailyMinutes : 30);
  const [exam, setExam] = useState(() => material.metadata.exam_on && material.metadata.exam_on >= localDate() ? material.metadata.exam_on : '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const locked = busy || saving;
  const pages = material.metadata.pages || [];
  function toggle(topic: string) {
    setSelected(current => current.includes(topic) ? current.filter(t => t !== topic) : [...current, topic]);
  }
  function renameTopic(topic: string, raw: string) {
    const value = raw.trim();
    if (!value || (value !== topic && topics.includes(value))) { setError('Use a unique, non-empty topic name.'); return; }
    setTopics(current => current.map(item => item === topic ? value : item));
    setSelected(current => current.map(item => item === topic ? value : item));
    setError('');
  }
  function addTopic() {
    const value = newTopic.trim();
    if (!value) return;
    if (!topics.includes(value) && topics.length >= 30) { setError('Review up to 30 topics. Remove a topic before adding another.'); return; }
    if (!topics.includes(value)) setTopics(current => [...current, value]);
    setSelected(current => current.includes(value) ? current : [...current, value]);
    setNewTopic('');
  }
  async function save() {
    if (locked) return;
    if (!course.trim() || !selected.length) { setStep('topics'); setError('Name your course and choose at least one topic you have covered.'); return; }
    if (topics.length > 30) { setStep('topics'); setError('Review up to 30 topics. Remove incorrect or duplicate suggestions before continuing.'); return; }
    if (exam && (!/^\d{4}-\d{2}-\d{2}$/.test(exam) || exam < localDate())) { setError('Choose an upcoming exam date, or leave it blank.'); return; }
    setError('');
    const now = new Date().toISOString();
    const courseName = course.trim();
    const result = buildSemesterSchedule({
      semester, stage, stageLabel: SEMESTER_STAGES.find(s => s.id === stage)!.label,
      courses: [{ course: courseName, taughtTopics: selected }],
      exams: exam ? [{ id: crypto.randomUUID(), title: `${courseName} exam`, course: courseName, date: exam, topics: selected, isRecent: false }] : [],
      breaks: { restDaysPerWeek: 1, preExamBufferHours: 48, preferredRestDays: ['Sunday'] },
      roadmap: [], createdAt: now, updatedAt: now,
    }, dailyMinutes);
    setSaving(true);
    try {
      await onConfirmMaterial({ ...material, metadata: { ...material.metadata, semester, course: courseName, topics, confirmed_topics: selected, confirmed: true, exam_on: exam || null } });
      await onSave(result.semesterPlan, result.studyPlan);
    } catch (e) { setError(e instanceof Error ? e.message : 'Your plan could not save. Your choices are still here.'); }
    finally { setSaving(false); }
  }
  return <section className="material-journey" aria-labelledby="journey-heading">
    <div className="journey-eyebrow"><BookOpen size={16} /> A plan from your own material</div>
    <ol className="journey-progress" aria-label="Course setup progress">
      <li className="is-done"><Check size={13} /> Add material</li>
      <li aria-current={step === 'topics' ? 'step' : undefined} className={step === 'topics' ? 'is-current' : 'is-done'}>02 Review topics</li>
      <li aria-current={step === 'pace' ? 'step' : undefined} className={step === 'pace' ? 'is-current' : ''}>03 Set your pace</li>
    </ol>
    <h2 id="journey-heading">{step === 'topics' ? 'A familiar place to begin.' : 'Make room for learning.'}</h2>
    <p className="journey-intro">{step === 'topics' ? 'Review the topics, then select only what you’ve covered in class or need for your current exam. We’ll build your starting plan from those.' : 'Choose a manageable daily rhythm. An exam date is helpful if you have one.'}</p>
    <p className="journey-small">{semester} · {SEMESTER_STAGES.find(s => s.id === stage)!.label}</p>
    <div className="journey-source-card"><FileText size={21} /><div><strong>{material.title}</strong><span>{pages.length || material.metadata.page_count ? `${pages.length || material.metadata.page_count} source pages` : 'Source material'} · {topics.length} topics to review</span></div><span className="journey-saved">Saved</span></div>
    <fieldset className="journey-fields" disabled={locked}>
    {step === 'topics' ? <>
      {material.topicAnalysisError && <p className="journey-notice" role="status">Your material is saved, but topic extraction needs another try. Add the topics below, or review this material in your library later.</p>}
      <label className="journey-field">Course name<input maxLength={120} value={course} onChange={e => setCourse(e.target.value)} /></label>
      <div className="journey-topic-heading"><h3>Topics in your current study scope</h3><span>{selected.length} selected</span></div>
      <p className="journey-small">Extracted topics may need correction. Selection sets your study context; mastery comes from your work.</p>
      <div className="journey-topics">{topics.map(topic => {
        const source = pages.find(page => page.text.toLocaleLowerCase().includes(topic.toLocaleLowerCase()));
        const start = source?.text.toLocaleLowerCase().indexOf(topic.toLocaleLowerCase()) ?? 0;
        return <div key={topic} className={`journey-topic ${selected.includes(topic) ? 'is-selected' : ''}`}>
          <label><input type="checkbox" checked={selected.includes(topic)} onChange={() => toggle(topic)} /><span>{topic}</span></label>
          <details className="journey-topic-edit"><summary>Edit</summary><form onSubmit={event => { event.preventDefault(); const field = event.currentTarget.elements.namedItem('topic-name') as HTMLInputElement; renameTopic(topic, field.value); }}><label>Topic name<input name="topic-name" defaultValue={topic} maxLength={200} required /></label><button className="learn-button subtle small">Save wording</button></form></details>
          <button className="text-button small journey-topic-remove" aria-label={`Remove ${topic} from this topic map`} onClick={() => { setTopics(current => current.filter(item => item !== topic)); setSelected(current => current.filter(item => item !== topic)); }}>Remove</button>
          {source ? <details><summary>Source · page {source.page}</summary><p>{source.text.slice(Math.max(0, start - 70), start + topic.length + 180)}</p></details> : <span className="journey-small">Review against your source</span>}
        </div>;
      })}</div>
      {!topics.length && <p className="journey-notice">No topics were extracted yet. Add a chapter or topic you’ve covered to get started.</p>}
      <form className="journey-add-topic" onSubmit={e => { e.preventDefault(); addTopic(); }}><label className="journey-field">Add a missing topic<input maxLength={160} placeholder="e.g. Limits and continuity" value={newTopic} onChange={e => setNewTopic(e.target.value)} /></label><button className="learn-button subtle" disabled={!newTopic.trim()}><Plus size={16} /> Add topic</button></form>
      <details className="journey-source-preview"><summary>Read the original material</summary>{pages.length ? pages.map(page => <section key={page.page}><strong>Page {page.page}</strong><p>{page.text}</p></section>) : <p>{material.extracted_text || 'Source text is not available. You can still add topics manually.'}</p>}</details>
    </> : <>
      <div className="journey-pace"><h3>How much time feels right?</h3><div className="journey-minute-options">{[10, 20, 30, 45].map(minutes => <button key={minutes} className={dailyMinutes === minutes ? 'is-selected' : ''} aria-pressed={dailyMinutes === minutes} onClick={() => setDailyMinutes(minutes)}>{minutes}<span>min / day</span></button>)}</div></div>
      <label className="journey-field">Next exam <span className="journey-small">Optional · you can add this later</span><input type="date" min={localDate()} value={exam} onChange={e => setExam(e.target.value)} /></label>
      <div className="journey-receipt"><span>Your starting point</span><strong>{selected.length} topics · {dailyMinutes} focused minutes</strong><p>A two-week plan with Sundays off and lighter review before exams. Adjust courses, exams, and rest days in your plan later.</p></div>
    </>}
    </fieldset>
    {error && <p className="journey-error" role="alert">{error}</p>}
    <footer className="journey-actions"><button className="learn-button subtle" disabled={locked} onClick={() => step === 'pace' ? setStep('topics') : onBack()}><ArrowLeft size={16} /> Back</button><button className="learn-button dark" disabled={locked || !selected.length || !course.trim()} onClick={() => step === 'topics' ? (setError(''), setStep('pace')) : void save()}>{locked ? <><Loader2 size={16} className="spin" /> Saving your plan…</> : <>{step === 'topics' ? 'Confirm topics' : 'Create my study plan'}<ArrowRight size={16} /></>}</button></footer>
  </section>;
}


/** Shared first-course entry for onboarding and the empty workspace. */
export function MaterialFirstSetup({ materials, initialDailyMinutes = 30, busy = false, onUploadClick, onSavePlan, onManualSetup, onConfirmMaterial, onLoadMaterial }: {
  materials: Material[];
  initialDailyMinutes?: number;
  busy?: boolean;
  onUploadClick?: () => void;
  onSavePlan: (plan: SemesterPlan, studyPlan: StudyPlan) => Promise<void>;
  onManualSetup: () => void;
  onLoadMaterial?: (material: Material) => Promise<Material>;
  onConfirmMaterial: (material: Material) => Promise<void>;
}) {
  const [selected, setSelected] = useState<Material | null>(null);
  const [semester, setSemester] = useState('');
  const [stage, setStage] = useState<SemesterPlan['stage'] | ''>('');
  const [contextConfirmed, setContextConfirmed] = useState(false);
  const semesters = [...new Set(materials.map(m => m.metadata.semester).filter((s): s is string => !!s))];
  const currentMaterials = materials.filter(m => !m.metadata.semester || sameSemester(m.metadata.semester, semester));
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const loadMaterial = useCallback(async (material: Material) => {
    setLoading(true);
    setLoadError('');
    try {
      const loaded = onLoadMaterial ? await onLoadMaterial(material) : material;
      const subjects = detectSubjectsFromPages(loaded.metadata.pages || []);
      if (subjects.length > 1 && subjects.some(subject => subject.semester && !sameSemester(subject.semester, semester))) {
        throw new Error('This material combines semesters. Upload it with “Split by subject” enabled, then choose material from your current semester.');
      }
      setSelected({ ...loaded, topicAnalysisError: loaded.topicAnalysisError || material.topicAnalysisError });
    }
    catch (error) { setLoadError(error instanceof Error ? error.message : 'Could not load the source. Your material is saved; try again.'); }
    finally { setLoading(false); }
  }, [onLoadMaterial, semester]);
  const knownIds = useRef(new Set<string>());
  useEffect(() => {
    const added = materials.find(material => !knownIds.current.has(material.id));
    knownIds.current = new Set(materials.map(material => material.id));
    if (added && contextConfirmed && stage && (!added.metadata.semester || sameSemester(added.metadata.semester, semester))) void loadMaterial(added);
  }, [materials, loadMaterial, contextConfirmed, semester, stage]);
  if (selected && contextConfirmed && stage) return <MaterialJourney key={selected.id} material={selected} semester={semester} stage={stage} initialDailyMinutes={initialDailyMinutes} busy={busy} onBack={() => setSelected(null)} onSave={onSavePlan} onConfirmMaterial={onConfirmMaterial} />;
  return <section className="material-first-entry" aria-labelledby="material-first-heading">
    <div className="journey-eyebrow"><BookOpen size={16} /> Your course. Your starting point.</div>
    <h2 id="material-first-heading">Bring your material.<br />Find your next step.</h2>
    <p className="journey-intro">Start with one course and a syllabus or set of notes. Turn what you’re studying into a clear, manageable daily plan.</p>
    <div className="journey-entry-visual" aria-label="How setup works"><div><FileText size={22} /><strong>01 / Add material</strong><span>A syllabus or your notes</span></div><div><Check size={22} /><strong>02 / Review topics</strong><span>You decide what’s covered</span></div><div><BookOpen size={22} /><strong>03 / Find your rhythm</strong><span>A plan that fits your day</span></div></div>
    {loadError && <p className="journey-error" role="alert">{loadError}</p>}
    {loading && <p role="status" className="journey-small">Loading your source material…</p>}
    {materials.length > 0 && <>
      <SemesterContextFields semester={semester} stage={stage} semesters={semesters}
        onSemester={value => { setSemester(value); setSelected(null); setContextConfirmed(false); }}
        onStage={value => { setStage(value); setContextConfirmed(false); }} />
      {!contextConfirmed && <button className="learn-button dark" disabled={!semester || !stage} onClick={() => setContextConfirmed(true)}>Show my current syllabus <ArrowRight size={16} /></button>}
    </>}
    {materials.length > 0 && contextConfirmed && <><h3>Your current syllabus</h3><div className="journey-library">{currentMaterials.map(material => <button key={material.id} onClick={() => void loadMaterial(material)} disabled={busy || loading}><FileText size={18} /><span>{material.title}<small>{material.metadata.course || 'Your course'} · Review topics</small></span><ArrowRight size={17} /></button>)}</div></>}
    {contextConfirmed && !currentMaterials.length && <p role="status">No material matches {semester}. Upload this semester’s syllabus or set up your topics manually.</p>}
    <div className="journey-entry-buttons">{onUploadClick && <button className="learn-button dark" disabled={busy || loading} onClick={onUploadClick}><Plus size={17} /> {materials.length ? 'Add another material' : 'Add my course material'}</button>}<button className="learn-button subtle" disabled={busy || loading} onClick={onManualSetup}>{onUploadClick ? 'Set up manually' : 'Choose my courses & topics'}<ArrowRight size={16} /></button></div>
    <p className="journey-small">No exam date needed. Add more courses once your first plan is ready.</p>
  </section>;
}
