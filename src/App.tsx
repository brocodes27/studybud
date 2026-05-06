import React, { useState, useEffect, Suspense, lazy } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ManusSidebar } from './components/ManusSidebar';
import TeacherNavbar from './components/TeacherNavbar';
import ManusHome from './pages/ManusHome';
import Landing from './pages/Landing';
import Privacy from './pages/Privacy';
import Terms from './pages/Terms';
import { Toaster } from './components/Toaster';
import { useOfflineStorage } from './hooks/useOfflineStorage';
import { useToast } from './hooks/useToast';
import { Profile } from './pages/Profile';
import Onboarding from './pages/Onboarding';
import { usePayment } from './hooks/usePayment';
import { supabase } from './lib/supabase';
import { Curriculum } from './pages/Curriculum';
import PersonalTipsManager from './components/PersonalTipsManager';
import { GlobalGenerationStatus } from './components/GlobalGenerationStatus';
import { AppFirstRunTour } from './components/AppFirstRunTour';
import SubscriptionPage from './components/SubscriptionPage';

const AdminPanel = lazy(() => import('./pages/AdminPanel').then(m => ({ default: m.AdminPanel })));
const TeacherPortal = lazy(() => import('./pages/TeacherPortal'));
const MyClasses = lazy(() => import('./pages/MyClasses'));
const ParentDashboard = lazy(() => import('./pages/ParentDashboard'));
const ClassPage = lazy(() => import('./pages/ClassPage').then(m => ({ default: m.ClassPage })));
const TeacherClassDashboard = lazy(() => import('./pages/TeacherClassDashboard'));
const AtlasWorkspace = lazy(() => import('./pages/AtlasWorkspace').then(m => ({ default: m.AtlasWorkspace })));
const AdminAnalytics = lazy(() => import('./components/AdminAnalytics').then(m => ({ default: m.AdminAnalytics })));
const MyProfileDashboard = lazy(() => import('./pages/MyProfileDashboard'));
const ProveIt = lazy(() => import('./pages/ProveIt').then(m => ({ default: m.ProveIt })));
const PublicReceipt = lazy(() => import('./pages/PublicReceipt').then(m => ({ default: m.PublicReceipt })));
const MasteryTree = lazy(() => import('./pages/MasteryTree').then(m => ({ default: m.MasteryTree })));
const SquadProveIt = lazy(() => import('./pages/SquadProveIt').then(m => ({ default: m.SquadProveIt })));
const OutcomeDashboard = lazy(() => import('./pages/OutcomeDashboard').then(m => ({ default: m.OutcomeDashboard })));
const MasteryReports = lazy(() => import('./pages/MasteryReports').then(m => ({ default: m.MasteryReports })));
const SchoolAdminPanel = lazy(() => import('./pages/SchoolAdminPanel').then(m => ({ default: m.SchoolAdminPanel })));
import { Crown, X } from 'lucide-react';

function AppContent() {
  const { user, role, loading, isPremium, onboardingCompleted, isAdmin } = useAuth();
  const { isOnline } = useOfflineStorage();
  const { initiatePayment, isLoadingPayment } = usePayment();
  const { toasts, removeToast } = useToast();
  const location = useLocation();
  const effectiveRole = typeof role === 'string' ? role.trim().toLowerCase() : user?.user_metadata?.role?.trim?.().toLowerCase?.();
  const isSchoolAdmin = effectiveRole === 'school_admin';
  const [ownsTeacherClasses, setOwnsTeacherClasses] = useState(false);
  const isTeacherExperience = effectiveRole === 'teacher' || ownsTeacherClasses || isSchoolAdmin;
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

  useEffect(() => {
    let cancelled = false;

    async function resolveTeacherExperience() {
      if (!user?.id) {
        setOwnsTeacherClasses(false);
        return;
      }

      if (effectiveRole === 'teacher') {
        setOwnsTeacherClasses(true);
        return;
      }

      const { count } = await supabase
        .from('classes')
        .select('*', { count: 'exact', head: true })
        .eq('teacher_id', user.id);

      if (!cancelled) {
        setOwnsTeacherClasses((count || 0) > 0);
      }
    }

    resolveTeacherExperience();
    return () => { cancelled = true; };
  }, [user?.id, effectiveRole]);

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
  if (!onboardingCompleted && effectiveRole !== 'teacher') return <Onboarding />;

  const hasFreeAccess = isTeacherExperience || isAdmin;
  const requiresSubscription = !hasFreeAccess && isPremium === false;

  if (requiresSubscription && location.pathname !== '/subscription' && location.pathname !== '/pricing') {
    return <Navigate to="/subscription" replace />;
  }

  if (requiresSubscription) {
    return (
      <div className="min-h-screen bg-white text-[#0A192F] selection:bg-[#00D1FF]/30 selection:text-[#0A192F]">
        <main className="w-full mx-auto px-6 py-10">
          <SubscriptionPage />
        </main>
        <Toaster toasts={toasts} removeToast={removeToast} />
      </div>
    );
  }

  return (
    <div className={`min-h-screen text-[#0A192F] selection:bg-[#00D1FF]/30 selection:text-[#0A192F] ${isImmersive ? 'bg-[#F8FAF9]' : 'bg-white'}`}>
      <div className="relative z-10">
        {!isFullscreen && (isTeacherExperience ? <TeacherNavbar /> : <ManusSidebar />)}

        <div className={!isFullscreen && !isTeacherExperience ? `md:pl-14 transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] ${isImmersive ? 'h-screen overflow-hidden' : ''}` : !isFullscreen ? "md:pl-[var(--sidebar-width,20rem)] transition-all duration-500" : ""}>
          {!isFullscreen && !isOnline && (
            <div className="bg-[#F472B6]/10 border-b border-[#F472B6]/20 text-[#F472B6] text-center py-3 text-xs font-bold uppercase tracking-widest">
              You're offline — syncing is limited
            </div>
          )}

          {!isFullscreen && !isImmersive && !isTeacherExperience && !isAdmin && isPremium === false && showSubscribeBanner && (
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
            <Suspense fallback={<div className="w-full min-h-[50vh] flex items-center justify-center"><div className="w-10 h-10 border-4 border-[#00D1FF]/20 border-t-[#00D1FF] animate-spin rounded-full" /></div>}>
            <Routes>
              {/* Core Experience */}
              <Route path="/" element={isSchoolAdmin ? <Navigate to="/school-admin" replace /> : isTeacherExperience ? <Navigate to="/my-classes" replace /> : <ManusHome />} />
              <Route path="/daily" element={isSchoolAdmin ? <Navigate to="/school-admin" replace /> : isTeacherExperience ? <Navigate to="/my-classes" replace /> : <ManusHome />} />
              <Route path="/atlas" element={<ErrorBoundary><AtlasWorkspace /></ErrorBoundary>} />

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
                <Route index element={<Navigate to="/my-classes" replace />} />
                <Route path="class/:id" element={<TeacherClassDashboard />} />
              </Route>
              <Route path="/my-classes" element={<MyClasses />} />
              <Route path="/parent" element={<ParentDashboard />} />
              <Route path="/school-admin" element={<SchoolAdminPanel />} />
              <Route path="/class/:id" element={<ClassPage />} />

              {/* Prove-It Mode — Socratic Mastery */}
              <Route path="/prove-it" element={<ErrorBoundary><ProveIt /></ErrorBoundary>} />
              <Route path="/mastery-tree" element={<ErrorBoundary><MasteryTree /></ErrorBoundary>} />
              <Route path="/squad-prove-it" element={<ErrorBoundary><SquadProveIt /></ErrorBoundary>} />
              <Route path="/outcomes" element={<ErrorBoundary><OutcomeDashboard /></ErrorBoundary>} />
              <Route path="/mastery-reports" element={<ErrorBoundary><MasteryReports /></ErrorBoundary>} />
              <Route path="/m/:slug" element={<ErrorBoundary><PublicReceipt /></ErrorBoundary>} />

              {/* Dashboard redirects */}
              <Route path="/dashboard" element={isSchoolAdmin ? <Navigate to="/school-admin" replace /> : isTeacherExperience ? <Navigate to="/my-classes" replace /> : <ManusHome />} />
              <Route path="/analytics" element={isSchoolAdmin ? <Navigate to="/school-admin" replace /> : isTeacherExperience ? <Navigate to="/my-classes" replace /> : <ManusHome />} />

              {/* Legal */}
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/terms" element={<Terms />} />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            </Suspense>
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
