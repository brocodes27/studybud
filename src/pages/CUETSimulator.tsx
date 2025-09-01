import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import OpenAIService from '../lib/openaiService';
import { Flag } from 'lucide-react';

type CuetQuestion = {
  id: string; // UUID in cuet_questions
  qid?: string | null;
  subject?: string | null;
  topic?: string | null;
  question: string;
  options?: string[] | null; // if available
  answer_index?: number | null;
  source?: string | null;
};

// CUET-UG subjects list (now includes English Language and General Test)
const CUET_DOMAINS = [
  'English (Language)',
  'General Test (GAT)',
  'Accountancy/Book-Keeping',
  'Agriculture',
  'Anthropology',
  'Biology/Biological Science/Biotechnology/Biochemistry',
  'Business Studies',
  'Chemistry',
  'Environmental Science',
  'Computer Science/Information Practices',
  'Economics/Business Economics',
  'Fine/Visual/Commercial Arts',
  'Geography/Geology',
  'History',
  'Home Science',
  'Knowledge Traditions–Practices in India',
  'Mass Media/Mass Communication',
  'Mathematics/Applied Mathematics',
  'Performing Arts (Dance/Drama/Music)',
  'Physical Education (Yoga, Sports)',
  'Physics',
  'Political Science',
  'Psychology',
  'Sanskrit',
  'Sociology'
];

const DEFAULT_TIME_MIN = 60;
const MARKS_CORRECT = 5;
const MARKS_WRONG = -1;
const QUESTIONS_PER_SUBJECT = 50;
const MIN_SUBJECTS = 3;
const MAX_SUBJECTS = 6;
const SECTION_TIME_MIN = 60; // 60 mins per subject

function shuffle<T>(arr: T[]): T[] { return [...arr].sort(() => Math.random() - 0.5); }

// Timeout helper for promises
function promiseWithTimeout<T>(promise: Promise<T>, ms: number, onTimeout?: () => void): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => { onTimeout?.(); reject(new Error('timeout')); }, ms);
    promise.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

// Return the first non-empty array result from multiple generators
async function firstNonEmpty<T>(gens: Array<() => Promise<T[]>>, timeoutMs: number): Promise<T[]> {
  return new Promise<T[]>((resolve, reject) => {
    let settled = false; let pending = gens.length; let lastErr: any = null;
    gens.forEach((g) => {
      promiseWithTimeout(g(), timeoutMs).then((arr) => {
        if (settled) return;
        if (Array.isArray(arr) && arr.length > 0) { settled = true; resolve(arr); }
        else { if (--pending === 0 && !settled) reject(lastErr || new Error('no results')); }
      }).catch((e) => { lastErr = e; if (--pending === 0 && !settled) reject(e); });
    });
  });
}

// Ensure question has exactly 4 options and a valid answer index
function normalizeOptions(q: any): { options: string[]; answer_index: number | null } {
  let opts: string[] = Array.isArray(q.options) ? q.options.filter(Boolean).map(String) : [];
  // remove duplicates
  const seen = new Set<string>();
  opts = opts.filter(o => { const k = o.trim(); if (seen.has(k)) return false; seen.add(k); return true; });
  while (opts.length < 4) {
    const filler = `Option ${String.fromCharCode(65 + opts.length)}`;
    if (!seen.has(filler)) { opts.push(filler); seen.add(filler); } else { opts.push(`${filler}*`); }
  }
  if (opts.length > 4) opts = opts.slice(0, 4);
  let ai = Number.isInteger(q.answer_index) ? q.answer_index : 0;
  if (ai < 0 || ai > 3) ai = 0;
  return { options: opts, answer_index: ai };
}

// Dedupe questions by normalized question text
function dedupeByQuestion(items: any[]): any[] {
  const seen = new Set<string>();
  const out: any[] = [];
  for (const it of items) {
    const key = (it.question || '').replace(/\s+/g, ' ').trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(it);
  }
  return out;
}

// Tiny local English generator (grammar/vocab) as a last-resort filler
function generateLocalEnglish(count: number): CuetQuestion[] {
  const bank: Array<{ stem: string; correct: string; distractors: string[]; topic: string }> = [
    { stem: 'Choose the correct article: __ apple a day keeps the doctor away.', correct: 'An', distractors: ['A', 'The', 'No article'], topic: 'Articles' },
    { stem: 'Identify the correct preposition: He is good __ mathematics.', correct: 'at', distractors: ['in', 'on', 'for'], topic: 'Prepositions' },
    { stem: 'Fill in the blank (subject–verb agreement): The list of items __ on the table.', correct: 'is', distractors: ['are', 'were', 'have been'], topic: 'Subject–Verb Agreement' },
    { stem: 'Choose the correct tense: She __ her homework before dinner.', correct: 'had finished', distractors: ['has finish', 'have finished', 'finisheds'], topic: 'Tenses' },
    { stem: 'Select the correct word: The movie was quite __ and I enjoyed it.', correct: 'entertaining', distractors: ['entertain', 'entertainment', 'entertained'], topic: 'Word Forms' },
    { stem: 'Synonym of “rapid”.', correct: 'swift', distractors: ['sluggish', 'dull', 'idle'], topic: 'Synonyms' },
    { stem: 'Antonym of “scarce”.', correct: 'abundant', distractors: ['rare', 'few', 'lacking'], topic: 'Antonyms' },
    { stem: 'Choose the correctly spelled word.', correct: 'accommodation', distractors: ['accomodation', 'acommodation', 'acomodation'], topic: 'Spelling' },
    { stem: 'Fill in the blank: Neither the teacher nor the students __ present.', correct: 'are', distractors: ['is', 'was', 'has been'], topic: 'Concord' },
    { stem: 'Choose the appropriate connector: He studied hard; __, he topped the exam.', correct: 'therefore', distractors: ['however', 'moreover', 'nevertheless'], topic: 'Connectors' },
  ];
  const items: CuetQuestion[] = [];
  for (let i = 0; i < count; i++) {
    const b = bank[i % bank.length];
    const opts = shuffle([b.correct, ...b.distractors]).slice(0,4);
    const answer_index = opts.indexOf(b.correct);
    items.push({
      id: crypto.randomUUID(),
      subject: 'English (Language)',
      topic: b.topic,
      question: b.stem,
      options: opts,
      answer_index,
      source: 'local-fallback'
    });
  }
  return items;
}

const CUETSimulator: React.FC = () => {
  const { user } = useAuth() as any;
  const [selectedDomains, setSelectedDomains] = useState<string[]>(['English (Language)', 'General Test (GAT)', 'Physics']);
  const [timeMinutes, setTimeMinutes] = useState(DEFAULT_TIME_MIN);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<CuetQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, number | null>>({}); // question_id (uuid) -> selected_index
  const [flags, setFlags] = useState<Record<string, boolean>>({}); // question_id (uuid) -> flagged for review
  const [currentIdx, setCurrentIdx] = useState(0);
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  const [remainingSec, setRemainingSec] = useState(timeMinutes * 60);
  const timerRef = useRef<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const finalizingRef = useRef(false);
  const [resumableAttempt, setResumableAttempt] = useState<null | { id: string; config: any; started_at: string }>(null);
  // Sectioned mode state
  const [sectionIdx, setSectionIdx] = useState<number>(0); // index into selectedDomains
  const [sectionsConfig, setSectionsConfig] = useState<any[] | null>(null); // [{subject,status,qids?:string[]}] 

  useEffect(() => {
    if (!startedAt || submitted) return;
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => {
      setRemainingSec((s) => {
        if (s <= 1) {
          window.clearInterval(timerRef.current!);
          setSubmitted(true);
          return 0;
        }
        return s - 1;
      });
    }, 1000) as unknown as number;
    return () => { if (timerRef.current) window.clearInterval(timerRef.current); };
  }, [startedAt, submitted]);

  // Lookup latest in-progress attempt (any subject type)
  useEffect(() => {
    (async () => {
      if (!user?.id) return;
      const { data, error } = await supabase
        .from('cuet_attempts')
        .select('id, config, started_at, submitted_at')
        .eq('user_id', user.id)
        .is('submitted_at', null)
        .order('started_at', { ascending: false })
        .limit(1);
      if (!error && data && data.length > 0) {
        setResumableAttempt({ id: data[0].id, config: data[0].config, started_at: data[0].started_at });
      } else {
        setResumableAttempt(null);
      }
    })();
  }, [user?.id]);

  

  const startExam = async () => {
    setError(null);
    setLoading(true);
    try {
      if (selectedDomains.length < MIN_SUBJECTS || selectedDomains.length > MAX_SUBJECTS) {
        throw new Error(`Select between ${MIN_SUBJECTS} and ${MAX_SUBJECTS} subjects`);
      }
      // Initialize attempt in sectioned mode (no questions yet). Each subject is a section with 60 mins.
      const n = selectedDomains.length;
      const sections = selectedDomains.map((s) => ({ subject: s, status: 'pending', qids: [] as string[] }));

      // 4) Now create attempt and persist selection
      const generatorName = 'sectioned_mode';
      const { data: attemptIns, error: attemptErr } = await supabase.from('cuet_attempts').insert({
        user_id: user.id,
        subject: 'Mixed Domains',
        config: {
          question_count: n * QUESTIONS_PER_SUBJECT,
          time_minutes: SECTION_TIME_MIN,
          marking: { correct: MARKS_CORRECT, wrong: MARKS_WRONG },
          generator: generatorName,
          selected_domains: selectedDomains,
          sections,
          current_section_index: 0
        }
      }).select('id').single();
      if (attemptErr) throw attemptErr;
      setAttemptId(attemptIns.id);
      setSectionsConfig(sections);
      setSectionIdx(0);
      setQuestions([]);
      setSubmitted(false);
      setStartedAt(null);

      // Nothing else to generate now; user will start Section 1 when ready
    } catch (e: any) {
      console.error('Start exam failed', e);
      setError(e.message || 'Failed to start exam');
    } finally {
      setLoading(false);
    }
  };

  // Finish current section, allow break, and advance to next
  const completeCurrentSection = async () => {
    if (!attemptId || !sectionsConfig) return;
    try {
      const newSections = sectionsConfig.slice();
      newSections[sectionIdx] = { ...newSections[sectionIdx], status: 'completed' };
      let nextIndex = sectionIdx + 1;
      const allDone = nextIndex >= newSections.length;
      setSectionsConfig(newSections);
      setQuestions([]); // clear questions to allow an indefinite break
      setStartedAt(null);
      setRemainingSec(SECTION_TIME_MIN * 60);
      if (!allDone) setSectionIdx(nextIndex);
      await supabase.from('cuet_attempts').update({
        config: {
          question_count: selectedDomains.length * QUESTIONS_PER_SUBJECT,
          time_minutes: SECTION_TIME_MIN,
          marking: { correct: MARKS_CORRECT, wrong: MARKS_WRONG },
          generator: 'sectioned_mode',
          selected_domains: selectedDomains,
          sections: newSections,
          current_section_index: allDone ? Math.max(0, newSections.length - 1) : nextIndex
        }
      }).eq('id', attemptId);
      if (allDone) {
        setSubmitted(true);
      }
    } catch (e) {
      console.error('Complete section failed', e);
      setError('Failed to complete section');
    }
  };

  // Start/generate the current section only when the user is ready (lazy generation)
  const startCurrentSection = async () => {
    if (!attemptId || !sectionsConfig) return;
    const subject = sectionsConfig[sectionIdx]?.subject;
    if (!subject) return;
    setError(null);
    setLoading(true);
    try {
      // If this section already has questions assigned, do NOT regenerate.
      const existing = sectionsConfig[sectionIdx];
      const existingQids: string[] = Array.isArray(existing?.qids) ? existing.qids : [];
      if (existingQids.length > 0) {
        const { data: qs, error: qerr } = await supabase
          .from('cuet_questions')
          .select('id,subject,topic,question,answer_index')
          .in('id', existingQids);
        if (qerr) throw qerr;
        const { data: opts, error: oerr } = await supabase
          .from('cuet_options')
          .select('question_id, idx, text')
          .in('question_id', existingQids);
        if (oerr) throw oerr;
        const byQ: Record<string, { idx: number; text: string }[]> = {};
        (opts || []).forEach((o: any) => {
          (byQ[o.question_id] = byQ[o.question_id] || []).push({ idx: o.idx, text: o.text });
        });
        const qById: Record<string, any> = {};
        (qs || []).forEach((q: any) => {
          const arr = (byQ[q.id] || []).sort((a,b) => a.idx - b.idx).map(x => x.text);
          const norm = normalizeOptions({ options: arr.length === 4 ? arr : [], answer_index: q.answer_index });
          qById[q.id] = { ...q, options: norm.options, answer_index: norm.answer_index };
        });
        const ordered: CuetQuestion[] = existingQids.map(id => ({ ...qById[id], qid: null, source: 'db' }));
        if (existing.status === 'completed') {
          // Do not restart a completed section; simply load for review (no timer)
          setQuestions(ordered);
          setAnswers(ordered.reduce((acc, q) => (acc[q.id] = null, acc), {} as Record<string, number | null>));
          setFlags(ordered.reduce((acc, q) => (acc[q.id] = false, acc), {} as Record<string, boolean>));
          setStartedAt(null);
          setRemainingSec(SECTION_TIME_MIN * 60);
          setLoading(false);
          return;
        }
        // In-progress: resume with timer
        setQuestions(ordered);
        setAnswers(ordered.reduce((acc, q) => (acc[q.id] = null, acc), {} as Record<string, number | null>));
        setFlags(ordered.reduce((acc, q) => (acc[q.id] = false, acc), {} as Record<string, boolean>));
        setCurrentIdx(0);
        setSubmitted(false);
        setStartedAt(new Date());
        setRemainingSec(SECTION_TIME_MIN * 60);
        // Ensure status persisted as in_progress
        const newSections = sectionsConfig.slice();
        newSections[sectionIdx] = { ...newSections[sectionIdx], status: 'in_progress', qids: existingQids };
        setSectionsConfig(newSections);
        await supabase.from('cuet_attempts').update({
          config: {
            question_count: selectedDomains.length * QUESTIONS_PER_SUBJECT,
            time_minutes: SECTION_TIME_MIN,
            marking: { correct: MARKS_CORRECT, wrong: MARKS_WRONG },
            generator: 'sectioned_mode',
            selected_domains: selectedDomains,
            sections: newSections,
            current_section_index: sectionIdx
          }
        }).eq('id', attemptId);
        setLoading(false);
        return;
      }
      // Try DB first for this subject: exact match then prefix fallback (helps for English/GAT naming)
      const limit = Math.max(QUESTIONS_PER_SUBJECT * 3, 60);
      const fetchByIdsWithOptions = async (qData: any[]) => {
        if (!qData?.length) return [] as any[];
        const ids = qData.map((q: any) => q.id);
        const { data: opts, error: oErr } = await supabase
          .from('cuet_options')
          .select('question_id, idx, text')
          .in('question_id', ids);
        if (oErr) throw oErr;
        const byQ: Record<string, { idx: number; text: string }[]> = {};
        (opts || []).forEach((o: any) => {
          (byQ[o.question_id] = byQ[o.question_id] || []).push({ idx: o.idx, text: o.text });
        });
        return (qData || []).map((q: any) => {
          const arr = (byQ[q.id] || []).sort((a,b) => a.idx - b.idx).map(x => x.text);
          // Synthesize options if missing
          const norm = normalizeOptions({ options: arr.length === 4 ? arr : [], answer_index: q.answer_index });
          return { ...q, options: norm.options, answer_index: norm.answer_index };
        });
      };
      const synonyms = subject.startsWith('English')
        ? ['English (Language)','English Language','English','English Core']
        : subject.startsWith('General Test')
          ? ['General Test (GAT)','General Test','GAT']
          : [subject];
      const prefix = subject.startsWith('English') ? 'English%'
        : subject.startsWith('General Test') ? 'General Test%'
        : subject.split('(')[0].trim() + '%';

      let enriched: any[] = [];
      // Exact IN match first
      {
        const { data: qData, error: qErr } = await supabase
          .from('cuet_questions')
          .select('id,subject,topic,question,answer_index')
          .in('subject', synonyms)
          .limit(limit);
        if (qErr) throw qErr;
        enriched = await fetchByIdsWithOptions(qData || []);
      }
      // Then prefix ilike for each synonym, merge
      if (enriched.length < QUESTIONS_PER_SUBJECT) {
        for (const syn of synonyms) {
          const pref = syn.split('(')[0].trim() + '%';
          const { data: qData2, error: qErr2 } = await supabase
            .from('cuet_questions')
            .select('id,subject,topic,question,answer_index')
            .ilike('subject', pref)
            .limit(limit);
          if (!qErr2 && qData2?.length) {
            const more = await fetchByIdsWithOptions(qData2);
            const seen = new Set(enriched.map((q:any)=>q.id));
            for (const q of more) if (!seen.has(q.id)) enriched.push(q);
          }
          if (enriched.length >= QUESTIONS_PER_SUBJECT) break;
        }
      }
      let selected: any[] = shuffle(enriched)
        .filter(x => (synonyms.includes(x.subject) || (typeof x.subject === 'string' && x.subject.startsWith(prefix.replace('%','')))) && Array.isArray(x.options) && x.options.length === 4)
        .slice(0, QUESTIONS_PER_SUBJECT);
      // Fill deficits by fallbacks per subject (parallelize GPT and Gemini, then web)
      if (selected.length < QUESTIONS_PER_SUBJECT) {
        const need = QUESTIONS_PER_SUBJECT - selected.length;
        const firstBatch = Math.min(need, 12);
        const quotas = [{ domain: subject, take: firstBatch }];
        let filled: any[] = [];
        try {
          const fast = await firstNonEmpty([
            () => generateMixedWithGPT([subject], quotas, firstBatch),
            () => generateMixedWithGemini([subject], quotas, firstBatch)
          ], 20000);
          filled.push(...fast);
        } catch {}
        if (filled.length < need) {
          try {
            const rem = Math.min(need - filled.length, 12);
            const webGen = await promiseWithTimeout(generateMixedWithWebSearch([subject], [{ domain: subject, take: rem }], rem), 15000);
            if (webGen?.length) filled.push(...webGen);
          } catch {}
        }
        // If still short, attempt a second GPT/Gemini race for the remaining
        if (filled.length < need) {
          const remain = Math.min(need - filled.length, 12);
          try {
            const fast2 = await firstNonEmpty([
              () => generateMixedWithGPT([subject], [{ domain: subject, take: remain }], remain),
              () => generateMixedWithGemini([subject], [{ domain: subject, take: remain }], remain)
            ], 20000);
            filled.push(...fast2);
          } catch {}
        }
        // Normalize generated subject field, ensure options, ids, and dedupe
        filled = filled.map((q:any) => {
          const norm = normalizeOptions(q);
          return { ...q, subject, options: norm.options, answer_index: norm.answer_index, id: q.id || crypto.randomUUID() };
        }).filter((q:any) => Array.isArray(q.options) && q.options.length === 4 && Number.isInteger(q.answer_index));
        selected = dedupeByQuestion([...selected, ...filled]).slice(0, QUESTIONS_PER_SUBJECT);

        // If still not enough, iterate in small batches to reach the target
        let safety = 6; // up to 6 more mini-attempts
        while (selected.length < QUESTIONS_PER_SUBJECT && safety-- > 0) {
          const remain = QUESTIONS_PER_SUBJECT - selected.length;
          const batch = Math.min(remain, 12);
          try {
            const got = await firstNonEmpty([
              () => generateMixedWithGPT([subject], [{ domain: subject, take: batch }], batch),
              () => generateMixedWithGemini([subject], [{ domain: subject, take: batch }], batch)
            ], 20000);
            let more = (got || []).map((q:any) => {
              const norm = normalizeOptions(q);
              return { ...q, subject, options: norm.options, answer_index: norm.answer_index, id: q.id || crypto.randomUUID() };
            });
            selected = dedupeByQuestion([...selected, ...more]).slice(0, QUESTIONS_PER_SUBJECT);
          } catch {}
          if (selected.length < QUESTIONS_PER_SUBJECT) {
            try {
              const web = await promiseWithTimeout(generateMixedWithWebSearch([subject], [{ domain: subject, take: batch }], batch), 15000);
              let more = (web || []).map((q:any) => {
                const norm = normalizeOptions(q);
                return { ...q, subject, options: norm.options, answer_index: norm.answer_index, id: q.id || crypto.randomUUID() };
              });
              selected = dedupeByQuestion([...selected, ...more]).slice(0, QUESTIONS_PER_SUBJECT);
            } catch {}
          }
        }

        // Final local fallback for English section to guarantee 50
        if (selected.length < QUESTIONS_PER_SUBJECT && subject.startsWith('English')) {
          const remain = QUESTIONS_PER_SUBJECT - selected.length;
          const local = generateLocalEnglish(remain).map(q => ({ ...q, subject, id: crypto.randomUUID() }));
          selected = dedupeByQuestion([...selected, ...local]).slice(0, QUESTIONS_PER_SUBJECT);
        }
      }

      if (selected.length < QUESTIONS_PER_SUBJECT) {
        console.debug('Section preparation shortfall', {
          subject,
          have: selected.length,
          dbPool: enriched.length
        });
        throw new Error(`Unable to prepare full section for ${subject}. Please try again or check API keys/network.`);
      }

      // Initialize answers for this section
      const initAns: Record<string, number | null> = {};
      selected.forEach(q => { initAns[q.id] = null; });
      setAnswers(initAns);
      setFlags(selected.reduce((acc, q) => (acc[q.id] = false, acc), {} as Record<string, boolean>));
      setQuestions(selected);
      setCurrentIdx(0);
      setSubmitted(false);
      setStartedAt(new Date());
      setRemainingSec(SECTION_TIME_MIN * 60);

      // Persist section qids and status
      const qids = selected.map((q: any) => q.id);
      const newSections = sectionsConfig.slice();
      newSections[sectionIdx] = { ...newSections[sectionIdx], status: 'in_progress', qids: qids };
      setSectionsConfig(newSections);
      await supabase.from('cuet_attempts').update({
        config: {
          question_count: selectedDomains.length * QUESTIONS_PER_SUBJECT,
          time_minutes: SECTION_TIME_MIN,
          marking: { correct: MARKS_CORRECT, wrong: MARKS_WRONG },
          generator: 'sectioned_mode',
          selected_domains: selectedDomains,
          sections: newSections,
          current_section_index: sectionIdx
        }
      }).eq('id', attemptId);
    } catch (e:any) {
      console.error('Start section failed', e);
      setError(e.message || 'Failed to start section');
    } finally {
      setLoading(false);
    }
  };

  async function generateMixedWithGPT(domains: string[], quotas: { domain: string; take: number }[], total: number): Promise<CuetQuestion[]> {
    try {
      const svc = OpenAIService.getInstance();
      const plan = quotas.map(q => `${q.domain}:${q.take}`).join(', ');
      const prompt = `You are an expert CUET-UG question setter. Create a mixed paper of exactly ${total} MCQs across these domain subjects with the following per-domain counts: ${plan}.

Output STRICT JSON array only (no extra text). Each item format:
{
  "subject": "<one of: ${domains.join(' | ')}>",
  "topic": "<syllabus topic>",
  "question": "<clear question>",
  "options": ["A","B","C","D"],
  "answer_index": <0..3>
}\n\nConstraints:\n- Align with CUET-UG 2025 syllabus (NCERT Class 12 level for domains).\n- Options must be plausible and unique; exactly 4.\n- answer_index must be correct.\n- Balance counts exactly per domain plan.`;
      const text = await svc.generateChatCompletion(prompt);
      let arr: any[] = extractJsonArray(text);
      if (!Array.isArray(arr)) return [];
      const valid = (arr as any[]).map((q: any) => ({
        subject: q.subject,
        topic: q.topic,
        question: q.question,
        options: q.options,
        answer_index: Number.isInteger(q.answer_index) ? q.answer_index : null,
        source: 'gpt',
        id: crypto.randomUUID()
      })).filter(x => x.subject && x.question && Array.isArray(x.options) && x.options.length === 4 && Number.isInteger(x.answer_index));
      return valid.slice(0, total) as any;
    } catch (e) {
      console.error('GPT mixed generation failed', e);
      return [];
    }
  }

  async function generateMixedWithGemini(domains: string[], quotas: { domain: string; take: number }[], total: number): Promise<CuetQuestion[]> {
    const apiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY || '';
    const model = (import.meta as any).env?.VITE_GEMINI_MODEL || 'gemini-2.5-flash';
    if (!apiKey) {
      console.warn('Gemini fallback skipped: VITE_GEMINI_API_KEY not set');
      return [];
    }
    try {
      // Try to fetch syllabus context from DB for better alignment
      let syllabusPrompt = '';
      try {
        const { data: syl, error: sylErr } = await supabase
          .from('cuet_syllabi')
          .select('subject, year, topics')
          .in('subject', domains);
        if (!sylErr && Array.isArray(syl) && syl.length) {
          // Build concise per-subject outline
          const sections = syl.map((row: any) => {
            const units = Array.isArray(row.topics) ? row.topics.slice(0, 8) : [];
            const unitLines = units.map((u: any) => {
              const unitName = typeof u?.unit === 'string' ? u.unit : 'Unit';
              const subs = Array.isArray(u?.subtopics) ? u.subtopics.slice(0, 6) : [];
              return `- ${unitName}: ${subs.join(', ')}`;
            }).join('\n');
            return `Subject: ${row.subject} (Year: ${row.year || '2025'})\n${unitLines}`;
          });
          syllabusPrompt = `\nSyllabus Context (authoritative; pick topics only from here):\n${sections.join('\n\n')}`;
        }
      } catch (sylCatch) {
        console.warn('Syllabus context unavailable, proceeding without it', sylCatch);
      }

      const plan = quotas.map(q => `${q.domain}:${q.take}`).join(', ');
      const prompt = `You are an expert CUET-UG question setter. Create a mixed paper of exactly ${total} MCQs across these domain subjects with the following per-domain counts: ${plan}.

Return STRICT JSON array only (no extra text). Each item format:
{
  "subject": "<one of: ${domains.join(' | ')}>",
  "topic": "<syllabus topic>",
  "question": "<clear question>",
  "options": ["A","B","C","D"],
  "answer_index": <0..3>
}

Constraints:
- Align with CUET-UG 2025 syllabus (NCERT Class 12 level for domains).
- Options must be plausible and unique; exactly 4.
- answer_index must be correct.
- Balance counts exactly per domain plan.${syllabusPrompt ? `\n${syllabusPrompt}` : ''}`;

      const res = await fetch(`https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [ { role: 'user', parts: [ { text: prompt } ] } ],
          generationConfig: { temperature: 0.2, maxOutputTokens: 1536 }
        })
      });
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      let arr: any[] = extractJsonArray(text);
      if (!Array.isArray(arr)) return [];
      const valid = (arr as any[]).map((q: any) => ({
        subject: q.subject,
        topic: q.topic,
        question: q.question,
        options: q.options,
        answer_index: Number.isInteger(q.answer_index) ? q.answer_index : null,
        source: 'gemini',
        id: crypto.randomUUID()
      })).filter(x => x.subject && x.question && Array.isArray(x.options) && x.options.length === 4 && Number.isInteger(x.answer_index));
      return valid.slice(0, total) as any;
    } catch (e) {
      console.error('Gemini mixed generation failed', e);
      return [];
    }
  }

  // Extract a JSON array (or object coerced to array) from a possibly fenced string
  function extractJsonArray(text: string): any[] {
    if (!text || typeof text !== 'string') return [];
    let s = text.trim();
    // Remove markdown fences ```json ... ``` or ``` ... ```
    if (s.startsWith('```')) {
      const firstLineEnd = s.indexOf('\n');
      if (firstLineEnd !== -1) s = s.slice(firstLineEnd + 1);
      if (s.endsWith('```')) s = s.slice(0, -3);
      s = s.trim();
      if (s.startsWith('json')) s = s.slice(4).trim();
    }
    // Try to find a top-level JSON array first
    const firstArr = s.indexOf('[');
    const lastArr = s.lastIndexOf(']');
    const firstObj = s.indexOf('{');
    const lastObj = s.lastIndexOf('}');
    const candidates: string[] = [];
    if (firstArr !== -1 && lastArr !== -1 && lastArr > firstArr) candidates.push(s.slice(firstArr, lastArr + 1));
    if (firstObj !== -1 && lastObj !== -1 && lastObj > firstObj) candidates.push(s.slice(firstObj, lastObj + 1));
    for (const c of candidates) {
      try {
        const parsed = JSON.parse(c);
        if (Array.isArray(parsed)) return parsed;
        if (parsed && typeof parsed === 'object') return [parsed];
      } catch {}
    }
    // Fallback: try raw parse
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) return parsed;
      if (parsed && typeof parsed === 'object') return [parsed];
    } catch {}
    return [];
  }

  async function generateMixedWithWebSearch(domains: string[], quotas: { domain: string; take: number }[], total: number): Promise<CuetQuestion[]> {
    try {
      const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL;
      if (!supabaseUrl) {
        console.warn('Web search fallback skipped: VITE_SUPABASE_URL not set');
        return [];
      }
      const { data: sess } = await supabase.auth.getSession();
      const accessToken = sess?.session?.access_token;
      const res = await fetch(`${supabaseUrl}/functions/v1/cuet-web-search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ domains, quotas, total })
      });
      if (!res.ok) {
        const t = await res.text();
        console.warn('cuet-web-search failed', res.status, t);
        return [];
      }
      const json = await res.json();
      const items: any[] = Array.isArray(json?.items) ? json.items : [];
      return items.slice(0, total).map((it: any, idx: number) => ({
        id: `web_${Date.now()}_${idx}`,
        qid: null,
        subject: typeof it.subject === 'string' ? it.subject : null,
        topic: typeof it.topic === 'string' ? it.topic : null,
        question: String(it.question || ''),
        options: Array.isArray(it.options) ? it.options.slice(0,4) : null,
        answer_index: typeof it.answer_index === 'number' ? it.answer_index : null,
        source: 'web'
      }));
    } catch (e) {
      console.warn('Web search fallback generation failed', e);
      return [];
    }
  }

  const resumeExam = async () => {
    if (!resumableAttempt) return;
    setError(null);
    setLoading(true);
    try {
      const cfg = resumableAttempt.config || {};
      // Sectioned resume: if a section is in progress, load its qids. Otherwise, prepare UI to start next section.
      const sections: any[] = Array.isArray(cfg.sections) ? cfg.sections : [];
      // Choose resume index: in_progress > first pending > 0
      let sIdx = sections.findIndex((s:any) => s?.status === 'in_progress');
      if (sIdx < 0) sIdx = sections.findIndex((s:any) => s?.status === 'pending');
      if (sIdx < 0) sIdx = Math.max(0, Math.min(typeof cfg.current_section_index === 'number' ? cfg.current_section_index : 0, sections.length - 1));
      setSectionsConfig(sections);
      setSectionIdx(sIdx);
      const current = sections[sIdx];
      const qids: string[] = Array.isArray(current?.qids) ? current.qids : [];
      let orderedLocal: CuetQuestion[] = [];
      if (qids.length > 0) {
        const { data: qs, error: qerr } = await supabase
          .from('cuet_questions')
          .select('id,subject,topic,question,answer_index')
          .in('id', qids);
        if (qerr) throw qerr;
        const { data: opts, error: oerr } = await supabase
          .from('cuet_options')
          .select('question_id, idx, text')
          .in('question_id', qids);
        if (oerr) throw oerr;
        const byQ: Record<string, { idx: number; text: string }[]> = {};
        (opts || []).forEach((o: any) => {
          (byQ[o.question_id] = byQ[o.question_id] || []).push({ idx: o.idx, text: o.text });
        });
        const qById: Record<string, any> = {};
        (qs || []).forEach((q: any) => {
          const arr = (byQ[q.id] || []).sort((a,b) => a.idx - b.idx).map(x => x.text);
          const norm = normalizeOptions({ options: arr.length === 4 ? arr : [], answer_index: q.answer_index });
          qById[q.id] = { ...q, options: norm.options, answer_index: norm.answer_index };
        });
        const ordered: CuetQuestion[] = qids.map(id => ({ ...qById[id], qid: null, source: 'db' }));
        orderedLocal = ordered;
        setQuestions(ordered);
        if (current?.status === 'in_progress') {
          setStartedAt(new Date());
          setRemainingSec((cfg.time_minutes || SECTION_TIME_MIN) * 60);
        } else {
          // completed or unknown: keep timer stopped
          setStartedAt(null);
          setRemainingSec((cfg.time_minutes || SECTION_TIME_MIN) * 60);
        }
      } else {
        setQuestions([]);
      }
      setAttemptId(resumableAttempt.id);
      setTimeMinutes(cfg.time_minutes || SECTION_TIME_MIN);

      // load existing answers
      const { data: ans, error: aerr } = await supabase
        .from('cuet_attempt_answers')
        .select('question_id, selected_index')
        .eq('attempt_id', resumableAttempt.id);
      if (aerr) throw aerr;
      const initAns: Record<string, number | null> = {};
      orderedLocal.forEach((q: CuetQuestion) => { initAns[q.id] = null; });
      (ans || []).forEach((r: any) => { initAns[r.question_id] = r.selected_index; });
      setAnswers(initAns);
      setFlags(orderedLocal.reduce((acc, q) => (acc[q.id] = false, acc), {} as Record<string, boolean>));
      setSubmitted(false);
      setCurrentIdx(0);
      // Timer initialized above depending on active section
    } catch (e: any) {
      setError(e.message || 'Failed to resume exam');
    } finally {
      setLoading(false);
    }
  };

  const score = useMemo(() => {
    if (!submitted) return null as null | { correct: number; incorrect: number; skipped: number; score: number };
    let correct = 0, incorrect = 0, skipped = 0;
    questions.forEach(q => {
      const sel = answers[q.id];
      if (sel == null) { skipped++; return; }
      const ai = q.answer_index ?? null;
      if (ai == null) { skipped++; return; }
      if (sel === ai) correct++; else incorrect++;
    });
    const total = correct * MARKS_CORRECT + incorrect * MARKS_WRONG;
    return { correct, incorrect, skipped, score: total };
  }, [submitted, answers, questions]);

  const onSelect = (qId: string, idx: number) => {
    setAnswers(prev => ({ ...prev, [qId]: idx }));
  };

  const toggleFlag = (qId: string) => {
    setFlags(prev => ({ ...prev, [qId]: !prev[qId] }));
  };

  // Autosave answers every 10s
  useEffect(() => {
    if (!attemptId || submitted) return;
    const interval = window.setInterval(async () => {
      try {
        const rows = Object.entries(answers)
          .filter(([_, v]) => v != null)
          .map(([qid, sel]) => {
            const q = questions.find(qq => qq.id === qid);
            const correct = q?.answer_index ?? null;
            const isCorrect = correct != null && sel === correct;
            return {
              attempt_id: attemptId,
              question_id: qid,
              selected_index: sel,
              correct_index: correct,
              is_correct: isCorrect,
            };
          });
        if (rows.length > 0) {
          await supabase.from('cuet_attempt_answers').upsert(rows, { onConflict: 'attempt_id,question_id' });
        }
      } catch (e) {
        console.warn('Autosave failed', e);
      }
    }, 10000);
    return () => window.clearInterval(interval);
  }, [attemptId, answers, submitted, questions]);

  // Finalize attempt on submit (or time up)
  useEffect(() => {
    if (!submitted || !attemptId || finalizingRef.current) return;
    finalizingRef.current = true;
    (async () => {
      try {
        // 1) Last upsert of answers
        const rows = Object.entries(answers)
          .filter(([_, v]) => v != null)
          .map(([qid, sel]) => {
            const q = questions.find(qq => qq.id === qid);
            const correct = q?.answer_index ?? null;
            const isCorrect = correct != null && sel === correct;
            return {
              attempt_id: attemptId,
              question_id: qid,
              selected_index: sel,
              correct_index: correct,
              is_correct: isCorrect,
            };
          });
        if (rows.length > 0) {
          await supabase.from('cuet_attempt_answers').upsert(rows, { onConflict: 'attempt_id,question_id' });
        }

        // 2) Compute summary
        let correct = 0, incorrect = 0, skipped = 0;
        questions.forEach(q => {
          const sel = answers[q.id];
          if (sel == null) { skipped++; return; }
          const ai = q.answer_index ?? null;
          if (ai == null) { skipped++; return; }
          if (sel === ai) correct++; else incorrect++;
        });
        const total = correct * MARKS_CORRECT + incorrect * MARKS_WRONG;
        const started = startedAt ? startedAt.getTime() : Date.now();
        const durationSec = Math.max(0, Math.round((Date.now() - started) / 1000));

        // 3) Update attempt
        await supabase.from('cuet_attempts').update({
          submitted_at: new Date().toISOString(),
          duration_sec: durationSec,
          summary: { correct, incorrect, skipped, score: total }
        }).eq('id', attemptId);
      } catch (e) {
        console.warn('Finalize attempt failed', e);
      }
    })();
  }, [submitted, attemptId, answers, questions, startedAt]);

  const answeredCount = useMemo(() => {
    try { return Object.values(answers).filter(v => v != null).length; } catch { return 0; }
  }, [answers]);

  const renderQuestion = (q: CuetQuestion) => {
    const sel = answers[q.id];
    const options: string[] = Array.isArray(q.options) && q.options.length === 4
      ? q.options as string[]
      : ['A', 'B', 'C', 'D']; // placeholder if options missing
    return (
      <div className="space-y-4">
        <div className="text-lg font-semibold text-gray-900 flex items-start justify-between gap-3">
          <div>Q{currentIdx + 1}. {q.question}</div>
          <button
            type="button"
            onClick={() => toggleFlag(q.id)}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs border ${flags[q.id] ? 'border-yellow-500 text-yellow-700 bg-yellow-100' : 'border-gray-300 text-gray-700 hover:bg-gray-100'}`}
            title={flags[q.id] ? 'Unmark question' : 'Mark for review'}
          >
            <Flag className={`w-3.5 h-3.5 ${flags[q.id] ? 'text-yellow-600' : 'text-gray-600'}`} />
            {flags[q.id] ? 'Marked' : 'Mark'}
          </button>
        </div>
        <div className="grid grid-cols-1 gap-3">
          {options.map((opt, i) => (
            <label key={i} className={`p-3 rounded-lg border cursor-pointer ${sel === i ? 'border-primary-500 bg-primary-500/10' : 'border-gray-700 bg-gray-300/50'} hover:bg-primary-500/10`}>
              <input
                type="radio"
                name={`q_${q.id}`}
                className="mr-2"
                checked={sel === i}
                onChange={() => onSelect(q.id, i)}
              />
              <span className="text-gray-900">{opt}</span>
            </label>
          ))}
        </div>
      </div>
    );
  };

  // Topic stats
  const topicStats = useMemo(() => {
    if (!submitted) return null as any;
    const stats: Record<string, { total: number; correct: number }> = {};
    questions.forEach(q => {
      const t = q.topic || 'General';
      stats[t] = stats[t] || { total: 0, correct: 0 };
      stats[t].total++;
      const sel = answers[q.id];
      const ai = q.answer_index ?? null;
      if (sel != null && ai != null && sel === ai) stats[t].correct++;
    });
    return stats;
  }, [submitted, questions, answers]);

  const submittedView = submitted && score ? (
    <div className="card-elevated mt-6">
      <h3 className="text-xl font-bold text-gray-900 mb-2">Result</h3>
      <div className="text-gray-200">Correct: {score.correct}</div>
      <div className="text-gray-200">Incorrect: {score.incorrect}</div>
      <div className="text-gray-200">Skipped: {score.skipped}</div>
      <div className="text-primary-300 font-semibold">Score: {score.score}</div>
      {topicStats && (
        <div className="mt-4 text-gray-200">
          <div className="font-semibold mb-2">Per-topic:</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {Object.entries(topicStats).map(([t, s]: any) => (
              <div key={t} className="bg-gray-300/60 rounded p-2">
                <div className="text-gray-900">{t}</div>
                <div className="text-sm text-gray-900">{s.correct}/{s.total} correct</div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="mt-6">
        <div className="font-semibold text-gray-900 mb-2">Review</div>
        <div className="space-y-3 max-h-96 overflow-auto pr-2">
          {questions.map((q, idx) => {
            const sel = answers[q.id];
            const ai = q.answer_index ?? null;
            const options: string[] = Array.isArray(q.options) && q.options.length === 4 ? q.options : ['A','B','C','D'];
            const correct = ai != null ? options[ai] : undefined;
            const chosen = sel != null ? options[sel] : undefined;
            const status = sel == null || ai == null ? 'skipped' : (sel === ai ? 'correct' : 'incorrect');
            return (
              <div key={q.id} className={`p-3 rounded border ${status==='correct' ? 'border-green-600 bg-green-600/10' : status==='incorrect' ? 'border-red-600 bg-red-600/10' : 'border-gray-700 bg-gray-300/50'}`}>
                <div className="text-gray-900 font-medium">Q{idx+1}. {q.question}</div>
                <div className="text-sm text-gray-900 mt-1">Your answer: {chosen ?? '—'}</div>
                <div className="text-sm text-gray-900">Correct answer: {correct ?? '—'}</div>
                {q.topic && <div className="text-xs text-gray-400 mt-1">Topic: {q.topic}</div>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">CUET Simulator</h1>
        <p className="text-gray-900">Practice with realistic CUET-style MCQs</p>
      </div>

      <div className="card-elevated">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <label className="block mb-1 font-semibold text-gray-900">Select Subjects (3–6). Each selected subject contributes 50 questions.</label>
            <div className="text-xs text-gray-400 mb-2">
              Selected: {selectedDomains.length} • Total Questions: {selectedDomains.length * QUESTIONS_PER_SUBJECT} • Max Marks: {selectedDomains.length * 250}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-auto p-2 rounded bg-gray-900/40 border border-gray-800">
              {CUET_DOMAINS.map(d => {
                const checked = selectedDomains.includes(d);
                const disableAdd = !checked && selectedDomains.length >= MAX_SUBJECTS;
                return (
                  <label key={d} className="flex items-center gap-2 text-gray-200">
                    <input type="checkbox" checked={checked} disabled={disableAdd} onChange={(e) => {
                      setSelectedDomains(prev => e.target.checked ? Array.from(new Set([...prev, d])) : prev.filter(x => x !== d));
                    }} />
                    <span>{d}</span>
                  </label>
                );
              })}
            </div>
            <div className="text-xs text-gray-400 mt-1">Select between {MIN_SUBJECTS} and {MAX_SUBJECTS} subjects. Paper has exactly 50 questions per subject.</div>
          </div>
          <div>
            <label className="block mb-2 font-semibold text-gray-900">Questions</label>
            <input className="form-input w-full" type="number" value={selectedDomains.length * QUESTIONS_PER_SUBJECT} readOnly />
          </div>
          <div>
            <label className="block mb-2 font-semibold text-gray-900">Time per section (min)</label>
            <input className="form-input w-full" type="number" value={SECTION_TIME_MIN} readOnly />
          </div>
          <div className="flex items-end gap-2">
            <button className="btn-primary w-full" disabled={loading} onClick={startExam}>
              {loading ? 'Preparing...' : 'Prepare Exam (Sectioned)'}
            </button>
            {resumableAttempt && (
              <button className="btn-secondary w-full" disabled={loading} onClick={resumeExam}>
                Resume Last Attempt
              </button>
            )}
          </div>
        </div>
        {error && <div className="text-red-400 mt-3">{error}</div>}
        {attemptId && sectionsConfig && (
          <div className="mt-4 p-3 rounded border border-gray-800 bg-gray-900/40">
            <div className="text-gray-900 font-semibold mb-2">Sections</div>
            <div className="flex flex-wrap gap-2 mb-3">
              {sectionsConfig.map((s, i) => (
                <button
                  key={s.subject}
                  type="button"
                  onClick={() => { if (questions.length === 0) setSectionIdx(i); }}
                  className={`px-2 py-1 rounded text-xs cursor-pointer ${i===sectionIdx ? 'bg-primary-600 text-gray-900' : 'bg-gray-700 text-gray-200 hover:bg-gray-600'}`}
                  title={questions.length === 0 ? 'Select section' : 'Finish current section to switch'}
                >
                  {i+1}. {s.subject} • {s.status}
                </button>
              ))}
            </div>
            {questions.length === 0 ? (
              <button className="btn-primary" onClick={startCurrentSection} disabled={loading}>
                {loading ? 'Starting…' : `Start Section ${sectionIdx+1}: ${sectionsConfig[sectionIdx]?.subject}`}
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <div className="text-xs text-gray-400">Section in progress: {sectionsConfig[sectionIdx]?.subject}. You can finish this section and take a break before the next.</div>
                <button className="btn-secondary" onClick={completeCurrentSection}>
                  Finish Section
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {questions.length > 0 && !submitted && (
        <div className="card-elevated">
          <div className="flex items-center justify-between mb-4">
            <div className="text-gray-900 font-semibold">Mixed Domains: {selectedDomains.join(', ')}</div>
            <div className="text-warning-300 font-bold">Time Left: {Math.floor(remainingSec/60)}:{String(remainingSec%60).padStart(2,'0')}</div>
          </div>
          <div className="mb-4">
            <div className="h-2 w-full bg-gray-700 rounded">
              <div
                className="h-2 bg-primary-500 rounded"
                style={{ width: `${questions.length ? Math.round((answeredCount / questions.length) * 100) : 0}%` }}
              />
            </div>
            <div className="text-xs text-gray-500 mt-1">{answeredCount}/{questions.length} answered</div>
          </div>
          {renderQuestion(questions[currentIdx])}
          <div className="flex items-center justify-between mt-6">
            <div className="flex gap-2 flex-wrap">
              {questions.map((_, i) => (
                <button
                  key={i}
                  className={`relative w-8 h-8 text-sm rounded ${i===currentIdx ? 'bg-primary-600 text-gray-900' : 'bg-gray-700 text-gray-200'} ${answers[questions[i].id] != null ? 'ring-2 ring-primary-400' : ''} ${flags[questions[i].id] ? 'ring-2 ring-yellow-400' : ''}`}
                  onClick={() => setCurrentIdx(i)}
                  title={flags[questions[i].id] ? 'Flagged for review' : undefined}
                >
                  {i+1}
                  {flags[questions[i].id] && <Flag className="absolute -top-1 -right-1 w-3 h-3 text-yellow-400" />}
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <button className="btn-secondary" onClick={() => setCurrentIdx(Math.max(0, currentIdx-1))}>Prev</button>
              <button className="btn-secondary" onClick={() => setCurrentIdx(Math.min(questions.length-1, currentIdx+1))}>Next</button>
              <button
                className="btn-primary"
                onClick={() => {
                  const msg = 'Are you sure you want to submit? You will not be able to change answers afterwards.';
                  if (window.confirm(msg)) setSubmitted(true);
                }}
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}

      {submittedView}
    </div>
  );
};

export default CUETSimulator;
