import { OAuth2Client } from 'google-auth-library';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

if (!GOOGLE_CLIENT_ID) {
  console.warn('[GoogleAuth] Missing GOOGLE_CLIENT_ID. Auth will not work.');
}

const client = new OAuth2Client(GOOGLE_CLIENT_ID);

export interface GoogleUserInfo {
  id: string;
  email: string | null;
  name: string | null;
  picture?: string;
}

// Verify Google access token and return user info
export async function verifyGoogleToken(accessToken: string): Promise<GoogleUserInfo | null> {
  try {
    // Use the access token to get user info from Google
    const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      console.warn('[GoogleAuth] Failed to get user info:', response.status);
      return null;
    }

    const userInfo = await response.json();

    return {
      id: userInfo.sub,
      email: userInfo.email || null,
      name: userInfo.name || null,
      picture: userInfo.picture,
    };
  } catch (error) {
    console.error('[GoogleAuth] Token verification error:', error);
    return null;
  }
}
