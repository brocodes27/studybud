import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, userData: any) => Promise<any>;
  signIn: (email: string, password: string) => Promise<any>;
  signOut: () => Promise<void>;
  updateProfile: (updates: any) => Promise<any>;
  trialStart: Date | null;
  trialActive: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [trialStart, setTrialStart] = useState<Date | null>(null);
  const [trialActive, setTrialActive] = useState<boolean>(true);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);

  useEffect(() => {
    let mounted = true;

    const restoreSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      } catch (err) {
        if (!mounted) return;
        setLoading(false);
      }
    };

    restoreSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (user && loading) {
      setLoading(false);
    }
  }, [user, loading]);

  // Fetch trial info and is_admin after session/user is set
  useEffect(() => {
    const fetchProfileInfo = async () => {
      if (!user) return;
      const { data, error } = await supabase
        .from('user_profiles')
        .select('trial_start, trial_active, is_admin')
        .eq('id', user.id)
        .single();
      if (data) {
        setTrialStart(data.trial_start ? new Date(data.trial_start) : null);
        setTrialActive(data.trial_active !== false);
        setIsAdmin(!!data.is_admin);
      } else {
        setIsAdmin(false);
      }
    };
    fetchProfileInfo();
  }, [user]);

  // Ensure user_profiles row exists for every user (including OAuth)
  useEffect(() => {
    const ensureUserProfile = async () => {
      if (!user) return;
      await supabase.from('user_profiles').upsert({
        id: user.id,
        email: user.email,
        full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });
    };
    ensureUserProfile();
  }, [user]);

  const syncProfileEmail = async (user: User) => {
    if (!user?.email) return;
    
    try {
      const { error } = await supabase
        .from('user_profiles')
        .upsert({
          id: user.id,
          email: user.email,
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' });
      
      if (error) {
        console.warn('Failed to sync profile email:', error);
      }
    } catch (error) {
      console.warn('Error syncing profile email:', error);
    }
  };

  const signUp = async (email: string, password: string, userData: any) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: userData
      }
    });
    // Debug log for signUp response
    console.log('signUp data:', data);
    console.log('signUp error:', error);

    // Insert / update user_profiles row
    if (data.user) {
      // Debug log to verify values
      console.log('Upserting user_profiles:', {
        id: data.user.id,
        full_name: userData?.full_name ?? userData?.name ?? null,
        grade: userData?.grade ?? null,
        school: userData?.school ?? null,
        email: email, // Include email in the upsert
      });
      // Upsert with all fields including email
      const { error: profileError } = await supabase.from('user_profiles').upsert({
        id: data.user.id,
        full_name: userData?.full_name ?? userData?.name ?? null,
        grade: userData?.grade ?? null,
        school: userData?.school ?? null,
        email: email, // Explicitly include email
        trial_start: new Date().toISOString(),
        trial_active: true,
      });
      if (profileError) console.warn('Profile upsert failed:', profileError.message);
    } else {
      console.warn('No user returned from signUp, skipping profile upsert.');
    }

    return { data, error };
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    // Sync profile email after successful sign in
    if (data.user) {
      await syncProfileEmail(data.user);
    }
    
    return { data, error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const updateProfile = async (updates: any) => {
    if (!user) throw new Error('No user logged in');
    
    const { error } = await supabase
      .from('user_profiles')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id);
    
    if (error) throw error;
    return { data: null, error: null };
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      loading,
      signUp,
      signIn,
      signOut,
      updateProfile,
      trialStart,
      trialActive,
      isAdmin
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}