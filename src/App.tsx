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
import { Analytics } from './pages/Analytics';
import { CalendarSync } from './pages/CalendarSync';
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
import { AIStudyBuddyPage } from './pages/AIStudyBuddyPage';
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
import { Sparkles, Crown, X, Zap } from 'lucide-react';
import VoiceLesson from './pages/VoiceLesson';
import { RanjanSir } from './pages/RanjanSir';
import { Curriculum } from './pages/Curriculum';

function AppContent() {
  const { user, role, loading, trialStart, trialActive, isPremium } = useAuth() as any;
  const { isOnline } = useOfflineStorage();
  const { initiatePayment, isLoadingPayment } = usePayment();
  const { toasts, removeToast } = useToast();
  const location = useLocation();

  // Fullscreen mode from notification deep links
  const isFullscreen = (() => {
    try {
      const params = new URLSearchParams(location.search);
      return params.get('fullscreen') === '1';
    } catch {
      return false;
    }
  })();

  // Floating Live Notes modal state
  // Removed unused showLiveNotes and showSuggest state

  // Dismissible subscribe banner
  const [showSubscribeBanner, setShowSubscribeBanner] = useState(true);

  // Register service worker for PWA
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          console.log('SW registered: ', registration);
        })
        .catch((registrationError) => {
          console.log('SW registration failed: ', registrationError);
        });
    }
  }, []);

  // Removed unused meeting URL detection effect

  // Debug logs for loading and user
  console.log('AppContent loading state:', loading);
  console.log('AppContent user:', user);
  console.log('AppContent isPremium:', isPremium);

  // Calculate if trial expired
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

  // Handler for subscribe button
  const handleSubscribeClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    await initiatePayment();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <div className="loading-spinner w-12 h-12" />
        <div className="mt-4 text-center">
          <div className="flex items-center justify-center space-x-2 text-gray-700">
            <Sparkles className="w-5 h-5" />
            <span className="text-lg font-semibold">ElevenFolks</span>
          </div>
          <p className="text-gray-500 text-sm mt-2">Loading your study experience...</p>
        </div>
      </div>
    );
  }

  // Show landing page if user is not authenticated
  if (!user) {
    return <Landing />;
  }

  // If authenticated but no role yet, show onboarding flow
  if (role === null) {
    return <Onboarding />;
  }

  // Block access if trial expired and not premium
  if (trialExpired && isPremium === false) {
    return (
      <div className="min-h-screen animated-gradient flex flex-col items-center justify-center p-4">
        {/* Subscribe Banner */}
        <div className="w-full flex justify-center sticky top-0 z-50 mb-8">
          <div className="relative flex items-center justify-center w-full max-w-2xl mx-auto mt-2">
            <button
              onClick={async (e) => { e.preventDefault(); await initiatePayment(); }}
              className="flex items-center gap-3 px-8 py-4 rounded-2xl font-bold text-white bg-gradient-to-r from-warning-400 via-warning-500 to-warning-600 shadow-2xl hover:from-warning-500 hover:to-warning-700 transition-all duration-300 text-lg border-2 border-warning-300/60 hover:scale-105 focus:outline-none focus:ring-4 focus:ring-warning-400/30 disabled:opacity-60 disabled:cursor-not-allowed glow-yellow"
              style={{ textDecoration: 'none' }}
              disabled={isLoadingPayment}
            >
              <Crown className="w-6 h-6 text-white drop-shadow" />
              <span>{isLoadingPayment ? 'Redirecting to Payment...' : 'Subscribe to Continue'}</span>
              <Zap className="w-5 h-5 text-white drop-shadow" />
            </button>
          </div>
        </div>
        <div className="card-elevated max-w-lg w-full text-center">
          <div className="w-16 h-16 bg-gradient-to-r from-warning-500 to-warning-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Crown className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-3xl font-bold mb-4 text-white">Your Free Trial Has Ended</h2>
          <p className="text-gray-300 mb-8 text-lg leading-relaxed">Your 7-day free access to all features has expired. Subscribe now to continue your learning journey with premium features.</p>
          <button
            onClick={async (e) => { e.preventDefault(); await initiatePayment(); }}
            className="w-full btn-primary text-lg py-4 disabled:opacity-60 disabled:cursor-not-allowed"
            disabled={isLoadingPayment}
          >
            {isLoadingPayment ? 'Redirecting to Payment...' : 'Subscribe Now'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="relative z-10">
        {/* Offline Indicator */}
        {!isFullscreen && !isOnline && (
          <div className="bg-amber-100 text-amber-800 text-center py-3 text-sm font-medium border-b border-amber-200">
            📱 You're offline. Some features may be limited.
          </div>
        )}
        
        {/* Improved Subscribe Button for Free Users */}
        {!isFullscreen && isPremium === false && showSubscribeBanner && (
          <div className="w-full flex justify-center sticky top-0 z-50">
            <div className="relative flex items-center justify-center w-full max-w-2xl mx-auto mt-4">
              <button
                onClick={handleSubscribeClick}
                className="flex items-center gap-3 px-6 py-3 rounded-2xl font-bold text-white bg-gradient-to-r from-warning-400 via-warning-500 to-warning-600 shadow-xl hover:from-warning-500 hover:to-warning-700 transition-all duration-300 text-base border-2 border-warning-300/60 hover:scale-105 focus:outline-none focus:ring-4 focus:ring-warning-400/30 disabled:opacity-60 disabled:cursor-not-allowed glow-yellow"
                style={{ textDecoration: 'none' }}
                disabled={isLoadingPayment}
              >
                <Crown className="w-5 h-5 text-white drop-shadow" />
                <span>{isLoadingPayment ? 'Redirecting to Payment...' : 'Unlock Premium Features'}</span>
                <Zap className="w-4 h-4 text-white drop-shadow" />
              </button>
              <button
                onClick={() => setShowSubscribeBanner(false)}
                className="absolute right-0 top-1/2 -translate-y-1/2 p-2 rounded-full hover:bg-warning-200/20 transition-colors text-warning-100 focus:outline-none focus:ring-2 focus:ring-warning-400/50"
                aria-label="Close subscribe banner"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
        
        {!isFullscreen && (role === 'teacher' ? <TeacherNavbar /> : <Navbar />)}
        <main className={isFullscreen ? "w-full h-screen p-0 m-0" : "w-full px-6 py-8 page-with-sidebar"}>
          <Routes>
            <Route path="/calendar" element={<CalendarSync />} />
            <Route path="/" element={<RanjanSir />} />
            <Route path="/create" element={<CreatePlan />} />
            <Route path="/plans" element={<StudyPlans />} />
            <Route path="/curriculum" element={<Curriculum />} />
            <Route path="/tools" element={<StudyTools />} />
            <Route path="/progress" element={<Progress />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/social" element={<Social />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/live-notes" element={<LiveMeetingNotes />} />
            <Route path="/my-notes" element={<MyMeetingNotes />} />
            <Route path="/my-notes/:id" element={<NoteDetailPage />} />
            <Route path="/study/:planId" element={<StudySession />} />
            <Route path="/ai-study-buddy" element={<AIStudyBuddyPage />} />
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
      
      {/* Global Components */}
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