import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import LessonCard from '../components/LessonCard';
import ModuleProgress from '../components/ModuleProgress';
import ProgressTracker from '../components/ProgressTracker';
import LessonInterface from '../components/LessonInterface';
import VoiceLectureInterface from '../components/VoiceLectureInterface';

interface Lesson {
  id: string;
  title: string;
  description: string;
  type: 'theory' | 'exercise' | 'quiz' | 'review' | 'challenge';
  isLocked: boolean;
  isCompleted: boolean;
  xpReward: number;
  estimatedTime: number;
  difficulty: 'easy' | 'medium' | 'hard' | 'expert' | 'master';
  accuracy?: number;
  dayNumber?: number;
  date?: string;
}

interface Module {
  id: string;
  title: string;
  description: string;
  lessons: Lesson[];
  isLocked: boolean;
  isCompleted: boolean;
  xpReward: number;
}

interface StudyPlan {
  id: string;
  title: string;
  subject: string;
  modules: Module[];
  totalXP: number;
  currentStreak: number;
  level: number;
  xpToNextLevel: number;
  totalXpForLevel: number;
  weeklyGoal: number;
  weeklyProgress: number;
}

const DuolingoStyleLearning: React.FC = () => {
  const { user } = useAuth() as any;
  const [selectedPlan, setSelectedPlan] = useState<StudyPlan | null>(null);
  const [selectedModule, setSelectedModule] = useState<Module | null>(null);
  const [view, setView] = useState<'overview' | 'module' | 'lesson'>('overview');
  const [currentLesson, setCurrentLesson] = useState<Lesson | null>(null);
  const [showLessonInterface, setShowLessonInterface] = useState(false);
  const [showVoiceLecture, setShowVoiceLecture] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [achievements] = useState([
    {
      id: 'first_lesson',
      title: 'First Steps',
      description: 'Complete your first lesson',
      icon: '🎯',
      isUnlocked: true,
      unlockedAt: new Date('2024-01-15')
    },
    {
      id: 'streak_3',
      title: 'On Fire!',
      description: 'Maintain a 3-day streak',
      icon: '🔥',
      isUnlocked: true,
      unlockedAt: new Date('2024-01-18')
    },
    {
      id: 'perfect_score',
      title: 'Perfect Score',
      description: 'Get 100% on any quiz',
      icon: '⭐',
      isUnlocked: false
    },
    {
      id: 'speed_learner',
      title: 'Speed Learner',
      description: 'Complete 5 lessons in one day',
      icon: '⚡',
      isUnlocked: false
    }
  ]);

  // Fetch real data from database
  useEffect(() => {
    const fetchUserData = async () => {
      if (!user) {
        setError('User not authenticated');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Fetch user progress and study plans
        const { data: userProgress, error: progressError } = await supabase
          .from('user_progress')
          .select('*')
          .eq('user_id', user.id);

        if (progressError) {
          console.error('Error fetching user progress:', progressError);
        }

        // Fetch voice lectures data
        const { data: voiceLectures, error: lecturesError } = await supabase
          .from('voice_lectures')
          .select('*')
          .eq('user_id', user.id);

        if (lecturesError) {
          console.error('Error fetching voice lectures:', lecturesError);
        }

        // Fetch user's study plans
        const { data: studyPlans, error: plansError } = await supabase
          .from('exam_plans')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (plansError) {
          console.error('Error fetching study plans:', plansError);
        }

        // Calculate XP and progress from real data
        const totalXP = (userProgress || []).reduce((sum, progress) => sum + (progress.xp_earned || 0), 0);
        const completedLessons = (userProgress || []).filter(p => p.completed_at).length;
        const currentStreak = calculateStreak(userProgress || []);
        const level = Math.floor(totalXP / 1000) + 1;
        const xpToNextLevel = totalXP % 1000;
        const totalXpForLevel = 1000;

        // Create study plan with real data
        const modules = await generateModulesFromProgress(userProgress || [], voiceLectures || [], studyPlans || []);
        
        console.log('Generated modules:', modules);
        console.log('User progress:', userProgress);
        console.log('Voice lectures:', voiceLectures);
        console.log('Study plans:', studyPlans);
        
        const studyPlan: StudyPlan = {
          id: 'physics-fundamentals',
          title: 'Physics Fundamentals',
          subject: 'Physics',
          totalXP,
          currentStreak,
          level,
          xpToNextLevel,
          totalXpForLevel,
          weeklyGoal: 500,
          weeklyProgress: calculateWeeklyProgress(userProgress || []),
          modules
        };

        setSelectedPlan(studyPlan);
      } catch (error) {
        console.error('Error fetching user data:', error);
        setError('Failed to load learning data');
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [user]);

  const calculateStreak = (progress: any[]): number => {
    if (!progress.length) return 0;
    
    const sortedProgress = progress
      .filter(p => p.completed_at)
      .sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime());
    
    let streak = 0;
    let currentDate = new Date();
    
    for (const item of sortedProgress) {
      const itemDate = new Date(item.completed_at);
      const daysDiff = Math.floor((currentDate.getTime() - itemDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysDiff <= 1) {
        streak++;
        currentDate = itemDate;
      } else {
        break;
      }
    }
    
    return streak;
  };

  const calculateWeeklyProgress = (progress: any[]): number => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    return progress
      .filter(p => p.completed_at && new Date(p.completed_at) >= weekAgo)
      .reduce((sum, p) => sum + (p.xp_earned || 0), 0);
  };

  const generateModulesFromProgress = async (progress: any[], voiceLectures: any[], studyPlans: any[]): Promise<Module[]> => {
    try {
      console.log('Generating modules from study plans...');
      console.log('Study plans:', studyPlans);
      console.log('User progress:', progress);
      console.log('Voice lectures:', voiceLectures);

      if (!studyPlans || studyPlans.length === 0) {
        console.log('No study plans found, creating default modules...');
        return createDefaultModules();
      }

      // Convert study plans to modules
      return studyPlans.map((plan, planIndex) => {
        const planId = plan.id;
        const planProgress = progress.filter(p => p.plan_id === planId);
        
        // Convert daily schedule topics to lessons
        const lessons = plan.plan.daily_schedule.map((day: any, dayIndex: number) => {
          const lessonProgress = planProgress.find(p => p.day_number === day.day);
          const voiceLecture = voiceLectures.find(v => v.plan_id === planId && v.day_number === day.day);
          
          return {
            id: `${planId}-day-${day.day}`,
            title: day.topic,
            description: day.description || `Study session for ${day.topic}`,
            type: 'theory' as const,
            xpReward: 50 + (dayIndex * 10), // More XP for later days
            estimatedTime: 30, // 30 minutes per session
            difficulty: dayIndex < 3 ? 'easy' as const : dayIndex < 7 ? 'medium' as const : 'hard' as const,
            isLocked: false,
            isCompleted: !!lessonProgress?.completed_at,
            accuracy: lessonProgress?.accuracy || voiceLecture?.accuracy || 0,
            dayNumber: day.day,
            date: day.date
          };
        });

        const completedLessons = planProgress.filter(p => p.completed_at).length;
        const totalLessons = lessons.length;
        const isCompleted = completedLessons === totalLessons;
        const isLocked = planIndex > 0; // Lock plans after the first one

        return {
          id: planId,
          title: `${plan.subject} - ${plan.class}`,
          description: `Exam on ${new Date(plan.exam_date).toLocaleDateString()}`,
          lessons,
          isLocked,
          isCompleted,
          xpReward: lessons.reduce((sum: number, lesson: any) => sum + lesson.xpReward, 0)
        };
      });
    } catch (error) {
      console.error('Error generating modules from study plans:', error);
      return [];
    }
  };

  const getModuleTitle = (moduleId: string): string => {
    const titles: Record<string, string> = {
      'mechanics': 'Mechanics',
      'waves': 'Waves & Oscillations',
      'electricity': 'Electricity & Circuits'
    };
    return titles[moduleId] || 'Physics Module';
  };

  const getModuleDescription = (moduleId: string): string => {
    const descriptions: Record<string, string> = {
      'mechanics': 'Learn about motion, forces, and energy',
      'waves': 'Study wave phenomena and oscillations',
      'electricity': 'Master electrical concepts and circuits'
    };
    return descriptions[moduleId] || 'Explore physics concepts';
  };

  const createDefaultModules = (): Module[] => {
    return [
      {
        id: 'mechanics',
        title: 'Mechanics',
        description: 'Learn about motion, forces, and energy',
        lessons: [
          {
            id: 'motion-basics',
            title: 'Motion Basics',
            description: 'Understand the fundamentals of motion and velocity',
            type: 'theory' as const,
            xpReward: 50,
            estimatedTime: 15,
            difficulty: 'easy' as const,
            isLocked: false,
            isCompleted: false
          },
          {
            id: 'forces-introduction',
            title: 'Forces Introduction',
            description: 'Explore different types of forces and their effects',
            type: 'theory' as const,
            xpReward: 60,
            estimatedTime: 20,
            difficulty: 'medium' as const,
            isLocked: false,
            isCompleted: false
          },
          {
            id: 'energy-concepts',
            title: 'Energy Concepts',
            description: 'Learn about kinetic and potential energy',
            type: 'theory' as const,
            xpReward: 70,
            estimatedTime: 25,
            difficulty: 'medium' as const,
            isLocked: false,
            isCompleted: false
          }
        ],
        isLocked: false,
        isCompleted: false,
        xpReward: 180
      },
      {
        id: 'waves',
        title: 'Waves & Oscillations',
        description: 'Study wave phenomena and oscillations',
        lessons: [
          {
            id: 'wave-properties',
            title: 'Wave Properties',
            description: 'Understand amplitude, frequency, and wavelength',
            type: 'theory' as const,
            xpReward: 55,
            estimatedTime: 18,
            difficulty: 'medium' as const,
            isLocked: false,
            isCompleted: false
          },
          {
            id: 'sound-waves',
            title: 'Sound Waves',
            description: 'Explore how sound travels and behaves',
            type: 'theory' as const,
            xpReward: 65,
            estimatedTime: 22,
            difficulty: 'medium' as const,
            isLocked: false,
            isCompleted: false
          }
        ],
        isLocked: false,
        isCompleted: false,
        xpReward: 120
      }
    ];
  };

  const handleModuleClick = (moduleId: string) => {
    const module = selectedPlan?.modules.find(m => m.id === moduleId);
    if (module) {
      setSelectedModule(module);
      setView('module');
    }
  };

  const handleLessonClick = (lessonId: string) => {
    const lesson = selectedModule?.lessons.find(l => l.id === lessonId);
    if (lesson) {
      setCurrentLesson(lesson);
      setShowLessonInterface(true);
    }
  };

  const handleLessonComplete = async (accuracy: number, xpEarned: number) => {
    if (!user || !currentLesson) return;

    try {
      // Extract plan_id and day_number from lesson ID (format: "planId-day-dayNumber")
      const lessonIdParts = currentLesson.id.split('-day-');
      const planId = lessonIdParts[0];
      const dayNumber = parseInt(lessonIdParts[1]);

      // Save lesson completion to database
      const { error } = await supabase
        .from('user_progress')
        .upsert({
          user_id: user.id,
          plan_id: planId,
          day_number: dayNumber,
          progress: 100,
          xp_earned: xpEarned,
          completed_at: new Date().toISOString()
        });

      if (error) {
        console.error('Error saving lesson completion:', error);
      } else {
        console.log('Lesson completed and saved:', { accuracy, xpEarned, planId, dayNumber });
      }

      setShowLessonInterface(false);
      setShowVoiceLecture(false);
      setCurrentLesson(null);

      // Refresh the data to show updated progress
      window.location.reload();
    } catch (error) {
      console.error('Error completing lesson:', error);
    }
  };

  const handleLessonClose = () => {
    setShowLessonInterface(false);
    setShowVoiceLecture(false);
    setCurrentLesson(null);
  };

  const handleVoiceLectureStart = () => {
    console.log('Starting voice lecture for lesson:', currentLesson);
    setShowVoiceLecture(true);
  };

  const handleBackToOverview = () => {
    setSelectedModule(null);
    setView('overview');
  };

  const getCompletedLessonsCount = (module: Module) => {
    return module.lessons.filter(lesson => lesson.isCompleted).length;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading your learning progress...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-white mb-2">Error Loading Data</h2>
          <p className="text-gray-300 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!selectedPlan) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-500 text-6xl mb-4">📚</div>
          <h2 className="text-2xl font-bold text-white mb-2">No Learning Data</h2>
          <p className="text-gray-300 mb-4">Start your first lesson to see your progress here.</p>
          <p className="text-gray-400 text-sm">Check the browser console for debugging information.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              {view !== 'overview' && (
                <button
                  onClick={handleBackToOverview}
                  className="mr-4 p-2 rounded-lg hover:bg-gray-700 transition-colors text-gray-300"
                >
                  <span className="text-2xl">←</span>
                </button>
              )}
              <h1 className="text-2xl font-bold text-white">
                {view === 'overview' ? selectedPlan.title : selectedModule?.title}
              </h1>
            </div>
            
            {/* Quick Stats */}
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <span className="text-yellow-400 text-xl">⭐</span>
                <span className="font-semibold text-white">{selectedPlan.totalXP}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-orange-400 text-xl">🔥</span>
                <span className="font-semibold text-white">{selectedPlan.currentStreak}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {view === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Progress Tracker */}
            <div className="lg:col-span-1">
              <ProgressTracker
                totalXP={selectedPlan.totalXP}
                currentStreak={selectedPlan.currentStreak}
                level={selectedPlan.level}
                xpToNextLevel={selectedPlan.xpToNextLevel}
                totalXpForLevel={selectedPlan.totalXpForLevel}
                achievements={achievements}
                weeklyGoal={selectedPlan.weeklyGoal}
                weeklyProgress={selectedPlan.weeklyProgress}
              />
            </div>

            {/* Modules */}
            <div className="lg:col-span-3">
              <h2 className="text-2xl font-bold text-white mb-8">Learning Path</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {selectedPlan.modules.map((module) => (
                  <ModuleProgress
                    key={module.id}
                    id={module.id}
                    title={module.title}
                    description={module.description}
                    totalLessons={module.lessons.length}
                    completedLessons={getCompletedLessonsCount(module)}
                    isLocked={module.isLocked}
                    isCompleted={module.isCompleted}
                    xpReward={module.xpReward}
                    onModuleClick={handleModuleClick}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {view === 'module' && selectedModule && (
          <div>
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-white mb-2">
                {selectedModule.title}
              </h2>
              <p className="text-gray-300">{selectedModule.description}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {selectedModule.lessons.map((lesson) => (
                <LessonCard
                  key={lesson.id}
                  id={lesson.id}
                  title={lesson.title}
                  description={lesson.description}
                  type={lesson.type}
                  isLocked={lesson.isLocked}
                  isCompleted={lesson.isCompleted}
                  xpReward={lesson.xpReward}
                  estimatedTime={lesson.estimatedTime}
                  difficulty={lesson.difficulty}
                  accuracy={lesson.accuracy}
                  onLessonClick={handleLessonClick}
                />
              ))}
            </div>
          </div>
        )}

        {/* Lesson Interface Modal */}
        {showLessonInterface && currentLesson && (
          <LessonInterface
            lessonId={currentLesson.id}
            lessonTitle={currentLesson.title}
            lessonType={currentLesson.type}
            lessonDescription={currentLesson.description}
            dayNumber={currentLesson.dayNumber}
            date={currentLesson.date}
            onComplete={handleLessonComplete}
            onClose={handleLessonClose}
            onStartVoiceLecture={handleVoiceLectureStart}
          />
        )}

        {/* Voice Lecture Interface Modal */}
        {showVoiceLecture && currentLesson && (
          <VoiceLectureInterface
            lessonId={currentLesson.id}
            lessonTitle={currentLesson.title}
            topic={currentLesson.title}
            onComplete={handleLessonComplete}
            onClose={handleLessonClose}
          />
        )}
      </div>
    </div>
  );
};

export default DuolingoStyleLearning; 