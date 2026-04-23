import { motion } from 'framer-motion';
import { Bell, FileText, BookOpen, Megaphone, GraduationCap } from 'lucide-react';
import type { ClassUpdate } from '../../lib/dailyBriefing';

interface ClassUpdateCardProps {
  update: ClassUpdate;
}

const subjectColors: Record<string, string> = {
  Physics: 'bg-[#6366F1]/10 text-[#6366F1] border-[#6366F1]/20',
  Chemistry: 'bg-[#34D399]/10 text-[#059669] border-[#34D399]/20',
  Mathematics: 'bg-[#F59E0B]/10 text-[#D97706] border-[#F59E0B]/20',
  Math: 'bg-[#F59E0B]/10 text-[#D97706] border-[#F59E0B]/20',
  Biology: 'bg-[#F472B6]/10 text-[#DB2777] border-[#F472B6]/20',
  English: 'bg-[#00D1FF]/10 text-[#0284C7] border-[#00D1FF]/20',
};

function getSubjectBadgeClass(subject: string) {
  return subjectColors[subject] || 'bg-[#94A3B8]/10 text-[#64748B] border-[#94A3B8]/20';
}

const typeConfig = {
  class_session: { icon: GraduationCap, color: 'text-[#6366F1]', bg: 'bg-[#6366F1]/[0.06]', border: 'border-[#6366F1]/10' },
  announcement: { icon: Megaphone, color: 'text-[#6366F1]', bg: 'bg-[#6366F1]/[0.06]', border: 'border-[#6366F1]/10' },
  assignment_due: { icon: FileText, color: 'text-[#F59E0B]', bg: 'bg-[#F59E0B]/[0.06]', border: 'border-[#F59E0B]/10' },
  meeting_note: { icon: BookOpen, color: 'text-[#34D399]', bg: 'bg-[#34D399]/[0.06]', border: 'border-[#34D399]/10' },
  none: { icon: Bell, color: 'text-[#94A3B8]', bg: 'bg-[#F1F5F9]', border: 'border-[#E2E8F0]' },
};

export function ClassUpdateCard({ update }: ClassUpdateCardProps) {
  const config = typeConfig[update.type] || typeConfig.none;
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.5 }}
      className="w-full max-w-xl"
    >
      <div className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider mb-2 ml-1">
        {update.type === 'class_session' ? 'What happened in class today' : 'Class updates'}
      </div>

      <div
        className={`bg-white rounded-2xl border ${config.border} shadow-neo-sm p-5 hover:shadow-neo transition-shadow`}
      >
        {update.type === 'none' ? (
          <div className="flex items-center gap-3 text-[#94A3B8]">
            <div className={`w-10 h-10 rounded-xl ${config.bg} flex items-center justify-center`}>
              <Icon className={`w-5 h-5 ${config.color}`} />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#64748B]">No new class updates</p>
              <p className="text-xs text-[#94A3B8]">You're all caught up. Focus on your revision!</p>
            </div>
          </div>
        ) : update.type === 'class_session' && update.sessions ? (
          <div className="space-y-4">
            {update.sessions.map((session, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-xl ${config.bg} flex items-center justify-center shrink-0`}>
                  <Icon className={`w-5 h-5 ${config.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getSubjectBadgeClass(session.subject)}`}>
                      {session.subject}
                    </span>
                    <span className="text-[10px] font-medium text-[#94A3B8]">{update.source}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-1.5">
                    {session.topics.map((topic, j) => (
                      <span key={j} className="text-[11px] font-medium text-[#475569] bg-[#F1F5F9] px-2 py-0.5 rounded-md">
                        {topic}
                      </span>
                    ))}
                  </div>
                  {session.homework && (
                    <p className="text-[11px] text-[#94A3B8] font-medium">
                      📝 {session.homework}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-xl ${config.bg} flex items-center justify-center shrink-0 mt-0.5`}>
              <Icon className={`w-5 h-5 ${config.color}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold text-[#0A192F] truncate">
                  {update.type === 'announcement' ? 'Announcement' : update.title}
                </span>
                <span className="text-[10px] font-medium text-[#94A3B8] shrink-0">{update.source}</span>
              </div>
              <p className="text-sm text-[#475569] leading-relaxed line-clamp-3">{update.content}</p>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
