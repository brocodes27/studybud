import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { AlertCircle, CalendarCheck, CheckCircle2, ClipboardList, GraduationCap, Loader2, ShieldCheck, Target, Users } from 'lucide-react';

const ParentDashboard: React.FC = () => {
  const { user, role, loading } = useAuth() as any;
  const [links, setLinks] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [behavior, setBehavior] = useState<Record<string, any>>({});
  const [tests, setTests] = useState<Record<string, any[]>>({});
  const [prescriptions, setPrescriptions] = useState<Record<string, any>>({});
  const [interventions, setInterventions] = useState<Record<string, any[]>>({});
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState('');

  const studentIds = useMemo(() => links.map((link: any) => link.student_user_id).filter(Boolean), [links]);

  useEffect(() => {
    const fetchParentData = async () => {
      if (!user?.id) return;
      setLoadingData(true);
      setError('');
      try {
        const { data: linkData, error: linkError } = await supabase
          .from('parent_student_links')
          .select('*')
          .eq('parent_user_id', user.id)
          .eq('status', 'active')
          .order('created_at', { ascending: false });
        if (linkError) throw linkError;

        const activeLinks = linkData || [];
        setLinks(activeLinks);
        const ids = activeLinks.map((link: any) => link.student_user_id).filter(Boolean);

        if (ids.length === 0) {
          setProfiles({});
          setBehavior({});
          setTests({});
          setPrescriptions({});
          setInterventions({});
          return;
        }

        const today = new Date().toISOString().split('T')[0];
        const [profileRes, behaviorRes, testsRes, prescriptionRes, interventionRes] = await Promise.all([
          supabase.from('user_profiles').select('id, full_name, email').in('id', ids),
          supabase.from('student_behavioral_profiles').select('*').in('user_id', ids),
          supabase.from('test_results').select('*').in('user_id', ids).order('created_at', { ascending: false }).limit(20),
          supabase.from('daily_prescriptions').select('*').in('user_id', ids).eq('prescription_date', today),
          supabase.from('interventions').select('*').in('student_user_id', ids).order('created_at', { ascending: false }).limit(30),
        ]);

        const profileMap: Record<string, any> = {};
        (profileRes.data || []).forEach((profile: any) => { profileMap[profile.id] = profile; });
        setProfiles(profileMap);

        const behaviorMap: Record<string, any> = {};
        (behaviorRes.data || []).forEach((row: any) => { behaviorMap[row.user_id] = row; });
        setBehavior(behaviorMap);

        const testMap: Record<string, any[]> = {};
        (testsRes.data || []).forEach((row: any) => {
          if (!testMap[row.user_id]) testMap[row.user_id] = [];
          testMap[row.user_id].push(row);
        });
        setTests(testMap);

        const prescriptionMap: Record<string, any> = {};
        (prescriptionRes.data || []).forEach((row: any) => { prescriptionMap[row.user_id] = row; });
        setPrescriptions(prescriptionMap);

        const interventionMap: Record<string, any[]> = {};
        if (!interventionRes.error) {
          (interventionRes.data || []).forEach((row: any) => {
            if (!interventionMap[row.student_user_id]) interventionMap[row.student_user_id] = [];
            interventionMap[row.student_user_id].push(row);
          });
        }
        setInterventions(interventionMap);
      } catch (err: any) {
        setError(err?.message || 'Failed to load parent dashboard.');
      } finally {
        setLoadingData(false);
      }
    };

    fetchParentData();
  }, [user?.id]);

  const parentSummary = useMemo(() => {
    let totalTasks = 0;
    let completedTasks = 0;
    let activeInterventions = 0;
    let highRiskStudents = 0;

    studentIds.forEach((studentId: string) => {
      const tasks = Array.isArray(prescriptions[studentId]?.tasks) ? prescriptions[studentId].tasks : [];
      totalTasks += tasks.length;
      completedTasks += tasks.filter((task: any) => task.completed).length;
      const active = (interventions[studentId] || []).filter((row: any) => row.status === 'active');
      activeInterventions += active.length;
      const risk = behavior[studentId]?.attendance_risk_level;
      if (risk === 'high' || active.some((row: any) => row.severity === 'critical' || row.severity === 'high')) {
        highRiskStudents += 1;
      }
    });

    return {
      missionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
      totalTasks,
      completedTasks,
      activeInterventions,
      highRiskStudents,
    };
  }, [behavior, interventions, prescriptions, studentIds]);

  if (loading || loadingData) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-[#8B7355]" />
      </div>
    );
  }

  if (role !== 'parent') {
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl border border-red-100 p-8 max-w-md text-center shadow-sm">
          <AlertCircle className="h-10 w-10 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-[#2D2A26] mb-2">Parent access only</h1>
          <p className="text-sm text-[#8A8279]">This dashboard is for linked parent accounts.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF8F5] pb-20">
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-8">
        <div className="mb-8 pb-8 border-b border-[#E8E4DF] flex items-center gap-4">
          <div className="bg-[#8B7355]/10 p-3 rounded-2xl">
            <Users className="h-8 w-8 text-[#8B7355] stroke-[2.5px]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#2D2A26] leading-none">Parent Dashboard</h1>
            <p className="text-sm text-[#8A8279] mt-1">Attendance, consistency, tests, and Ranjan Sir’s progress signals.</p>
          </div>
        </div>

        {error && <div className="bg-red-50 border border-red-100 text-red-600 font-bold p-4 rounded-xl mb-6">{error}</div>}

        {studentIds.length === 0 ? (
          <div className="bg-white rounded-2xl border-2 border-dashed border-[#2D2A26]/[0.08] p-12 text-center">
            <h2 className="text-xl font-bold text-[#2D2A26] mb-2">No students linked yet</h2>
            <p className="text-sm text-[#8A8279] max-w-xl mx-auto">Ask your child or institute admin to connect your parent account. Once linked, you’ll see attendance, daily missions, tests, and weekly progress summaries here.</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-2xl border border-[#2D2A26]/[0.06] p-5 shadow-sm">
                <ClipboardList className="h-5 w-5 text-[#8B7355] mb-3" />
                <p className="text-xs font-black uppercase tracking-wider text-[#8A8279]">Mission Rate</p>
                <p className="text-3xl font-black text-[#2D2A26] mt-1">{parentSummary.missionRate}%</p>
                <p className="text-xs text-[#8A8279] mt-1">{parentSummary.completedTasks}/{parentSummary.totalTasks} tasks closed today</p>
              </div>
              <div className="bg-white rounded-2xl border border-[#2D2A26]/[0.06] p-5 shadow-sm">
                <ShieldCheck className="h-5 w-5 text-blue-600 mb-3" />
                <p className="text-xs font-black uppercase tracking-wider text-[#8A8279]">Active Supports</p>
                <p className="text-3xl font-black text-[#2D2A26] mt-1">{parentSummary.activeInterventions}</p>
                <p className="text-xs text-[#8A8279] mt-1">AI interventions currently watching progress</p>
              </div>
              <div className="bg-white rounded-2xl border border-[#2D2A26]/[0.06] p-5 shadow-sm">
                <AlertCircle className="h-5 w-5 text-red-600 mb-3" />
                <p className="text-xs font-black uppercase tracking-wider text-[#8A8279]">High Risk</p>
                <p className="text-3xl font-black text-[#2D2A26] mt-1">{parentSummary.highRiskStudents}</p>
                <p className="text-xs text-[#8A8279] mt-1">students needing urgent support</p>
              </div>
              <div className="bg-white rounded-2xl border border-[#2D2A26]/[0.06] p-5 shadow-sm">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 mb-3" />
                <p className="text-xs font-black uppercase tracking-wider text-[#8A8279]">Status</p>
                <p className="text-3xl font-black text-[#2D2A26] mt-1">{parentSummary.highRiskStudents > 0 ? 'Watch' : 'Stable'}</p>
                <p className="text-xs text-[#8A8279] mt-1">based on attendance, missions, and support flags</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {studentIds.map((studentId: string) => {
              const profile = profiles[studentId] || {};
              const b = behavior[studentId] || {};
              const latestTest = tests[studentId]?.[0];
              const prescription = prescriptions[studentId];
              const tasks = Array.isArray(prescription?.tasks) ? prescription.tasks : [];
              const completed = tasks.filter((task: any) => task.completed).length;
              const attendanceRate = Math.round(Number(b.attendance_rate_30d ?? 1) * 100);
              const activeInterventions = (interventions[studentId] || []).filter((row: any) => row.status === 'active');
              const topIntervention = activeInterventions[0];

              return (
                <div key={studentId} className="bg-white rounded-2xl border-2 border-[#2D2A26]/[0.06] p-6 shadow-sm space-y-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-bold text-[#2D2A26]">{profile.full_name || 'Student'}</h2>
                      <p className="text-xs font-medium text-[#8A8279]">{profile.email}</p>
                    </div>
                    <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${b.attendance_risk_level === 'high' ? 'bg-red-50 text-red-600' : b.attendance_risk_level === 'medium' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                      {b.attendance_risk_level || 'low'} risk
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-[#F5F0E8] rounded-xl p-4">
                      <CalendarCheck className="h-5 w-5 text-[#8B7355] mb-2" />
                      <p className="text-xs font-bold text-[#8A8279] uppercase">30-day attendance</p>
                      <p className="text-2xl font-bold text-[#2D2A26]">{attendanceRate}%</p>
                      <p className="text-xs text-[#8A8279] mt-1">{b.consecutive_absences || 0} consecutive absences</p>
                    </div>
                    <div className="bg-[#F5F0E8] rounded-xl p-4">
                      <ClipboardList className="h-5 w-5 text-[#8B7355] mb-2" />
                      <p className="text-xs font-bold text-[#8A8279] uppercase">Today’s mission</p>
                      <p className="text-2xl font-bold text-[#2D2A26]">{tasks.length ? `${completed}/${tasks.length}` : '—'}</p>
                      <p className="text-xs text-[#8A8279] mt-1">tasks completed</p>
                    </div>
                    <div className="bg-[#F8FAFF] rounded-xl p-4">
                      <Target className="h-5 w-5 text-[#00D1FF] mb-2" />
                      <p className="text-xs font-bold text-[#8A8279] uppercase">Latest test</p>
                      <p className="text-2xl font-bold text-[#2D2A26]">{latestTest ? `${latestTest.score_obtained ?? latestTest.score ?? 0}/${latestTest.score_total ?? latestTest.max_score ?? 100}` : '—'}</p>
                      <p className="text-xs text-[#8A8279] mt-1">{latestTest?.test_name || 'No test yet'}</p>
                    </div>
                    <div className="bg-[#F8FAFF] rounded-xl p-4">
                      <GraduationCap className="h-5 w-5 text-[#00D1FF] mb-2" />
                      <p className="text-xs font-bold text-[#8A8279] uppercase">Backlog health</p>
                      <p className="text-2xl font-bold text-[#2D2A26]">{b.backlog_count ?? 0}</p>
                      <p className="text-xs text-[#8A8279] mt-1">pending items</p>
                    </div>
                  </div>

                  <div className="bg-[#FAF8F5] rounded-xl p-4 border border-[#E8E4DF]">
                    <p className="text-sm font-bold text-[#2D2A26] mb-1">Ranjan Sir summary</p>
                    <p className="text-sm text-[#8A8279] leading-relaxed">
                      {topIntervention
                        ? `${profile.full_name || 'Your child'} has an active ${String(topIntervention.trigger_type || 'support').replace(/_/g, ' ')} support. The next milestone is to complete the assigned proof or rescue task.`
                        : attendanceRate < 85
                          ? `${profile.full_name || 'Your child'} needs attendance support first. Ranjan Sir will prioritize missed-class catch-up before new work.`
                          : `${profile.full_name || 'Your child'} is maintaining healthy attendance. Keep watching daily mission completion and recent test corrections.`}
                    </p>
                  </div>

                  <div className="rounded-xl p-4 border border-blue-100 bg-blue-50">
                    <p className="text-sm font-bold text-[#2D2A26] mb-2">Active AI support</p>
                    {activeInterventions.length > 0 ? (
                      <div className="space-y-2">
                        {activeInterventions.slice(0, 2).map((row: any) => (
                          <div key={row.id} className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-bold text-blue-900 capitalize">{String(row.trigger_type || 'support').replace(/_/g, ' ')}</p>
                              <p className="text-xs text-blue-800/70 capitalize">{String(row.action_type || 'action').replace(/_/g, ' ')}</p>
                            </div>
                            <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-full ${row.severity === 'critical' || row.severity === 'high' ? 'bg-red-100 text-red-700' : 'bg-white text-blue-700'}`}>
                              {row.severity || 'watch'}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-blue-800/75">No active intervention. Daily mission and attendance are the main signals to watch.</p>
                    )}
                  </div>
                </div>
              );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ParentDashboard;
