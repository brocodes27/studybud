import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ManusSidebar } from './components/ManusSidebar';
import TeacherNavbar from './components/TeacherNavbar';
import ManusHome from './pages/ManusHome';
import Landing from './pages/Landing';
import { Toaster } from './components/Toaster';
import { useOfflineStorage } from './hooks/useOfflineStorage';
import { useToast } from './hooks/useToast';
import { Profile } from './pages/Profile';
import Onboarding from './pages/Onboarding';
import { usePayment } from './hooks/usePayment';
import { AdminPanel } from './pages/AdminPanel';
import TeacherPortal from './pages/TeacherPortal';
import TeacherPanel from './pages/TeacherPanel';
import MyClasses from './pages/MyClasses';
import { ClassPage } from './pages/ClassPage';
import TeacherClassDashboard from './pages/TeacherClassDashboard';
import { AtlasWorkspace } from './pages/AtlasWorkspace';
import { Curriculum } from './pages/Curriculum';
import PersonalTipsManager from './components/PersonalTipsManager';
import { GlobalGenerationStatus } from './components/GlobalGenerationStatus';
import { AppFirstRunTour } from './components/AppFirstRunTour';
import SubscriptionPage from './components/SubscriptionPage';
import { AdminAnalytics } from './components/AdminAnalytics';
import MyProfileDashboard from './pages/MyProfileDashboard';
import { ProveIt } from './pages/ProveIt';
import { PublicReceipt } from './pages/PublicReceipt';
import { MasteryTree } from './pages/MasteryTree';
import { SquadProveIt } from './pages/SquadProveIt';
import { OutcomeDashboard } from './pages/OutcomeDashboard';
import { MasteryReports } from './pages/MasteryReports';
import { Crown, X } from 'lucide-react';

function AppContent() {
  const { user, role, loading, isPremium, onboardingCompleted } = useAuth();
  const { isOnline } = useOfflineStorage();
  const { initiatePayment, isLoadingPayment } = usePayment();
  const { toasts, removeToast } = useToast();
  const location = useLocation();
  const isImmersive = location.pathname === '/atlas';

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
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-[#00D1FF]/5 blur-[120px] rounded-full translate-y-1/2" />
        <div className="relative z-10 w-16 h-16 border-4 border-[#00D1FF]/20 border-t-[#00D1FF] rounded-full animate-spin" />
        <div className="mt-10 text-center space-y-3 relative z-10">
          <h2 className="text-4xl font-extrabold tracking-tight text-[#0A192F]">Elevenfolks</h2>
          <p className="text-[#64748B] font-medium text-sm">Loading your workspace...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Landing />;
  if (!onboardingCompleted) return <Onboarding />;

  return (
    <div className={`min-h-screen text-[#0A192F] selection:bg-[#00D1FF]/30 selection:text-[#0A192F] ${isImmersive ? 'bg-[#F8FAF9]' : 'bg-white'}`}>
      <div className="relative z-10">
        {!isFullscreen && (role === 'teacher' ? <TeacherNavbar /> : <ManusSidebar />)}

        <div className={!isFullscreen && role !== 'teacher' ? `md:pl-14 transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] ${isImmersive ? 'h-screen overflow-hidden' : ''}` : !isFullscreen ? "md:pl-[var(--sidebar-width,20rem)] transition-all duration-500" : ""}>
          {!isFullscreen && !isOnline && (
            <div className="bg-[#F472B6]/10 border-b border-[#F472B6]/20 text-[#F472B6] text-center py-3 text-xs font-bold uppercase tracking-widest">
              You're offline — syncing is limited
            </div>
          )}

          {!isFullscreen && !isImmersive && isPremium === false && showSubscribeBanner && (
            <div className="w-full flex justify-center sticky top-6 z-50 pointer-events-none">
              <div className="pointer-events-auto relative flex flex-col sm:flex-row items-center justify-between w-[calc(100%-2rem)] max-w-4xl mx-4 bg-white/90 backdrop-blur-2xl border-2 border-[#0A192F]/10 p-4 sm:p-6 rounded-[24px] sm:rounded-[32px] shadow-float-cyan overflow-hidden group gap-4 sm:gap-6">
                <div className="absolute top-0 left-0 w-full h-1 sm:w-1.5 sm:h-full bg-[#00D1FF]" />
                <div className="flex items-center gap-4 sm:gap-6">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 bg-[#00D1FF]/10 border border-[#00D1FF]/20 rounded-[16px] flex items-center justify-center text-[#00D1FF] shrink-0">
                    <Crown className="w-6 h-6 sm:w-7 sm:h-7" />
                  </div>
                  <div className="space-y-1 text-center sm:text-left">
                    <span className="font-extrabold text-lg sm:text-xl text-[#0A192F] leading-none block tracking-tight">Level Up to Premium</span>
                    <span className="text-xs font-medium text-[#64748B] block">Unlock advanced AI models & global analytics</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto justify-center">
                  <button
                    onClick={handleSubscribeClick}
                    disabled={isLoadingPayment}
                    className="flex-1 sm:flex-none neo-button px-6 sm:px-8 py-3 text-sm"
                  >
                    {isLoadingPayment ? 'Processing...' : 'Subscribe'}
                  </button>
                  <button
                    onClick={() => setShowSubscribeBanner(false)}
                    className="p-2 sm:p-3 text-[#64748B] hover:text-[#0A192F] transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          )}

          <main className={isFullscreen ? "w-full min-h-screen p-0 m-0" : `w-full mx-auto px-0 py-0 transition-all ${isImmersive ? 'h-full' : ''}`}>
            <Routes>
              {/* Core Experience */}
              <Route path="/" element={<ManusHome />} />
              <Route path="/daily" element={<ManusHome />} />
              <Route path="/atlas" element={<AtlasWorkspace />} />

              {/* Curriculum Reference */}
              <Route path="/curriculum" element={<Curriculum />} />

              {/* Account & Profile */}
              <Route path="/profile" element={<MyProfileDashboard />} />
              <Route path="/my-profile" element={<MyProfileDashboard />} />
              <Route path="/settings" element={<Profile />} />
              <Route path="/admin" element={<AdminPanel />} />
              <Route path="/admin/analytics" element={<AdminAnalytics />} />
              <Route path="/pricing" element={<SubscriptionPage />} />
              <Route path="/subscription" element={<SubscriptionPage />} />

              {/* Teacher Portal */}
              <Route path="/teacher" element={<TeacherPortal />}>
                <Route index element={<TeacherPanel />} />
                <Route path="class/:id" element={<TeacherClassDashboard />} />
              </Route>
              <Route path="/my-classes" element={<MyClasses />} />
              <Route path="/class/:id" element={<ClassPage />} />

              {/* Prove-It Mode — Socratic Mastery */}
              <Route path="/prove-it" element={<ProveIt />} />
              <Route path="/mastery-tree" element={<MasteryTree />} />
              <Route path="/squad-prove-it" element={<SquadProveIt />} />
              <Route path="/outcomes" element={<OutcomeDashboard />} />
              <Route path="/mastery-reports" element={<MasteryReports />} />
              <Route path="/m/:slug" element={<PublicReceipt />} />

              {/* Dashboard redirects */}
              <Route path="/dashboard" element={<ManusHome />} />
              <Route path="/analytics" element={<ManusHome />} />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </div>

      <PersonalTipsManager />
      <GlobalGenerationStatus />
      <AppFirstRunTour />
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
