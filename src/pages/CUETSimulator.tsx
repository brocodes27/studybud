import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import OpenAIService from '../lib/openaiService';
import { Flag } from 'lucide-react';

type CuetQuestion = {
  id: string; // UUID
  qid?: string | null;
  subject?: string | null;
  topic?: string | null;
  question: string;
  options?: string[] | null;
  answer_index?: number | null;
  source?: string | null;
  type?: 'mcq' | 'mtf' | 'ar' | 'statement' | 'case_study' | null;
  passage?: string | null;
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

// Sort questions by CUET blueprint sequence
function sortQuestionsByBlueprint(questions: CuetQuestion[]): CuetQuestion[] {
  const typeOrder = {
    'mcq': 0,
    'statement': 1,
    'mtf': 2,
    'ar': 3,
    'case_study': 4
  };
  return [...questions].sort((a, b) => {
    const orderA = typeOrder[a.type as keyof typeof typeOrder] ?? 99;
    const orderB = typeOrder[b.type as keyof typeof typeOrder] ?? 99;
    if (orderA !== orderB) return orderA - orderB;
    // For case_study, keep items with the same passage together
    if (a.type === 'case_study' && b.type === 'case_study' && a.passage !== b.passage) {
      return (a.passage || '').localeCompare(b.passage || '');
    }
    return 0; // maintain relative order
  });
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
    const opts = shuffle([b.correct, ...b.distractors]).slice(0, 4);
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
          const arr = (byQ[q.id] || []).sort((a, b) => a.idx - b.idx).map(x => x.text);
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
          const arr = (byQ[q.id] || []).sort((a, b) => a.idx - b.idx).map(x => x.text);
          // Synthesize options if missing
          const norm = normalizeOptions({ options: arr.length === 4 ? arr : [], answer_index: q.answer_index });
          return { ...q, options: norm.options, answer_index: norm.answer_index };
        });
      };
      const synonyms = subject.startsWith('English')
        ? ['English (Language)', 'English Language', 'English', 'English Core']
        : subject.startsWith('General Test')
          ? ['General Test (GAT)', 'General Test', 'GAT']
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
            const seen = new Set(enriched.map((q: any) => q.id));
            for (const q of more) if (!seen.has(q.id)) enriched.push(q);
          }
          if (enriched.length >= QUESTIONS_PER_SUBJECT) break;
        }
      }
      let selected: any[] = shuffle(enriched)
        .filter(x => (synonyms.includes(x.subject) || (typeof x.subject === 'string' && x.subject.startsWith(prefix.replace('%', '')))) && Array.isArray(x.options) && x.options.length === 4)
        .slice(0, QUESTIONS_PER_SUBJECT);
      // Fill deficits by fallbacks per subject (parallelize GPT and Gemini, then web)
      if (selected.length < QUESTIONS_PER_SUBJECT) {
        const need = QUESTIONS_PER_SUBJECT - selected.length;
        const firstBatch = Math.min(need, 12);
        const quotas = [{ domain: subject, take: firstBatch }];
        let filled: any[] = [];
        try {
          const fast = await generateMixedWithGPT([subject], quotas, firstBatch);
          filled.push(...fast);
        } catch { }
        if (filled.length < need) {
          try {
            const rem = Math.min(need - filled.length, 12);
            const webGen = await promiseWithTimeout(generateMixedWithWebSearch([subject], [{ domain: subject, take: rem }], rem), 15000);
            if (webGen?.length) filled.push(...webGen);
          } catch { }
        }
        // If still short, attempt a second GPT/Gemini race for the remaining
        if (filled.length < need) {
          const remain = Math.min(need - filled.length, 12);
          try {
            const fast2 = await generateMixedWithGPT([subject], [{ domain: subject, take: remain }], remain);
            filled.push(...fast2);
          } catch { }
        }
        // Normalize generated subject field, ensure options, ids, and dedupe
        filled = filled.map((q: any) => {
          const norm = normalizeOptions(q);
          return { ...q, subject, options: norm.options, answer_index: norm.answer_index, id: q.id || crypto.randomUUID() };
        }).filter((q: any) => Array.isArray(q.options) && q.options.length === 4 && Number.isInteger(q.answer_index));
        selected = dedupeByQuestion([...selected, ...filled]).slice(0, QUESTIONS_PER_SUBJECT);

        // If still not enough, iterate in small batches to reach the target
        let safety = 6; // up to 6 more mini-attempts
        while (selected.length < QUESTIONS_PER_SUBJECT && safety-- > 0) {
          const remain = QUESTIONS_PER_SUBJECT - selected.length;
          const batch = Math.min(remain, 12);
          try {
            const got = await generateMixedWithGPT([subject], [{ domain: subject, take: batch }], batch);
            let more = (got || []).map((q: any) => {
              const norm = normalizeOptions(q);
              return { ...q, subject, options: norm.options, answer_index: norm.answer_index, id: q.id || crypto.randomUUID() };
            });
            selected = dedupeByQuestion([...selected, ...more]).slice(0, QUESTIONS_PER_SUBJECT);
          } catch { }
          if (selected.length < QUESTIONS_PER_SUBJECT) {
            try {
              const web = await promiseWithTimeout(generateMixedWithWebSearch([subject], [{ domain: subject, take: batch }], batch), 15000);
              let more = (web || []).map((q: any) => {
                const norm = normalizeOptions(q);
                return { ...q, subject, options: norm.options, answer_index: norm.answer_index, id: q.id || crypto.randomUUID() };
              });
              selected = dedupeByQuestion([...selected, ...more]).slice(0, QUESTIONS_PER_SUBJECT);
            } catch { }
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
    } catch (e: any) {
      console.error('Start section failed', e);
      setError(e.message || 'Failed to start section');
    } finally {
      setLoading(false);
    }
  };

  // CUET Domain to CBSE Subject Mapper


  async function fetchRagContext(domains: string[]): Promise<string> {
    const svc = OpenAIService.getInstance();
    let combinedContext = "";
    const subjectsToFetch = [...new Set(domains.filter(Boolean))] as string[];

    for (const subj of subjectsToFetch) {
      try {
        const query = `${subj} important cuet questions conceptual`;
        const embedding = await svc.getEmbedding(query);
        // Call the new RPC targeting cuet_question_bank
        const similar = await svc.searchCuetQuestions(embedding, 0.4, 3, subj);

        if (similar && similar.length > 0) {
          const snippet = similar.map((q: any) => `- [${subj}] ${q.question}`).join("\n");
          combinedContext += `\n\n### Reference Questions for ${subj}:\n${snippet}`;
        }
      } catch (e) {
        console.warn(`Failed to fetch RAG context for ${subj}`, e);
      }
    }
    return combinedContext;
  }

  async function generateMixedWithGPT(domains: string[], quotas: { domain: string; take: number }[], total: number): Promise<CuetQuestion[]> {
    try {
      const svc = OpenAIService.getInstance();

      // 1. Fetch RAG Context
      let ragContext = "";
      try {
        ragContext = await fetchRagContext(domains);
        if (ragContext) console.log("RAG Context injected into GPT prompt");
      } catch (err) { console.warn("RAG fetch failed", err); }

      const plan = quotas.map(q => `${q.domain}:${q.take}`).join(', ');
      const blueprint = `Enforce the following CUET UG 2025 question distribution:
- **Match the Following (MTF)**: ~15%
- **Assertion-Reason (AR)**: ~15%
- **Statement-Based (SB)**: ~15%
- **Case-Study (CS)**: Include 1 passage with 5 sub-questions if total >= 10.
- **Direct MCQs**: Remainder (~40%).

For MTF, format the question clearly with List I and List II and A/B/C/D combinations in options.
For AR, provide two statements (Assertion A and Reason R) and standard 4 options (Both true and R is correct explanation, etc.).
For Case-Study, ensure 'passage' field is populated for all 5 sub-questions and 'question' is individual.`;

      const prompt = `You are an expert CUET-UG question setter. Create a mixed paper of exactly ${total} items across these domain subjects with the following per-domain counts: ${plan}.

${blueprint}

${ragContext ? `REFERENCE MATERIAL (Use these ONLY for difficulty level and style, do not copy exact questions):\n${ragContext}\n` : ""}

Output STRICT JSON array only (no extra text). Each item format:
{
  "subject": "<one of: ${domains.join(' | ')}>",
  "topic": "<syllabus topic>",
  "type": "mcq | mtf | ar | statement | case_study",
  "passage": "<text of passage, only for case_study>",
  "question": "<clear question text>",
  "options": ["A","B","C","D"],
  "answer_index": <0..3>
}

Constraints:
- Align with CUET-UG 2025 syllabus (NCERT Class 12 level).
- Options must be plausible and unique; exactly 4.
- answer_index must be correct.
- Balance counts exactly per domain plan.`;
      const text = await svc.generateChatCompletion(prompt);
      let arr: any[] = extractJsonArray(text);
      if (!Array.isArray(arr)) return [];
      const valid = (arr as any[]).map((q: any) => ({
        subject: q.subject,
        topic: q.topic,
        type: q.type || 'mcq',
        passage: q.passage || null,
        question: q.question,
        options: q.options,
        answer_index: Number.isInteger(q.answer_index) ? q.answer_index : null,
        source: 'gpt',
        id: crypto.randomUUID()
      })).filter(x => x.subject && x.question && Array.isArray(x.options) && x.options.length === 4 && Number.isInteger(x.answer_index));
      return sortQuestionsByBlueprint(valid).slice(0, total) as any;
    } catch (e) {
      console.error('GPT mixed generation failed', e);
      return [];
    }
  }

  // Gemini generator removed as per user preference for OpenAI
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
      } catch { }
    }
    // Fallback: try raw parse
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) return parsed;
      if (parsed && typeof parsed === 'object') return [parsed];
    } catch { }
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
        options: Array.isArray(it.options) ? it.options.slice(0, 4) : null,
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
      let sIdx = sections.findIndex((s: any) => s?.status === 'in_progress');
      if (sIdx < 0) sIdx = sections.findIndex((s: any) => s?.status === 'pending');
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
          const arr = (byQ[q.id] || []).sort((a, b) => a.idx - b.idx).map(x => x.text);
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
      : ['A', 'B', 'C', 'D'];

    // Special formatting for Match the Following (MTF)
    const isMTF = q.type === 'mtf' || q.question.toLowerCase().includes('list i') || q.question.toLowerCase().includes('match the following');
    // Special formatting for Assertion-Reason (AR)
    const isAR = q.type === 'ar' || (q.question.includes('Assertion') && q.question.includes('Reason'));

    return (
      <div className="space-y-6">
        {/* Passage for Case Study */}
        {q.passage && (
          <div className="neo-card bg-neo-secondary/10 border-neo-muted">
            <div className="sticker bg-neo-secondary mb-3">Case Study Passage</div>
            <div className="text-sm md:text-base leading-relaxed whitespace-pre-wrap font-medium">
              {q.passage}
            </div>
          </div>
        )}

        {/* Question Header */}
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="sticker bg-neo-accent text-black mb-2">Question {currentIdx + 1}</div>
              {isAR ? (
                <div className="space-y-4">
                  <div className="text-xl font-bold font-mono tracking-tight leading-snug">
                    {q.question.split('\n').map((line, i) => (
                      <div key={i} className={line.startsWith('Assertion') || line.startsWith('Reason') ? 'bg-black/5 p-2 rounded' : ''}>
                        {line}
                      </div>
                    ))}
                  </div>
                </div>
              ) : isMTF ? (
                <div className="space-y-4">
                  <div className="text-xl font-bold font-mono tracking-tight leading-snug whitespace-pre-wrap italic">
                    {q.question}
                  </div>
                </div>
              ) : (
                <div className="text-xl font-bold font-mono tracking-tight leading-snug">
                  {q.question}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => toggleFlag(q.id)}
              className={`neo-button-white px-3 py-2 text-xs h-fit ${flags[q.id] ? 'bg-neo-secondary' : ''}`}
            >
              <Flag className={`w-4 h-4 ${flags[q.id] ? 'fill-black' : ''}`} />
              {flags[q.id] ? 'MARKED' : 'MARK'}
            </button>
          </div>

          {q.subject && (
            <div className="flex gap-2">
              <span className="sticker bg-black text-black text-[10px]">{q.subject}</span>
              {q.topic && <span className="sticker bg-neo-muted text-[10px]">{q.topic}</span>}
            </div>
          )}
        </div>

        {/* Options Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {options.map((opt, i) => (
            <label
              key={i}
              className={`neo-card cursor-pointer p-4 flex items-center gap-4 transition-all active:scale-[0.98] ${sel === i ? 'bg-neo-secondary translate-x-1 translate-y-1 shadow-none border-black' : 'bg-white hover:bg-neo-secondary/20'
                }`}
            >
              <div className={`w-8 h-8 rounded-full border-2 border-black flex items-center justify-center font-black ${sel === i ? 'bg-black text-black' : 'bg-transparent'}`}>
                {String.fromCharCode(65 + i)}
              </div>
              <input
                type="radio"
                name={`q_${q.id}`}
                className="hidden"
                checked={sel === i}
                onChange={() => onSelect(q.id, i)}
              />
              <span className="font-bold text-lg">{opt}</span>
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
    <div className="neo-card space-y-12">
      <div className="flex flex-col md:flex-row justify-between items-start gap-8">
        <div>
          <div className="sticker bg-neo-secondary rotate-sticker-1 mb-4">
            {sectionIdx < (sectionsConfig?.length || 0) - 1 ? 'Section Completed' : 'Exam Completed'}
          </div>
          <h2 className="text-3xl md:text-6xl font-black italic">
            {sectionIdx < (sectionsConfig?.length || 0) - 1 ? 'SECTION SCORE:' : 'FINAL SCORE:'}
            <span className="text-stroke-neo"> {score.score}</span>
          </h2>
        </div>
        <div className="grid grid-cols-2 gap-4 w-full md:w-auto">
          <div className="neo-card bg-green-500 text-black p-4 text-center">
            <div className="text-xs font-black uppercase">Correct</div>
            <div className="text-3xl font-black">{score.correct}</div>
          </div>
          <div className="neo-card bg-neo-accent text-black p-4 text-center">
            <div className="text-xs font-black uppercase">Wrong</div>
            <div className="text-3xl font-black">{score.incorrect}</div>
          </div>
        </div>
      </div>

      {topicStats && (
        <div className="space-y-6">
          <h3 className="text-2xl">Performance by Topic</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Object.entries(topicStats).map(([t, s]: any) => {
              const pct = Math.round((s.correct / s.total) * 100);
              return (
                <div key={t} className={`neo-card ${pct >= 70 ? 'bg-green-50' : pct >= 40 ? 'bg-neo-secondary/10' : 'bg-neo-accent/5'}`}>
                  <div className="font-black italic text-lg uppercase mb-2">{t}</div>
                  <div className="flex justify-between items-end">
                    <div className="text-sm font-bold">{s.correct} / {s.total} CORRECT</div>
                    <div className="text-3xl font-black tracking-tighter">{pct}%</div>
                  </div>
                  <div className="neo-border h-3 bg-white mt-3 overflow-hidden">
                    <div className={`h-full ${pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-neo-secondary' : 'bg-neo-accent'}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="space-y-8">
        <h3 className="text-2xl">Question Review</h3>
        <div className="grid grid-cols-1 gap-6">
          {questions.map((q, idx) => {
            const sel = answers[q.id];
            const ai = q.answer_index ?? null;
            const options: string[] = Array.isArray(q.options) && q.options.length === 4 ? q.options : ['A', 'B', 'C', 'D'];
            const status = sel == null || ai == null ? 'skipped' : (sel === ai ? 'correct' : 'incorrect');

            return (
              <div key={q.id} className={`neo-card ${status === 'correct' ? 'border-green-500 bg-green-50' : status === 'incorrect' ? 'border-neo-accent bg-neo-accent/5' : 'bg-neo-bg'}`}>
                <div className="flex justify-between items-start mb-4">
                  <div className="sticker bg-black text-black text-[10px]">Q{idx + 1} • {status.toUpperCase()}</div>
                  {q.topic && <div className="text-[10px] font-black uppercase text-black/40">{q.topic}</div>}
                </div>

                {q.passage && (
                  <div className="bg-black/5 p-4 neo-border border-dashed mb-4 text-sm font-medium italic">
                    {q.passage}
                  </div>
                )}

                <div className="text-xl font-bold font-mono italic mb-6">{q.question}</div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {options.map((opt, i) => {
                    const isSelected = sel === i;
                    const isCorrect = ai === i;
                    return (
                      <div
                        key={i}
                        className={`p-3 neo-border text-sm font-bold flex items-center gap-3 ${isCorrect ? 'bg-green-500 text-black' :
                          isSelected ? 'bg-neo-accent text-black' : 'bg-white/50'
                          }`}
                      >
                        <div className={`w-6 h-6 rounded-full border-2 border-black flex items-center justify-center text-[10px] ${isCorrect || isSelected ? 'bg-black text-black' : 'bg-white'}`}>
                          {String.fromCharCode(65 + i)}
                        </div>
                        {opt}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Navigation Buttons for Sectioned Mode */}
      {sectionsConfig && (
        <div className="flex flex-col md:flex-row gap-4 pt-8 border-t-8 border-black">
          {sectionIdx < sectionsConfig.length - 1 ? (
            <button
              className="neo-button flex-1 text-2xl h-20"
              onClick={async () => {
                await completeCurrentSection();
                setSubmitted(false);
              }}
            >
              PROCEED TO NEXT SECTION
            </button>
          ) : (
            <button
              className="neo-button flex-1 text-2xl h-20"
              onClick={() => {
                // Return to home or reset
                setAttemptId(null);
                setStartedAt(null);
                setSubmitted(false);
                setQuestions([]);
              }}
            >
              RETURN TO DASHBOARD
            </button>
          )}

          <button
            className="neo-button-white px-8"
            onClick={() => {
              // Toggle detailed review view or just scroll up
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          >
            TOP
          </button>
        </div>
      )}
    </div>
  ) : null;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-12">
      {/* Header Section */}
      <div className="relative inline-block">
        <div className="sticker rotate-sticker-1 bg-neo-secondary mb-4 text-xs md:text-sm">Official Pattern</div>
        <h1 className="text-4xl md:text-7xl lg:text-8xl font-black italic tracking-tighter">
          CUET <span className="text-stroke-neo">SIMULATOR</span>
        </h1>
        <div className="sticker rotate-sticker-2 bg-neo-accent text-black absolute -bottom-2 -right-2 md:-bottom-4 md:-right-4 text-[10px] md:text-xs">
          UG 2025 EDITION
        </div>
      </div>

      {/* Intro Stats Bar */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="bg-black text-black px-4 py-2 font-black uppercase text-sm flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          RAG-Injected Engine
        </div>
        <div className="bg-neo-muted px-4 py-2 font-black uppercase text-sm border-2 border-black">
          NCERT Level: Class 12
        </div>
      </div>

      {/* Main Config Area */}
      {!startedAt && !submitted && (
        <div className="neo-card space-y-8">
          <div className={`grid grid-cols-1 ${!attemptId ? 'lg:grid-cols-2' : ''} gap-12`}>
            {!attemptId && (
              <div>
                <h3 className="text-2xl mb-6">Select Subjects (3–6)</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-4 neo-border p-4 bg-white">
                  {CUET_DOMAINS.map(d => {
                    const checked = selectedDomains.includes(d);
                    const disableAdd = !checked && selectedDomains.length >= MAX_SUBJECTS;
                    return (
                      <label
                        key={d}
                        className={`flex items-center gap-3 p-3 neo-border transition-colors cursor-pointer ${checked ? 'bg-neo-secondary' : 'bg-neo-bg hover:bg-neo-secondary/20'
                          } ${disableAdd ? 'opacity-40 cursor-not-allowed' : ''}`}
                      >
                        <input
                          type="checkbox"
                          className="w-5 h-5 accent-black border-2 border-black"
                          checked={checked}
                          disabled={disableAdd}
                          onChange={(e) => {
                            setSelectedDomains(prev => e.target.checked ? Array.from(new Set([...prev, d])) : prev.filter(x => x !== d));
                          }}
                        />
                        <span className="font-bold text-sm tracking-tight">{d}</span>
                      </label>
                    );
                  })}
                </div>
                <div className="mt-4 p-4 bg-black text-white text-xs font-mono uppercase tracking-widest leading-relaxed">
                  Selected: {selectedDomains.length} • Questions: {selectedDomains.length * QUESTIONS_PER_SUBJECT} • Time: {SECTION_TIME_MIN}m / Subject
                </div>
              </div>
            )}

            <div className="space-y-8">
              <div className="sticker rotate-sticker-3 bg-neo-secondary w-full text-center py-4 text-xl">
                Ready to begin?
              </div>

              <div className="space-y-4">
                {!attemptId && (
                  <button
                    className="neo-button w-full text-2xl h-20"
                    disabled={loading}
                    onClick={startExam}
                  >
                    {loading ? 'GENERATING BLUEPRINT...' : 'LAUNCH SIMULATOR'}
                  </button>
                )}

                {!attemptId && resumableAttempt && (
                  <button
                    className="neo-button-secondary w-full py-4"
                    disabled={loading}
                    onClick={resumeExam}
                  >
                    CONTINUE PREVIOUS ATTEMPT
                  </button>
                )}
              </div>

              {error && (
                <div className="bg-neo-accent text-black p-4 neo-border font-black text-center animate-bounce">
                  ERROR: {error}
                </div>
              )}

              {attemptId && sectionsConfig && (
                <div className="neo-card bg-black text-black border-0 shadow-neo">
                  <h4 className="text-black mb-4">ACTIVE SECTIONS</h4>
                  <div className="flex flex-col gap-2">
                    {sectionsConfig.map((s, i) => (
                      <div
                        key={s.subject}
                        className={`p-3 border-2 flex justify-between items-center ${i === sectionIdx ? 'border-neo-secondary bg-neo-secondary/10' : 'border-white/20'
                          }`}
                      >
                        <span className="font-bold">{i + 1}. {s.subject}</span>
                        <span className={`text-[10px] px-2 py-1 uppercase rounded ${s.status === 'completed' ? 'bg-green-500 text-black' :
                          s.status === 'in_progress' ? 'bg-neo-secondary text-black' : 'bg-white/10'
                          }`}>
                          {s.status}
                        </span>
                      </div>
                    ))}
                  </div>
                  {questions.length === 0 && (
                    <button
                      className="neo-button w-full mt-6 bg-neo-secondary border-white text-black"
                      onClick={startCurrentSection}
                      disabled={loading}
                    >
                      {loading ? 'PREPARING SECTION...' : `START SECTION ${sectionIdx + 1}`}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Active Exam UI */}
      {questions.length > 0 && !submitted && (
        <div className="space-y-8">
          {/* Dashboard Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="space-y-1">
              <h2 className="text-2xl md:text-4xl text-stroke-neo">{sectionsConfig?.[sectionIdx]?.subject}</h2>
              <div className="text-sm font-black uppercase tracking-widest text-black/60">
                Attempting {answeredCount} / {questions.length}
              </div>
            </div>

            <div className="neo-card bg-black text-black p-3 md:p-4 py-2 flex items-center gap-3 md:gap-4 w-full md:w-auto justify-between md:justify-start">
              <div className="text-[10px] md:text-xs uppercase font-black text-neo-secondary">Time Remaining</div>
              <div className="text-3xl md:text-4xl font-mono font-black italic">
                {Math.floor(remainingSec / 60)}:{String(remainingSec % 60).padStart(2, '0')}
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="neo-border h-6 bg-white overflow-hidden relative">
            <div
              className="h-full bg-neo-accent transition-all duration-500"
              style={{ width: `${questions.length ? Math.round((answeredCount / questions.length) * 100) : 0}%` }}
            />
            <div className="absolute inset-0 flex items-center justify-center text-[10px] font-black uppercase tracking-[0.2em] mix-blend-difference text-black">
              Progress
            </div>
          </div>

          {/* Question Palate & Main Body */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            <div className="lg:col-span-3 neo-card min-h-[500px] flex flex-col justify-between">
              <div>
                {renderQuestion(questions[currentIdx])}
              </div>

              <div className="flex gap-4 mt-12 pt-8 border-t-4 border-dashed border-black">
                <button className="neo-button-white flex-1" onClick={() => setCurrentIdx(Math.max(0, currentIdx - 1))}>
                  PREVIOUS
                </button>
                <button className="neo-button-secondary flex-1" onClick={() => setCurrentIdx(Math.min(questions.length - 1, currentIdx + 1))}>
                  NEXT
                </button>
                <button
                  className="neo-button"
                  onClick={() => {
                    const msg = 'FINALIZE THIS SECTION? YOU CANNOT CHANGE ANSWERS LATER.';
                    if (window.confirm(msg)) setSubmitted(true);
                  }}
                >
                  SUBMIT
                </button>
              </div>
            </div>

            <div className="space-y-6">
              <div className="neo-card bg-neo-bg">
                <h4 className="text-sm mb-4">NAVIGATE</h4>
                <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                  {questions.map((_, i) => (
                    <button
                      key={i}
                      className={`w-full aspect-square text-xs font-black neo-border transition-all hover:-translate-y-1 active:translate-y-0 ${i === currentIdx ? 'bg-black text-black translate-x-1 translate-y-1 shadow-none' :
                        flags[questions[i].id] ? 'bg-neo-secondary' :
                          answers[questions[i].id] != null ? 'bg-neo-muted' : 'bg-white'
                        }`}
                      onClick={() => setCurrentIdx(i)}
                    >
                      {i + 1}
                      {flags[questions[i].id] && <div className="absolute -top-1 -right-1 w-2 h-2 bg-neo-secondary border border-black rounded-full" />}
                    </button>
                  ))}
                </div>
              </div>

              <button className="neo-button-secondary w-full py-4 text-xs" onClick={completeCurrentSection}>
                QUIT SECTION EARLY
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
