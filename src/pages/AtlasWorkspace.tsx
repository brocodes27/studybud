import { useEffect } from 'react';
import { AIStudyBuddy } from '../components/AIStudyBuddy';
import { useLocation } from 'react-router-dom';

export function AtlasWorkspace() {
  const location = useLocation();
  const isFullscreen =
    new URLSearchParams(location.search).get('fullscreen') === '1';

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
    <div
      className={`flex w-full flex-col overflow-hidden bg-[var(--neo-bg)] ${
        isFullscreen ? 'h-screen' : 'h-[calc(100vh-4rem)] md:h-screen'
      }`}
    >
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
