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
        const { data, error } = await supabase.auth.getSession();
        if (data?.session) {
          if (isMounted) {
            setUser(data.session.user);
            setSession(data.session);
          }
          // Fetch role from user_profiles
          const { data: profile, error: profileError } = await supabase
            .from('user_profiles')
            .select('role')
            .eq('id', data.session.user.id);

          if (profileError) {
            console.error('Error fetching profile:', profileError);
          }
          console.log('Fetched profile for AuthContext:', profile, 'Error:', profileError);
          if (isMounted) setRole(profile?.[0]?.role || 'student');
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
      setSession(session);
      if (session?.user) {
        setUser(session.user);
        // Optionally re-fetch role here if needed
        supabase
          .from('user_profiles')
          .select('role')
          .eq('id', session.user.id)
          .then(({ data: profile, error }) => {
            if (error) {
              console.error('Error re-fetching profile:', error);
            }
            setRole(profile?.[0]?.role || 'student')
          });
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

  const signOut = async () => {
    return await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, role, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}