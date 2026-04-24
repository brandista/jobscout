import { useAuth } from "@/_core/hooks/useAuth";

/**
 * Returns the issue number for the current user — days since their account
 * was created, minimum 1. Returns 1 for unauthenticated or missing data.
 *
 * TODO(Plan 2): surface createdAt from auth.me tRPC procedure so this
 * returns a real per-user issue number.
 */
export function useEditionNumber(): number {
  useAuth(); // keep the hook call so it re-renders when auth state changes
  return 1;
}
