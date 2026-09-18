import { lazy, Suspense, useEffect } from "react";
import {
  BrowserRouter as Router,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { LearningAuth as Auth } from "./learning/Auth";
import { Toaster } from "./components/Toaster";
import { useToast } from "./hooks/useToast";
import { isStudentRole, STAFF_SIGN_IN_MESSAGE } from "./lib/consumerAccess";
import { LearningEntry, OnboardingDemo } from "./learning/Onboarding";

const PublicReceipt = lazy(() =>
  import("./pages/PublicReceipt").then((m) => ({ default: m.PublicReceipt })),
);
const CurveApp = lazy(() =>
  import("./curve/CurveApp").then((m) => ({ default: m.CurveApp })),
);
const LearningLanding = lazy(() =>
  import("./learning/Landing").then((m) => ({ default: m.LearningLanding })),
);
const DemoWorkspace = lazy(() =>
  import("./learning/Workspace").then((m) => ({ default: m.DemoWorkspace })),
);
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));
function LoadingScreen() {
  return (
    <div className="grid min-h-screen place-items-center bg-[#f5f8f5] text-[#252824]">
      <div className="text-center">
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-[#8b5cf6]/20 border-t-[#8b5cf6]" />
        <p className="mt-4 text-sm font-bold text-[#a79fb5]">
          Loading Curve...
        </p>
      </div>
    </div>
  );
}

function AppContent() {
  const { user, loading, role, accountType, signOut } = useAuth();
  const { toasts, removeToast } = useToast();

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !import.meta.env.DEV) return;
    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) =>
        Promise.all(
          registrations.map((registration) => registration.unregister()),
        ),
      )
      .catch(() => undefined);
  }, []);

  if (loading) return <LoadingScreen />;
  if (user && !isStudentRole(role || accountType || user.user_metadata?.role)) {
    return (
      <div className="learn loading-state">
        <p>{STAFF_SIGN_IN_MESSAGE}</p>
        <button className="learn-button dark" onClick={() => void signOut()}>
          Sign out
        </button>
      </div>
    );
  }

  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        {/* Public Shareable Receipts & Informational Pages */}
        <Route path="/m/:slug" element={<PublicReceipt />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/demo" element={<DemoWorkspace />} />
        <Route path="/welcome" element={<LearningLanding />} />
        <Route path="/demo/onboarding" element={<OnboardingDemo />} />
        <Route
          path="/emergency/:enrollmentId"
          element={<Navigate to={user ? "/library" : "/auth"} replace />}
        />
        <Route
          path="/emergency"
          element={<Navigate to={user ? "/library" : "/auth"} replace />}
        />

        {!user ? (
          <>
            <Route path="/auth" element={<Auth />} />
            <Route
              path="/onboarding"
              element={<Navigate to="/auth" replace />}
            />
            <Route
              path="/subscription"
              element={<Navigate to="/auth" replace />}
            />
            <Route path="/pricing" element={<Navigate to="/auth" replace />} />
            <Route path="/" element={<LearningLanding />} />
            <Route path="/classic" element={<LearningLanding />} />
            <Route path="*" element={<LearningLanding />} />
          </>
        ) : (
          <Route
            path="*"
            element={
              <LearningEntry key={user.id}>
                <CurveApp />
              </LearningEntry>
            }
          />
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
