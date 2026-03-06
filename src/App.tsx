import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Navbar from './components/Navbar';
import TeacherNavbar from './components/TeacherNavbar';
import { Dashboard } from './pages/Dashboard';
import { CreatePlan } from './pages/CreatePlan';
import { StudyPlans } from './pages/StudyPlans';
import { Progress } from './pages/Progress';
import { StudyTools } from './pages/StudyTools';
import { Social } from './pages/Social';
import { Notifications } from './pages/Notifications';
import Landing from './pages/Landing';
import { StudySession } from './pages/StudySession';
import { Toaster } from './components/Toaster';
import { useOfflineStorage } from './hooks/useOfflineStorage';
import { useToast } from './hooks/useToast';
import { LiveMeetingNotes } from './components/LiveMeetingNotes';
import { MyMeetingNotes } from './pages/MyMeetingNotes';
import { NoteDetailPage } from './pages/NoteDetailPage';
import { Profile } from './pages/Profile';
import Onboarding from './pages/Onboarding';
import { usePayment } from './hooks/usePayment';
import { AdminPanel } from './pages/AdminPanel';
import TeacherPortal from './pages/TeacherPortal';
import TeacherPanel from './pages/TeacherPanel';
import MyClasses from './pages/MyClasses';
import { ClassPage } from './pages/ClassPage';
import TeacherClassDashboard from './pages/TeacherClassDashboard';
import SATSimulator from './pages/SATSimulator';
import CollegeRoadmaps from './pages/CollegeRoadmaps';
import VAPITestComponent from './components/VAPITestComponent';
import VAPISetupTest from './components/VAPISetupTest';
import VoiceSelector from './components/VoiceSelector';
import ElliotVoiceTest from './components/ElliotVoiceTest';
import { Crown, X } from 'lucide-react';
import VoiceLesson from './pages/VoiceLesson';
import { AtlasWorkspace } from './pages/AtlasWorkspace';
import { VideoLessons } from './pages/VideoLessons';
import { Curriculum } from './pages/Curriculum';
import { AIStudyBuddyPage } from './pages/AIStudyBuddyPage';
// import GlobalTourManager from './components/GlobalTourManager';
import PersonalTipsManager from './components/PersonalTipsManager';
import { GlobalGenerationStatus } from './components/GlobalGenerationStatus';
import GuidedPaperSolver from './pages/GuidedPaperSolver';
import FeynmanBoard from './pages/FeynmanBoard';
import { DailyCheckin } from './components/DailyCheckin';
import { SubscriptionPage } from './components/SubscriptionPage';
import SYOW from './pages/SYOW';

function AppContent() {
  const { user, role, loading, isPremium, onboardingCompleted } = useAuth();
  const { isOnline } = useOfflineStorage();
  const { initiatePayment, isLoadingPayment } = usePayment();
  const { toasts, removeToast } = useToast();
  const location = useLocation();

  const isFullscreen = (() => {
    try {
      const params = new URLSearchParams(location.search);
      return params.get('fullscreen') === '1';
    } catch {
      return false;
    }
  })();

  const [showSubscribeBanner, setShowSubscribeBanner] = useState(true);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    if (import.meta.env.DEV) {
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => Promise.all(registrations.map((r) => r.unregister())))
        .catch(() => {
        });
      return;
    }
  }, []);

  const handleSubscribeClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    await initiatePayment();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-primary/5 blur-[120px] rounded-full translate-y-1/2" />
        <div className="relative z-10 w-24 h-24 border-2 border-primary/20 border-t-primary rounded-full animate-spin shadow-2xl shadow-primary/20" />
        <div className="mt-16 text-center space-y-4 relative z-10">
          <h2 className="text-5xl font-black italic tracking-tighter text-white uppercase leading-none">Atlas</h2>
          <p className="text-slate-500 font-black uppercase tracking-[0.4em] text-xs">Initializing_Neural_Matrix_v4.0</p>
        </div>
      </div>
    );
  }

  if (!user) return <Landing />;
  if (!onboardingCompleted) return <Onboarding />;

  return (
    <div className="min-h-screen bg-slate-950 text-white selection:bg-primary/30 selection:text-white">
      <div className="relative z-10">
        {!isFullscreen && (role === 'teacher' ? <TeacherNavbar /> : <Navbar />)}

        <div className={!isFullscreen ? "md:pl-[var(--sidebar-width,20rem)] transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)]" : ""}>
          {!isFullscreen && !isOnline && (
            <div className="bg-rose-500/10 border-b border-rose-500/20 text-rose-500 text-center py-3 text-[10px] font-black uppercase tracking-[0.3em] backdrop-blur-xl">
              ⚠️ Offline_Mode_Active // Limited_Sync
            </div>
          )}

          {!isFullscreen && isPremium === false && showSubscribeBanner && (
            <div className="w-full flex justify-center sticky top-6 z-50 pointer-events-none">
              <div className="pointer-events-auto relative flex flex-col sm:flex-row items-center justify-between w-[calc(100%-2rem)] max-w-4xl mx-4 bg-slate-900/80 backdrop-blur-2xl border border-white/10 p-4 sm:p-6 rounded-2xl sm:rounded-[2rem] shadow-2xl shadow-black/50 overflow-hidden group gap-4 sm:gap-6">
                <div className="absolute top-0 left-0 w-full h-1 sm:w-2 sm:h-full bg-primary" />
                <div className="flex items-center gap-6">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 bg-primary/10 border border-primary/20 rounded-xl sm:rounded-2xl flex items-center justify-center text-primary shadow-inner shrink-0">
                    <Crown className="w-6 h-6 sm:w-8 sm:h-8 drop-shadow-lg" />
                  </div>
                  <div className="space-y-1 text-center sm:text-left">
                    <span className="font-black uppercase tracking-tighter text-lg sm:text-2xl italic leading-none block">Level Up to Premium</span>
                    <span className="text-[8px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Unlock Advanced AI Models & Global Analytics</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto justify-center">
                  <button
                    onClick={handleSubscribeClick}
                    disabled={isLoadingPayment}
                    className="flex-1 sm:flex-none bg-primary hover:bg-blue-600 text-white px-6 sm:px-8 py-3 sm:py-4 rounded-xl font-black uppercase text-xs sm:text-sm tracking-widest shadow-xl shadow-primary/20 transition-all hover:-translate-y-0.5 active:scale-95"
                  >
                    {isLoadingPayment ? 'WAIT...' : 'SUBSCRIBE'}
                  </button>
                  <button
                    onClick={() => setShowSubscribeBanner(false)}
                    className="p-2 sm:p-3 text-slate-600 hover:text-white transition-colors"
                  >
                    <X className="w-5 h-5 sm:w-6 h-6" />
                  </button>
                </div>
              </div>
            </div>
          )}

          <main className={isFullscreen ? "w-full min-h-screen p-0 m-0" : "w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 transition-all"}>
            <Routes>
              {/* Daily Experience - New Primary Flow */}
              <Route path="/" element={<DailyCheckin />} />
              <Route path="/daily" element={<DailyCheckin />} />
              <Route path="/atlas" element={<AtlasWorkspace />} />
              <Route path="/syow" element={<SYOW />} />

              {/* Study Planning */}
              <Route path="/create" element={<CreatePlan />} />
              <Route path="/plans" element={<StudyPlans />} />
              <Route path="/curriculum" element={<Curriculum />} />

              {/* Practice & Testing - US Exams */}
              <Route path="/sat-simulator" element={<SATSimulator />} />
              <Route path="/feynman" element={<FeynmanBoard />} />
              <Route path="/guided-paper" element={<GuidedPaperSolver />} />

              {/* Learning Content */}
              <Route path="/videos" element={<VideoLessons />} />
              <Route path="/tools" element={<StudyTools />} />
              <Route path="/ai-buddy" element={<AIStudyBuddyPage />} />
              <Route path="/voice-lesson" element={<VoiceLesson />} />

              {/* Progress & Analytics */}
              <Route path="/progress" element={<Progress />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/analytics" element={<Dashboard />} />

              {/* College Prep */}
              <Route path="/roadmaps" element={<CollegeRoadmaps />} />

              {/* Social & Community */}
              <Route path="/social" element={<Social />} />
              <Route path="/notifications" element={<Notifications />} />

              {/* Notes */}
              <Route path="/live-notes" element={<LiveMeetingNotes />} />
              <Route path="/my-notes" element={<MyMeetingNotes />} />
              <Route path="/my-notes/:id" element={<NoteDetailPage />} />

              {/* Study Sessions */}
              <Route path="/study/:planId" element={<StudySession />} />

              {/* Account */}
              <Route path="/profile" element={<Profile />} />
              <Route path="/admin" element={<AdminPanel />} />
              <Route path="/pricing" element={<SubscriptionPage />} />
              <Route path="/subscription" element={<SubscriptionPage />} />

              {/* Voice/VAPI Testing */}
              <Route path="/vapi-test" element={<VAPITestComponent />} />
              <Route path="/vapi-setup" element={<VAPISetupTest />} />
              <Route path="/voice-selector" element={<VoiceSelector />} />
              <Route path="/elliot-test" element={<ElliotVoiceTest />} />

              {/* Teacher Portal */}
              <Route path="/teacher" element={<TeacherPortal />}>
                <Route index element={<TeacherPanel />} />
                <Route path="class/:id" element={<TeacherClassDashboard />} />
              </Route>
              <Route path="/my-classes" element={<MyClasses />} />
              <Route path="/class/:id" element={<ClassPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </div>

      <PersonalTipsManager />
      <GlobalGenerationStatus />
      <Toaster toasts={toasts} removeToast={removeToast} />
    </div>
  );
}

export function App() {
  return (
    <Router>
      <AuthProvider key="auth-provider">
        <AppContent />
      </AuthProvider>
    </Router>
  );
}

export default App;
