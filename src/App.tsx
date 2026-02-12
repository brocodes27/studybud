import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
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
  const { user, role, loading, isPremium, isAdmin, trialStart, trialActive, onboardingCompleted, signOut } = useAuth();
  const { isOnline } = useOfflineStorage();
  const { initiatePayment, isLoadingPayment } = usePayment();
  const { toasts, removeToast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();

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

  let trialExpired = false;
  if (trialStart && trialActive === false) {
    trialExpired = true;
  } else if (trialStart) {
    const now = new Date();
    const diff = now.getTime() - trialStart.getTime();
    if (diff > 7 * 24 * 60 * 60 * 1000) {
      trialExpired = true;
    }
  }


  const handleSubscribeClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    await initiatePayment();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neo-bg flex flex-col items-center justify-center p-6">
        <div className="w-24 h-24 border-8 border-black border-t-neo-accent animate-spin" />
        <div className="mt-12 text-center p-8 bg-white border-4 border-black shadow-[8px_8px_0px_0px_#000]">
          <h2 className="text-4xl font-black uppercase tracking-tighter">ELEVENFOLKS</h2>
          <p className="text-black/60 font-bold uppercase tracking-widest text-sm mt-2">Initializing Experience...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Landing />;
  if (!onboardingCompleted) return <Onboarding />;

  const isSubscriptionRoute = location.pathname === '/pricing' || location.pathname === '/subscription';

  if (trialExpired && !isPremium && !isAdmin && !isSubscriptionRoute) {
    return (
      <div className="min-h-screen bg-neo-bg flex flex-col items-center justify-center p-4 py-20 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(#000 2px, transparent 2px)', backgroundSize: '30px 30px' }} />

        <div className="neo-card bg-white max-w-lg w-full text-center relative z-10">
          <div className="w-20 h-20 bg-neo-secondary border-4 border-black flex items-center justify-center mx-auto mb-8 shadow-[4px_4px_0px_0px_#000] sticky top-0">
            <Crown className="w-10 h-10 text-black stroke-[2.5px]" />
          </div>
          <h2 className="text-4xl font-black uppercase tracking-tighter mb-4 text-black italic">TRIAL EXPIRED</h2>
          <p className="text-black/70 mb-10 text-lg font-bold leading-snug">
            Your 7-day free access has ended. Level up to a Pro subscription to keep your neural edge.
          </p>
          <div className="space-y-4">
            <button
              onClick={() => navigate('/pricing')}
              className="w-full neo-button bg-neo-accent py-5 text-xl"
            >
              VIEW SUBSCRIPTION PLANS
            </button>
            <button
              onClick={() => signOut()}
              className="w-full text-black/40 font-black uppercase text-xs tracking-widest hover:text-red-500 transition-colors"
            >
              LOGOUT / CHANGE ACCOUNT
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neo-bg selection:bg-neo-accent selection:text-black">
      <div className="relative z-10">
        {!isFullscreen && (role === 'teacher' ? <TeacherNavbar /> : <Navbar />)}

        <div className={!isFullscreen ? "md:pl-[var(--sidebar-width,16rem)] transition-all duration-300" : ""}>
          {!isFullscreen && !isOnline && (
            <div className="bg-neo-muted text-black text-center py-4 text-sm font-black border-b-4 border-black uppercase tracking-widest">
              📱 OFFLINE MODE ACTIVE
            </div>
          )}

          {!isFullscreen && isPremium === false && showSubscribeBanner && (
            <div className="w-full flex justify-center sticky top-4 z-50">
              <div className="relative flex items-center justify-between w-full max-w-3xl mx-4 bg-neo-secondary border-4 border-black p-4 shadow-[8px_8px_0px_0px_#000]">
                <div className="flex items-center gap-4">
                  <Crown className="w-6 h-6 text-black stroke-[2.5px]" />
                  <span className="font-black uppercase tracking-tighter text-lg">LEVEL UP TO PREMIUM</span>
                </div>
                <div className="flex items-center gap-4">
                  <button
                    onClick={handleSubscribeClick}
                    disabled={isLoadingPayment}
                    className="bg-black text-white px-6 py-2 font-black uppercase text-sm hover:bg-neo-ink translate-y-[-2px] shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)] active:translate-y-0 active:shadow-none transition-all"
                  >
                    {isLoadingPayment ? 'WAIT...' : 'SUBSCRIBE'}
                  </button>
                  <button
                    onClick={() => setShowSubscribeBanner(false)}
                    className="p-1 hover:bg-black/10"
                  >
                    <X className="w-5 h-5 stroke-[3px]" />
                  </button>
                </div>
              </div>
            </div>
          )}

          <main className={isFullscreen ? "w-full min-h-screen p-0 m-0" : "w-full max-w-7xl mx-auto px-6 py-10 transition-all"}>
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
