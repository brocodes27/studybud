import { Cpu, CheckCircle2, AlertCircle, XCircle, Zap, TrendingUp, Brain, Activity } from 'lucide-react';
import { useMLIntelligence } from '../hooks/useMLIntelligence';

const PIPELINE_DEFS = [
  {
    key: 'irt-calibrate',
    label: 'IRT Calibration',
    desc: 'Question difficulty calibrated from student responses',
    icon: Activity,
    color: '#00D1FF',
  },
  {
    key: 'bkt-tune',
    label: 'BKT Tuning',
    desc: 'Mastery parameters tuned from cohort data',
    icon: Brain,
    color: '#F472B6',
  },
  {
    key: 'agent-analyze-corrections',
    label: 'Agent Corrections',
    desc: 'AI study buddy self-improves from feedback',
    icon: Zap,
    color: '#34D399',
  },
  {
    key: 'train-score-model',
    label: 'Score Model',
    desc: 'Regression model trained on labeled test attempts',
    icon: TrendingUp,
    color: '#A294F9',
  },
];

export function MLPipelineHealth() {
  const ml = useMLIntelligence();

  return (
    <div className="bg-slate-800 border border-white/10 p-6 shadow-neo">
      <h3 className="text-xl font-black text-slate-100 mb-6 flex items-center gap-2 uppercase italic">
        <Cpu className="h-6 w-6 text-[#34D399]" />
        Adaptive Intelligence Pipeline
        <span className="ml-2 text-xs font-black uppercase text-slate-100/40 tracking-widest">(Teacher View)</span>
      </h3>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {PIPELINE_DEFS.map((def) => {
          const health = ml.pipelineHealth[def.key] ?? 'never_run';
          const Icon = def.icon;
          const lastRun = ml.pipelineRuns.find(r => r.function_name === def.key);
          const count =
            def.key === 'irt-calibrate' ? ml.irtCalibrations.length :
            def.key === 'bkt-tune' ? ml.bktParams.length :
            def.key === 'agent-analyze-corrections' ? ml.agentInsights.length :
            ml.scoreModel?.model_version ?? 0;

          return (
            <div
              key={def.key}
              className="p-4 border border-white/10 bg-slate-900 relative overflow-hidden"
            >
              {/* Status glow */}
              {health === 'healthy' && (
                <div className="absolute inset-0 bg-[#34D399]/5" />
              )}
              {health === 'stale' && (
                <div className="absolute inset-0 bg-amber-500/5" />
              )}

              <div className="relative z-10">
                <div className="flex items-center justify-between mb-3">
                  <Icon className="w-5 h-5" style={{ color: def.color }} />
                  {health === 'healthy' && <CheckCircle2 className="w-4 h-4 text-[#34D399]" />}
                  {health === 'stale' && <AlertCircle className="w-4 h-4 text-amber-400" />}
                  {health === 'never_run' && <XCircle className="w-4 h-4 text-slate-100/20" />}
                </div>

                <p className="text-xs font-black uppercase tracking-widest text-slate-100/60 mb-1">{def.label}</p>
                <p className="text-3xl font-black italic" style={{ color: def.color }}>
                  {typeof count === 'number' ? count : '—'}
                </p>

                {lastRun?.completed_at && (
                  <p className="text-[10px] text-slate-100/30 mt-1">
                    Last: {new Date(lastRun.completed_at).toLocaleDateString()}
                  </p>
                )}

                <p className="text-[10px] text-slate-100/40 mt-2 leading-tight">{def.desc}</p>

                <div className="mt-3 flex items-center gap-1">
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                    health === 'healthy' ? 'bg-[#34D399]/20 text-[#34D399]' :
                    health === 'stale' ? 'bg-amber-500/20 text-amber-400' :
                    'bg-slate-700 text-slate-100/30'
                  }`}>
                    {health === 'healthy' ? 'Active' : health === 'stale' ? 'Stale' : 'Pending'}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Recent runs */}
      {ml.pipelineRuns.length > 0 && (
        <div className="mt-6">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-100/40 mb-3">Recent Pipeline Runs</p>
          <div className="space-y-2">
            {ml.pipelineRuns.slice(0, 6).map((run) => (
              <div key={run.id} className="flex items-center justify-between text-xs bg-slate-900 border border-white/5 px-3 py-2">
                <span className="font-black uppercase text-slate-100/60">{run.function_name}</span>
                <div className="flex items-center gap-2">
                  <span className={`font-black ${
                    run.status === 'completed' ? 'text-[#34D399]' :
                    run.status === 'failed' ? 'text-red-400' :
                    'text-amber-400'
                  }`}>
                    {run.status.replace('_', ' ')}
                  </span>
                  {run.completed_at && (
                    <span className="text-slate-100/30">{new Date(run.completed_at).toLocaleDateString()}</span>
                  )}
                  {run.records_processed != null && (
                    <span className="text-slate-100/30">{run.records_processed} records</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
