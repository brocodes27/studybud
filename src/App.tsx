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

function AppContent() {
  const { user, loading } = useAuth();
  const { isOnline } = useOfflineStorage();

  // Floating Live Notes modal state
  const [showLiveNotes, setShowLiveNotes] = useState(false);
  const [showSuggest, setShowSuggest] = useState(false);

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
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </Router>
  );
}

export default App;