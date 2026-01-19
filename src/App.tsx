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
import { FeatureComparison } from './components/FeatureComparison';
import { usePayment } from './hooks/usePayment';
import { AdminPanel } from './pages/AdminPanel';
import TeacherPortal from './pages/TeacherPortal';
import TeacherPanel from './pages/TeacherPanel';
import MyClasses from './pages/MyClasses';
import { ClassPage } from './pages/ClassPage';
import TeacherClassDashboard from './pages/TeacherClassDashboard';
import CBSEExamSimulator from './pages/CBSEExamSimulator';
import CUETSimulator from './pages/CUETSimulator';
import CBSEExamSession from './pages/CBSEExamSession';
import VAPITestComponent from './components/VAPITestComponent';
import CUETSyllabusDev from './pages/CUETSyllabusDev';
import VAPISetupTest from './components/VAPISetupTest';
import VoiceSelector from './components/VoiceSelector';
import ElliotVoiceTest from './components/ElliotVoiceTest';
import { Crown, X } from 'lucide-react';
import VoiceLesson from './pages/VoiceLesson';
import { RanjanSir } from './pages/RanjanSir';
import { VideoLessons } from './pages/VideoLessons';
import { Curriculum } from './pages/Curriculum';
import { AIStudyBuddyPage } from './pages/AIStudyBuddyPage';
import GlobalTourManager from './components/GlobalTourManager';
import PersonalTipsManager from './components/PersonalTipsManager';
import { GlobalGenerationStatus } from './components/GlobalGenerationStatus';
import GuidedPaperSolver from './pages/GuidedPaperSolver';

function AppContent() {
  const { user, role, loading, trialStart, trialActive, isPremium } = useAuth() as any;
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
    // Never register a Service Worker in development. This prevents the
    // "zombie localhost" behavior caused by SW-controlled pages after the dev
    // server stops.
    if (!('serviceWorker' in navigator)) return;

    if (import.meta.env.DEV) {
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => Promise.all(registrations.map((r) => r.unregister())))
        .catch(() => {
          // Ignore failures; dev should still load normally.
        });
      return;
    }
  }, []);

  let trialExpired = false;
  if (trialStart && !trialActive) {
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
  if (role === null) return <Onboarding />;

  if (trialExpired && isPremium === false) {
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
            Your 7-day free access has expired. Time to level up your study game with Premium access.
          </p>
          <button
            onClick={handleSubscribeClick}
            disabled={isLoadingPayment}
            className="w-full neo-button bg-neo-accent py-5 text-xl"
          >
            {isLoadingPayment ? 'PROCESSING...' : 'GET PREMIUM ACCESS NOW'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neo-bg selection:bg-neo-accent selection:text-black">
      <div className="relative z-10">
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

        {!isFullscreen && (role === 'teacher' ? <TeacherNavbar /> : <Navbar />)}

        <main className={isFullscreen ? "w-full min-h-screen p-0 m-0" : `w-full max-w-7xl mx-auto px-6 py-10 transition-all ${!isFullscreen ? 'page-with-sidebar' : ''}`}>
          <Routes>
            <Route path="/" element={<RanjanSir />} />
            <Route path="/create" element={<CreatePlan />} />
            <Route path="/plans" element={<StudyPlans />} />
            <Route path="/videos" element={<VideoLessons />} />
            <Route path="/curriculum" element={<Curriculum />} />
            <Route path="/ai-buddy" element={<AIStudyBuddyPage />} />
            <Route path="/tools" element={<StudyTools />} />
            <Route path="/progress" element={<Progress />} />
            <Route path="/analytics" element={<Dashboard />} />
            <Route path="/social" element={<Social />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/live-notes" element={<LiveMeetingNotes />} />
            <Route path="/my-notes" element={<MyMeetingNotes />} />
            <Route path="/my-notes/:id" element={<NoteDetailPage />} />
            <Route path="/study/:planId" element={<StudySession />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/admin" element={<AdminPanel />} />
            <Route path="/pricing" element={<FeatureComparison />} />
            <Route path="/cbse-simulator" element={<CBSEExamSimulator />} />
            <Route path="/cbse-exam-session" element={<CBSEExamSession />} />
            <Route path="/cuet-simulator" element={<CUETSimulator />} />
            <Route path="/dev/cuet-syllabus" element={<CUETSyllabusDev />} />
            <Route path="/vapi-test" element={<VAPITestComponent />} />
            <Route path="/vapi-setup" element={<VAPISetupTest />} />
            <Route path="/voice-selector" element={<VoiceSelector />} />
            <Route path="/elliot-test" element={<ElliotVoiceTest />} />
            <Route path="/voice-lesson" element={<VoiceLesson />} />
            <Route path="/guided-paper" element={<GuidedPaperSolver />} />
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
