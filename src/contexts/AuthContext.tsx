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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  console.log('AuthProvider mounted'); // Debug log
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('getSession resolved:', session); // Debug log
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('onAuthStateChange:', event, session); // Debug log
        setSession(session);
        setUser(session?.user ?? null);
        
        // Sync profile email when user changes
        if (session?.user) {
          await syncProfileEmail(session.user);
        }
        
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user && loading) {
      setLoading(false);
    }
  }, [user, loading]);

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
      updateProfile
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