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
    <div className="h-screen w-full flex flex-col overflow-hidden bg-[#FAF8F5]">
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
