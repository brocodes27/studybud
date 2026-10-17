/** An unlabelled source needs explicit review before it belongs to a semester. */
export function sameSemester(source: string | null | undefined, current: string): boolean {
  const normalize = (value: string) => value.trim().toLowerCase().replace(/^sem(?:ester)?\.?\s*/, '');
  return !!source && normalize(source) === normalize(current);
}

export interface SemesterScope {
  semester?: string;
  courses: { course: string; taughtTopics: string[] }[];
}

export function scopeLibrary<T extends { metadata: { semester?: string | null; course?: string; topics?: string[]; confirmed_topics?: string[] } }>(materials: T[], plan?: SemesterScope | null): T[] {
  if (!plan?.semester) return materials;
  return materials.filter(m => sameSemester(m.metadata.semester, plan.semester!)).map(m => {
    const course = plan.courses.find(c => c.course.trim().toLowerCase() === m.metadata.course?.trim().toLowerCase());
    const topics = (m.metadata.topics || []).filter(topic => course?.taughtTopics.includes(topic));
    return { ...m, metadata: { ...m.metadata, topics, confirmed_topics: (m.metadata.confirmed_topics || []).filter(t => topics.includes(t)) } };
  }).filter(m => m.metadata.topics.length > 0);
}
