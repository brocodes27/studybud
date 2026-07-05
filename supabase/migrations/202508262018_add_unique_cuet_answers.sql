-- Ensure unique per (attempt_id, question_id) for upsert support
alter table public.cuet_attempt_answers
  add constraint cuet_attempt_answers_attempt_question_unique unique (attempt_id, question_id);
-- Helpful index for query patterns
create index if not exists cuet_attempts_started_at_idx on public.cuet_attempts(started_at);
