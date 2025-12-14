import { AIStudyBuddy } from '../components/AIStudyBuddy';

export function AIStudyBuddyPage() {
  return (
    <div 
      className="fixed w-full h-screen -mx-6 -my-8" 
      style={{ 
        left: 'calc(var(--sidebar-width, 18rem) + var(--sidebar-gap, 1rem))',
        top: 0,
        right: 0,
        bottom: 0
      }}
    >
      <AIStudyBuddy />
    </div>
  );
}