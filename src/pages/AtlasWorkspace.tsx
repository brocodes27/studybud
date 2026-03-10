import { useEffect } from 'react';
import { AIStudyBuddy } from '../components/AIStudyBuddy';
import { useLocation } from 'react-router-dom';

export function AtlasWorkspace() {
  const location = useLocation();

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
    <div className="h-[calc(100vh-8rem)] flex flex-col rounded-[40px] overflow-hidden border-2 border-[#0A192F]/5 shadow-float-cyan">
      <AIStudyBuddy
        title="Atlas"
        subtitle="AI Study Buddy"
        variant="default"
        storageNamespace="atlas_core"
        hideMissionControl={false}
      />
    </div>
  );
}
