import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Plus, Sparkles, Trash2, Files, TriangleAlert, CircleCheck } from 'lucide-react';

import { useAuth } from '../contexts/AuthContext';
import { pdfFileToImageDataUrls } from '../lib/pdfToImages';
import {
  currentTerm,
  parseMultiSyllabusImages,
  parseMultiSyllabusTexts,
  type ParsedSyllabus,
  type ParsedMultiSubjectSyllabus,
} from './ai';
import type { FieldConfidence } from './confidence';
import { readAndClearPendingParse } from './onboardingHandoff';
import { weekStartOn } from '../lib/perirO';
import { createCourseWithComponents, markTopicsCovered } from './data';
import { localToday } from './stageData';
import type { ComponentKind } from './gradeEngine';
import { round } from './gradeEngine';
import { AhaForecastModal } from './AhaForecastModal';
import {
  Banner,
  CurveButton,
  CurveShell,
  Display,
  Eyebrow,
  Field,
  Panel,
  Select,
  TextArea,
  TextInput,
  type CurveTone,
} from './ui';

const KINDS: ComponentKind[] = [
  'homework',
  'quiz',
  'midterm',
  'final',
  'project',
  'lab',
  'participation',
  'other',
];

const TONES: CurveTone[] = ['violet', 'amber', 'mint', 'blush'];

interface DraftComponent {
  name: string;
  kind: ComponentKind;
  weight: string;
  dropLowest: string;
  dueOn: string;
}

const BLANK_COMPONENT: DraftComponent = {
  name: '',
  kind: 'homework',
  weight: '',
  dropLowest: '0',
  dueOn: '',
};

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.readAsDataURL(file);
  });
}

function defaultComponents(): DraftComponent[] {
  return [
    { name: 'Problem sets', kind: 'homework', weight: '20', dropLowest: '1', dueOn: '' },
    { name: 'Midterm 1', kind: 'midterm', weight: '20', dropLowest: '0', dueOn: '' },
    { name: 'Midterm 2', kind: 'midterm', weight: '20', dropLowest: '0', dueOn: '' },
    { name: 'Final exam', kind: 'final', weight: '40', dropLowest: '0', dueOn: '' },
  ];
}

export function AddCourse() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [syllabus, setSyllabus] = useState('');
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [parsedTopics, setParsedTopics] = useState<Array<{ topic: string; week: number }>>([]);
  const [fileNames, setFileNames] = useState<string[]>([]);
  const [parsedCourses, setParsedCourses] = useState<ParsedSyllabus[]>([]);
  const [showAhaModal, setShowAhaModal] = useState(false);
  const [activeConfidence, setActiveConfidence] = useState<FieldConfidence[]>([]);
  const [hasLowConfidence, setHasLowConfidence] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [courseCode, setCourseCode] = useState('');
  const [title, setTitle] = useState('');
  const [instructor, setInstructor] = useState('');
  const [term, setTerm] = useState(currentTerm());
  // Without a term start there are no lecture dates, so priming never fires.
  // Prefilled with the Monday of this week; the student corrects it if the
  // course started earlier.
  const [termStartOn, setTermStartOn] = useState(weekStartOn(localToday()));
  const [coveredThroughWeek, setCoveredThroughWeek] = useState('0');
  const [creditHours, setCreditHours] = useState('3');
  const [tone, setTone] = useState<CurveTone>('violet');
  const [components, setComponents] = useState<DraftComponent[]>(defaultComponents);

  const weightTotal = components.reduce((sum, component) => sum + (Number(component.weight) || 0), 0);
  const weightsOff = components.length > 0 && Math.abs(weightTotal - 100) > 0.5;

  function applyParsed(parsed: ParsedSyllabus) {
    setCourseCode(parsed.courseCode);
    setTitle(parsed.title);
    setInstructor(parsed.instructorName ?? '');
    setTerm(parsed.term);
    setCreditHours(String(parsed.creditHours));
    if (parsed.components.length > 0) {
      setComponents(
        parsed.components.map((component) => ({
          name: component.name,
          kind: component.kind,
          weight: String(component.weight),
          dropLowest: String(component.dropLowest ?? 0),
          dueOn: component.dueOn ?? '',
        })),
      );
    }
    setWarnings(parsed.warnings);
    setParsedTopics(parsed.topics ?? []);
    setActiveConfidence(parsed.confidence ?? []);
    setHasLowConfidence(Boolean(parsed.hasLowConfidence));
  }

  function handleMultiParsed(parsedMulti: ParsedMultiSubjectSyllabus) {
    setParsedCourses(parsedMulti.courses);
    if (parsedMulti.courses.length > 0) {
      applyParsed(parsedMulti.courses[0]);
    }
    setWarnings(parsedMulti.globalWarnings);
    setShowAhaModal(true);
  }

  /**
   * P1.2: if the landing page stashed a pre-auth parse, restore it so the
   * student lands on a pre-filled form instead of re-uploading. Runs once on
   * mount and consumes the stash so refreshes/back-nav don't re-apply.
   */
  useEffect(() => {
    const handoff = readAndClearPendingParse();
    if (!handoff) return;
    handleMultiParsed({ courses: handoff.courses, globalWarnings: handoff.globalWarnings });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only consumption
  }, []);

  async function handleParse() {
    if (syllabus.trim().length < 40) {
      setError('Paste a bit more of the syllabus so the grading section is included.');
      return;
    }

    setParsing(true);
    setError(null);
    setWarnings([]);

    try {
      const parsedMulti = await parseMultiSyllabusTexts([syllabus]);
      handleMultiParsed(parsedMulti);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not read that syllabus.');
    } finally {
      setParsing(false);
    }
  }

  async function handleFiles(files: FileList) {
    if (!files || files.length === 0) return;

    setParsing(true);
    setError(null);
    setWarnings([]);
    const names = Array.from(files).map((f) => f.name);
    setFileNames(names);

    try {
      const imageBatches: string[][] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
        const images = isPdf ? await pdfFileToImageDataUrls(file) : [await readFileAsDataUrl(file)];
        if (images.length > 0) {
          imageBatches.push(images);
        }
      }

      if (imageBatches.length === 0) {
        throw new Error('Could not extract pages from uploaded files.');
      }

      const parsedMulti = await parseMultiSyllabusImages(imageBatches);
      handleMultiParsed(parsedMulti);
    } catch (cause) {
      setFileNames([]);
      setError(cause instanceof Error ? cause.message : 'Could not read uploaded syllabus file(s).');
    } finally {
      setParsing(false);
    }
  }

  async function applyCoveredWeeks(enrollmentId: string) {
    const week = Number(coveredThroughWeek);
    if (!Number.isFinite(week) || week < 1) return;
    await markTopicsCovered(enrollmentId, week);
  }

  async function handleSave() {
    if (!user?.id) {
      setError('Sign in to save a course.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      let lastEnrollmentId = '';

      if (parsedCourses.length > 1) {
        for (const c of parsedCourses) {
          const res = await createCourseWithComponents(user.id, {
            courseCode: c.courseCode,
            title: c.title,
            instructorName: c.instructorName,
            term: c.term,
            creditHours: c.creditHours,
            tone,
            components: c.components.map((comp) => ({
              name: comp.name,
              kind: comp.kind,
              weight: comp.weight,
              dropLowest: comp.dropLowest,
              dueOn: comp.dueOn,
            })),
            topics: c.topics,
            termStartOn,
          });
          await applyCoveredWeeks(res.enrollmentId);
          lastEnrollmentId = res.enrollmentId;
        }
      } else {
        if (!courseCode.trim() || !title.trim()) {
          setError('A course code and title are required.');
          setSaving(false);
          return;
        }

        const cleaned = components
          .filter((component) => component.name.trim() && Number(component.weight) > 0)
          .map((component) => ({
            name: component.name,
            kind: component.kind,
            weight: Number(component.weight),
            dropLowest: Number(component.dropLowest) || 0,
            dueOn: component.dueOn || null,
          }));

        if (cleaned.length === 0) {
          setError('Add at least one grading component with a weight.');
          setSaving(false);
          return;
        }

        const res = await createCourseWithComponents(user.id, {
          courseCode,
          title,
          instructorName: instructor || null,
          term,
          creditHours: Number(creditHours) || 3,
          tone,
          components: cleaned,
          topics: parsedTopics,
          termStartOn,
        });
        await applyCoveredWeeks(res.enrollmentId);
        lastEnrollmentId = res.enrollmentId;
      }

      // P1.2 routes straight to the new course; today we still land on the
      // dashboard until that progressive-onboarding flow ships.
      if (lastEnrollmentId) {
        navigate(`/course/${lastEnrollmentId}`);
      } else {
        navigate('/');
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save the course.');
      setSaving(false);
    }
  }

  function updateComponent(index: number, patch: Partial<DraftComponent>) {
    setComponents((current) =>
      current.map((component, position) =>
        position === index ? { ...component, ...patch } : component,
      ),
    );
  }

  return (
    <CurveShell>
      {showAhaModal ? (
        <AhaForecastModal
          parsedCourses={
            parsedCourses.length > 0
              ? parsedCourses
              : [
                  {
                    courseCode,
                    title,
                    instructorName: null,
                    term,
                    creditHours: Number(creditHours) || 3,
                    topics: parsedTopics,
                    components: [],
                    warnings: [],
                    confidence: [],
                    hasLowConfidence: false,
                  } satisfies ParsedSyllabus,
                ]
          }
          onContinue={() => setShowAhaModal(false)}
        />
      ) : null}

      <button
        type="button"
        onClick={() => navigate('/')}
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-curve-muted transition hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to courses
      </button>

      <Display lead="Add">course syllabi.</Display>
      <p className="mt-3 max-w-xl text-sm text-curve-muted">
        Upload one or multiple syllabus PDFs (or photos) for your subjects. Curve extracts grading weights,
        weekly topics, and BKT mastery parameters for each course simultaneously.
      </p>

      {error ? (
        <div className="mt-6">
          <Banner tone="error">{error}</Banner>
        </div>
      ) : null}

      <Panel className="mt-6">
        <Eyebrow>Step 1 — upload multi-subject syllabi</Eyebrow>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="application/pdf,image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(event) => {
            if (event.target.files) void handleFiles(event.target.files);
            event.target.value = '';
          }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={parsing}
          className="curve-inset w-full rounded-2xl border-2 border-dashed border-white/15 px-6 py-8 text-center transition hover:border-curve-violet/60 hover:bg-white/[0.03]"
        >
          {parsing ? (
            <span className="flex items-center justify-center gap-2 text-sm font-medium text-curve-muted">
              <Loader2 className="h-4 w-4 animate-spin text-curve-violet-soft" />
              Parsing multi-subject syllabus PDF(s)…
            </span>
          ) : (
            <span className="flex flex-col items-center gap-2">
              <Files className="h-7 w-7 text-curve-violet-soft" strokeWidth={2} />
              <span className="text-sm font-semibold text-white">
                {fileNames.length > 0
                  ? `${fileNames.length} PDF(s) selected: ${fileNames.join(', ')}`
                  : 'Upload Syllabus PDF(s) — Single or Multiple Subjects'}
              </span>
              <span className="text-xs text-curve-faint">PDFs or images. Drop multiple files at once.</span>
            </span>
          )}
        </button>

        {parsedCourses.length > 1 ? (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-curve-muted">Parsed Subjects:</span>
            {parsedCourses.map((c, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => applyParsed(c)}
                className="rounded-lg bg-curve-violet/20 px-3 py-1 text-xs font-bold text-curve-violet-soft hover:bg-curve-violet/40"
              >
                {c.courseCode || `Subject ${idx + 1}`}
              </button>
            ))}
          </div>
        ) : null}

        <div className="my-5 flex items-center gap-3">
          <span className="h-px flex-1 bg-white/10" />
          <span className="text-xs font-medium text-curve-faint">or paste the text</span>
          <span className="h-px flex-1 bg-white/10" />
        </div>

        <div className="mt-3">
          <TextArea
            value={syllabus}
            onChange={(event) => setSyllabus(event.target.value)}
            placeholder={
              'Paste the syllabus text here. The grading breakdown matters most, for example:\n\nHomework 20%\nMidterm 1 20%\nMidterm 2 20%\nFinal exam 40%'
            }
          />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <CurveButton onClick={handleParse} disabled={parsing}>
            {parsing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Reading it
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" strokeWidth={2.4} />
                Read my syllabus
              </>
            )}
          </CurveButton>
          <span className="text-xs text-curve-faint">Or fill the fields in yourself below.</span>
        </div>
      </Panel>

      {warnings.length > 0 ? (
        <div className="mt-4 space-y-2">
          {warnings.map((warning) => (
            <Banner key={warning} tone="warn">
              {warning}
            </Banner>
          ))}
        </div>
      ) : null}

      {activeConfidence.length > 0 ? (
        <Panel className={`mt-4 border-2 ${hasLowConfidence ? 'border-curve-risk/60' : 'border-amber-400/40'}`}>
          <Eyebrow>
            {hasLowConfidence
              ? 'Double-check these before saving'
              : 'A few things to glance at'}
          </Eyebrow>
          <p className="mt-2 text-xs text-curve-muted">
            {hasLowConfidence
              ? 'Curve couldn’t read these fields reliably from the syllabus. Fixing them now keeps your forecast honest.'
              : 'These were inferred rather than printed explicitly — confirm they match your syllabus.'}
          </p>
          <ul className="mt-3 space-y-2">
            {activeConfidence
              .filter((entry) => entry.level !== 'high')
              .map((entry) => (
                <li key={`${entry.field}-${entry.reason}`} className="flex items-start gap-2 text-sm">
                  {entry.level === 'low' ? (
                    <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-curve-risk" />
                  ) : (
                    <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                  )}
                  <span className="text-white">
                    <span className="font-semibold">
                      {entry.field === 'components'
                        ? 'Grading breakdown'
                        : entry.field === 'courseCode'
                          ? 'Course code'
                          : entry.field === 'title'
                            ? 'Course title'
                            : entry.field === 'topics'
                              ? 'Weekly topics'
                              : entry.field.startsWith('components.')
                                ? `Component ${entry.field.split('.')[1]} (${entry.field.endsWith('.weight') ? 'weight' : 'type'})`
                                : entry.field}
                      :{' '}
                    </span>
                    <span className="text-curve-muted">{entry.reason || 'Confirm this below.'}</span>
                  </span>
                </li>
              ))}
          </ul>
        </Panel>
      ) : null}

      <Panel className="mt-4">
        <Eyebrow>Step 2 — course details</Eyebrow>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Course code">
            <TextInput
              value={courseCode}
              onChange={(event) => setCourseCode(event.target.value)}
              placeholder="CHEM 2210"
            />
          </Field>
          <Field label="Title">
            <TextInput
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Organic Chemistry I"
            />
          </Field>
          <Field label="Instructor">
            <TextInput
              value={instructor}
              onChange={(event) => setInstructor(event.target.value)}
              placeholder="Dr. Chen"
            />
          </Field>
          <Field label="Term">
            <TextInput value={term} onChange={(event) => setTerm(event.target.value)} />
          </Field>
          <Field label="Classes start" hint="Week 1's first day. This is what lets us prime you before a lecture.">
            <TextInput
              type="date"
              value={termStartOn}
              onChange={(event) => setTermStartOn(event.target.value)}
            />
          </Field>
          <Field
            label="Already covered through week"
            hint="Joining mid-semester? Those topics skip priming and start at encoding. 0 if you are starting fresh."
          >
            <TextInput
              type="number"
              min="0"
              step="1"
              value={coveredThroughWeek}
              onChange={(event) => setCoveredThroughWeek(event.target.value)}
            />
          </Field>
          <Field label="Credit hours">
            <TextInput
              type="number"
              min="0.5"
              step="0.5"
              value={creditHours}
              onChange={(event) => setCreditHours(event.target.value)}
            />
          </Field>
          <Field label="Card colour">
            <Select value={tone} onChange={(event) => setTone(event.target.value as CurveTone)}>
              {TONES.map((option) => (
                <option key={option} value={option}>
                  {option.charAt(0).toUpperCase() + option.slice(1)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Panel>

      <Panel className="mt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Eyebrow>Step 3 — grading breakdown</Eyebrow>
          <span
            className={`text-xs font-semibold ${weightsOff ? 'text-curve-risk' : 'text-curve-good'}`}
          >
            {round(weightTotal, 1)}% total
          </span>
        </div>

        <div className="mt-4 space-y-3">
          {components.map((component, index) => (
            <div
              key={index}
              className="curve-inset grid grid-cols-2 gap-3 p-3 sm:grid-cols-12 sm:items-end"
            >
              <div className="col-span-2 sm:col-span-4">
                <Field label="Name">
                  <TextInput
                    value={component.name}
                    onChange={(event) => updateComponent(index, { name: event.target.value })}
                    placeholder="Problem sets"
                  />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Type">
                  <Select
                    value={component.kind}
                    onChange={(event) =>
                      updateComponent(index, { kind: event.target.value as ComponentKind })
                    }
                  >
                    {KINDS.map((kind) => (
                      <option key={kind} value={kind}>
                        {kind}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Weight %">
                  <TextInput
                    type="number"
                    min="0"
                    max="100"
                    value={component.weight}
                    onChange={(event) => updateComponent(index, { weight: event.target.value })}
                  />
                </Field>
              </div>
              <div className="sm:col-span-1">
                <Field label="Drop">
                  <TextInput
                    type="number"
                    min="0"
                    value={component.dropLowest}
                    onChange={(event) => updateComponent(index, { dropLowest: event.target.value })}
                  />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Due">
                  <TextInput
                    type="date"
                    value={component.dueOn}
                    onChange={(event) => updateComponent(index, { dueOn: event.target.value })}
                  />
                </Field>
              </div>
              <div className="flex justify-end sm:col-span-1">
                <button
                  type="button"
                  aria-label={`Remove ${component.name || 'component'}`}
                  onClick={() =>
                    setComponents((current) => current.filter((_, position) => position !== index))
                  }
                  className="curve-orb curve-orb-light curve-orb-static"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setComponents((current) => [...current, { ...BLANK_COMPONENT }])}
          className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-curve-violet-soft transition hover:text-white"
        >
          <Plus className="h-4 w-4" strokeWidth={2.4} />
          Add a component
        </button>

        {weightsOff ? (
          <div className="mt-4">
            <Banner tone="warn">
              Weights sum to {round(weightTotal, 1)}%, not 100%. Curve will still work, but the
              projection assumes these are the whole grade.
            </Banner>
          </div>
        ) : null}
      </Panel>

      <div className="mt-6 flex flex-wrap gap-3">
        <CurveButton onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving
            </>
          ) : (
            'Save course'
          )}
        </CurveButton>
        <CurveButton ghost onClick={() => navigate('/')}>
          Cancel
        </CurveButton>
      </div>
    </CurveShell>
  );
}

export default AddCourse;
