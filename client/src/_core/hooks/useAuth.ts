import { supabase } from "@/lib/supabase";
import { trpc } from "@/lib/trpc";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { User as SupabaseUser, Session } from "@supabase/supabase-js";

type AuthState = {
  user: { id: number; openId: string; name: string | null; email: string | null } | null;
  supabaseUser: SupabaseUser | null;
  session: Session | null;
  loading: boolean;
  isAuthenticated: boolean;
};

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    supabaseUser: null,
    session: null,
    loading: true,
    isAuthenticated: false,
  });
  
  const utils = trpc.useUtils();
  
  // Query database user when we have a session
  const meQuery = trpc.auth.me.useQuery(undefined, {
    enabled: !!authState.session,
    retry: false,
    refetchOnWindowFocus: false,
  });

  // Initialize auth state
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthState(prev => ({
        ...prev,
        session,
        supabaseUser: session?.user ?? null,
        loading: false,
        isAuthenticated: !!session,
      }));
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[Auth] State changed:', event);
        setAuthState(prev => ({
          ...prev,
          session,
          supabaseUser: session?.user ?? null,
          loading: false,
          isAuthenticated: !!session,
        }));
        
        // Invalidate user query on auth change
        if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
          utils.auth.me.invalidate();
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [utils]);

  // Update user from database query
  useEffect(() => {
    if (meQuery.data) {
      setAuthState(prev => ({
        ...prev,
        user: meQuery.data,
      }));
    }
  }, [meQuery.data]);

  const logout = useCallback(async () => {
    try {
      await supabase.auth.signOut();
      setAuthState({
        user: null,
        supabaseUser: null,
        session: null,
        loading: false,
        isAuthenticated: false,
      });
      utils.auth.me.setData(undefined, null);
    } catch (error) {
      console.error('[Auth] Logout error:', error);
    }
  }, [utils]);

  const signInWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      console.error('[Auth] Google sign in error:', error);
    }
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      throw error;
    }
  }, []);

  const signUpWithEmail = useCallback(async (email: string, password: string, name?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
        },
      },
    });
    if (error) {
      throw error;
    }
  }, []);

  const signInWithMagicLink = useCallback(async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      throw error;
    }
  }, []);

  return {
    user: authState.user,
    supabaseUser: authState.supabaseUser,
    session: authState.session,
    loading: authState.loading || meQuery.isLoading,
    isAuthenticated: authState.isAuthenticated,
    error: meQuery.error,
    refresh: () => meQuery.refetch(),
    logout,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    signInWithMagicLink,
  };
}
