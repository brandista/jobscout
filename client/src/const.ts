export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Redirect to login page - using Supabase Auth now instead of old OAuth
export const getLoginUrl = () => {
  return "/login";
};
