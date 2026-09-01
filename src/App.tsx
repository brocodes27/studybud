import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Auth from './pages/Auth';
import { Toaster } from './components/Toaster';
import { useToast } from './hooks/useToast';
import { flags } from './lib/featureFlags';

const PublicReceipt = lazy(() =>
  import('./pages/PublicReceipt').then((m) => ({ default: m.PublicReceipt })),
);
const CurveApp = lazy(() => import('./curve/CurveApp').then((m) => ({ default: m.CurveApp })));
const CurveLanding = lazy(() =>
  import('./curve/CurveLanding').then((m) => ({ default: m.CurveLanding })),
);
// Scroll-scrubbed camera flight. Heavy (video chain), so it stays code-split.
const WorldLanding = lazy(() =>
  import('./curve/WorldLanding').then((m) => ({ default: m.WorldLanding })),
);
const ExamEmergencySprint = lazy(() =>
  import('./curve/ExamEmergencySprint').then((m) => ({ default: m.ExamEmergencySprint })),
);

/**
 * Legacy legal/billing pages are heavy aggregates that pull in large chunks of
 * the pre-Curve app. They are code-split behind VITE_LEGACY_PAGES (P0.2) so the
 * consumer bundle stays lean; school accounts run with the flag ON.
 */
const Privacy = flags.legacyPages
  ? lazy(() => import('./pages/Privacy'))
  : null;
const Terms = flags.legacyPages
  ? lazy(() => import('./pages/Terms'))
  : null;
const SubscriptionPage = flags.legacyPages
  ? lazy(() => import('./components/SubscriptionPage'))
  : null;

function LoadingScreen() {
  return (
    <div className="curve-root grid min-h-screen place-items-center bg-[#0a0814] text-white">
      <div className="text-center">
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-[#8b5cf6]/20 border-t-[#8b5cf6]" />
        <p className="mt-4 text-sm font-bold text-[#a79fb5]">Loading Curve...</p>
      </div>
    </div>
  );
}

function AppContent() {
  const { user, loading } = useAuth();
  const { toasts, removeToast } = useToast();

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !import.meta.env.DEV) return;
    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
      .catch(() => undefined);
  }, []);

  if (loading) return <LoadingScreen />;

  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        {/* Public Shareable Receipts & Informational Pages */}
        <Route path="/m/:slug" element={<PublicReceipt />} />
        {flags.legacyPages && Privacy ? (
          <Route path="/privacy" element={<Privacy />} />
        ) : (
          <Route path="/privacy" element={<Navigate to="/" replace />} />
        )}
        {flags.legacyPages && Terms ? (
          <Route path="/terms" element={<Terms />} />
        ) : (
          <Route path="/terms" element={<Navigate to="/" replace />} />
        )}
        {flags.legacyPages && SubscriptionPage ? (
          <>
            <Route path="/subscription" element={<SubscriptionPage />} />
            <Route path="/pricing" element={<SubscriptionPage />} />
          </>
        ) : (
          <>
            <Route path="/subscription" element={<Navigate to="/" replace />} />
            <Route path="/pricing" element={<Navigate to="/" replace />} />
          </>
        )}
        <Route path="/emergency/:enrollmentId" element={<ExamEmergencySprint />} />
        <Route path="/emergency" element={<ExamEmergencySprint />} />

        {!user ? (
          <>
            <Route path="/auth" element={<Auth />} />
            <Route path="/" element={<WorldLanding />} />
            <Route path="/classic" element={<CurveLanding />} />
            <Route path="*" element={<CurveLanding />} />
          </>
        ) : (
          <Route path="*" element={<CurveApp />} />
        )}
      </Routes>
      <Toaster toasts={toasts} removeToast={removeToast} />
    </Suspense>
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
