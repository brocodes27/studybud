import { useEffect, useRef, useState } from 'react';
import type { AssessmentArtifact, TopicTarget } from '../../../supabase/functions/_shared/learning-workflows';

interface AssessmentDraft {
  targets: TopicTarget[];
  minutes: number;
  confidence: string;
  examDate: string;
  report: string;
  score: string;
  total: string;
}
export type AssessmentDraftCache = Map<string, { saved: string; draft: AssessmentDraft }>;

function initialDraft(saved: string): AssessmentDraft {
  const input = JSON.parse(saved);
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate()+1);
  return {
    targets: input.targets,
    minutes: input.minutes ?? 60,
    confidence: input.confidence ?? 'unsure',
    examDate: input.examDate || `${tomorrow.getFullYear()}-${String(tomorrow.getMonth()+1).padStart(2,'0')}-${String(tomorrow.getDate()).padStart(2,'0')}`,
    report: input.report ?? '', score: String(input.score ?? ''), total: String(input.total ?? ''),
  };
}

function mergeSavedDraft(previous: string, saved: string, draft: AssessmentDraft): AssessmentDraft {
  if (previous === saved) return draft;
  const before = JSON.parse(previous), after = JSON.parse(saved), defaults = initialDraft(saved);
  const next = {...draft};
  for (const field of Object.keys(defaults) as (keyof AssessmentDraft)[]) {
    if (JSON.stringify(before[field]) !== JSON.stringify(after[field])) Object.assign(next,{[field]:defaults[field]});
  }
  return next;
}

export function useAssessmentDraft(artifact: AssessmentArtifact, drafts?: AssessmentDraftCache) {
  // Snapshot object identity changes on focus/polling; only changed saved fields replace a draft.
  const saved = JSON.stringify({targets:artifact.targets,minutes:artifact.minutes,confidence:artifact.confidence,examDate:artifact.examDate,report:artifact.report,score:artifact.score,total:artifact.total});
  const previous = useRef(saved);
  const [draft,setDraft] = useState(() => {
    const cached = drafts?.get(artifact.id);
    return cached ? mergeSavedDraft(cached.saved,saved,cached.draft) : initialDraft(saved);
  });
  useEffect(() => {
    const before = previous.current;
    previous.current = saved;
    setDraft(current => {
      const next = mergeSavedDraft(before,saved,current);
      drafts?.set(artifact.id,{saved,draft:next});
      return next;
    });
  },[saved,artifact.id,drafts]);
  function setField<K extends keyof AssessmentDraft>(field: K, value: AssessmentDraft[K]) {
    setDraft(current => {
      const next = {...current,[field]:value};
      drafts?.set(artifact.id,{saved:previous.current,draft:next});
      return next;
    });
  }
  return {draft,setField};
}
