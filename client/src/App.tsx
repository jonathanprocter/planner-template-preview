import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import { useEffect, useState } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import WeeklyPage from "./pages/WeeklyPage";
import { waitForSession } from "./lib/sessionCheck";

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/"} component={WeeklyPage} />
      <Route path={"/daily"} component={Home} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    // Wait for session cookie to be available before rendering
    // This prevents "missing authorization headers" errors on platform API calls
    waitForSession(3000, 50)
      .then(() => {
        setSessionReady(true);
      })
      .catch(() => {
        // Session not found, but allow app to load anyway
        // User might not be logged in yet
        setSessionReady(true);
      });
  }, []);

  if (!sessionReady) {
    // Show minimal loading state while waiting for session
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
