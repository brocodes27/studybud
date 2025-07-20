import React, { useEffect, useState, createContext, useContext, ReactNode } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchUserAndRole = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.auth.getUser();
        if (data?.user) {
          if (isMounted) setUser(data.user);
          // Fetch role from user_profiles
          const { data: profile, error: profileError } = await supabase
            .from('user_profiles')
            .select('role')
            .eq('id', data.user.id)
            .single();
          console.log('Fetched profile for AuthContext:', profile, 'Error:', profileError);
          if (isMounted) setRole(profile?.role || 'student');
        } else {
          if (isMounted) {
            setUser(null);
            setRole(null);
          }
        }
      } catch (err) {
        if (isMounted) {
          setUser(null);
          setRole(null);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchUserAndRole();

    // Listen for auth state changes
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user);
        // Optionally re-fetch role here if needed
        supabase
          .from('user_profiles')
          .select('role')
          .eq('id', session.user.id)
          .single()
          .then(({ data: profile }) => setRole(profile?.role || 'student'));
      } else {
        setUser(null);
        setRole(null);
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

  return (
    <AuthContext.Provider value={{ user, session, loading, role, signIn, signUp }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}