// Utility to check if a user is subscribed (including email extensions)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export async function isUserPremium(user_id: string): Promise<{ premium: boolean }> {
  // 1. Check for active subscription first
  const { data: subData, error: subError } = await supabase
    .from('subscriptions')
    .select('status')
    .eq('user_id', user_id);

  if (subData && subData.length > 0 && subData[0].status === 'active') {
    return { premium: true };
  }

  // 2. If no active subscription, check for email extension
  // First get the user's email
  const { data: userData, error: userError } = await supabase.auth.admin.getUserById(user_id);
  
  if (userError || !userData?.user?.email) {
    return { premium: false };
  }

  const userEmail = userData.user.email.toLowerCase();
  
  // Check premium email extensions
  const { data: extData, error: extError } = await supabase
    .from('premium_email_extensions')
    .select('extension');
    
  if (extError || !extData) {
    return { premium: false };
  }

  // Check if user's email matches any premium extension
  for (const item of extData) {
    const extension = item.extension.trim().toLowerCase();
    if (extension.startsWith('*.')) {
      const domain = extension.substring(2);
      if (userEmail.endsWith(domain)) {
        return { premium: true };
      }
    } else {
      if (userEmail.includes(extension)) {
        return { premium: true };
      }
    }
  }

  // If neither subscription nor email extension, not premium
  return { premium: false };
} 