import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
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
import { Auth } from './pages/Auth';
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
import { FeatureComparison } from './components/FeatureComparison';
import { usePayment } from './hooks/usePayment';
import { AdminPanel } from './pages/AdminPanel';
import TeacherPortal from './pages/TeacherPortal';
import TeacherPanel from './pages/TeacherPanel';
import MyClasses from './pages/MyClasses';
import { ClassPage } from './pages/ClassPage';
import TeacherClassDashboard from './pages/TeacherClassDashboard';
import CBSEExamSimulator from './pages/CBSEExamSimulator';
import CBSEExamSession from './pages/CBSEExamSession';
import VAPITestComponent from './components/VAPITestComponent';
import VAPISetupTest from './components/VAPISetupTest';
import VoiceSelector from './components/VoiceSelector';
import ElliotVoiceTest from './components/ElliotVoiceTest';
import { Sparkles, Crown, X, Zap } from 'lucide-react';

function AppContent() {
  const { user, role, loading, session, trialStart, trialActive, isPremium } = useAuth() as any;
  const { isOnline } = useOfflineStorage();
  const { initiatePayment, isLoadingPayment } = usePayment();
  const { toasts, removeToast } = useToast();

  // Floating Live Notes modal state
  const [showLiveNotes, setShowLiveNotes] = useState(false);
  const [showSuggest, setShowSuggest] = useState(false);

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

  // Detect Google Meet or Zoom in URL (simple heuristic)
  useEffect(() => {
    const url = window.location.href;
    if (
      url.includes('meet.google.com') ||
      url.includes('zoom.us') ||
      url.includes('web.zoom.us')
    ) {
      setShowSuggest(true);
    }
  }, []);

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
      <div className="min-h-screen animated-gradient flex items-center justify-center">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin"></div>
          <div className="absolute inset-0 w-16 h-16 border-4 border-accent-500/20 border-b-accent-500 rounded-full animate-spin animation-delay-150"></div>
          <div className="absolute inset-4 w-12 h-12 border-4 border-success-500/20 border-r-success-500 rounded-full animate-spin animation-delay-300"></div>
          <div className="absolute inset-8 w-8 h-8 border-4 border-warning-500/20 border-l-warning-500 rounded-full animate-spin animation-delay-500"></div>
        </div>
        <div className="absolute bottom-8 text-center">
          <div className="flex items-center justify-center space-x-2 text-white/80">
            <Sparkles className="w-5 h-5 animate-pulse" />
            <span className="text-lg font-semibold">ElevenFolks</span>
          </div>
          <p className="text-white/60 text-sm mt-2">Loading your study experience...</p>
        </div>
      </div>
    );
  }

  // Show landing page if user is not authenticated
  if (!user) {
    return <Landing />;
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
    <div className="min-h-screen bg-gray-900">
      <div className="animated-gradient fixed inset-0 opacity-10"></div>
      <div className="relative z-10">
        {/* Offline Indicator */}
        {!isOnline && (
          <div className="bg-warning-600 text-white text-center py-3 text-sm font-medium shadow-lg">
            📱 You're offline. Some features may be limited.
          </div>
        )}
        
        {/* Improved Subscribe Button for Free Users */}
        {isPremium === false && showSubscribeBanner && (
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
        
        {role === 'teacher' ? <TeacherNavbar /> : <Navbar />}
        <main className="w-full px-4 sm:px-6 py-6 sm:py-8 page-with-sidebar safe-bottom">
          <Routes>
            <Route path="/calendar" element={<CalendarSync />} />
            <Route path="/" element={<Dashboard />} />
            <Route path="/create" element={<CreatePlan />} />
            <Route path="/plans" element={<StudyPlans />} />
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
            <Route path="/profile" element={<Profile />} />
            <Route path="/admin" element={<AdminPanel />} />
            <Route path="/pricing" element={<FeatureComparison />} />
            <Route path="/cbse-simulator" element={<CBSEExamSimulator />} />
            <Route path="/cbse-exam-session" element={<CBSEExamSession />} />
            <Route path="/vapi-test" element={<VAPITestComponent />} />
            <Route path="/vapi-setup" element={<VAPISetupTest />} />
            <Route path="/voice-selector" element={<VoiceSelector />} />
            <Route path="/elliot-test" element={<ElliotVoiceTest />} />
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