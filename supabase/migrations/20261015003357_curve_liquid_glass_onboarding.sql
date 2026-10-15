-- Reuse the existing owner-only RLS policies; old profiles remain valid.
alter table public.curve_study_preferences
  add column onboarding_answers jsonb not null default '{}'::jsonb
  constraint curve_onboarding_answers_bounded check (
    jsonb_typeof(onboarding_answers) = 'object'
    and octet_length(onboarding_answers::text) <= 10000
  );
