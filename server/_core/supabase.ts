import { createClient } from '@supabase/supabase-js';
import { ENV } from './env';

// Supabase Admin client for server-side operations
export const supabaseAdmin = createClient(
  ENV.supabaseUrl || '',
  ENV.supabaseServiceKey || '',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Verify Supabase JWT token and return user data
export async function verifySupabaseToken(accessToken: string) {
  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(accessToken);
    
    if (error || !user) {
      console.warn('[Supabase] Token verification failed:', error?.message);
      return null;
    }
    
    return {
      id: user.id,
      email: user.email || null,
      name: user.user_metadata?.full_name || user.user_metadata?.name || null,
    };
  } catch (error) {
    console.error('[Supabase] Token verification error:', error);
    return null;
  }
}
