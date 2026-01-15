import { trpc } from "@/lib/trpc";
import {
  GOOGLE_CLIENT_ID,
  GoogleUser,
  getStoredToken,
  getStoredUser,
  storeAuth,
  clearAuth
} from "@/lib/google-auth";
import { useGoogleLogin, googleLogout } from "@react-oauth/google";
import { useCallback, useEffect, useState } from "react";

type AuthState = {
  user: { id: number; openId: string; name: string | null; email: string | null } | null;
  googleUser: GoogleUser | null;
  token: string | null;
  loading: boolean;
  isAuthenticated: boolean;
};

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    googleUser: null,
    token: null,
    loading: true,
    isAuthenticated: false,
  });

  const utils = trpc.useUtils();

  // Query database user when we have a token
  const meQuery = trpc.auth.me.useQuery(undefined, {
    enabled: !!authState.token,
    retry: false,
    refetchOnWindowFocus: false,
  });

  // Initialize auth state from localStorage
  useEffect(() => {
    const token = getStoredToken();
    const googleUser = getStoredUser();

    if (token && googleUser) {
      setAuthState(prev => ({
        ...prev,
        token,
        googleUser,
        loading: false,
        isAuthenticated: true,
      }));
    } else {
      setAuthState(prev => ({
        ...prev,
        loading: false,
        isAuthenticated: false,
      }));
    }
  }, []);

  // Update user from database query
  useEffect(() => {
    if (meQuery.data) {
      setAuthState(prev => ({
        ...prev,
        user: meQuery.data,
      }));
    }
  }, [meQuery.data]);

  // Google Login hook - only works when GoogleOAuthProvider is present
  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        // Get user info from Google
        const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
        });

        if (!userInfoResponse.ok) {
          throw new Error('Failed to get user info');
        }

        const userInfo = await userInfoResponse.json();
        const googleUser: GoogleUser = {
          id: userInfo.sub,
          email: userInfo.email,
          name: userInfo.name,
          picture: userInfo.picture,
        };

        // Store auth data
        storeAuth(tokenResponse.access_token, googleUser);

        setAuthState({
          user: null,
          googleUser,
          token: tokenResponse.access_token,
          loading: false,
          isAuthenticated: true,
        });

        // Invalidate user query to fetch from database
        utils.auth.me.invalidate();

        console.log('[Auth] Google sign in successful');
      } catch (error) {
        console.error('[Auth] Failed to get user info:', error);
      }
    },
    onError: (error) => {
      console.error('[Auth] Google sign in error:', error);
    },
  });

  const logout = useCallback(async () => {
    console.log('[Auth] Logging out...');

    // Clear Google session
    googleLogout();

    // Clear local storage
    clearAuth();

    // Clear state
    setAuthState({
      user: null,
      googleUser: null,
      token: null,
      loading: false,
      isAuthenticated: false,
    });

    // Clear all tRPC cache
    utils.auth.me.setData(undefined, null);
    await utils.invalidate();

    // Redirect to login
    window.location.href = '/login';
  }, [utils]);

  const signInWithGoogle = useCallback(() => {
    if (!GOOGLE_CLIENT_ID) {
      console.error('[Auth] Google Client ID not configured');
      alert('Google-kirjautuminen ei ole konfiguroitu. Lisää VITE_GOOGLE_CLIENT_ID .env tiedostoon.');
      return;
    }
    googleLogin();
  }, [googleLogin]);

  return {
    user: authState.user,
    googleUser: authState.googleUser,
    token: authState.token,
    loading: authState.loading || meQuery.isLoading,
    isAuthenticated: authState.isAuthenticated,
    error: meQuery.error,
    refresh: () => meQuery.refetch(),
    logout,
    signInWithGoogle,
  };
}
