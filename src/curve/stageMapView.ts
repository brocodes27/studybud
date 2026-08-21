/**
 * Pure view logic for the stage map (PRD v2 §7.2).
 *
 * Split out of `StageMap.tsx` for the same reason as the encoding rubric: this
 * decides what a student sees about their own progress, and anything that
 * shapes that should be testable without a browser or a database.
 */

import { daysBetween, stageRank } from '../lib/perirO';
import type { PlannerTopic } from '../lib/studyPlanner';

export type MapFilter = 'week' | 'all' | 'attention';

/** Days either side of today that count as "this week". */
export const WEEK_WINDOW = 7;

/**
 * Unscheduled topics always pass the week filter. With no lecture date there is
 * no week they belong to, and hiding them would make them invisible forever —
 * a topic the student can never find is worse than one shown out of order.
 */
export function matchesFilter(topic: PlannerTopic, filter: MapFilter, today: string): boolean {
  switch (filter) {
    case 'attention':
      return (
        topic.stage.remedial ||
        (topic.stage.nextRetrievalOn !== null &&
          daysBetween(topic.stage.nextRetrievalOn, today) >= 0)
      );
    case 'week': {
      if (!topic.lectureOn) return true;
      const offset = daysBetween(today, topic.lectureOn);
      return offset >= -WEEK_WINDOW && offset <= WEEK_WINDOW;
    }
    default:
      return true;
  }
}

/** Subjects in stable alphabetical order; topics keep their syllabus order. */
export function groupBySubject(topics: PlannerTopic[]): Array<[string, PlannerTopic[]]> {
  const groups = new Map<string, PlannerTopic[]>();
  for (const topic of topics) {
    const existing = groups.get(topic.subject);
    if (existing) existing.push(topic);
    else groups.set(topic.subject, [topic]);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
}

export interface StageTotals {
  started: number;
  tested: number;
  mixed: number;
}

/**
 * The headline counts. Deliberately three, and deliberately these three: the
 * honest questions are how much has been touched at all, how much has survived
 * a closed-book test, and how much holds up when mixed with everything else.
 */
export function countByStage(topics: PlannerTopic[]): StageTotals {
  return {
    started: topics.filter((topic) => topic.stage.stage !== 'new').length,
    tested: topics.filter((topic) => stageRank(topic.stage.stage) >= stageRank('retrieved')).length,
    mixed: topics.filter((topic) => stageRank(topic.stage.stage) >= stageRank('interleaved')).length,
  };
}
