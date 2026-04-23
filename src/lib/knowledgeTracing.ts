import { supabase } from './supabase';

interface MasteryUpdateResult {
  previous_mastery: number;
  new_mastery: number;
  mastery_delta: number;
  cognitive_tier: string;
  is_correct: boolean;
}

interface AdaptiveTestResponse {
  questions: any[];
  theta_estimate: number;
  avg_mastery: number;
  mechanism: string;
}

export class KnowledgeTracingService {
  /**
   * Log an interaction to the Bayesian Knowledge Tracing engine.
   * This updates the student's mastery probabilities in real-time.
   */
  static async logInteraction(
    kcId: string, 
    isCorrect: boolean, 
    responseTimeMs: number, 
    source: string,
    metadata?: Record<string, any>,
    difficultyPresented?: number,
    emotionalStateDetected?: string
  ): Promise<MasteryUpdateResult | null> {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) return null;

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/knowledge-trace`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.session.access_token}`
        },
        body: JSON.stringify({
          kc_id: kcId,
          is_correct: isCorrect,
          response_time_ms: responseTimeMs,
          source: source,
          metadata: metadata || {},
          difficulty_presented: difficultyPresented,
          emotional_state_detected: emotionalStateDetected
        })
      });

      if (!response.ok) {
        console.error('Knowledge Tracing Error:', await response.text());
        return null;
      }

      return await response.json();
    } catch (e) {
      console.error('Failed to log interaction to BKT engine', e);
      return null;
    }
  }

  /**
   * Fetch adaptively selected questions using Item Response Theory (IRT)
   * The questions will match the student's current mastery level (Theta).
   */
  static async getAdaptiveQuestions(
    subject: string,
    topic?: string,
    count: number = 10,
    kcIds?: string[]
  ): Promise<AdaptiveTestResponse | null> {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) return null;

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/adaptive-difficulty`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.session.access_token}`
        },
        body: JSON.stringify({
          subject,
          topic,
          kc_ids: kcIds,
          count,
          source: 'practice_test'
        })
      });

      if (!response.ok) {
        console.error('Adaptive Difficulty Error:', await response.text());
        return null;
      }

      return await response.json();
    } catch (e) {
      console.error('Failed to fetch adaptive questions', e);
      return null;
    }
  }

  /**
   * Returns a student's mastery vector for a given subject.
   */
  static async getSubjectMastery(subject: string) {
    try {
      // Get all KCs for subject
      const { data: kcs } = await supabase
        .from('knowledge_components')
        .select('id, topic, subtopic')
        .eq('subject', subject);

      if (!kcs || kcs.length === 0) return [];

      const kcIds = kcs.map(kc => kc.id);

      // Get mastery for these KCs
      const { data: profiles } = await supabase
        .from('student_cognitive_profiles')
        .select('kc_id, p_mastery, cognitive_tier')
        .in('kc_id', kcIds);

      // Merge
      return kcs.map(kc => {
        const profile = profiles?.find(p => p.kc_id === kc.id);
        return {
          ...kc,
          mastery: profile?.p_mastery || 0.1,
          tier: profile?.cognitive_tier || 'anoetic'
        };
      });
    } catch (e) {
      console.error('Failed to get mastery', e);
      return [];
    }
  }
}
