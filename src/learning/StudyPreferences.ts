import { createContext, useContext } from 'react';
import type { OnboardingAnswers } from '../../supabase/functions/_shared/onboarding-profile';

export type StudyPreferences = {
  goal: string;
  courses: string[];
  exam_date: string;
  daily_minutes: number;
  completed: boolean;
  onboarding_answers?: OnboardingAnswers;
};

export const StudyPreferencesContext = createContext<StudyPreferences | null>(null);
export const useStudyPreferences = () => useContext(StudyPreferencesContext);
