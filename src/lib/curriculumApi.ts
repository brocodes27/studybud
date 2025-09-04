import { supabase } from './supabase';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

async function getAuthHeader() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Not authenticated');
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } as const;
}

export type GenerateMonthlyCurriculumPayload = {
  aim?: 'cbse' | 'jee';
  class_level?: string;
  subjects?: string[];
  month?: string; // YYYY-MM
  curriculum_id?: string;
};

export async function generateMonthlyCurriculum(payload: GenerateMonthlyCurriculumPayload) {
  const headers = await getAuthHeader();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/generate-monthly-curriculum`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(text || 'Failed to generate monthly curriculum');
  try { return JSON.parse(text); } catch { return text; }
}

export type RescheduleWeekPayload = {
  curriculum_id?: string;
  week_start?: string; // YYYY-MM-DD (Monday)
  include_sources?: Array<'monthly' | 'manual'>;
  constraints?: string;
};

export async function rescheduleWeek(payload: RescheduleWeekPayload) {
  const headers = await getAuthHeader();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/reschedule-week`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(text || 'Failed to reschedule week');
  try { return JSON.parse(text); } catch { return text; }
}

export type ApplyExamPayload = {
  class: string;
  subject: string;
  chapters: string;
  exam_date: string; // YYYY-MM-DD
  curriculum_id?: string;
  aim?: 'cbse' | 'jee';
  update_mode?: 'mark' | 'reschedule';
};

export async function applyExamToCurriculum(payload: ApplyExamPayload) {
  const headers = await getAuthHeader();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/apply-exam-to-curriculum`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(text || 'Failed to apply exam to curriculum');
  try { return JSON.parse(text); } catch { return text; }
}
