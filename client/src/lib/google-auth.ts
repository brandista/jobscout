// Google OAuth configuration
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

if (!GOOGLE_CLIENT_ID) {
  console.warn('[GoogleAuth] Missing VITE_GOOGLE_CLIENT_ID. Auth will not work.');
}

export { GOOGLE_CLIENT_ID };

// Token storage
const TOKEN_KEY = 'google_auth_token';
const USER_KEY = 'google_auth_user';

export interface GoogleUser {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): GoogleUser | null {
  const stored = localStorage.getItem(USER_KEY);
  return stored ? JSON.parse(stored) : null;
}

export function storeAuth(token: string, user: GoogleUser): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuth(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}
