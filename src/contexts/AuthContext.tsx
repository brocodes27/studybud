import { useEffect, useState, createContext, useContext, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { User, Session } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  role: string | null;
  isPremium: boolean;
  isAdmin: boolean;
  fullName: string | null;
  trialStart: Date | null;
  trialActive: boolean;
  onboardingCompleted: boolean;
  schoolId: string | null;
  grade: string | null;
  accountType: string | null;
  refreshProfile: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<any>;
  signUp: (email: string, password: string, meta: any) => Promise<any>;
  signOut: () => Promise<any>;
  signInWithGoogle: () => Promise<any>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const normalizeRole = (value: unknown) => {
  return typeof value === 'string' ? value.trim().toLowerCase() : null;
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [role, setRole] = useState<string | null>(null);
  const [isPremium, setIsPremium] = useState<boolean>(false);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [fullName, setFullName] = useState<string | null>(null);
  const [trialStart, setTrialStart] = useState<Date | null>(null);
  const [trialActive, setTrialActive] = useState<boolean>(false);
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean>(true); // Default true to avoid flash, will be set correctly below
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [grade, setGrade] = useState<string | null>(null);
  const [accountType, setAccountType] = useState<string | null>(null);

  const refreshProfile = async () => {
    if (!user) return;
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role, is_admin, full_name, created_at, trial_active, onboarding_completed, school_id, grade, account_type')
      .eq('id', user.id);

    if (profile && profile.length > 0) {
      const p = profile[0];
      setRole(normalizeRole(p.role));
      setIsAdmin(p.is_admin ?? false);
      setFullName(p.full_name ?? null);
      setTrialStart(p.created_at ? new Date(p.created_at) : null);
      setTrialActive(p.trial_active ?? false);
      setOnboardingCompleted(p.onboarding_completed ?? false);
      setSchoolId(p.school_id ?? null);
      setGrade(p.grade ?? null);
      setAccountType(p.account_type ?? null);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const checkPremiumStatus = async (user: any) => {
      if (!user || !isMounted) return;

      // 1. Check for subscription
      const { data: subData } = await supabase
        .from('subscriptions')
        .select('status')
        .eq('user_id', user.id);

      if (subData && subData.length > 0 && subData[0].status === 'active') {
        if (isMounted) setIsPremium(true);
        return;
      }

      // 2. Check for email extension if no active subscription
      if (!user.email) {
        if (isMounted) setIsPremium(false);
        return;
      }

      const { data: extData } = await supabase.from('premium_email_extensions').select('extension');
      if (!extData) {
        if (isMounted) setIsPremium(false);
        return;
      }

      const userEmail = user.email.toLowerCase();
      for (const item of extData) {
        const extension = item.extension.trim().toLowerCase();
        if (extension.startsWith('*.')) {
          const domain = extension.substring(2);
          if (userEmail.endsWith(domain)) {
            if (isMounted) setIsPremium(true);
            return;
          }
        } else {
          if (userEmail.includes(extension)) {
            if (isMounted) setIsPremium(true);
            return;
          }
        }
      }

      // If neither, not premium
      if (isMounted) setIsPremium(false);
    };

    const fetchUserAndRole = async () => {
      setLoading(true);
      try {
        const { data } = await supabase.auth.getSession();
        if (data?.session) {
          if (isMounted) {
            setUser(data.session.user);
            setSession(data.session);
            checkPremiumStatus(data.session.user);
          }
          // Fetch role from user_profiles
          const { data: profile, error: profileError } = await supabase
            .from('user_profiles')
            .select('role, is_admin, full_name, created_at, trial_active, onboarding_completed, school_id, grade, account_type')
            .eq('id', data.session.user.id);

          if (profileError) {
            console.error('Error fetching profile:', profileError);
          }
          if (isMounted) {
            const hasProfile = Array.isArray(profile) && profile.length > 0;
            const p = profile?.[0];
            setRole(normalizeRole(hasProfile ? p?.role : data.session.user.user_metadata?.role));
            setIsAdmin(hasProfile ? (p?.is_admin ?? false) : false);
            setFullName(hasProfile ? (p?.full_name ?? null) : null);
            setTrialStart(hasProfile && p?.created_at ? new Date(p.created_at) : null);
            setTrialActive(hasProfile ? (p?.trial_active ?? false) : false);
            setOnboardingCompleted(hasProfile ? (p?.onboarding_completed ?? false) : false);
            setSchoolId(hasProfile ? (p?.school_id ?? null) : null);
            setGrade(hasProfile ? (p?.grade ?? null) : null);
            setAccountType(hasProfile ? (p?.account_type ?? null) : null);
          }
        } else {
          if (isMounted) {
            setUser(null);
            setRole(null);
            setIsPremium(false);
            setIsAdmin(false);
            setFullName(null);
            setTrialStart(null);
            setTrialActive(false);
            setSchoolId(null);
            setGrade(null);
            setAccountType(null);
          }
        }
      } catch (err) {
        if (isMounted) {
          setUser(null);
          setRole(null);
          setIsPremium(false);
          setIsAdmin(false);
          setFullName(null);
          setTrialStart(null);
          setTrialActive(false);
          setSchoolId(null);
          setGrade(null);
          setAccountType(null);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };


    fetchUserAndRole();

    // Listen for auth state changes
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        setUser(session.user);
        checkPremiumStatus(session.user);
        // Optionally re-fetch role here if needed
        supabase
          .from('user_profiles')
          .select('role, is_admin, full_name, created_at, trial_active, onboarding_completed, school_id, grade, account_type')
          .eq('id', session.user.id)
          .then(({ data: profile, error }) => {
            if (error) {
              console.error('Error re-fetching profile:', error);
            }
            const hasProfile = Array.isArray(profile) && profile.length > 0;
            const p = profile?.[0];
            setRole(normalizeRole(hasProfile ? p?.role : session.user.user_metadata?.role));
            setIsAdmin(hasProfile ? (p?.is_admin ?? false) : false);
            setFullName(hasProfile ? (p?.full_name ?? null) : null);
            setTrialStart(hasProfile && p?.created_at ? new Date(p.created_at) : null);
            setTrialActive(hasProfile ? (p?.trial_active ?? false) : false);
            setOnboardingCompleted(hasProfile ? (p?.onboarding_completed ?? false) : false);
            setGrade(hasProfile ? (p?.grade ?? null) : null);
            setSchoolId(hasProfile ? (p?.school_id ?? null) : null);
            setAccountType(hasProfile ? (p?.account_type ?? null) : null);
          });
      } else {
        setUser(null);
        setRole(null);
        setIsPremium(false);
        setIsAdmin(false);
        setFullName(null);
        setSchoolId(null);
        setGrade(null);
        setAccountType(null);
      }
    });

    return () => {
      isMounted = false;
      listener?.subscription.unsubscribe();
    };
  }, []);

  // Add signIn and signUp functions
  const signIn = async (email: string, password: string) => {
    return await supabase.auth.signInWithPassword({ email, password });
  };

  const signUp = async (email: string, password: string, meta: any) => {
    return await supabase.auth.signUp({
      email,
      password,
      options: { data: meta }
    });
  };

  const signOut = async () => {
    return await supabase.auth.signOut();
  };

  // Google OAuth sign-in
  const signInWithGoogle = async () => {
    return await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });
  };

  return (
    <AuthContext.Provider value={{
      user, session, loading, role, isPremium, isAdmin, fullName,
      trialStart, trialActive, onboardingCompleted, schoolId, grade, accountType, refreshProfile,
      signIn, signUp, signOut, signInWithGoogle
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}