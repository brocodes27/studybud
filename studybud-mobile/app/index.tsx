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
            router.replace('/(tabs)/home');
        } else {
            router.replace('/landing');
        }
    };

    return null;
}
