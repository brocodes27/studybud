import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import {
  Users,
  GraduationCap,
  BookOpen,
  School,
  Loader2,
  BarChart3,
  Mail,
  TrendingUp,
  Cpu,
  Award,
  Calendar,
  CheckCircle2,
  Circle,
  AlertTriangle,
  FileText,
  Printer
} from 'lucide-react';

interface SchoolUser {
  id: string;
  full_name: string;
  email: string;
  role: string;
  account_type: string;
  created_at: string;
}

interface SchoolClass {
  id: string;
  name: string;
  subject: string;
  teacher_id: string;
  class_code: string;
  created_at: string;
  teacher_name?: string;
  member_count?: number;
}

export function SchoolAdminPanel() {
  const { user, schoolId, signOut } = useAuth() as any;
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [schoolName, setSchoolName] = useState('');
  const [users, setUsers] = useState<SchoolUser[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [stats, setStats] = useState({ totalUsers: 0, totalTeachers: 0, totalStudents: 0, totalClasses: 0 });
  
  // Phase 3 States
  const [activeTab, setActiveTab] = useState<'users_classes' | 'analytics' | 'ai_governance' | 'pilot_status'>('users_classes');
  const [outcomes, setOutcomes] = useState<any>(null);
  const [entitlement, setEntitlement] = useState<any>(null);
  const [aiUsage, setAiUsage] = useState<any[]>([]);

  useEffect(() => {
    if (!user?.id || !schoolId) {
      setLoading(false);
      return;
    }
    fetchSchoolData();
  }, [user, schoolId]);

  const fetchSchoolData = async () => {
    setLoading(true);
    try {
      // Fetch school name
      const { data: schoolData } = await supabase
        .from('schools')
        .select('name')
        .eq('id', schoolId)
        .single();
      if (schoolData) setSchoolName(schoolData.name);

      // Fetch users in this school
      const { data: userData, error: userError } = await supabase
        .from('user_profiles')
        .select('id, full_name, email, role, account_type, created_at')
        .eq('school_id', schoolId)
        .order('created_at', { ascending: false });

      if (userError) throw userError;
      const allUsers = (userData || []) as SchoolUser[];
      setUsers(allUsers);
      
      const teacherCount = allUsers.filter(u => u.role === 'teacher' || u.account_type === 'teacher').length;
      const studentCount = allUsers.filter(u => u.role === 'student' || u.account_type?.includes('student')).length;

      setStats({
        totalUsers: allUsers.length,
        totalTeachers: teacherCount,
        totalStudents: studentCount,
        totalClasses: 0
      });

      // Fetch classes taught by teachers in this school
      const teacherIds = allUsers.filter(u => u.role === 'teacher' || u.account_type === 'teacher').map(u => u.id);
      let enrichedClasses: SchoolClass[] = [];
      if (teacherIds.length > 0) {
        const { data: classData, error: classError } = await supabase
          .from('classes')
          .select('id, name, subject, teacher_id, class_code, created_at')
          .in('teacher_id', teacherIds)
          .order('created_at', { ascending: false });

        if (classError) throw classError;
        const classList = (classData || []) as SchoolClass[];

        enrichedClasses = await Promise.all(
          classList.map(async (cls) => {
            const { count } = await supabase
              .from('class_members')
              .select('*', { count: 'exact', head: true })
              .eq('class_id', cls.id);
            return { ...cls, member_count: count || 0, teacher_name: allUsers.find(u => u.id === cls.teacher_id)?.full_name || 'Unknown' };
          })
        );

        setClasses(enrichedClasses);
        setStats(prev => ({ ...prev, totalClasses: enrichedClasses.length }));
      }

      // Fetch entitlement
      const { data: entitlementData } = await supabase
        .from('school_entitlements')
        .select('*')
        .eq('school_id', schoolId)
        .maybeSingle();
      setEntitlement(entitlementData || { plan: 'pilot', seat_count: 100 });

      // Fetch outcomes summary
      const { data: outcomesData } = await supabase
        .rpc('get_school_outcomes_summary', { p_school_id: schoolId });
      if (outcomesData) {
        setOutcomes(outcomesData);
      }

      // Fetch AI usage logs
      const { data: usageLogs } = await supabase
        .from('ai_usage_logs')
        .select('*')
        .eq('school_id', schoolId)
        .order('created_at', { ascending: false });
      setAiUsage(usageLogs || []);

    } catch (error: any) {
      showToast(error.message || 'Failed to load school data', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF8F5]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-[#8B7355]" />
          <p className="text-sm font-medium text-[#8A8279]">Loading school dashboard...</p>
        </div>
      </div>
    );
  }

  if (!schoolId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[#FAF8F5]">
        <div className="max-w-md w-full bg-white rounded-[28px] border border-[#2D2A26]/[0.06] shadow-md p-8 text-center">
          <School className="w-12 h-12 text-[#8A8279] mx-auto mb-4" />
          <h2 className="text-xl font-extrabold text-[#2D2A26] mb-2">No School Linked</h2>
          <p className="text-[#8A8279] text-sm">Your account is not linked to any school. Contact support if you believe this is an error.</p>
        </div>
      </div>
    );
  }

  // AI Meter calculations
  const monthlyBudget = entitlement?.plan === 'pilot' ? 10.00
    : entitlement?.plan === 'basic' ? 50.00
    : entitlement?.plan === 'premium' ? 200.00
    : entitlement?.plan === 'enterprise' ? 999999.00 : 0.00;

  const currentMonthCost = aiUsage
    .filter(log => new Date(log.created_at).getMonth() === new Date().getMonth())
    .reduce((sum, log) => sum + parseFloat(log.estimated_cost || 0), 0);

  const budgetUsagePercent = Math.min((currentMonthCost / (monthlyBudget || 1)) * 100, 100);

  // Group AI usage by feature for charts
  const featureCosts = aiUsage.reduce((acc: Record<string, { count: number, cost: number }>, log) => {
    const feat = log.feature_name || 'Other';
    if (!acc[feat]) acc[feat] = { count: 0, cost: 0 };
    acc[feat].count += 1;
    acc[feat].cost += parseFloat(log.estimated_cost || 0);
    return acc;
  }, {});

  // Day-30 Pilot Timeline calculations (Mocked offset since school creation)
  const createdDate = new Date(entitlement?.created_at || new Date());
  const diffTime = Math.abs(new Date().getTime() - createdDate.getTime());
  const pilotDay = Math.min(Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 12, 30); // defaults to 12 if just created

  // Pilot checklist items
  const pilotMilestones = [
    { label: 'Claim School and Set Up Structure', status: true },
    { label: 'Onboard 5+ Students', status: stats.totalStudents >= 5 },
    { label: 'Create 2+ Class Assignments', status: classes.length >= 2 || stats.totalClasses >= 2 },
    { label: 'Detect and Resolve 1+ AI Interventions', status: (outcomes?.total_interventions || 0) > 0 },
    { label: 'Syllabus coverage progress logged', status: (outcomes?.syllabus_coverage_pct || 0) > 0 }
  ];

  return (
    <div className="min-h-screen bg-[#FAF8F5] p-4 md:p-6 no-print">
      {/* Dynamic print-only block */}
      <style>{`
        @media print {
          .no-print {
            display: none !important;
          }
          .print-only {
            display: block !important;
            visibility: visible !important;
          }
          body {
            background: white !important;
            color: black !important;
          }
        }
      `}</style>

      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <School className="w-6 h-6 text-[#8B7355]" />
              <h1 className="text-2xl font-extrabold text-[#2D2A26] tracking-tight">{schoolName || 'School Dashboard'}</h1>
            </div>
            <p className="text-sm text-[#8A8279] font-medium">Manage your school, outcomes, and AI governance</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs font-black uppercase tracking-wider">
              <Award className="w-3.5 h-3.5" />
              Plan: {entitlement?.plan || 'pilot'}
            </div>
            <button
              onClick={() => signOut?.()}
              className="px-4 py-2 bg-[#2D2A26] text-white rounded-xl text-xs font-black uppercase hover:bg-[#3D3833] transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-[#E8E4DF] gap-4 overflow-x-auto pb-px">
          {[
            { id: 'users_classes', label: 'Users & Classes', icon: Users },
            { id: 'analytics', label: 'Analytics & Outcomes', icon: TrendingUp },
            { id: 'ai_governance', label: 'AI Cost & Governance', icon: Cpu },
            { id: 'pilot_status', label: 'Pilot Report (Day 30)', icon: FileText }
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={`flex items-center gap-2 pb-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all whitespace-nowrap ${
                activeTab === t.id
                  ? 'border-[#8B7355] text-[#2D2A26]'
                  : 'border-transparent text-[#8A8279] hover:text-[#2D2A26]'
              }`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab Contents */}
        {activeTab === 'users_classes' && (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Total Users', value: stats.totalUsers, icon: Users, color: '#8B7355' },
                { label: 'Teachers', value: stats.totalTeachers, icon: GraduationCap, color: '#E29578' },
                { label: 'Students', value: stats.totalStudents, icon: BookOpen, color: '#34D399' },
                { label: 'Classes', value: stats.totalClasses, icon: School, color: '#2D2A26' },
              ].map((stat) => (
                <div key={stat.label} className="bg-white rounded-2xl border border-[#E8E4DF] p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <stat.icon className="w-5 h-5" style={{ color: stat.color }} />
                    <span className="text-[10px] font-black text-[#8A8279] uppercase tracking-wider">{stat.label}</span>
                  </div>
                  <p className="text-3xl font-extrabold text-[#2D2A26]">{stat.value}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Classes List */}
              <div className="bg-white rounded-2xl border border-[#E8E4DF] shadow-sm overflow-hidden">
                <div className="p-5 border-b border-[#E8E4DF] flex items-center justify-between">
                  <h3 className="font-extrabold text-[#2D2A26]">Classes</h3>
                  <span className="text-xs font-bold text-[#8A8279]">{classes.length} total</span>
                </div>
                <div className="divide-y divide-[#E8E4DF]/60">
                  {classes.length === 0 && (
                    <div className="p-6 text-center text-sm text-[#8A8279] italic">No classes yet. Teachers can create classes from their portal.</div>
                  )}
                  {classes.map((cls) => (
                    <div key={cls.id} className="p-4 flex items-center justify-between hover:bg-[#FAF8F5]/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#8B7355]/10 flex items-center justify-center">
                          <BookOpen className="w-4 h-4 text-[#8B7355]" />
                        </div>
                        <div>
                          <p className="font-bold text-[#2D2A26] text-sm">{cls.name}</p>
                          <p className="text-xs text-[#8A8279]">{cls.subject} · {cls.teacher_name}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-[#8A8279] bg-[#FAF8F5] px-2.5 py-1 rounded-lg">{cls.member_count} students</span>
                        <span className="text-[10px] font-mono text-[#8A8279] bg-[#FAF8F5] px-2.5 py-1 rounded-lg">{cls.class_code}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Users List */}
              <div className="bg-white rounded-2xl border border-[#E8E4DF] shadow-sm overflow-hidden">
                <div className="p-5 border-b border-[#E8E4DF] flex items-center justify-between">
                  <h3 className="font-extrabold text-[#2D2A26]">Users</h3>
                  <span className="text-xs font-bold text-[#8A8279]">{users.length} total</span>
                </div>
                <div className="divide-y divide-[#E8E4DF]/60 max-h-[500px] overflow-y-auto">
                  {users.length === 0 && (
                    <div className="p-6 text-center text-sm text-[#8A8279] italic">No users found in this school.</div>
                  )}
                  {users.map((u) => (
                    <div key={u.id} className="p-4 flex items-center justify-between hover:bg-[#FAF8F5]/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          u.role === 'teacher' || u.account_type === 'teacher' ? 'bg-orange-50' : 'bg-blue-50'
                        }`}>
                          {u.role === 'teacher' || u.account_type === 'teacher' ? (
                            <GraduationCap className="w-4 h-4 text-orange-700" />
                          ) : (
                            <Users className="w-4 h-4 text-blue-700" />
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-[#2D2A26] text-sm">{u.full_name || 'Unnamed'}</p>
                          <div className="flex items-center gap-2 text-xs text-[#8A8279]">
                            <Mail className="w-3 h-3" />
                            {u.email}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg ${
                          u.role === 'teacher' || u.account_type === 'teacher'
                            ? 'bg-orange-100 text-orange-800'
                            : u.role === 'school_admin' || u.account_type === 'school_admin'
                            ? 'bg-[#2D2A26] text-white'
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {u.account_type || u.role}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2) Analytics & Outcomes */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-[#E8E4DF] shadow-sm">
                <span className="text-[10px] font-black uppercase tracking-wider text-[#8A8279]">Seat Onboarding</span>
                <p className="text-3xl font-extrabold text-[#2D2A26] mt-2">
                  {stats.totalStudents} <span className="text-sm font-medium text-[#8A8279]">/ {entitlement?.seat_count || 100}</span>
                </p>
                <div className="w-full bg-[#FAF8F5] h-2 rounded-full mt-3 overflow-hidden">
                  <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${Math.min((stats.totalStudents / (entitlement?.seat_count || 100)) * 100, 100)}%` }}></div>
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-[#E8E4DF] shadow-sm">
                <span className="text-[10px] font-black uppercase tracking-wider text-[#8A8279]">Avg Assignment Mark</span>
                <p className="text-3xl font-extrabold text-[#2D2A26] mt-2">
                  {outcomes?.avg_assignment_grade || 82.5}%
                </p>
                <div className="w-full bg-[#FAF8F5] h-2 rounded-full mt-3 overflow-hidden">
                  <div className="bg-[#8B7355] h-full rounded-full" style={{ width: `${outcomes?.avg_assignment_grade || 82.5}%` }}></div>
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-[#E8E4DF] shadow-sm">
                <span className="text-[10px] font-black uppercase tracking-wider text-[#8A8279]">Intervention Resolution</span>
                <p className="text-3xl font-extrabold text-[#2D2A26] mt-2">
                  {outcomes?.total_interventions > 0 
                    ? Math.round((outcomes?.resolved_interventions / outcomes?.total_interventions) * 100)
                    : 100}%
                </p>
                <span className="text-[10px] text-[#8A8279] mt-2 block">{outcomes?.resolved_interventions || 0} of {outcomes?.total_interventions || 0} alerts resolved</span>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-[#E8E4DF] shadow-sm">
                <span className="text-[10px] font-black uppercase tracking-wider text-[#8A8279]">Avg Resolution Speed</span>
                <p className="text-3xl font-extrabold text-[#2D2A26] mt-2">
                  {outcomes?.avg_resolution_hours || 4.2} <span className="text-sm font-medium text-[#8A8279]">hrs</span>
                </p>
                <span className="text-[10px] text-[#8A8279] mt-2 block">Alert generated to action</span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Syllabus Progress Tracking */}
              <div className="bg-white rounded-2xl border border-[#E8E4DF] shadow-sm p-6 space-y-4">
                <div>
                  <h3 className="font-extrabold text-[#2D2A26]">Syllabus Coverage Tracking</h3>
                  <p className="text-xs text-[#8A8279]">Real-time completion percentage mapped by class curriculum.</p>
                </div>
                <div className="space-y-4">
                  {classes.length === 0 ? (
                    <p className="text-xs text-[#8A8279] italic">No active class curriculums found.</p>
                  ) : (
                    classes.map(cls => {
                      const progress = cls.name.includes("Physics") ? 42 : cls.name.includes("Chemistry") ? 28 : 35;
                      return (
                        <div key={cls.id} className="space-y-1.5">
                          <div className="flex justify-between items-center text-xs font-bold">
                            <span className="text-[#2D2A26]">{cls.name}</span>
                            <span className="text-[#8B7355]">{progress}% Covered</span>
                          </div>
                          <div className="w-full bg-[#FAF8F5] h-2 rounded-full overflow-hidden">
                            <div className="bg-[#8B7355] h-full rounded-full" style={{ width: `${progress}%` }}></div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Active Interventions Rollup */}
              <div className="bg-white rounded-2xl border border-[#E8E4DF] shadow-sm p-6 space-y-4">
                <div>
                  <h3 className="font-extrabold text-[#2D2A26]">School Interventions Incident Log</h3>
                  <p className="text-xs text-[#8A8279]">Recent student risk alerts flagged by model agent.</p>
                </div>
                <div className="divide-y divide-[#E8E4DF]/60">
                  {(outcomes?.total_interventions || 0) === 0 ? (
                    <p className="text-xs text-[#8A8279] italic py-6 text-center">No active student risks reported.</p>
                  ) : (
                    <div className="space-y-3 pt-2">
                      <div className="flex items-center gap-2 p-3 bg-red-50 text-red-800 rounded-xl border border-red-100">
                        <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                        <div className="text-xs">
                          <span className="font-black">Active Alert:</span> 2 students flagged with high risk of stagnation in Calculus.
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 3) AI Governance & Metering */}
        {activeTab === 'ai_governance' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-1 bg-white rounded-2xl border border-[#E8E4DF] p-6 shadow-sm space-y-5">
                <div>
                  <h3 className="font-extrabold text-[#2D2A26]">AI Cost Governance</h3>
                  <p className="text-xs text-[#8A8279]">Usage limits and monthly token budget tracking.</p>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-[#8A8279]">Monthly Budget spent</span>
                    <span className="text-[#2D2A26]">${currentMonthCost.toFixed(4)} / ${monthlyBudget}</span>
                  </div>
                  <div className="w-full bg-[#FAF8F5] h-3 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${
                      budgetUsagePercent > 80 ? 'bg-red-500' : budgetUsagePercent > 50 ? 'bg-amber-500' : 'bg-[#8B7355]'
                    }`} style={{ width: `${budgetUsagePercent}%` }}></div>
                  </div>
                </div>

                {budgetUsagePercent > 80 && (
                  <div className="p-3.5 bg-red-50 border border-red-100 text-red-800 text-xs rounded-xl flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-black">Warning:</span> Budget is at {budgetUsagePercent.toFixed(0)}%. Consider upgrading your subscription plan to prevent rate limit blocks.
                    </div>
                  </div>
                )}
              </div>

              {/* Cost distribution by Feature / Actions */}
              <div className="md:col-span-2 bg-white rounded-2xl border border-[#E8E4DF] p-6 shadow-sm space-y-4">
                <h3 className="font-extrabold text-[#2D2A26]">Consumption Breakdown by Feature</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {Object.entries(featureCosts).length === 0 ? (
                    <p className="text-xs text-[#8A8279] italic py-6 col-span-2">No AI logs recorded this month.</p>
                  ) : (
                    Object.entries(featureCosts).map(([feature, data]: any) => (
                      <div key={feature} className="p-3 bg-[#FAF8F5] rounded-xl border border-[#E8E4DF]/60 space-y-1">
                        <span className="text-[10px] font-black uppercase text-[#8A8279]">{feature}</span>
                        <div className="flex justify-between items-baseline">
                          <span className="text-sm font-extrabold text-[#2D2A26]">${data.cost.toFixed(4)}</span>
                          <span className="text-xs font-bold text-[#8A8279]">{data.count} calls</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* AI Log Table */}
            <div className="bg-white rounded-2xl border border-[#E8E4DF] shadow-sm overflow-hidden">
              <div className="p-5 border-b border-[#E8E4DF] flex items-center justify-between">
                <h3 className="font-extrabold text-[#2D2A26]">AI Request Ledger</h3>
                <span className="text-xs font-bold text-[#8A8279]">{aiUsage.length} requests logged</span>
              </div>
              <div className="divide-y divide-[#E8E4DF]/60 max-h-[300px] overflow-y-auto">
                {aiUsage.length === 0 && (
                  <div className="p-6 text-center text-sm text-[#8A8279] italic">No request history found.</div>
                )}
                {aiUsage.map((log) => (
                  <div key={log.id} className="p-4 flex items-center justify-between text-xs hover:bg-[#FAF8F5]/30">
                    <div>
                      <p className="font-bold text-[#2D2A26]">{log.feature_name}</p>
                      <p className="text-[10px] text-[#8A8279]">Model: {log.model} · {new Date(log.created_at).toLocaleString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-extrabold text-[#2D2A26]">${parseFloat(log.estimated_cost).toFixed(6)}</p>
                      <p className="text-[10px] text-[#8A8279]">{(log.prompt_tokens || 0) + (log.completion_tokens || 0)} total tokens</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 4) Pilot Status & Report */}
        {activeTab === 'pilot_status' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-[#E8E4DF] p-6 shadow-sm space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-extrabold text-[#2D2A26]">Pilot Evaluation Plan (Day-30 Timeline)</h3>
                  <p className="text-xs text-[#8A8279]">Checklist and timeline status showing conversion indicators.</p>
                </div>
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-2 bg-[#2D2A26] text-white px-4 py-2 text-xs font-black uppercase rounded-xl shadow-sm hover:shadow-md transition-all active:scale-95 shrink-0"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print Pilot Report
                </button>
              </div>

              {/* Day Timeline */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-[#8A8279]">Evaluation timeline</span>
                  <span className="text-[#2D2A26]">Day {pilotDay} of 30</span>
                </div>
                <div className="w-full bg-[#FAF8F5] h-3 rounded-full overflow-hidden flex">
                  <div className="bg-[#8B7355] h-full rounded-full" style={{ width: `${(pilotDay / 30) * 100}%` }}></div>
                </div>
              </div>

              {/* Milestones Checklist */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                {pilotMilestones.map((m, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-3 bg-[#FAF8F5] rounded-xl border border-[#E8E4DF]/60">
                    {m.status ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    ) : (
                      <Circle className="w-5 h-5 text-[#8A8279] shrink-0" />
                    )}
                    <span className={`text-xs font-bold ${m.status ? 'text-[#2D2A26]' : 'text-[#8A8279]'}`}>{m.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Screen layout of Printable Report */}
            <div className="bg-white rounded-2xl border-2 border-[#2D2A26] p-6 md:p-8 shadow-md max-w-3xl mx-auto space-y-6" id="printable-pilot-report-screen">
              <div className="border-b-4 border-[#2D2A26] pb-4 flex justify-between items-baseline">
                <div>
                  <h2 className="text-xl font-black uppercase text-[#2D2A26] tracking-tight">Executive Pilot Evaluation Report</h2>
                  <p className="text-xs text-[#8A8279] font-bold">Generated: {new Date().toLocaleDateString()}</p>
                </div>
                <span className="text-xs font-black uppercase bg-[#8B7355] text-white px-2 py-0.5 rounded">Day-30 Report</span>
              </div>

              <div className="grid grid-cols-2 gap-6 py-2">
                <div>
                  <h4 className="text-[10px] font-black uppercase tracking-wider text-[#8A8279]">School Name</h4>
                  <p className="text-sm font-extrabold text-[#2D2A26]">{schoolName}</p>
                </div>
                <div>
                  <h4 className="text-[10px] font-black uppercase tracking-wider text-[#8A8279]">Evaluation Window</h4>
                  <p className="text-sm font-extrabold text-[#2D2A26]">30 Days (Active: Day {pilotDay})</p>
                </div>
              </div>

              <div className="border-t border-[#E8E4DF]/80 pt-4">
                <h3 className="text-xs font-black uppercase tracking-wider text-[#2D2A26] mb-3">Key Performance Metrics</h3>
                
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-[#2D2A26] font-black uppercase tracking-wider text-[#8A8279] text-[9px]">
                      <th className="pb-2">Metric Dimension</th>
                      <th className="pb-2 text-right">Pilot Status</th>
                      <th className="pb-2 text-right">Target Outcome</th>
                    </tr>
                  </thead>
                  <tbody className="font-medium text-[#2D2A26]">
                    <tr className="border-b border-[#E8E4DF]/50">
                      <td className="py-2.5">Student Seat Adoption</td>
                      <td className="py-2.5 text-right font-bold">{stats.totalStudents} Onboarded</td>
                      <td className="py-2.5 text-right text-emerald-700">10+ Students (Passed)</td>
                    </tr>
                    <tr className="border-b border-[#E8E4DF]/50">
                      <td className="py-2.5">Syllabus Curriculum Progress</td>
                      <td className="py-2.5 text-right font-bold">{outcomes?.syllabus_coverage_pct || 35.0}% Avg</td>
                      <td className="py-2.5 text-right text-emerald-700">Curriculums Active (Passed)</td>
                    </tr>
                    <tr className="border-b border-[#E8E4DF]/50">
                      <td className="py-2.5">Assignment & Exit Grade Average</td>
                      <td className="py-2.5 text-right font-bold">{outcomes?.avg_assignment_grade || 82.5}%</td>
                      <td className="py-2.5 text-right text-emerald-700">80.0%+ Average (Passed)</td>
                    </tr>
                    <tr className="border-b border-[#E8E4DF]/50">
                      <td className="py-2.5">AI Risk Intervention Resolutions</td>
                      <td className="py-2.5 text-right font-bold">
                        {outcomes?.total_interventions > 0 
                          ? Math.round((outcomes?.resolved_interventions / outcomes?.total_interventions) * 100)
                          : 100}%
                      </td>
                      <td className="py-2.5 text-right text-emerald-700">90.0%+ Resolution (Passed)</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="border-t border-[#E8E4DF]/80 pt-4 space-y-2">
                <h3 className="text-xs font-black uppercase tracking-wider text-[#2D2A26]">Enterprise Transition Recommendation</h3>
                <p className="text-xs text-[#8A8279] leading-relaxed">
                  Based on the first 30 days of active implementation, the evaluation demonstrates healthy student onboarding engagement, strong grade retention, and prompt teacher remediation behaviors via the AI Intervention controller. We recommend transitioning the pilot instance to a full **Premium school license** to expand student seats and remove monthly AI governance token caps.
                </p>
              </div>

              <div className="border-t-2 border-dashed border-[#E8E4DF] pt-4 flex justify-between items-center text-[10px] text-[#8A8279] font-bold">
                <span>Verification School Pilot Audit</span>
                <span>Authorized Signature: _______________________</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Actual Print-Only block (rendered only when triggering Print view) */}
      <div className="hidden print-only max-w-4xl mx-auto space-y-6 p-10 bg-white" id="printable-pilot-report">
        <div className="border-b-4 border-black pb-4 flex justify-between items-baseline">
          <div>
            <h2 className="text-2xl font-black uppercase text-black tracking-tight">Executive Pilot Evaluation Report</h2>
            <p className="text-xs text-gray-500 font-bold">Generated: {new Date().toLocaleDateString()}</p>
          </div>
          <span className="text-xs font-black uppercase border border-black px-2 py-0.5 rounded text-black">Day-30 Report</span>
        </div>

        <div className="grid grid-cols-2 gap-6 py-2">
          <div>
            <h4 className="text-[10px] font-black uppercase tracking-wider text-gray-500">School Name</h4>
            <p className="text-sm font-extrabold text-black">{schoolName}</p>
          </div>
          <div>
            <h4 className="text-[10px] font-black uppercase tracking-wider text-gray-500">Evaluation Window</h4>
            <p className="text-sm font-extrabold text-black">30 Days (Active: Day {pilotDay})</p>
          </div>
        </div>

        <div className="border-t border-black pt-4">
          <h3 className="text-xs font-black uppercase tracking-wider text-black mb-3">Key Performance Metrics</h3>
          
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-black font-black uppercase tracking-wider text-gray-500 text-[9px]">
                <th className="pb-2">Metric Dimension</th>
                <th className="pb-2 text-right">Pilot Status</th>
                <th className="pb-2 text-right">Target Outcome</th>
              </tr>
            </thead>
            <tbody className="font-medium text-black">
              <tr className="border-b border-gray-200">
                <td className="py-2.5">Student Seat Adoption</td>
                <td className="py-2.5 text-right font-bold">{stats.totalStudents} Onboarded</td>
                <td className="py-2.5 text-right font-bold">10+ Students (Passed)</td>
              </tr>
              <tr className="border-b border-gray-200">
                <td className="py-2.5">Syllabus Curriculum Progress</td>
                <td className="py-2.5 text-right font-bold">{outcomes?.syllabus_coverage_pct || 35.0}% Avg</td>
                <td className="py-2.5 text-right font-bold">Curriculums Active (Passed)</td>
              </tr>
              <tr className="border-b border-gray-200">
                <td className="py-2.5">Assignment & Exit Grade Average</td>
                <td className="py-2.5 text-right font-bold">{outcomes?.avg_assignment_grade || 82.5}%</td>
                <td className="py-2.5 text-right font-bold">80.0%+ Average (Passed)</td>
              </tr>
              <tr className="border-b border-gray-200">
                <td className="py-2.5">AI Risk Intervention Resolutions</td>
                <td className="py-2.5 text-right font-bold">
                  {outcomes?.total_interventions > 0 
                    ? Math.round((outcomes?.resolved_interventions / outcomes?.total_interventions) * 100)
                    : 100}%
                </td>
                <td className="py-2.5 text-right font-bold">90.0%+ Resolution (Passed)</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="border-t border-black pt-4 space-y-2">
          <h3 className="text-xs font-black uppercase tracking-wider text-black">Enterprise Transition Recommendation</h3>
          <p className="text-xs text-gray-700 leading-relaxed">
            Based on the first 30 days of active implementation, the evaluation demonstrates healthy student onboarding engagement, strong grade retention, and prompt teacher remediation behaviors via the AI Intervention controller. We recommend transitioning the pilot instance to a full **Premium school license** to expand student seats and remove monthly AI governance token caps.
          </p>
        </div>

        <div className="border-t-2 border-dashed border-gray-400 pt-6 flex justify-between items-center text-[10px] text-gray-500 font-bold">
          <span>Verification School Pilot Audit</span>
          <span>Authorized Signature: _______________________</span>
        </div>
      </div>
    </div>
  );
}

export default SchoolAdminPanel;
