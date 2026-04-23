import { AIStudyBuddy } from '../components/AIStudyBuddy';
import { useLocation } from 'react-router-dom';
import { useEffect, useRef } from 'react';

export function AIStudyBuddyPage() {
  const location = useLocation();
  const initialPrompt = (location.state as any)?.initialPrompt;
  const sentRef = useRef(false);

  useEffect(() => {
    if (initialPrompt && !sentRef.current) {
      sentRef.current = true;
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('trigger-atlas-chat', { 
          detail: { message: initialPrompt, voice: false } 
        }));
      }, 800);
    }
  }, [initialPrompt]);

  return <AIStudyBuddy />;
}