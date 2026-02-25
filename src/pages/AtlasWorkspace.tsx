import { useEffect } from 'react';
import { AIStudyBuddy } from '../components/AIStudyBuddy';
import { useLocation } from 'react-router-dom';
import { BookOpen } from 'lucide-react';

export function AtlasWorkspace() {
  const location = useLocation();

  // Handle initial messages from navigation state
  useEffect(() => {
    const state = location.state as { initialMessage?: string };
    if (state?.initialMessage) {
      const timer = setTimeout(() => {
        window.dispatchEvent(new CustomEvent('trigger-atlas-chat', {
          detail: { message: state.initialMessage }
        }));
        window.history.replaceState({}, document.title);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [location]);

  return (
    <div className="h-screen bg-[#0A0F1D] flex flex-col font-sans text-slate-100 overflow-hidden">
      {/* MINIMAL HEADER */}
      <header className="flex items-center justify-between px-8 py-4 bg-[#0A0F1D]/80 backdrop-blur-xl border-b border-white/5 sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <BookOpen className="h-6 w-6 text-blue-500" />
          <h1 className="text-sm font-black tracking-[0.2em] text-white/80 uppercase">
            ATLAS NEURAL OS
          </h1>
        </div>
      </header>

      <main className="flex-1 flex justify-center items-center p-4 sm:p-6 lg:p-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-900/10 via-transparent to-transparent overflow-hidden">
        <div className="w-full max-w-[1600px] h-full bg-[#0F1629]/60 backdrop-blur-2xl border border-white/5 rounded-[40px] shadow-[0_32px_128px_-16px_rgba(0,0,0,0.7)] flex flex-col overflow-hidden relative">
          {/* Subtle Glow Effects */}
          <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none" />
          <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />

          <AIStudyBuddy
            title="Atlas"
            subtitle="Neural AI Study Buddy"
            variant="default"
            storageNamespace="atlas_core"
            hideMissionControl={false}
          />
        </div>
      </main>
    </div>
  );
}
