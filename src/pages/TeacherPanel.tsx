import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { Plus, Users, BookOpen, X, Loader2, GraduationCap, Lock, Layers, Upload, Copy, Check } from 'lucide-react';

interface CoachingTemplate {
  id: string;
  institute_name: string;
  program: string;
  year_level: string;
  description: string;
  total_weeks: number;
}

const TeacherPanel: React.FC = () => {
  const { user, role, loading } = useAuth() as any;
  const isTeacher = role === 'teacher';
  const [classes, setClasses] = useState<any[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newClassSubject, setNewClassSubject] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<{ code: string; link: string } | null>(null);
  const [curriculumSource, setCurriculumSource] = useState<'template' | 'upload' | 'custom'>('template');
  const [templates, setTemplates] = useState<CoachingTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [customJson, setCustomJson] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!showCreateModal) return;
    supabase
      .from('coaching_templates')
      .select('id, institute_name, program, year_level, description, total_weeks')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setTemplates((data || []) as CoachingTemplate[]);
        if (data && data.length > 0) setSelectedTemplateId(data[0].id);
      });
  }, [showCreateModal]);

  useEffect(() => {
    const fetchClasses = async () => {
      setLoadingClasses(true);
      if (!user) return;
      const { data, error } = await supabase
        .from('classes')
        .select('id, name, teacher_id, subject, class_code, invite_link, curriculum_source, template_id')
        .eq('teacher_id', user.id);

      if (error) {
        setLoadingClasses(false);
        return;
      }

      const classesWithCounts = await Promise.all(
        data.map(async (cls) => {
          const { count, error: countError } = await supabase
            .from('class_members')
            .select('*', { count: 'exact', head: true })
            .eq('class_id', cls.id);

          return {
            ...cls,
            student_count: countError ? 0 : count,
          };
        })
      );

      setClasses(classesWithCounts);
      setLoadingClasses(false);
    };
    if (role === 'teacher') fetchClasses();
  }, [user, role, showCreateModal]);

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    setCreateSuccess(null);
    if (!newClassName.trim()) {
      setCreateError('Class name is required.');
      setCreating(false);
      return;
    }
    if (!newClassSubject.trim()) {
      setCreateError('Subject is required.');
      setCreating(false);
      return;
    }
    if (curriculumSource === 'custom' || (!selectedTemplateId && !customJson.trim())) {
      setCreateError('Please select a coaching template or upload a custom curriculum JSON.');
      setCreating(false);
      return;
    }

    let templateId: string | null = null;
    if (curriculumSource === 'template') {
      templateId = selectedTemplateId;
      if (!templateId) {
        setCreateError('Please select a coaching template.');
        setCreating(false);
        return;
      }
    } else if (curriculumSource === 'upload') {
      try {
        JSON.parse(customJson);
      } catch {
        setCreateError('Invalid JSON curriculum. Please fix and try again.');
        setCreating(false);
        return;
      }
    }

    const { data, error } = await supabase.rpc('create_class', {
      p_name: newClassName.trim(),
      p_subject: newClassSubject.trim(),
      p_template_id: templateId,
    });

    if (error || !data || data.length === 0) {
      setCreateError(error?.message || 'Failed to create class.');
      setCreating(false);
      return;
    }

    const created = data[0];

    if (curriculumSource === 'upload' && customJson.trim()) {
      await supabase.from('classes').update({
        curriculum_source: 'upload',
        custom_curriculum: JSON.parse(customJson),
      }).eq('id', created.id);
    }

    setCreateSuccess({ code: created.class_code, link: created.invite_link });
    setClasses((prev: any[]) => [...prev, {
      id: created.id,
      name: newClassName.trim(),
      subject: newClassSubject.trim(),
      class_code: created.class_code,
      invite_link: created.invite_link,
      curriculum_source: curriculumSource === 'template' ? 'template' : curriculumSource,
      student_count: 0,
      template_id: templateId,
    }]);
    setNewClassName('');
    setNewClassSubject('');
    setCustomJson('');
    setCreating(false);
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 1500);
  };

  const handleCopyLink = (link: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/join/${link}`);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 1500);
  };

  const resetModal = () => {
    setShowCreateModal(false);
    setCreateSuccess(null);
    setCreateError(null);
    setCurriculumSource('template');
    setCustomJson('');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#8B7355]"></div>
      </div>
    );
  }

  if (role !== 'teacher') {
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl border border-red-200 text-center max-w-md shadow-sm">
          <h2 className="text-2xl font-bold text-red-500 mb-2">Access Denied</h2>
          <p className="text-[#8A8279]">You must be a teacher to access this panel.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF8F5] pb-20">
      <div className="bg-white border-b border-[#E8E4DF] sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="bg-[#8B7355]/10 p-3 rounded-2xl">
                <GraduationCap className="h-8 w-8 text-[#8B7355] stroke-[2.5px]" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-[#2D2A26] leading-none">Teacher Hub</h1>
                <p className="text-sm text-[#8A8279] mt-1">Classroom management</p>
              </div>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-[#2D2A26] text-white px-5 py-2.5 font-bold rounded-[14px] shadow-sm hover:shadow-md active:scale-95 transition-all flex items-center gap-2"
            >
              <Plus className="h-5 w-5 stroke-[2.5px]" /> Create Class
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {!isTeacher ? (
          <div className="text-center py-20 bg-white rounded-2xl border-2 border-[#2D2A26]/[0.06] border-dashed">
            <div className="w-20 h-20 bg-[#F5F0E8] rounded-2xl mx-auto mb-6 flex items-center justify-center">
              <Lock className="h-8 w-8 text-[#8B7355] stroke-[2.5px]" />
            </div>
            <h3 className="text-2xl font-bold text-[#2D2A26] mb-2">Access Denied</h3>
            <p className="text-[#8A8279] max-w-xl mx-auto">
              You must be a verified instructor to access this panel.
            </p>
          </div>
        ) : loading || loadingClasses ? (
          <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
            <div className="w-10 h-10 border-2 border-[#E8E4DF] border-t-[#8B7355] rounded-full animate-spin" />
            <p className="text-[#8A8279]">Loading classes...</p>
          </div>
        ) : classes.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border-2 border-[#2D2A26]/[0.06] border-dashed">
            <div className="w-20 h-20 bg-[#F5F0E8] rounded-2xl mx-auto mb-6 flex items-center justify-center">
              <BookOpen className="h-8 w-8 text-[#8B7355] stroke-[2.5px]" />
            </div>
            <h3 className="text-2xl font-bold text-[#2D2A26] mb-2">No Classes Yet</h3>
            <p className="text-[#8A8279] max-w-xl mx-auto">
              Create your first class to start managing students and sharing curricula.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {classes.map((cls) => (
              <div
                key={cls.id}
                onClick={() => navigate(`/teacher/class/${cls.id}`)}
                className="bg-white rounded-2xl border-2 border-[#2D2A26]/[0.06] p-6 shadow-sm hover:shadow-md transition-all cursor-pointer group relative"
              >
                <div className="absolute top-4 right-4 bg-[#00D1FF]/10 text-[#00D1FF] px-2.5 py-1 text-xs font-bold rounded-lg">
                  Active
                </div>

                <div className="flex items-center gap-4 mb-5">
                  <div className="w-14 h-14 bg-[#F5F0E8] rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Users className="h-7 w-7 text-[#8B7355] stroke-[2.5px]" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-[#2D2A26] line-clamp-1">{cls.name}</h3>
                    <p className="text-sm text-[#8A8279]">{cls.subject}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-[#8A8279]">Code:</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleCopyCode(cls.class_code); }}
                      className="bg-[#F5F0E8] text-[#2D2A26] px-2 py-1 text-xs font-mono font-bold rounded-lg flex items-center gap-1 hover:bg-[#E8E4DF] transition-colors"
                    >
                      {cls.class_code || '—'}
                      {copiedCode ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                  <div className="text-xs font-medium text-[#8A8279]">
                    {cls.student_count ?? 0} students
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {cls.curriculum_source === 'template' && (
                    <span className="text-[10px] font-bold bg-[#8B7355]/10 text-[#8B7355] px-2 py-1 rounded-md">Template</span>
                  )}
                  {cls.curriculum_source === 'upload' && (
                    <span className="text-[10px] font-bold bg-emerald-50 text-emerald-600 px-2 py-1 rounded-md">Custom Upload</span>
                  )}
                  {cls.invite_link && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleCopyLink(cls.invite_link); }}
                      className="text-[10px] font-bold bg-[#F5F0E8] text-[#2D2A26] px-2 py-1 rounded-md hover:bg-[#E8E4DF] transition-colors flex items-center gap-1"
                    >
                      <Copy className="w-3 h-3" /> Invite Link
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create Class Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2D2A26]/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-lg p-8 shadow-lg relative max-h-[90vh] overflow-y-auto">
              <button
                onClick={resetModal}
                className="absolute top-4 right-4 text-[#8A8279] hover:text-[#2D2A26] transition-colors"
              >
                <X className="h-6 w-6 stroke-[2.5px]" />
              </button>

              {!createSuccess ? (
                <>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="bg-[#00D1FF]/10 p-2 rounded-xl">
                      <Plus className="h-5 w-5 text-[#00D1FF] stroke-[2.5px]" />
                    </div>
                    <h2 className="text-xl font-bold text-[#2D2A26]">Create a new class</h2>
                  </div>

                  <form onSubmit={handleCreateClass} className="space-y-5">
                    <div>
                      <label className="block text-sm font-bold text-[#2D2A26] mb-1.5">Class Name</label>
                      <input
                        type="text"
                        required
                        value={newClassName}
                        onChange={(e) => setNewClassName(e.target.value)}
                        className="w-full bg-[#F8FAFF] rounded-[14px] border border-[#E8E4DF] px-4 py-3 font-medium text-[#2D2A26] focus:outline-none focus:ring-2 focus:ring-[#8B7355]/20 transition-all placeholder:text-[#8A8279]/50"
                        placeholder="e.g. JEE Advanced Physics"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-[#2D2A26] mb-1.5">Subject</label>
                      <select
                        className="w-full bg-[#F8FAFF] rounded-[14px] border border-[#E8E4DF] px-4 py-3 font-medium text-[#2D2A26] focus:outline-none focus:ring-2 focus:ring-[#8B7355]/20 appearance-none"
                        value={newClassSubject}
                        onChange={e => setNewClassSubject(e.target.value)}
                        disabled={creating}
                        required
                      >
                        <option value="">Select Subject</option>
                        <option value="Mathematics">Mathematics</option>
                        <option value="Physics">Physics</option>
                        <option value="Chemistry">Chemistry</option>
                        <option value="Biology">Biology</option>
                        <option value="Computer Science">Computer Science</option>
                        <option value="English">English</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-[#2D2A26] mb-2">Curriculum Source</label>
                      <div className="bg-[#F8FAFF] p-1 rounded-[14px] flex">
                        <button
                          type="button"
                          onClick={() => setCurriculumSource('template')}
                          className={`flex-1 py-2.5 rounded-[12px] text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${curriculumSource === 'template' ? 'bg-white text-[#00D1FF] shadow-sm' : 'text-[#64748B]'}`}
                        >
                          <Layers className="w-4 h-4" />
                          Pick Template
                        </button>
                        <button
                          type="button"
                          onClick={() => setCurriculumSource('upload')}
                          className={`flex-1 py-2.5 rounded-[12px] text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${curriculumSource === 'upload' ? 'bg-white text-[#00D1FF] shadow-sm' : 'text-[#64748B]'}`}
                        >
                          <Upload className="w-4 h-4" />
                          Upload JSON
                        </button>
                      </div>
                    </div>

                    {curriculumSource === 'template' && (
                      <div className="space-y-2">
                        <label className="block text-sm font-bold text-[#2D2A26]">Select a Roadmap Template</label>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {templates.length === 0 ? (
                            <p className="text-sm text-[#8A8279]">No templates available.</p>
                          ) : (
                            templates.map((t) => (
                              <button
                                key={t.id}
                                type="button"
                                onClick={() => setSelectedTemplateId(t.id)}
                                className={`w-full text-left rounded-xl border-2 p-3 transition-all ${selectedTemplateId === t.id ? 'border-[#8B7355] bg-white shadow-sm ring-2 ring-[#8B7355]/10' : 'border-[#2D2A26]/[0.06] bg-[#F8FAFF] hover:border-[#2D2A26]/10 hover:shadow-sm'}`}
                              >
                                <div className="flex items-center gap-3">
                                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${selectedTemplateId === t.id ? 'border-[#8B7355] bg-[#8B7355]' : 'border-[#2D2A26]/15'}`}>
                                    {selectedTemplateId === t.id && <Check className="w-3 h-3 text-white" />}
                                  </div>
                                  <div>
                                    <p className="font-bold text-[#2D2A26] text-sm">{t.institute_name}</p>
                                    <p className="text-xs text-[#8A8279]">{t.program} · {t.total_weeks} weeks</p>
                                  </div>
                                </div>
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    )}

                    {curriculumSource === 'upload' && (
                      <div>
                        <label className="block text-sm font-bold text-[#2D2A26] mb-1.5">Paste Custom Curriculum JSON</label>
                        <textarea
                          value={customJson}
                          onChange={(e) => setCustomJson(e.target.value)}
                          rows={6}
                          className="w-full bg-[#F8FAFF] rounded-[14px] border border-[#E8E4DF] px-4 py-3 font-mono text-xs text-[#2D2A26] focus:outline-none focus:ring-2 focus:ring-[#8B7355]/20 transition-all placeholder:text-[#8A8279]/50"
                          placeholder='{"weekly_schedule": [...]}'
                        />
                      </div>
                    )}


                    {createError && (
                      <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-sm font-bold text-red-600">
                        {createError}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={creating || (curriculumSource === 'template' && !selectedTemplateId) || (curriculumSource === 'upload' && !customJson.trim())}
                      className="w-full bg-[#2D2A26] text-white py-3 font-bold rounded-[14px] shadow-sm hover:shadow-md active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {creating ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin" /> Creating...
                        </>
                      ) : (
                        'Create Class'
                      )}
                    </button>
                  </form>
                </>
              ) : (
                <div className="text-center py-6">
                  <div className="w-16 h-16 bg-[#8B7355]/10 rounded-2xl mx-auto mb-4 flex items-center justify-center">
                    <Check className="w-8 h-8 text-[#8B7355] stroke-[2.5px]" />
                  </div>
                  <h3 className="text-xl font-bold text-[#2D2A26] mb-2">Class Created!</h3>
                  <p className="text-sm text-[#8A8279] mb-6">Share this code or link with your students.</p>

                  <div className="space-y-4">
                    <div className="bg-[#F5F0E8] rounded-xl p-4">
                      <p className="text-xs font-bold text-[#8A8279] mb-2 uppercase tracking-wide">Class Code</p>
                      <div className="flex items-center gap-3">
                        <code className="text-2xl font-mono font-black text-[#2D2A26]">{createSuccess.code}</code>
                        <button
                          onClick={() => { navigator.clipboard.writeText(createSuccess.code); setCopiedCode(true); setTimeout(() => setCopiedCode(false), 1500); }}
                          className="bg-white px-3 py-1.5 rounded-lg text-sm font-bold text-[#2D2A26] shadow-sm hover:shadow-md transition-all flex items-center gap-1"
                        >
                          {copiedCode ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                          Copy
                        </button>
                      </div>
                    </div>

                    <div className="bg-[#F5F0E8] rounded-xl p-4">
                      <p className="text-xs font-bold text-[#8A8279] mb-2 uppercase tracking-wide">Invite Link</p>
                      <div className="flex items-center gap-3">
                        <code className="text-sm font-mono font-bold text-[#2D2A26] truncate flex-1">{window.location.origin}/join/{createSuccess.link}</code>
                        <button
                          onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/join/${createSuccess.link}`); setCopiedCode(true); setTimeout(() => setCopiedCode(false), 1500); }}
                          className="bg-white px-3 py-1.5 rounded-lg text-sm font-bold text-[#2D2A26] shadow-sm hover:shadow-md transition-all flex items-center gap-1"
                        >
                          {copiedCode ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                          Copy
                        </button>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={resetModal}
                    className="mt-6 w-full bg-[#2D2A26] text-white py-3 font-bold rounded-[14px] shadow-sm hover:shadow-md active:scale-95 transition-all"
                  >
                    Done
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TeacherPanel;