import { useEffect, useState, createContext, useContext, ReactNode, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { User, Session } from '@supabase/supabase-js';

const ACTIVE_SCHOOL_KEY = 'elevenfolks.activeSchoolId';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  role: string | null;
  isPremium: boolean;
  isAdmin: boolean;
  isChainAdmin: boolean;
  chainIds: string[];
  accessibleSchools: Array<{ id: string; name: string; chain_id: string | null }>;
  fullName: string | null;
  trialStart: Date | null;
  trialActive: boolean;
  onboardingCompleted: boolean;
  schoolId: string | null;
  setActiveSchoolId: (schoolId: string | null) => Promise<void>;
  grade: string | null;
  accountType: string | null;
  schoolEntitlements: any;
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

function readStoredSchoolId() {
  try {
    return localStorage.getItem(ACTIVE_SCHOOL_KEY);
  } catch {
    return null;
  }
}

function writeStoredSchoolId(schoolId: string | null) {
  try {
    if (schoolId) localStorage.setItem(ACTIVE_SCHOOL_KEY, schoolId);
    else localStorage.removeItem(ACTIVE_SCHOOL_KEY);
  } catch {
    /* ignore */
  }
}

let isSetActiveSchoolContextSupported = true;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [role, setRole] = useState<string | null>(null);
  const [isPremium, setIsPremium] = useState<boolean>(false);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isChainAdmin, setIsChainAdmin] = useState<boolean>(false);
  const [chainIds, setChainIds] = useState<string[]>([]);
  const [accessibleSchools, setAccessibleSchools] = useState<Array<{ id: string; name: string; chain_id: string | null }>>([]);
  const [fullName, setFullName] = useState<string | null>(null);
  const [trialStart, setTrialStart] = useState<Date | null>(null);
  const [trialActive, setTrialActive] = useState<boolean>(false);
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean>(true);
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [grade, setGrade] = useState<string | null>(null);
  const [accountType, setAccountType] = useState<string | null>(null);
  const [schoolEntitlements, setSchoolEntitlements] = useState<any>(null);

  const setActiveSchoolId = useCallback(async (nextSchoolId: string | null) => {
    if (nextSchoolId && isSetActiveSchoolContextSupported) {
      try {
        const { error } = await supabase.rpc('set_active_school_context', {
          p_school_id: nextSchoolId,
        });
        if (error) {
          isSetActiveSchoolContextSupported = false;
        }
      } catch {
        isSetActiveSchoolContextSupported = false;
      }
    }
    setSchoolId(nextSchoolId);
    writeStoredSchoolId(nextSchoolId);
    if (!nextSchoolId) {
      setSchoolEntitlements(null);
      return;
    }
    void supabase
      .from('school_entitlements')
      .select('plan, features, expires_at')
      .eq('school_id', nextSchoolId)
      .maybeSingle()
      .then(({ data }) => setSchoolEntitlements(data));
  }, []);

  const applyAuthState = useCallback(async (userId: string, authMetadataRole?: string | null) => {
    const claimResult = await supabase.rpc('claim_pending_invitations');
    if (claimResult.error && claimResult.error.code !== 'PGRST202') {
      // Ignore missing RPC before migration; surface other claim failures in console only.
      console.warn('claim_pending_invitations:', claimResult.error.message);
    }

    const [profileRes, membershipRes, chainRes] = await Promise.all([
      supabase
        .from('user_profiles')
        .select('role, account_type, is_admin, full_name, created_at, trial_active, onboarding_completed, school_id, grade')
        .eq('id', userId)
        .maybeSingle(),
      supabase
        .from('memberships')
        .select('role, school_id')
        .eq('user_id', userId)
        .eq('status', 'active'),
      supabase
        .from('chain_memberships')
        .select('chain_id, role')
        .eq('user_id', userId)
        .eq('status', 'active'),
    ]);

    const profile = profileRes.data;
    const memberships = membershipRes.data || [];
    const chains = chainRes.data || [];
    const nextChainIds = chains.map((row: any) => row.chain_id).filter(Boolean);
    const chainAdmin = chains.some((row: any) => row.role === 'chain_admin');

    const membershipSchoolIds = memberships.map((row: any) => row.school_id).filter(Boolean);
    let schools: Array<{ id: string; name: string; chain_id: string | null }> = [];

    if (nextChainIds.length) {
      const { data } = await supabase
        .from('schools')
        .select('id, name, chain_id')
        .in('chain_id', nextChainIds)
        .order('name');
      schools = data || [];
    }

    const missingMembershipIds = membershipSchoolIds.filter(
      (id: string) => !schools.some((school) => school.id === id),
    );
    if (missingMembershipIds.length) {
      const { data } = await supabase
        .from('schools')
        .select('id, name, chain_id')
        .in('id', missingMembershipIds);
      schools = [...schools, ...(data || [])];
    }

    if (profile?.is_admin) {
      const { data } = await supabase.from('schools').select('id, name, chain_id').order('name').limit(200);
      if (data?.length) schools = data;
    }

    const primaryMembership =
      memberships.find((row: any) => row.role === 'org_admin' || row.role === 'principal') ||
      memberships[0] ||
      null;

    let resolvedRole =
      normalizeRole(primaryMembership?.role) ||
      normalizeRole(profile?.role) ||
      normalizeRole(profile?.account_type) ||
      normalizeRole(authMetadataRole);

    if (chainAdmin && !['org_admin', 'principal', 'teacher', 'parent'].includes(String(resolvedRole))) {
      resolvedRole = 'chain_admin';
    }
    if (chainAdmin && !resolvedRole) resolvedRole = 'chain_admin';

    const stored = readStoredSchoolId();
    const preferredSchoolId =
      (stored && schools.some((school) => school.id === stored) && stored) ||
      primaryMembership?.school_id ||
      profile?.school_id ||
      schools[0]?.id ||
      null;

    if (preferredSchoolId && isSetActiveSchoolContextSupported) {
      try {
        const contextResult = await supabase.rpc('set_active_school_context', {
          p_school_id: preferredSchoolId,
        });
        if (contextResult.error) {
          isSetActiveSchoolContextSupported = false;
        }
      } catch {
        isSetActiveSchoolContextSupported = false;
      }
    }

    let entitlements = null;
    if (preferredSchoolId) {
      const { data } = await supabase
        .from('school_entitlements')
        .select('plan, features, expires_at')
        .eq('school_id', preferredSchoolId)
        .maybeSingle();
      entitlements = data;
    }

    return {
      profile,
      primaryMembership,
      entitlements,
      chainIds: nextChainIds,
      isChainAdmin: chainAdmin,
      schools,
      preferredSchoolId,
      resolvedRole,
      profileError: profileRes.error,
      membershipError: membershipRes.error,
      chainError: chainRes.error,
    };
  }, []);

  const publishState = useCallback((payload: Awaited<ReturnType<typeof applyAuthState>>) => {
    const { profile: p, primaryMembership: m, entitlements, chainIds: nextChainIds, isChainAdmin: chainAdmin, schools, preferredSchoolId, resolvedRole } = payload;

    setIsAdmin(p?.is_admin ?? false);
    setIsChainAdmin(chainAdmin);
    setChainIds(nextChainIds);
    setAccessibleSchools(schools);
    setFullName(p?.full_name ?? null);
    setTrialStart(p?.created_at ? new Date(p.created_at) : null);
    setTrialActive(p?.trial_active ?? false);
    setOnboardingCompleted(p?.onboarding_completed ?? false);
    setGrade(p?.grade ?? null);
    setRole(resolvedRole);
    setSchoolId(preferredSchoolId);
    writeStoredSchoolId(preferredSchoolId);
    setAccountType(m?.role ?? p?.account_type ?? resolvedRole);
    setSchoolEntitlements(entitlements);
  }, []);

  const clearState = useCallback(() => {
    setUser(null);
    setRole(null);
    setIsPremium(false);
    setIsAdmin(false);
    setIsChainAdmin(false);
    setChainIds([]);
    setAccessibleSchools([]);
    setFullName(null);
    setTrialStart(null);
    setTrialActive(false);
    setSchoolId(null);
    setGrade(null);
    setAccountType(null);
    setSchoolEntitlements(null);
  }, []);

  const refreshProfile = async () => {
    if (!user) return;
    const payload = await applyAuthState(user.id, user.user_metadata?.role);
    publishState(payload);
  };

  useEffect(() => {
    let isMounted = true;

    const checkPremiumStatus = async (authUser: any) => {
      if (!authUser || !isMounted) return;

      const { data: subData } = await supabase
        .from('subscriptions')
        .select('status')
        .eq('user_id', authUser.id);

      if (subData && subData.length > 0 && subData[0].status === 'active') {
        if (isMounted) setIsPremium(true);
        return;
      }

      if (!authUser.email) {
        if (isMounted) setIsPremium(false);
        return;
      }

      const { data: extData } = await supabase.from('premium_email_extensions').select('extension');
      if (!extData) {
        if (isMounted) setIsPremium(false);
        return;
      }

      const userEmail = authUser.email.toLowerCase();
      for (const item of extData) {
        const extension = item.extension.trim().toLowerCase();
        if (extension.startsWith('*.')) {
          const domain = extension.substring(2);
          if (userEmail.endsWith(domain)) {
            if (isMounted) setIsPremium(true);
            return;
          }
        } else if (userEmail.includes(extension)) {
          if (isMounted) setIsPremium(true);
          return;
        }
      }

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
          const payload = await applyAuthState(
            data.session.user.id,
            data.session.user.user_metadata?.role,
          );
          if (payload.profileError || payload.membershipError || payload.chainError) {
            console.error(
              'Error fetching profile/membership:',
              payload.profileError || payload.membershipError || payload.chainError,
            );
          }
          if (isMounted) publishState(payload);
        } else if (isMounted) {
          clearState();
        }
      } catch {
        if (isMounted) clearState();
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchUserAndRole();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession?.user) {
        setUser(nextSession.user);
        checkPremiumStatus(nextSession.user);
        applyAuthState(nextSession.user.id, nextSession.user.user_metadata?.role).then((payload) => {
          if (payload.profileError || payload.membershipError || payload.chainError) {
            console.error(
              'Error re-fetching profile/membership:',
              payload.profileError || payload.membershipError || payload.chainError,
            );
          }
          if (isMounted) publishState(payload);
        });
      } else {
        clearState();
      }
    });

    return () => {
      isMounted = false;
      listener?.subscription.unsubscribe();
    };
  }, [applyAuthState, clearState, publishState]);

  const signIn = async (email: string, password: string) => {
    return await supabase.auth.signInWithPassword({ email, password });
  };

  const signUp = async (email: string, password: string, meta: any) => {
    return await supabase.auth.signUp({
      email,
      password,
      options: { data: meta },
    });
  };

  const signOut = async () => {
    writeStoredSchoolId(null);
    return await supabase.auth.signOut();
  };

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
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        role,
        isPremium,
        isAdmin,
        isChainAdmin,
        chainIds,
        accessibleSchools,
        fullName,
        trialStart,
        trialActive,
        onboardingCompleted,
        schoolId,
        setActiveSchoolId,
        grade,
        accountType,
        schoolEntitlements,
        refreshProfile,
        signIn,
        signUp,
        signOut,
        signInWithGoogle,
      }}
    >
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
