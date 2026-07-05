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
  Mail
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
      setStats({
        totalUsers: allUsers.length,
        totalTeachers: allUsers.filter(u => u.role === 'teacher' || u.account_type === 'teacher').length,
        totalStudents: allUsers.filter(u => u.role === 'student' || u.account_type?.includes('student')).length,
        totalClasses: 0
      });

      // Fetch classes taught by teachers in this school
      const teacherIds = allUsers.filter(u => u.role === 'teacher' || u.account_type === 'teacher').map(u => u.id);
      if (teacherIds.length > 0) {
        const { data: classData, error: classError } = await supabase
          .from('classes')
          .select('id, name, subject, teacher_id, class_code, created_at')
          .in('teacher_id', teacherIds)
          .order('created_at', { ascending: false });

        if (classError) throw classError;
        const classList = (classData || []) as SchoolClass[];

        // Get member counts for each class
        const enrichedClasses = await Promise.all(
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
    } catch (error: any) {
      showToast(error.message || 'Failed to load school data', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-[#00D1FF]" />
          <p className="text-sm font-medium text-[#64748B]">Loading school dashboard...</p>
        </div>
      </div>
    );
  }

  if (!schoolId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-[28px] border border-[#0A192F]/[0.06] shadow-neo-lg p-8 text-center">
          <School className="w-12 h-12 text-[#8A8279] mx-auto mb-4" />
          <h2 className="text-xl font-extrabold text-[#0A192F] mb-2">No School Linked</h2>
          <p className="text-[#64748B] text-sm">Your account is not linked to any school. Contact support if you believe this is an error.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFBFF] p-6">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <School className="w-6 h-6 text-[#6366F1]" />
              <h1 className="text-2xl font-extrabold text-[#0A192F] tracking-tight">{schoolName || 'School Dashboard'}</h1>
            </div>
            <p className="text-sm text-[#64748B] font-medium">Manage your school, teachers, and classes</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl border border-[#0A192F]/[0.06] shadow-sm">
              <BarChart3 className="w-4 h-4 text-[#00D1FF]" />
              <span className="text-xs font-bold text-[#0A192F] uppercase tracking-wider">School Admin</span>
            </div>
            <button
              onClick={() => signOut?.()}
              className="px-4 py-2 bg-[#2D2A26] text-white rounded-xl text-xs font-bold hover:bg-[#3D3833] transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Users', value: stats.totalUsers, icon: Users, color: '#00D1FF' },
            { label: 'Teachers', value: stats.totalTeachers, icon: GraduationCap, color: '#F472B6' },
            { label: 'Students', value: stats.totalStudents, icon: BookOpen, color: '#34D399' },
            { label: 'Classes', value: stats.totalClasses, icon: School, color: '#6366F1' },
          ].map((stat) => (
            <div key={stat.label} className="bg-white rounded-[20px] border border-[#0A192F]/[0.06] p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <stat.icon className="w-5 h-5" style={{ color: stat.color }} />
                <span className="text-[10px] font-bold text-[#8A8279] uppercase tracking-wider">{stat.label}</span>
              </div>
              <p className="text-3xl font-extrabold text-[#0A192F]">{stat.value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Classes List */}
          <div className="bg-white rounded-[20px] border border-[#0A192F]/[0.06] shadow-sm overflow-hidden">
            <div className="p-5 border-b border-[#0A192F]/[0.06] flex items-center justify-between">
              <h3 className="font-extrabold text-[#0A192F]">Classes</h3>
              <span className="text-xs font-bold text-[#8A8279]">{classes.length} total</span>
            </div>
            <div className="divide-y divide-[#0A192F]/[0.04]">
              {classes.length === 0 && (
                <div className="p-6 text-center text-sm text-[#64748B]">No classes yet. Teachers can create classes from their portal.</div>
              )}
              {classes.map((cls) => (
                <div key={cls.id} className="p-4 flex items-center justify-between hover:bg-[#FAFBFF] transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#6366F1]/10 flex items-center justify-center">
                      <BookOpen className="w-4 h-4 text-[#6366F1]" />
                    </div>
                    <div>
                      <p className="font-bold text-[#0A192F] text-sm">{cls.name}</p>
                      <p className="text-xs text-[#8A8279]">{cls.subject} · {cls.teacher_name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-[#64748B] bg-[#F8FAFF] px-2 py-1 rounded-lg">{cls.member_count} students</span>
                    <span className="text-[10px] font-mono text-[#8A8279] bg-[#F8FAFF] px-2 py-1 rounded-lg">{cls.class_code}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Users List */}
          <div className="bg-white rounded-[20px] border border-[#0A192F]/[0.06] shadow-sm overflow-hidden">
            <div className="p-5 border-b border-[#0A192F]/[0.06] flex items-center justify-between">
              <h3 className="font-extrabold text-[#0A192F]">Users</h3>
              <span className="text-xs font-bold text-[#8A8279]">{users.length} total</span>
            </div>
            <div className="divide-y divide-[#0A192F]/[0.04] max-h-[500px] overflow-y-auto">
              {users.length === 0 && (
                <div className="p-6 text-center text-sm text-[#64748B]">No users found in this school.</div>
              )}
              {users.map((u) => (
                <div key={u.id} className="p-4 flex items-center justify-between hover:bg-[#FAFBFF] transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      u.role === 'teacher' || u.account_type === 'teacher' ? 'bg-[#F472B6]/10' : 'bg-[#00D1FF]/10'
                    }`}>
                      {u.role === 'teacher' || u.account_type === 'teacher' ? (
                        <GraduationCap className="w-4 h-4 text-[#F472B6]" />
                      ) : (
                        <Users className="w-4 h-4 text-[#00D1FF]" />
                      )}
                    </div>
                    <div>
                      <p className="font-bold text-[#0A192F] text-sm">{u.full_name || 'Unnamed'}</p>
                      <div className="flex items-center gap-2 text-xs text-[#8A8279]">
                        <Mail className="w-3 h-3" />
                        {u.email}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg ${
                      u.role === 'teacher' || u.account_type === 'teacher'
                        ? 'bg-[#F472B6]/10 text-[#F472B6]'
                        : u.role === 'school_admin' || u.account_type === 'school_admin'
                        ? 'bg-[#6366F1]/10 text-[#6366F1]'
                        : 'bg-[#00D1FF]/10 text-[#00D1FF]'
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
    </div>
  );
}

export default SchoolAdminPanel;
