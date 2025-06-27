// Utility to check if a user is subscribed (no trial logic)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export async function isUserPremium(user_id: string): Promise<{ premium: boolean }> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('status')
    .eq('user_id', user_id)
    .single();

  if (error || !data) return { premium: false };
  if (data.status === 'active') return { premium: true };
  return { premium: false };
} 