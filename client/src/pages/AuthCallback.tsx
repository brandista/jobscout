import { supabase } from "@/lib/supabase";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { useLocation } from "wouter";

export default function AuthCallback() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    // Handle the OAuth callback
    const handleCallback = async () => {
      try {
        // Supabase handles the token exchange automatically
        // when it detects the hash/query params in the URL
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('[Auth] Callback error:', error);
          setLocation('/login');
          return;
        }

        if (session) {
          // Successfully authenticated
          setLocation('/');
        } else {
          // No session, redirect to login
          setLocation('/login');
        }
      } catch (error) {
        console.error('[Auth] Callback error:', error);
        setLocation('/login');
      }
    };

    handleCallback();
  }, [setLocation]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
      <p className="text-muted-foreground">Kirjaudutaan sisään...</p>
    </div>
  );
}
