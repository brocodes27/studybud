import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, GraduationCap, Clock, ChevronRight, Sparkles, Loader2, School, Lock } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface CoachingTemplate {
  id: string;
  institute_name: string;
  program: string;
  year_level: string;
  description: string;
  total_weeks: number;
}

interface Props {
  userId: string;
  onComplete: () => void;
}

export function RoadmapOnboarding({ userId, onComplete }: Props) {
  const [templates, setTemplates] = useState<CoachingTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const [isSchoolStudent, setIsSchoolStudent] = useState(false);
  const [schoolInfo, setSchoolInfo] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      // Check if user is a school student (has active school roadmap or account_type)
      const { data: profile } = await supabase.from('user_profiles').select('account_type').eq('id', userId).single();
      const { data: schoolRoadmap } = await supabase
        .from('student_roadmaps')
        .select('id, institute_name, class_id')
        .eq('user_id', userId)
        .eq('scope', 'school')
        .eq('is_active', true)
        .maybeSingle();

      if (profile?.account_type === 'school_student' || schoolRoadmap) {
        setIsSchoolStudent(true);
        setSchoolInfo(schoolRoadmap?.institute_name || 'Your School');
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from('coaching_templates')
        .select('id, institute_name, program, year_level, description, total_weeks')
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      setTemplates((data || []) as CoachingTemplate[]);
      setLoading(false);
    }
    init();
  }, [userId]);

  const handleEnroll = async () => {
    if (!selectedId || enrolling) return;
    setEnrolling(true);

    const template = templates.find(t => t.id === selectedId);
    if (!template) return;

    // Use the canonical Edge Function instead of direct insert
    const { error } = await supabase.functions.invoke('roadmap-onboarding', {
      body: {
        template_id: template.id,
        institute_name: template.institute_name,
        program: template.program,
        year_level: template.year_level,
        batch_name: `${template.program} ${new Date().getFullYear()}`,
        current_week: 1,
      }
    });

    if (!error) {
      onComplete();
    } else {
      setEnrolling(false);
    }
  };

  const getProgramColor = (program: string) => {
    switch (program.toUpperCase()) {
      case 'JEE': return { bg: 'bg-amber-50', border: 'border-amber-200', accent: 'text-amber-700', dot: 'bg-amber-400' };
      case 'CBSE': return { bg: 'bg-sky-50', border: 'border-sky-200', accent: 'text-sky-700', dot: 'bg-sky-400' };
      default: return { bg: 'bg-emerald-50', border: 'border-emerald-200', accent: 'text-emerald-700', dot: 'bg-emerald-400' };
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#8B7355]" />
      </div>
    );
  }

  if (isSchoolStudent) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex flex-col items-center px-4 pt-12 md:pt-20 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-lg text-center"
        >
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#8B7355]/10 mb-4">
            <Lock className="w-7 h-7 text-[#8B7355]" />
          </div>
          <h1 className="text-2xl font-bold text-[#2D2A26] mb-2">School Roadmap Active</h1>
          <p className="text-sm text-[#8A8279] max-w-sm mx-auto mb-6">
            You are enrolled in <span className="font-semibold text-[#2D2A26]">{schoolInfo}</span>. Your teacher manages your study roadmap, so self-selection is disabled.
          </p>
          <div className="flex items-center justify-center gap-2 text-xs text-[#8B7355] bg-[#8B7355]/5 rounded-xl px-4 py-3">
            <School className="w-4 h-4" />
            <span className="font-medium">Curriculum locked by your school</span>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF8F5] flex flex-col items-center px-4 pt-12 md:pt-20 pb-20">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-lg"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#8B7355]/10 mb-4">
            <GraduationCap className="w-7 h-7 text-[#8B7355]" />
          </div>
          <h1 className="text-2xl font-bold text-[#2D2A26] mb-2">
            Choose your roadmap
          </h1>
          <p className="text-sm text-[#8A8279] max-w-sm mx-auto">
            Pick a study program to get daily tasks, revision plans, and personalized guidance.
          </p>
        </div>

        {/* Template Cards */}
        <div className="space-y-3 mb-8">
          <AnimatePresence>
            {templates.map((t, i) => {
              const colors = getProgramColor(t.program);
              const isSelected = selectedId === t.id;

              return (
                <motion.button
                  key={t.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: i * 0.08 }}
                  onClick={() => setSelectedId(t.id)}
                  className={`w-full text-left rounded-2xl border-2 p-4 transition-all duration-200 ${
                    isSelected
                      ? 'border-[#8B7355] bg-white shadow-md ring-2 ring-[#8B7355]/10'
                      : 'border-[#2D2A26]/[0.06] bg-white hover:border-[#2D2A26]/10 hover:shadow-sm'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Selection indicator */}
                    <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                      isSelected ? 'border-[#8B7355] bg-[#8B7355]' : 'border-[#2D2A26]/15'
                    }`}>
                      {isSelected && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="w-2 h-2 rounded-full bg-white"
                        />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Title row */}
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-[13px] font-bold text-[#2D2A26] truncate">
                          {t.institute_name}
                        </h3>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${colors.bg} ${colors.accent}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
                          {t.program}
                        </span>
                      </div>

                      {/* Description */}
                      <p className="text-[11px] text-[#8A8279] leading-relaxed line-clamp-2 mb-2">
                        {t.description}
                      </p>

                      {/* Meta chips */}
                      <div className="flex items-center gap-3 text-[10px] text-[#B5AEA5]">
                        <span className="flex items-center gap-1">
                          <BookOpen className="w-3 h-3" />
                          Class {t.year_level}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {t.total_weeks} weeks
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </AnimatePresence>
        </div>

        {/* CTA Button */}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          onClick={handleEnroll}
          disabled={!selectedId || enrolling}
          className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-[13px] font-bold transition-all duration-200 ${
            selectedId
              ? 'bg-[#2D2A26] text-white shadow-lg hover:shadow-xl active:scale-[0.98]'
              : 'bg-[#2D2A26]/10 text-[#2D2A26]/40 cursor-not-allowed'
          }`}
        >
          {enrolling ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Start this Roadmap
              <ChevronRight className="w-4 h-4" />
            </>
          )}
        </motion.button>
      </motion.div>
    </div>
  );
}
