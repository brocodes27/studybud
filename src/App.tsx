import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Navbar } from './components/Navbar';
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
import { Landing } from './pages/Landing';
import { StudySession } from './pages/StudySession';
import { Toaster } from './components/Toaster';
import { useOfflineStorage } from './hooks/useOfflineStorage';
import { LiveMeetingNotes } from './components/LiveMeetingNotes';
import { MyMeetingNotes } from './pages/MyMeetingNotes';
import { NoteDetailPage } from './pages/NoteDetailPage';
import { AIStudyBuddyPage } from './pages/AIStudyBuddyPage';
import { Profile } from './pages/Profile';
import { FeatureComparison } from './components/FeatureComparison';
import { usePayment } from './hooks/usePayment';
import { AdminPanel } from './pages/AdminPanel';

function AppContent() {
  const { user, loading, session, trialStart, trialActive } = useAuth();
  const { isOnline } = useOfflineStorage();
  const { initiatePayment, isLoadingPayment } = usePayment();

  // Floating Live Notes modal state
  const [showLiveNotes, setShowLiveNotes] = useState(false);
  const [showSuggest, setShowSuggest] = useState(false);

  // Subscription status
  const [isPremium, setIsPremium] = useState<boolean | null>(null);
  // Dismissible subscribe banner
  const [showSubscribeBanner, setShowSubscribeBanner] = useState(true);

  useEffect(() => {
    if (user) {
      fetchPremiumStatus();
    }
  }, [user]);

  const fetchPremiumStatus = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('subscriptions')
      .select('status')
      .eq('user_id', user.id)
      .single();
    setIsPremium(data?.status === 'active');
  };

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
          <div className="w-32 h-32 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
          <div className="absolute inset-0 w-32 h-32 border-4 border-purple-500/20 border-b-purple-500 rounded-full animate-spin animation-delay-150"></div>
          <div className="absolute inset-4 w-24 h-24 border-4 border-cyan-500/20 border-r-cyan-500 rounded-full animate-spin animation-delay-300"></div>
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
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center">
        {/* Subscribe Banner */}
        <div className="w-full flex justify-center sticky top-0 z-50 mb-8">
          <div className="relative flex items-center justify-center w-full max-w-2xl mx-auto mt-2">
            <button
              onClick={async (e) => { e.preventDefault(); await initiatePayment(); }}
              className="flex items-center gap-3 px-6 py-3 rounded-full font-bold text-white bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-600 shadow-xl hover:from-yellow-500 hover:to-yellow-700 transition-all duration-200 text-lg border-2 border-yellow-300/60 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-yellow-400 disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ textDecoration: 'none', boxShadow: '0 4px 24px 0 rgba(255, 193, 7, 0.15)' }}
              disabled={isLoadingPayment}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-7 h-7 text-white drop-shadow">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a1.5 1.5 0 012.68 0l2.09 4.23a1.5 1.5 0 001.13.82l4.66.68a1.5 1.5 0 01.83 2.56l-3.37 3.29a1.5 1.5 0 00-.43 1.33l.8 4.65a1.5 1.5 0 01-2.18 1.58l-4.18-2.2a1.5 1.5 0 00-1.4 0l-4.18 2.2a1.5 1.5 0 01-2.18-1.58l.8-4.65a1.5 1.5 0 00-.43-1.33l-3.37-3.29a1.5 1.5 0 01.83-2.56l4.66-.68a1.5 1.5 0 001.13-.82l2.09-4.23z" />
              </svg>
              <span>{isLoadingPayment ? 'Redirecting to Payment...' : 'Subscribe to Continue'}</span>
            </button>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 max-w-lg w-full text-center">
          <h2 className="text-3xl font-bold mb-4 text-gray-900">Your Free Trial Has Ended</h2>
          <p className="text-gray-700 mb-6">Your 7-day free access to all features has expired. Please subscribe to continue using the app and unlock premium features.</p>
          <button
            onClick={async (e) => { e.preventDefault(); await initiatePayment(); }}
            className="w-full bg-gradient-to-r from-yellow-500 to-yellow-700 hover:from-yellow-600 hover:to-yellow-800 text-white font-bold py-3 px-6 rounded-xl transition-all duration-200 text-lg disabled:opacity-60 disabled:cursor-not-allowed"
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
          <div className="bg-yellow-600 text-white text-center py-2 text-sm">
            📱 You're offline. Some features may be limited.
          </div>
        )}
        {/* Improved Subscribe Button for Free Users */}
        {isPremium === false && showSubscribeBanner && (
          <div className="w-full flex justify-center sticky top-0 z-50">
            <div className="relative flex items-center justify-center w-full max-w-2xl mx-auto mt-2">
              <button
                onClick={handleSubscribeClick}
                className="flex items-center gap-3 px-6 py-3 rounded-full font-bold text-white bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-600 shadow-xl hover:from-yellow-500 hover:to-yellow-700 transition-all duration-200 text-lg border-2 border-yellow-300/60 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-yellow-400 disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ textDecoration: 'none', boxShadow: '0 4px 24px 0 rgba(255, 193, 7, 0.15)' }}
                disabled={isLoadingPayment}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-7 h-7 text-white drop-shadow">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a1.5 1.5 0 012.68 0l2.09 4.23a1.5 1.5 0 001.13.82l4.66.68a1.5 1.5 0 01.83 2.56l-3.37 3.29a1.5 1.5 0 00-.43 1.33l.8 4.65a1.5 1.5 0 01-2.18 1.58l-4.18-2.2a1.5 1.5 0 00-1.4 0l-4.18 2.2a1.5 1.5 0 01-2.18-1.58l.8-4.65a1.5 1.5 0 00-.43-1.33l-3.37-3.29a1.5 1.5 0 01.83-2.56l4.66-.68a1.5 1.5 0 001.13-.82l2.09-4.23z" />
                </svg>
                <span>{isLoadingPayment ? 'Redirecting to Payment...' : 'Unlock Premium Features'}</span>
              </button>
              <button
                onClick={() => setShowSubscribeBanner(false)}
                className="absolute right-0 top-1/2 -translate-y-1/2 p-2 rounded-full hover:bg-yellow-200/60 transition-colors text-yellow-900 focus:outline-none"
                aria-label="Close subscribe banner"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}
        <Navbar />
        <main className="w-full px-6 py-8 md:pl-72">
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
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
      
      {/* Global Components */}
      <Toaster />
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