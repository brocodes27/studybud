import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { ensureBehavioralProfile } from '../lib/dailyBriefing';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain,
  Clock,
  Target,
  AlertTriangle,
  Heart,
  BookOpen,
  Shield,
  Edit3,
  Save,
  X,
  ChevronDown,
  ChevronUp,
  Trash2,
  Info,
  Sparkles,
  Zap,
  Network,
  FileText,
} from 'lucide-react';
import { useToast } from '../hooks/useToast';

interface BehavioralProfile {
  id: string;
  user_id: string;
  preferred_study_time: string;
  preferred_time?: string;
  typical_session_duration_min: number;
  subject_affinity: Record<string, number>;
  weak_subjects?: string[];
  strong_subjects?: string[];
  backlog_count?: number;
  missed_days_streak?: number;
  stress_signals?: Record<string, any>;
  typical_slump_day?: string;
  response_to_low_score?: string;
  fatigue_patterns: {
    peak_focus_hour?: number;
    fatigue_onset_min?: number;
    common_dropoff_task?: number;
  };
  slump_triggers: string[];
  response_to_failure: string;
  avg_plan_adherence_pct: number;
  total_sessions_logged: number;
  last_emotional_state: string;
  escalation_history: any[];
  memory_snapshot: {
    known_facts?: string[];
    study_habits?: Record<string, boolean>;
    emotional_patterns?: Record<string, any>;
  };
  created_at: string;
  updated_at: string;
}

const SECTIONS = [
  {
    key: 'study_patterns',
    title: 'Study Patterns',
    icon: Clock,
    description: 'When and how long you typically study',
    color: 'from-blue-500/10 to-cyan-500/10',
    borderColor: 'border-blue-200',
    iconColor: 'text-blue-500',
  },
  {
    key: 'subject_affinity',
    title: 'Subject Affinity',
    icon: Target,
    description: 'How confident you are in each subject',
    color: 'from-emerald-500/10 to-teal-500/10',
    borderColor: 'border-emerald-200',
    iconColor: 'text-emerald-500',
  },
  {
    key: 'fatigue',
    title: 'Focus & Fatigue',
    icon: Zap,
    description: 'When you lose concentration during sessions',
    color: 'from-amber-500/10 to-orange-500/10',
    borderColor: 'border-amber-200',
    iconColor: 'text-amber-500',
  },
  {
    key: 'behavior',
    title: 'Behavioral Signals',
    icon: Brain,
    description: 'How you respond to setbacks and stress',
    color: 'from-violet-500/10 to-purple-500/10',
    borderColor: 'border-violet-200',
    iconColor: 'text-violet-500',
  },
  {
    key: 'memory',
    title: 'Memory Snapshot',
    icon: BookOpen,
    description: 'Facts and habits Ranjan Sir remembers about you',
    color: 'from-rose-500/10 to-pink-500/10',
    borderColor: 'border-rose-200',
    iconColor: 'text-rose-500',
  },
  {
    key: 'knowledge_map',
    title: 'Knowledge Map',
    icon: Network,
    description: 'Concepts you have mastered or need help with',
    color: 'from-fuchsia-500/10 to-indigo-500/10',
    borderColor: 'border-fuchsia-200',
    iconColor: 'text-fuchsia-500',
  },
  {
    key: 'recent_submissions',
    title: 'Recent Submissions',
    icon: FileText,
    description: 'Your recent task outputs and evaluations',
    color: 'from-blue-500/10 to-cyan-500/10',
    borderColor: 'border-blue-200',
    iconColor: 'text-blue-500',
  },
];

export default function MyProfileDashboard() {
  const { user } = useAuth() as any;
  const { showToast } = useToast();
  const [profile, setProfile] = useState<BehavioralProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<BehavioralProfile>>({});
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['study_patterns']));
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    loadProfile();
  }, [user?.id]);

  const loadProfile = async () => {
    setLoading(true);
    setLoadError(null);
    let lastError: string | null = null;

    try {
      // 1. Try direct read
      let { data, error } = await supabase
        .from('student_behavioral_profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        lastError = `Read failed: ${error.message}`;
        console.error(lastError);
      }

      // 2. Try RPC refresh
      if (!data) {
        const { error: rpcError } = await supabase.rpc('refresh_behavioral_profile', { p_user_id: user.id });
        if (rpcError) {
          lastError = `refresh_behavioral_profile RPC failed: ${rpcError.message}`;
          console.error(lastError);
        }
        const retry = await supabase
          .from('student_behavioral_profiles')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();
        if (retry.error) {
          lastError = `Retry read after RPC failed: ${retry.error.message}`;
          console.error(lastError);
        }
        data = retry.data;
      }

      // 3. Try helper insert
      if (!data) {
        const ensureRes = await ensureBehavioralProfile(user.id);
        if (!ensureRes.success) {
          lastError = `ensureBehavioralProfile failed: ${ensureRes.error}`;
          console.error(lastError);
        }
        const finalRetry = await supabase
          .from('student_behavioral_profiles')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();
        if (finalRetry.error) {
          lastError = `Final read after ensure failed: ${finalRetry.error.message}`;
          console.error(lastError);
        }
        data = finalRetry.data;
      }

      // 4. Last resort — direct inline insert with full error capture
      if (!data) {
        const { error: insertErr } = await supabase.from('student_behavioral_profiles').insert({
          user_id: user.id,
          preferred_time: 'evening',
          typical_session_duration_min: 90,
          weak_subjects: [],
          strong_subjects: [],
          stress_signals: {},
        });
        if (insertErr) {
          lastError = `Direct insert failed: ${insertErr.message}`;
          console.error(lastError);
        } else {
          const lastRead = await supabase
            .from('student_behavioral_profiles')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle();
          data = lastRead.data;
          if (!data && lastRead.error) {
            lastError = `Read after direct insert failed: ${lastRead.error.message}`;
            console.error(lastError);
          }
        }
      }

      setProfile(data);
      if (!data && lastError) {
        setLoadError(lastError);
      }
    } catch (err: any) {
      const msg = err?.message || 'Unexpected profile load error';
      console.error('Failed to load profile:', err);
      setLoadError(msg);
      showToast('Could not load your profile', 'error');
    } finally {
      setLoading(false);
    }
  };

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const startEdit = (section: string) => {
    if (!profile) return;
    setEditingSection(section);
    setEditForm({ ...profile });
  };

  const cancelEdit = () => {
    setEditingSection(null);
    setEditForm({});
  };

  const saveEdit = async () => {
    if (!user?.id || !profile) return;
    try {
      const { error } = await supabase
        .from('student_behavioral_profiles')
        .update({
          preferred_study_time: editForm.preferred_study_time,
          typical_session_duration_min: editForm.typical_session_duration_min,
          subject_affinity: editForm.subject_affinity,
          fatigue_patterns: editForm.fatigue_patterns,
          slump_triggers: editForm.slump_triggers,
          response_to_failure: editForm.response_to_failure,
          memory_snapshot: editForm.memory_snapshot,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);

      if (error) throw error;
      showToast('Profile updated successfully', 'success');
      setEditingSection(null);
      loadProfile();
    } catch (err) {
      showToast('Failed to save changes', 'error');
    }
  };

  const deleteProfile = async () => {
    if (!user?.id) return;
    try {
      const { error } = await supabase
        .from('student_behavioral_profiles')
        .delete()
        .eq('user_id', user.id);

      if (error) throw error;
      showToast('Your behavioral profile has been deleted', 'info');
      setProfile(null);
      setConfirmDelete(false);
    } catch (err) {
      showToast('Failed to delete profile', 'error');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAF9] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#00D1FF]/20 border-t-[#00D1FF] rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-[#F8FAF9] py-12 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#6366F1]/10 to-[#00D1FF]/10 flex items-center justify-center mx-auto mb-6">
            <Brain className="w-8 h-8 text-[#6366F1]" />
          </div>
          <h1 className="text-2xl font-extrabold text-[#0A192F] mb-3">No Profile Data Yet</h1>
          <p className="text-[#64748B] mb-4 max-w-md mx-auto">
            Ranjan Sir hasn't built a behavioral model for you yet. Start completing tasks and interacting with the platform — your profile will grow automatically.
          </p>
          {loadError && (
            <div className="mb-6 mx-auto max-w-md">
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-left">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-red-700 mb-1">Diagnostics</p>
                    <p className="text-[11px] text-red-600 font-mono break-all">{loadError}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => window.location.href = '/'}
              className="bg-[#0A192F] text-white font-bold text-sm py-3 px-6 rounded-xl hover:bg-[#1E293B] transition-colors"
            >
              Go to Daily Briefing
            </button>
            <button
              onClick={loadProfile}
              className="bg-white text-[#0A192F] border border-[#0A192F]/10 font-bold text-sm py-3 px-6 rounded-xl hover:bg-gray-50 transition-colors"
            >
              Retry Load
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAF9] py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#6366F1] to-[#00D1FF] flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-[#0A192F]">What Ranjan Sir Knows</h1>
              <p className="text-xs text-[#94A3B8] font-medium">Your behavioral profile — transparent, editable, yours</p>
            </div>
          </div>
          <p className="text-sm text-[#64748B] mt-3 leading-relaxed">
            This is everything StudyBud's AI remembers about your study habits, strengths, and patterns.
            You can edit or delete any of it at any time. We believe you should control your own data.
          </p>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          <div className="bg-white rounded-2xl border border-[#0A192F]/[0.06] p-4 text-center">
            <div className="text-2xl font-extrabold text-[#0A192F]">{profile.total_sessions_logged ?? 0}</div>
            <div className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider mt-1">Sessions Logged</div>
          </div>
          <div className="bg-white rounded-2xl border border-[#0A192F]/[0.06] p-4 text-center">
            <div className="text-2xl font-extrabold text-[#0A192F]">{profile.backlog_count ?? profile.avg_plan_adherence_pct ?? 0}</div>
            <div className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider mt-1">
              {profile.backlog_count != null ? 'Backlog Count' : 'Plan Adherence'}
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-[#0A192F]/[0.06] p-4 text-center">
            <div className="text-2xl font-extrabold text-[#0A192F]">{profile.missed_days_streak ?? (profile.last_emotional_state || '—')}</div>
            <div className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider mt-1">
              {profile.missed_days_streak != null ? 'Missed Days' : 'Last State'}
            </div>
          </div>
        </div>

        {/* Sections */}
        <div className="space-y-3">
          {SECTIONS.map((section) => {
            const isExpanded = expandedSections.has(section.key);
            const isEditing = editingSection === section.key;
            const Icon = section.icon;

            return (
              <motion.div
                key={section.key}
                layout
                className={`bg-white rounded-2xl border ${section.borderColor} overflow-hidden`}
              >
                {/* Section Header */}
                <button
                  onClick={() => toggleSection(section.key)}
                  className="w-full flex items-center justify-between p-4 hover:bg-gray-50/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${section.color} flex items-center justify-center`}>
                      <Icon className={`w-4 h-4 ${section.iconColor}`} />
                    </div>
                    <div className="text-left">
                      <div className="text-sm font-bold text-[#0A192F]">{section.title}</div>
                      <div className="text-[11px] text-[#94A3B8]">{section.description}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!isEditing && (
                      <button
                        onClick={(e) => { e.stopPropagation(); startEdit(section.key); }}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-[#94A3B8] hover:text-[#0A192F] transition-colors"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-[#94A3B8]" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-[#94A3B8]" />
                    )}
                  </div>
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 pt-1 border-t border-gray-100">
                        {isEditing ? (
                          <EditForm
                            section={section.key}
                            profile={profile}
                            editForm={editForm}
                            setEditForm={setEditForm}
                            onSave={saveEdit}
                            onCancel={cancelEdit}
                          />
                        ) : (
                          <SectionContent section={section.key} profile={profile} />
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>

        {/* Delete Section */}
        <div className="mt-8 bg-red-50 rounded-2xl border border-red-200 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
            <div className="flex-1">
              <h3 className="text-sm font-bold text-red-800 mb-1">Delete Your Behavioral Profile</h3>
              <p className="text-xs text-red-600 mb-3">
                This will erase everything Ranjan Sir knows about your study patterns. Your task history and XP will remain.
              </p>
              {confirmDelete ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={deleteProfile}
                    className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold py-2 px-4 rounded-lg transition-colors"
                  >
                    Confirm Delete
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="bg-white hover:bg-gray-50 text-red-700 border border-red-200 text-xs font-bold py-2 px-4 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="flex items-center gap-1.5 text-red-600 hover:text-red-700 text-xs font-bold transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete My Profile
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Footer Note */}
        <div className="mt-6 flex items-center gap-2 text-[#94A3B8]">
          <Info className="w-3.5 h-3.5" />
          <span className="text-[11px]">
            Last updated: {profile.updated_at ? new Date(profile.updated_at).toLocaleString() : 'Never'}
          </span>
        </div>
      </div>
    </div>
  );
}

function SectionContent({ section, profile }: { section: string; profile: BehavioralProfile }) {
  switch (section) {
    case 'study_patterns':
      return (
        <div className="space-y-3 pt-2">
          <DataRow label="Preferred Study Time" value={profile.preferred_study_time || profile.preferred_time || 'Not set'} />
          <DataRow label="Typical Session" value={`${profile.typical_session_duration_min} minutes`} />
          <DataRow label="Response to Failure" value={profile.response_to_failure || profile.response_to_low_score || 'Not observed'} />
          <div className="mt-3 p-3 bg-blue-50 rounded-xl">
            <div className="flex items-start gap-2">
              <Sparkles className="w-3.5 h-3.5 text-blue-500 mt-0.5" />
              <p className="text-[11px] text-blue-700 leading-relaxed">
                This helps Ranjan Sir schedule your daily prescriptions at the right time and set realistic session lengths.
              </p>
            </div>
          </div>
        </div>
      );

    case 'subject_affinity':
      return (
        <div className="space-y-3 pt-2">
          {Object.entries(profile.subject_affinity || {}).length === 0 && !(profile.weak_subjects?.length || profile.strong_subjects?.length) ? (
            <p className="text-sm text-[#94A3B8]">No subject data collected yet.</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(profile.subject_affinity || {}).map(([subject, score]) => (
                <div key={subject} className="flex items-center gap-3">
                  <span className="text-sm font-medium text-[#0A192F] w-24">{subject}</span>
                  <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(score as number) * 100}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                      className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-400"
                    />
                  </div>
                  <span className="text-xs font-bold text-[#64748B] w-10 text-right">{Math.round((score as number) * 100)}%</span>
                </div>
              ))}
              {profile.weak_subjects?.length ? <DataRow label="Weak Subjects" value={profile.weak_subjects.join(', ')} /> : null}
              {profile.strong_subjects?.length ? <DataRow label="Strong Subjects" value={profile.strong_subjects.join(', ')} /> : null}
            </div>
          )}
          <div className="mt-3 p-3 bg-emerald-50 rounded-xl">
            <div className="flex items-start gap-2">
              <Sparkles className="w-3.5 h-3.5 text-emerald-500 mt-0.5" />
              <p className="text-[11px] text-emerald-700 leading-relaxed">
                Subject affinity is calculated from your test results, task completions, and self-reported confidence. It determines which topics get priority in your daily plan.
              </p>
            </div>
          </div>
        </div>
      );

    case 'fatigue':
      return (
        <div className="space-y-3 pt-2">
          <DataRow label="Peak Focus Hour" value={profile.fatigue_patterns?.peak_focus_hour ? `${profile.fatigue_patterns.peak_focus_hour}:00` : 'Unknown'} />
          <DataRow label="Fatigue Onset" value={profile.fatigue_patterns?.fatigue_onset_min ? `~${profile.fatigue_patterns.fatigue_onset_min} min` : 'Unknown'} />
          <DataRow label="Common Dropoff" value={profile.fatigue_patterns?.common_dropoff_task ? `Task #${profile.fatigue_patterns.common_dropoff_task}` : 'None recorded'} />
          <div className="mt-3 p-3 bg-amber-50 rounded-xl">
            <div className="flex items-start gap-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-500 mt-0.5" />
              <p className="text-[11px] text-amber-700 leading-relaxed">
                Fatigue patterns are inferred from your session durations and engagement scores. Ranjan Sir uses this to break long sessions into manageable chunks.
              </p>
            </div>
          </div>
        </div>
      );

    case 'behavior':
      return (
        <div className="space-y-3 pt-2">
          <DataRow label="Slump Triggers" value={profile.slump_triggers?.length ? profile.slump_triggers.join(', ') : profile.typical_slump_day || 'None identified'} />
          <DataRow label="Last Emotional State" value={profile.last_emotional_state || 'Not recorded'} />
          <DataRow label="Escalation History" value={`${(profile.escalation_history || []).length} events`} />
          {profile.backlog_count != null ? <DataRow label="Backlog Count" value={`${profile.backlog_count}`} /> : null}
          {profile.missed_days_streak != null ? <DataRow label="Missed Days Streak" value={`${profile.missed_days_streak}`} /> : null}
          <div className="mt-3 p-3 bg-violet-50 rounded-xl">
            <div className="flex items-start gap-2">
              <Sparkles className="w-3.5 h-3.5 text-violet-500 mt-0.5" />
              <p className="text-[11px] text-violet-700 leading-relaxed">
                Behavioral signals trigger interventions. If you miss multiple days, Ranjan Sir will suggest a lighter plan. If stress is detected, he'll recommend a break.
              </p>
            </div>
          </div>
        </div>
      );

    case 'knowledge_map':
      return <KnowledgeMapContent userId={profile.user_id} />;

    case 'recent_submissions':
      return <RecentSubmissionsContent userId={profile.user_id} />;

    case 'memory':
      return (
        <div className="space-y-3 pt-2">
          {(profile.memory_snapshot?.known_facts || []).length === 0 ? (
            <p className="text-sm text-[#94A3B8]">No memory facts recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {profile.memory_snapshot.known_facts!.map((fact, i) => (
                <div key={i} className="flex items-start gap-2 p-2.5 bg-rose-50 rounded-xl">
                  <Heart className="w-3.5 h-3.5 text-rose-400 mt-0.5 shrink-0" />
                  <span className="text-xs text-rose-800">{fact}</span>
                </div>
              ))}
            </div>
          )}
          {Object.keys(profile.memory_snapshot?.study_habits || {}).length > 0 && (
            <div className="mt-2">
              <div className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider mb-2">Study Habits</div>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(profile.memory_snapshot.study_habits!).map(([habit, value]) => (
                  <div key={habit} className="flex items-center gap-2 text-xs text-[#0A192F]">
                    <div className={`w-1.5 h-1.5 rounded-full ${value ? 'bg-emerald-400' : 'bg-gray-300'}`} />
                    {habit.replace(/_/g, ' ')}
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="mt-3 p-3 bg-rose-50 rounded-xl">
            <div className="flex items-start gap-2">
              <Sparkles className="w-3.5 h-3.5 text-rose-500 mt-0.5" />
              <p className="text-[11px] text-rose-700 leading-relaxed">
                Memory snapshots are built from your interactions, feedback, and explicit preferences you share with Ranjan Sir. You can edit these facts anytime.
              </p>
            </div>
          </div>
        </div>
      );

    default:
      return null;
  }
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-xs text-[#64748B] font-medium">{label}</span>
      <span className="text-xs font-bold text-[#0A192F]">{value}</span>
    </div>
  );
}

function EditForm({
  section,
  profile,
  editForm,
  setEditForm,
  onSave,
  onCancel,
}: {
  section: string;
  profile: BehavioralProfile;
  editForm: Partial<BehavioralProfile>;
  setEditForm: (f: Partial<BehavioralProfile>) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const updateField = (field: string, value: any) => {
    setEditForm({ ...editForm, [field]: value });
  };

  switch (section) {
    case 'study_patterns':
      return (
        <div className="space-y-3 pt-2">
          <div>
            <label className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider block mb-1.5">Preferred Study Time</label>
            <select
              value={editForm.preferred_study_time || ''}
              onChange={(e) => updateField('preferred_study_time', e.target.value)}
              className="w-full text-sm bg-white border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#6366F1]/20"
            >
              <option value="">Select...</option>
              <option value="morning">Morning (6-12)</option>
              <option value="afternoon">Afternoon (12-17)</option>
              <option value="evening">Evening (17-22)</option>
              <option value="night">Night (22-2)</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider block mb-1.5">Typical Session (minutes)</label>
            <input
              type="number"
              value={editForm.typical_session_duration_min || ''}
              onChange={(e) => updateField('typical_session_duration_min', parseInt(e.target.value) || 0)}
              className="w-full text-sm bg-white border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#6366F1]/20"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider block mb-1.5">Response to Failure</label>
            <select
              value={editForm.response_to_failure || ''}
              onChange={(e) => updateField('response_to_failure', e.target.value)}
              className="w-full text-sm bg-white border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#6366F1]/20"
            >
              <option value="">Select...</option>
              <option value="seeks_help">Seeks Help</option>
              <option value="withdraws">Withdraws</option>
              <option value="doubles_down">Doubles Down</option>
              <option value="varies">Varies by Subject</option>
            </select>
          </div>
          <div className="flex items-center gap-2 pt-2">
            <button onClick={onSave} className="flex items-center gap-1.5 bg-[#0A192F] text-white text-xs font-bold py-2 px-4 rounded-lg hover:bg-[#1E293B] transition-colors">
              <Save className="w-3.5 h-3.5" /> Save
            </button>
            <button onClick={onCancel} className="flex items-center gap-1.5 bg-white text-[#64748B] border border-gray-200 text-xs font-bold py-2 px-4 rounded-lg hover:bg-gray-50 transition-colors">
              <X className="w-3.5 h-3.5" /> Cancel
            </button>
          </div>
        </div>
      );

    case 'subject_affinity':
      return (
        <div className="space-y-3 pt-2">
          {Object.entries(editForm.subject_affinity || profile.subject_affinity || {}).map(([subject, score]) => (
            <div key={subject}>
              <label className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider block mb-1.5">{subject} Confidence (0-1)</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={score as number}
                onChange={(e) => {
                  const newAffinity = { ...(editForm.subject_affinity || profile.subject_affinity), [subject]: parseFloat(e.target.value) };
                  updateField('subject_affinity', newAffinity);
                }}
                className="w-full"
              />
              <div className="text-right text-xs font-bold text-[#0A192F]">{Math.round((score as number) * 100)}%</div>
            </div>
          ))}
          <div className="flex items-center gap-2 pt-2">
            <button onClick={onSave} className="flex items-center gap-1.5 bg-[#0A192F] text-white text-xs font-bold py-2 px-4 rounded-lg hover:bg-[#1E293B] transition-colors">
              <Save className="w-3.5 h-3.5" /> Save
            </button>
            <button onClick={onCancel} className="flex items-center gap-1.5 bg-white text-[#64748B] border border-gray-200 text-xs font-bold py-2 px-4 rounded-lg hover:bg-gray-50 transition-colors">
              <X className="w-3.5 h-3.5" /> Cancel
            </button>
          </div>
        </div>
      );

    case 'fatigue':
      return (
        <div className="space-y-3 pt-2">
          <div>
            <label className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider block mb-1.5">Peak Focus Hour (0-23)</label>
            <input
              type="number"
              min="0"
              max="23"
              value={editForm.fatigue_patterns?.peak_focus_hour ?? profile.fatigue_patterns?.peak_focus_hour ?? ''}
              onChange={(e) => updateField('fatigue_patterns', { ...(editForm.fatigue_patterns || profile.fatigue_patterns), peak_focus_hour: parseInt(e.target.value) })}
              className="w-full text-sm bg-white border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#6366F1]/20"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider block mb-1.5">Fatigue Onset (minutes)</label>
            <input
              type="number"
              value={editForm.fatigue_patterns?.fatigue_onset_min ?? profile.fatigue_patterns?.fatigue_onset_min ?? ''}
              onChange={(e) => updateField('fatigue_patterns', { ...(editForm.fatigue_patterns || profile.fatigue_patterns), fatigue_onset_min: parseInt(e.target.value) })}
              className="w-full text-sm bg-white border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#6366F1]/20"
            />
          </div>
          <div className="flex items-center gap-2 pt-2">
            <button onClick={onSave} className="flex items-center gap-1.5 bg-[#0A192F] text-white text-xs font-bold py-2 px-4 rounded-lg hover:bg-[#1E293B] transition-colors">
              <Save className="w-3.5 h-3.5" /> Save
            </button>
            <button onClick={onCancel} className="flex items-center gap-1.5 bg-white text-[#64748B] border border-gray-200 text-xs font-bold py-2 px-4 rounded-lg hover:bg-gray-50 transition-colors">
              <X className="w-3.5 h-3.5" /> Cancel
            </button>
          </div>
        </div>
      );

    case 'behavior':
      return (
        <div className="space-y-3 pt-2">
          <div>
            <label className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider block mb-1.5">Slump Triggers (comma separated)</label>
            <input
              type="text"
              value={(editForm.slump_triggers || profile.slump_triggers || []).join(', ')}
              onChange={(e) => updateField('slump_triggers', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
              className="w-full text-sm bg-white border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#6366F1]/20"
              placeholder="e.g. social_media, late_night_study"
            />
          </div>
          <div className="flex items-center gap-2 pt-2">
            <button onClick={onSave} className="flex items-center gap-1.5 bg-[#0A192F] text-white text-xs font-bold py-2 px-4 rounded-lg hover:bg-[#1E293B] transition-colors">
              <Save className="w-3.5 h-3.5" /> Save
            </button>
            <button onClick={onCancel} className="flex items-center gap-1.5 bg-white text-[#64748B] border border-gray-200 text-xs font-bold py-2 px-4 rounded-lg hover:bg-gray-50 transition-colors">
              <X className="w-3.5 h-3.5" /> Cancel
            </button>
          </div>
        </div>
      );

    case 'memory':
      return (
        <div className="space-y-3 pt-2">
          <div>
            <label className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider block mb-1.5">Known Facts (one per line)</label>
            <textarea
              value={(editForm.memory_snapshot?.known_facts || profile.memory_snapshot?.known_facts || []).join('\n')}
              onChange={(e) => updateField('memory_snapshot', { ...(editForm.memory_snapshot || profile.memory_snapshot), known_facts: e.target.value.split('\n').filter(Boolean) })}
              rows={4}
              className="w-full text-sm bg-white border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#6366F1]/20 resize-none"
            />
          </div>
          <div className="flex items-center gap-2 pt-2">
            <button onClick={onSave} className="flex items-center gap-1.5 bg-[#0A192F] text-white text-xs font-bold py-2 px-4 rounded-lg hover:bg-[#1E293B] transition-colors">
              <Save className="w-3.5 h-3.5" /> Save
            </button>
            <button onClick={onCancel} className="flex items-center gap-1.5 bg-white text-[#64748B] border border-gray-200 text-xs font-bold py-2 px-4 rounded-lg hover:bg-gray-50 transition-colors">
              <X className="w-3.5 h-3.5" /> Cancel
            </button>
          </div>
        </div>
      );

    default:
      return null;
  }
}

function KnowledgeMapContent({ userId }: { userId: string }) {
  const [nodes, setNodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('user_knowledge')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);
      setNodes(data || []);
      setLoading(false);
    }
    load();
  }, [userId]);

  if (loading) return <div className="p-4 text-center text-xs text-[#94A3B8]">Loading knowledge map...</div>;
  if (!nodes.length) return <div className="p-4 text-center text-xs text-[#94A3B8]">No knowledge data recorded yet.</div>;

  return (
    <div className="space-y-3 pt-2">
      {nodes.map(n => (
        <div key={n.id} className="p-3 bg-fuchsia-50 rounded-xl border border-fuchsia-100">
          <div className="flex items-center gap-2 mb-1">
            <Network className="w-4 h-4 text-fuchsia-500" />
            <span className="font-bold text-xs text-[#0A192F]">{n.topic || n.metadata?.topic || 'Knowledge Entry'}</span>
            <span className="ml-auto text-[10px] font-medium text-fuchsia-700 uppercase">{n.knowledge_type || n.source_type || 'knowledge'}</span>
          </div>
          <p className="text-xs text-[#64748B]">{n.content}</p>
        </div>
      ))}
    </div>
  );
}

function RecentSubmissionsContent({ userId }: { userId: string }) {
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState<Set<string>>(new Set());

  const fetchSubmissions = async () => {
    const { data } = await supabase
      .from('task_outputs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5);
    return data || [];
  };

  const retryPendingAnalyses = async (rows: any[]) => {
    const pending = rows.filter(r => !r.ai_analysis);
    if (pending.length === 0) return rows;

    setRetrying(new Set(pending.map(p => p.id)));

    await Promise.all(
      pending.map(async (row) => {
        try {
          await supabase.functions.invoke('analyse-task-output', {
            body: {
              output_id: row.id,
              task_title: row.metadata?.task_title || 'Task Output',
              subject: row.metadata?.subject || null,
              output_type: row.output_type || 'text',
              text_content: row.text_content || null,
            },
          });
        } catch (err) {
          console.error(`Retry failed for output ${row.id}:`, err);
        }
      })
    );

    // Re-fetch after retries completed
    const refreshed = await fetchSubmissions();
    setRetrying(new Set());
    return refreshed;
  };

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const initial = await fetchSubmissions();
      if (cancelled) return;
      setSubmissions(initial);
      setLoading(false);

      const refreshed = await retryPendingAnalyses(initial);
      if (cancelled) return;
      setSubmissions(refreshed);
    }
    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  if (loading) return <div className="p-4 text-center text-xs text-[#94A3B8]">Loading submissions...</div>;
  if (!submissions.length) return <div className="p-4 text-center text-xs text-[#94A3B8]">No submissions yet.</div>;

  return (
    <div className="space-y-3 pt-2">
      {submissions.map(s => (
        <div key={s.id} className="p-3 bg-blue-50 rounded-xl border border-blue-100">
          <div className="flex items-center gap-2 mb-1">
            <FileText className="w-4 h-4 text-blue-500" />
            <span className="font-bold text-xs text-[#0A192F]">Task Output</span>
            <span className="ml-auto text-[10px] font-medium text-blue-700 uppercase">{s.output_type}</span>
          </div>
          {s.ai_analysis ? (
            <div className="mt-2 text-xs text-[#64748B]">
              <div className="mb-1"><strong>Effort:</strong> {s.ai_analysis.effort_score}/10 | <strong>Accuracy:</strong> {s.ai_analysis.accuracy_score}/10</div>
              <p>{s.ai_analysis.feedback}</p>
            </div>
          ) : retrying.has(s.id) ? (
            <p className="text-xs text-blue-600 italic mt-2">Running analysis...</p>
          ) : (
            <p className="text-xs text-[#64748B] italic mt-2">Analysis pending...</p>
          )}
        </div>
      ))}
    </div>
  );
}
