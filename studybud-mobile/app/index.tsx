import { useEffect } from 'react';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';

export default function Index() {
    useEffect(() => {
        checkAuth();
    }, []);

    const checkAuth = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            // Check role
            const { data: profile } = await supabase
                .from('user_profiles')
                .select('role')
                .eq('id', session.user.id)
                .single();

            if (profile?.role === 'teacher') {
                router.replace('/teacher-panel');
            } else {
                router.replace('/(tabs)/home');
            }
        } else {
            router.replace('/landing');
        }
    };

    return null;
}
