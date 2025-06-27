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
  const { user, loading, session } = useAuth();
  const { isOnline } = useOfflineStorage();

  // Floating Live Notes modal state
  const [showLiveNotes, setShowLiveNotes] = useState(false);
  const [showSuggest, setShowSuggest] = useState(false);

  // Subscription status
  const [isPremium, setIsPremium] = useState<boolean | null>(null);
  const [isLoadingPayment, setIsLoadingPayment] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [currency, setCurrency] = useState<'INR' | 'USD'>('INR');
  const [price, setPrice] = useState(199); // INR default

  useEffect(() => {
    if (user) {
      fetchPremiumStatus();
    }
  }, [user]);

  const fetchPremiumStatus = async () => {
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

  // Detect user country and set currency/price
  useEffect(() => {
    fetch('https://ipapi.co/json/')
      .then(res => res.json())
      .then(data => {
        if (data && data.country_code === 'US') {
          setCurrency('USD');
          setPrice(3); // $3/month for US
        } else {
          setCurrency('INR');
          setPrice(199);
        }
      })
      .catch(() => {
        setCurrency('INR');
        setPrice(199);
      });
  }, []);

  useEffect(() => {
    if (isPremium === false && user && user.email && session?.access_token) {
      // Preload Razorpay script
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      document.body.appendChild(script);

      // Pre-create payment link
      setIsLoadingPayment(true);
      fetch('https://yjdcshkqgzcubniinwoc.supabase.co/functions/v1/create-razorpay-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ user_id: user.id, email: user.email }),
      })
        .then(res => res.json())
        .then(data => {
          console.log('Razorpay subscription response:', data);
          if (data.short_url) {
            setPaymentUrl(data.short_url);
          } else {
            setPaymentUrl(null);
            alert('Failed to get payment link. Please try again or contact support.');
          }
        })
        .catch(err => {
          console.error('Error fetching payment link:', err);
          setPaymentUrl(null);
          alert('Error connecting to payment server. Please try again.');
        })
        .finally(() => setIsLoadingPayment(false));

      return () => {
        document.body.removeChild(script);
      };
    }
  }, [isPremium, user, session]);

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

  // Show paywall if not subscribed
  if (isPremium === false) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-gray-900">
        <div className="bg-white rounded-3xl p-10 shadow-2xl text-center max-w-md w-full border border-purple-200/40 relative">
          <div className="flex justify-center mb-6">
            <span className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 shadow-lg">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 48 48" className="w-12 h-12 text-white"><path stroke="currentColor" strokeWidth="2" d="M24 6v36M6 24h36"/></svg>
            </span>
          </div>
          <h2 className="text-3xl font-extrabold mb-2 text-gray-900">Unlock All Features</h2>
          <p className="mb-6 text-gray-600 text-lg">Get unlimited access to all study tools, flashcards, analytics, and more.</p>
          <div className="mb-6">
            <ul className="text-left text-gray-700 space-y-2 mx-auto max-w-xs">
              <li className="flex items-center gap-2"><span className="text-green-500">✔</span> Unlimited AI Flashcards</li>
              <li className="flex items-center gap-2"><span className="text-green-500">✔</span> Practice Tests & Analytics</li>
              <li className="flex items-center gap-2"><span className="text-green-500">✔</span> Smart Notifications</li>
              <li className="flex items-center gap-2"><span className="text-green-500">✔</span> Study Plan Generator</li>
              <li className="flex items-center gap-2"><span className="text-green-500">✔</span> Social & Collaboration</li>
            </ul>
          </div>
          <div className="mb-8">
            <span className="inline-block bg-gradient-to-r from-purple-600 to-pink-600 text-white text-2xl font-bold px-8 py-3 rounded-2xl shadow-lg">
              {currency === 'USD' ? '$' : '₹'}{price} <span className="text-base font-medium">/ month</span>
            </span>
          </div>
          <button
            onClick={() => {
              console.log('Subscribe button clicked. paymentUrl:', paymentUrl);
              if (paymentUrl) window.open(paymentUrl, '_blank');
            }}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-4 px-6 rounded-2xl text-xl shadow-xl transition-all duration-200 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed"
            disabled={!paymentUrl || isLoadingPayment}
          >
            {isLoadingPayment ? 'Loading...' : 'Subscribe Now'}
          </button>
          <p className="mt-6 text-gray-400 text-xs">Cancel anytime. Secure payment via Razorpay.</p>
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