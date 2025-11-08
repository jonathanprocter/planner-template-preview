import { useAuth } from "@/_core/hooks/useAuth";
import DailyView from "@/components/DailyView";

/**
 * Home page component
 * Displays the daily calendar view for authenticated users
 */
export default function Home() {
  // The useAuth hook provides authentication state
  // To implement login/logout functionality, call logout() or redirect to getLoginUrl()
  const { user, loading, error, isAuthenticated, logout } = useAuth();

  return <DailyView />;
}
