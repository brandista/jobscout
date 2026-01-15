import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { useLocation } from "wouter";

// This page is no longer needed with Google OAuth
// Keeping it for backwards compatibility - just redirects to home
export default function AuthCallback() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    // With Google OAuth, authentication happens client-side
    // Just redirect to home
    setLocation('/');
  }, [setLocation]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
      <p className="text-muted-foreground">Ohjataan...</p>
    </div>
  );
}
