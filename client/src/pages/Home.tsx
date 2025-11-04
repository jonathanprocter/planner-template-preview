import { useAuth } from "@/_core/hooks/useAuth";
import DailyView from "@/components/DailyView";

export default function Home() {
  // The userAuth hooks provides authentication state
  // To implement login/logout functionality, simply call logout() or redirect to getLoginUrl()
  let { user, loading, error, isAuthenticated, logout } = useAuth();

  return <DailyView />;
}
