import type { ResearchArtifact } from '../../../supabase/functions/_shared/learning-workflows';
import type { WorkspaceState } from './contracts';

export function unreadResearch(state: WorkspaceState): ResearchArtifact[] {
  const excluded = new Set([...(state.closedArtifactIds || []), ...(state.reviewedArtifactIds || [])]);
  return state.artifacts.filter((artifact): artifact is ResearchArtifact =>
    artifact.kind === 'research' && !!artifact.text.trim() && !excluded.has(artifact.id)
  ).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function canPresentResearch(state: WorkspaceState): boolean {
  const active = state.artifacts.find(artifact => artifact.id === state.activeId);
  return !state.checkpointId && active?.kind !== 'session' && active?.kind !== 'assessment';
}
