import React, { useEffect, useState, createContext, useContext, ReactNode } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [role, setRole] = useState<string | null>(null);
  const [isPremium, setIsPremium] = useState<boolean>(false);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [fullName, setFullName] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const checkPremiumStatus = async (user: any) => {
      if (!user || !isMounted) return;

      // 1. Check for subscription
      const { data: subData, error: subError } = await supabase
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
      
      const { data: extData, error: extError } = await supabase.from('premium_email_extensions').select('extension');
      if (extError || !extData) {
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
        const { data, error } = await supabase.auth.getSession();
        if (data?.session) {
          if (isMounted) {
            setUser(data.session.user);
            setSession(data.session);
            checkPremiumStatus(data.session.user);
          }
          // Fetch role from user_profiles
          const { data: profile, error: profileError } = await supabase
            .from('user_profiles')
            .select('role, is_admin, full_name')
            .eq('id', data.session.user.id);

          if (profileError) {
            console.error('Error fetching profile:', profileError);
          }
          if (isMounted) {
            setRole(profile?.[0]?.role || 'student');
            setIsAdmin(profile?.[0]?.is_admin || false);
            setFullName(profile?.[0]?.full_name || null);
          }
        } else {
          if (isMounted) {
            setUser(null);
            setRole(null);
            setIsPremium(false);
            setIsAdmin(false);
            setFullName(null);
          }
        }
      } catch (err) {
        if (isMounted) {
          setUser(null);
          setRole(null);
          setIsPremium(false);
          setIsAdmin(false);
          setFullName(null);
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
          .select('role, is_admin, full_name')
          .eq('id', session.user.id)
          .then(({ data: profile, error }) => {
            if (error) {
              console.error('Error re-fetching profile:', error);
            }
            setRole(profile?.[0]?.role || 'student');
            setIsAdmin(profile?.[0]?.is_admin || false);
            setFullName(profile?.[0]?.full_name || null);
          });
      } else {
        setUser(null);
        setRole(null);
        setIsPremium(false);
        setIsAdmin(false);
        setFullName(null);
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

  return (
    <AuthContext.Provider value={{ user, session, loading, role, isPremium, isAdmin, fullName, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}