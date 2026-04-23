import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Brain,
  Calculator,
  FlaskConical,
  BookOpen,
  ArrowUp,
  Paperclip,
  Mic,
  LayoutTemplate,
  MonitorPlay,
  PenSquare,
  Search,
  Library,
  LayoutGrid,
} from 'lucide-react';

export function ExploreGrid() {
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState('');

  const handleGenerate = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!prompt.trim()) return;
    navigate('/ai-buddy', { state: { initialPrompt: prompt } });
  };

  const handleSample = (text: string) => {
    navigate('/ai-buddy', { state: { initialPrompt: text } });
  };

  const workspaces = [
    {
      label: 'Atlas',
      desc: 'Knowledge Atlas',
      icon: Brain,
      route: '/atlas',
      bg: 'bg-[#F5F0E8]',
      border: 'border-[#E8E2D9]',
      iconColor: 'text-[#8B7355]',
      labelColor: 'text-[#2D2A26]',
    },
    {
      label: 'Engine',
      desc: 'Study Engine',
      icon: Calculator,
      route: '/plans',
      bg: 'bg-[#F5F0E8]',
      border: 'border-[#E8E2D9]',
      iconColor: 'text-[#8B7355]',
      labelColor: 'text-[#2D2A26]',
    },
    {
      label: 'Simulator',
      desc: 'Exam Simulator',
      icon: FlaskConical,
      route: '/sat-simulator',
      bg: 'bg-[#F5F0E8]',
      border: 'border-[#E8E2D9]',
      iconColor: 'text-[#8B7355]',
      labelColor: 'text-[#2D2A26]',
    },
  ];

  const quickActions = [
    { icon: PenSquare, label: 'New Session', route: '/atlas', color: 'text-[#8B7355]' },
    { icon: Search, label: 'Search', route: '/atlas', color: 'text-[#8B7355]' },
    { icon: Library, label: 'Library', route: '/plans', color: 'text-[#8B7355]' },
    { icon: MonitorPlay, label: 'Videos', route: '/videos', color: 'text-[#8B7355]' },
    { icon: LayoutGrid, label: 'Atlas', route: '/atlas', color: 'text-[#8B7355]' },
    { icon: BookOpen, label: 'Curriculum', route: '/curriculum', color: 'text-[#8B7355]' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="w-full max-w-3xl mx-auto pb-20"
    >
      {/* AI Prompt Box */}
      <div className="mb-10">
        <h2 className="text-2xl md:text-3xl font-semibold text-[#2D2A26] mb-8 tracking-tight text-center"
          style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
          What can I do for you?
        </h2>

        <div className="w-full bg-white rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.03)] border border-[#E8E2D9] p-2 transition-all hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
          <form onSubmit={handleGenerate} className="flex flex-col">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Create a 5 page pastel minimalist slide presentation..."
              className="w-full min-h-[120px] resize-none focus:outline-none p-4 text-[#2D2A26] placeholder-[#B5AEA5] font-sans text-[15px] leading-relaxed bg-transparent"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleGenerate();
                }
              }}
            />
            <div className="flex items-center justify-between p-2 mt-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="w-9 h-9 rounded-full flex items-center justify-center text-[#8A8279] hover:bg-[#F5F0E8] hover:text-[#2D2A26] transition-colors"
                >
                  <Paperclip className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-full flex items-center gap-1.5 text-[#8A8279] hover:bg-[#F5F0E8] text-xs font-semibold font-sans border border-[#E8E2D9] transition-colors"
                >
                  <LayoutTemplate className="w-3.5 h-3.5 text-[#8B7355]" />
                  Slides
                </button>
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-full flex items-center gap-1.5 text-[#8A8279] hover:bg-[#F5F0E8] text-xs font-semibold font-sans border border-[#E8E2D9] transition-colors"
                >
                  <MonitorPlay className="w-3.5 h-3.5 text-[#8B7355]" />
                  StudyBud Pro
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="w-9 h-9 rounded-full flex items-center justify-center text-[#8A8279] hover:bg-[#F5F0E8] hover:text-[#2D2A26] transition-colors"
                >
                  <Mic className="w-4 h-4" />
                </button>
                <button
                  type="submit"
                  disabled={!prompt.trim()}
                  className="w-9 h-9 rounded-full flex items-center justify-center bg-[#2D2A26] text-white hover:bg-[#3D3833] disabled:opacity-50 disabled:bg-[#E8E2D9] disabled:text-[#8A8279] transition-all"
                >
                  <ArrowUp className="w-4 h-4" />
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Sample Prompts */}
      <div className="mb-10">
        <h3 className="text-sm font-semibold text-[#2D2A26] mb-4">Sample prompts</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            'Create a diagnostic test for Kinematics.',
            'Analyze my weakest topics from yesterday.',
            'Find video explanations for Newton\'s Laws.',
            'Generate a 5-day intensive revision plan.',
          ].map((text, i) => (
            <button
              key={i}
              onClick={() => handleSample(text)}
              className="bg-white border border-[#E8E2D9] p-4 rounded-2xl text-left text-[13px] text-[#8A8279] hover:border-[#8B7355]/30 hover:shadow-sm transition-all group relative min-h-[80px] flex flex-col"
            >
              <span className="leading-snug">{text}</span>
              <ArrowUp className="w-3.5 h-3.5 absolute bottom-4 right-4 text-[#B5AEA5] group-hover:text-[#2D2A26] transform rotate-45 transition-colors" />
            </button>
          ))}
        </div>
      </div>

      {/* Workspaces */}
      <div className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-[#2D2A26]">Choose a workspace</h3>
          <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#E8E2D9] text-xs font-semibold text-[#8A8279]">
            <MonitorPlay className="w-3.5 h-3.5" /> Media View
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {workspaces.map((ws) => (
            <button key={ws.label} onClick={() => navigate(ws.route)} className="text-left group">
              <div
                className={`h-32 ${ws.bg} border ${ws.border} rounded-2xl mb-3 flex flex-col items-center justify-center gap-2 group-hover:border-[#8B7355]/30 transition-colors`}
              >
                <ws.icon className={`w-8 h-8 ${ws.iconColor}`} />
                <span className={`text-xs font-semibold ${ws.labelColor}`}>{ws.desc}</span>
              </div>
              <p className="text-[13px] font-semibold text-[#2D2A26] text-center">{ws.label}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h3 className="text-sm font-semibold text-[#2D2A26] mb-4">Quick Actions</h3>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {quickActions.map((action) => (
            <button
              key={action.label}
              onClick={() => navigate(action.route)}
              className="flex flex-col items-center gap-2 p-4 bg-white border border-[#E8E2D9] rounded-2xl hover:border-[#8B7355]/30 hover:shadow-sm transition-all"
            >
              <action.icon className={`w-5 h-5 ${action.color}`} />
              <span className="text-[11px] font-semibold text-[#2D2A26]">{action.label}</span>
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
