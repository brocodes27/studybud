import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export interface CognitiveProfile {
  kc_id: string;
  p_mastery: number;
  cognitive_tier: 'anoetic' | 'noetic' | 'autonoetic';
  interaction_count: number;
  last_interaction_at: string | null;
  last_correct: boolean | null;
}

export interface LearningVelocity {
  id: string;
  user_id: string;
  kc_id: string | null;
  subject: string | null;
  velocity_tier: 'stalled' | 'struggling' | 'building' | 'momentum' | 'unknown';
  velocity_per_day: number;
  mastery_delta: number;
  days_active: number;
}

export interface PipelineRun {
  id: string;
  function_name: string;
  status: 'running' | 'completed' | 'failed' | 'completed_with_errors';
  started_at: string;
  completed_at: string | null;
  records_processed: number | null;
  errors: string | null;
}

export interface AgentCorrectionInsight {
  id: string;
  agent_responsible: string;
  root_cause_category: string;
  frequency: number;
  affected_sessions: number;
  suggested_template_delta: string | null;
  confidence: number;
}

export interface IRTCalibrationInfo {
  question_id: string;
  irt_difficulty: number;
  irt_discrimination: number;
  calibrated_at: string;
  sample_size: number;
}

export interface BKTParamInfo {
  kc_id: string;
  p_guess: number;
  p_slip: number;
  p_transit: number;
  sample_size: number;
}

export interface ScoreModelInfo {
  model_version: number;
  training_sample_size: number;
  accuracy: number | null;
  trained_at: string;
  coefficient_count: number;
}

export interface MLIntelligence {
  cognitiveProfiles: CognitiveProfile[];
  learningVelocity: LearningVelocity[];
  pipelineRuns: PipelineRun[];
  agentInsights: AgentCorrectionInsight[];
  bktParams: BKTParamInfo[];
  irtCalibrations: IRTCalibrationInfo[];
  scoreModel: ScoreModelInfo | null;
  isLoading: boolean;
  error: string | null;
  avgMastery: number;
  dominantTier: string;
  velocityTier: string;
  pipelineHealth: Record<string, 'healthy' | 'stale' | 'never_run'>;
}

export function useMLIntelligence(userId?: string) {
  const { user } = useAuth();
  const uid = userId || user?.id;

  // Default pipeline health to avoid undefined access before data loads
  const defaultPipelineHealth: Record<string, 'healthy' | 'stale' | 'never_run'> = {
    'irt-calibrate': 'never_run',
    'bkt-tune': 'never_run',
    'agent-analyze-corrections': 'never_run',
    'train-score-model': 'never_run',
  };

  const defaultData: MLIntelligence = {
    cognitiveProfiles: [],
    learningVelocity: [],
    pipelineRuns: [],
    agentInsights: [],
    bktParams: [],
    irtCalibrations: [],
    scoreModel: null,
    isLoading: true,
    error: null,
    avgMastery: 0,
    dominantTier: 'anoetic',
    velocityTier: 'unknown',
    pipelineHealth: defaultPipelineHealth,
  };

  const [data, setData] = useState<MLIntelligence>(defaultData);
  const [loading, setLoading] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!uid) return;
    setLoading(true);

    try {
      const [cogProfiles, velocity, pipelineRuns, agentInsights, bktParams, irtCalibrations, scoreModel] =
        await Promise.all([
          supabase.from('student_cognitive_profiles').select('*').eq('user_id', uid),
          supabase.from('student_learning_velocity').select('*').eq('user_id', uid).limit(10),
          supabase.from('ml_pipeline_runs').select('*').order('started_at', { ascending: false }).limit(10),
          supabase.from('agent_correction_analysis').select('*').order('analyzed_at', { ascending: false }).limit(20),
          supabase.from('bkt_kc_parameters').select('*').limit(100),
          supabase.from('irt_item_parameters_history').select('*').order('calibrated_at', { ascending: false }).limit(100),
          supabase.from('score_model_coefficients').select('model_version, training_sample_size, accuracy, trained_at').order('model_version', { ascending: false }).limit(1).single(),
        ]);

      const cogData = cogProfiles.data ?? [];
      const velData = velocity.data ?? [];
      const pipelineData = pipelineRuns.data ?? [];
      const insightData = agentInsights.data ?? [];
      const bktData = bktParams.data ?? [];
      const irtData = irtCalibrations.data ?? [];

      const avgMastery = cogData.length > 0
        ? cogData.reduce((s, p) => s + (p.p_mastery ?? 0), 0) / cogData.length
        : 0;

      const tierCounts = { anoetic: 0, noetic: 0, autonoetic: 0 };
      cogData.forEach(p => {
        const t = (p.cognitive_tier as keyof typeof tierCounts) ?? 'anoetic';
        if (t in tierCounts) tierCounts[t]++;
      });
      const dominantTier = Object.entries(tierCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'anoetic';

      const velocityTier = velData.length > 0
        ? (velData[0]?.velocity_tier ?? 'unknown')
        : 'unknown';

      // Pipeline health from last run per function
      const pipelineHealth: Record<string, 'healthy' | 'stale' | 'never_run'> = {};
      const pipelineTypes = ['irt-calibrate', 'bkt-tune', 'agent-analyze-corrections', 'train-score-model'];
      for (const pt of pipelineTypes) {
        const lastRun = pipelineData.find(r => r.function_name === pt);
        if (!lastRun) {
          pipelineHealth[pt] = 'never_run';
        } else if (lastRun.status === 'completed') {
          const hoursSince = (Date.now() - new Date(lastRun.completed_at ?? lastRun.started_at).getTime()) / 3600000;
          pipelineHealth[pt] = hoursSince < 168 ? 'healthy' : 'stale'; // healthy if < 1 week
        } else {
          pipelineHealth[pt] = 'stale';
        }
      }

      setData({
        cognitiveProfiles: cogData as CognitiveProfile[],
        learningVelocity: velData as LearningVelocity[],
        pipelineRuns: pipelineData as PipelineRun[],
        agentInsights: insightData as AgentCorrectionInsight[],
        bktParams: bktData as BKTParamInfo[],
        irtCalibrations: irtData as IRTCalibrationInfo[],
        scoreModel: scoreModel.data as ScoreModelInfo | null,
        isLoading: false,
        error: null,
        avgMastery,
        dominantTier,
        velocityTier,
        pipelineHealth,
      });
    } catch (err: any) {
      setData({
        cognitiveProfiles: [],
        learningVelocity: [],
        pipelineRuns: [],
        agentInsights: [],
        bktParams: [],
        irtCalibrations: [],
        scoreModel: null,
        isLoading: false,
        error: err.message,
        avgMastery: 0,
        dominantTier: 'anoetic',
        velocityTier: 'unknown',
        pipelineHealth: {},
      });
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    if (uid) {
      fetchAll();
    }
  }, [uid, fetchAll]);

  return { ...data, isLoading: loading, refetch: fetchAll };
}

// Standalone fetcher for non-React contexts
export async function fetchPipelineHealth() {
  const { data } = await supabase
    .from('ml_pipeline_runs')
    .select('function_name, status, completed_at, records_processed')
    .order('started_at', { ascending: false })
    .limit(20);
  return data ?? [];
}
