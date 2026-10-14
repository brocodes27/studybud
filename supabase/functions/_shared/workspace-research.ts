import { researchViaA2A } from './a2a-research.ts';
import { researchTopic } from './research-topic.ts';
import { type ResearchArtifact } from './learning-workflows.ts';
import type { Access } from './workspace.ts';

export async function researchSnapshot(a: Access) {
  const [settings, jobs] = await Promise.all([
    a.sb.from('curve_workspace_threads').select('research_enabled').eq('user_id', a.user.id).single(),
    a.sb.from('curve_workspace_research').select('id,status,artifacts,error,updated_at').eq('user_id', a.user.id).order('updated_at', {ascending: false}).limit(7),
  ]);
  if (settings.error || jobs.error) throw new Error('Daily research could not load. Please retry.');
  const latest = jobs.data?.[0];
  return {
    status: { enabled: settings.data.research_enabled, status: latest?.status || 'pending', error: latest?.error || undefined, completedAt: latest?.status === 'ready' ? latest.updated_at : undefined },
    artifacts: (jobs.data || []).filter(j => j.status === 'ready').flatMap(j => j.artifacts) as ResearchArtifact[],
  };
}

/** Search queries contain only course/topic names, never exam reports or chat. */
export async function buildDailyResearch(db: Access['admin'], userId: string, jobId: string): Promise<ResearchArtifact[]> {
  const [materials, sessions] = await Promise.all([
    db.from('materials').select('id,title,metadata').eq('owner_user_id', userId).contains('metadata', {workspace:'curve', confirmed:true}).limit(50),
    db.from('curve_material_sessions').select('material_id,topic,results').eq('user_id', userId).eq('mode','checkpoint').not('completed_at', 'is', null).order('completed_at', {ascending:false}).limit(50),
  ]);
  if (materials.error || sessions.error) throw new Error('Your learning context is temporarily unavailable.');
  const targets = (materials.data || []).flatMap(m => (m.metadata.topics || []).map((topic: string) => {
    const recent = sessions.data?.find(s => s.material_id === m.id && s.topic === topic);
    const results = (recent?.results || []).filter((r: {assisted?:boolean}) => !r.assisted);
    return {material: m, topic, accuracy: results.length ? results.filter((r: {correct:boolean}) => r.correct).length / results.length : -1};
  })).sort((a,b) => a.accuracy - b.accuracy).slice(0,3);
  if (!targets.length) throw new Error('Add and confirm course material to start daily research.');
  const key = Deno.env.get('TAVILY_API_KEY');
  const cardUrl = Deno.env.get('A2A_RESEARCH_CARD_URL');
  if (!key && !cardUrl) throw new Error('Daily web research is not configured yet. Your saved notes are available.');
  return await Promise.all(targets.map(async ({material, topic}, i) => {
    if (cardUrl) {
      try {
        const brief = await researchViaA2A({cardUrl,token:Deno.env.get('A2A_RESEARCH_TOKEN')}, {course:String(material.metadata.course || ''),topic});
        return {id:`research:${jobId}:${i}`,kind:'research' as const,title:topic,topic,materialId:material.id,...brief,createdAt:new Date().toISOString()};
      } catch {
        console.warn('A2A research unavailable; using built-in research when configured.');
        if (!key) throw new Error('The research agent is temporarily unavailable.');
      }
    }
    const brief = await researchTopic(String(material.metadata.course || ''),topic);
    return {id:`research:${jobId}:${i}`,kind:'research',title:topic,topic,materialId:material.id,...brief,createdAt:new Date().toISOString()};
  }));
}
