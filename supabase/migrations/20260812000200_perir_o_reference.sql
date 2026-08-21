-- Reference stage support (PRD v2 §4.3, roadmap P2.1).
--
-- The flashcards table predates the stage engine and keys cards only by a topic
-- string. The Reference gate counts cards for a specific syllabus topic, and
-- Retrieval draws items from the same place, so cards need to point at the
-- topic and the knowledge component rather than at a name that may repeat
-- across two of the student's courses.

alter table public.flashcards
  add column if not exists topic_id uuid references public.curve_course_topics(id) on delete set null,
  add column if not exists kc_id uuid references public.knowledge_components(id) on delete set null,
  -- Where the card came from. Cards produced by the Reference stage are the
  -- only ones its gate counts; a deck imported or generated elsewhere is not
  -- evidence that this student processed this topic.
  add column if not exists source text;

create index if not exists flashcards_topic_idx
  on public.flashcards (user_id, topic_id)
  where topic_id is not null;
