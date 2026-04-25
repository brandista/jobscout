import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Login from "./pages/Login";
import AuthCallback from "./pages/AuthCallback";
import { EditorialLayout } from "@/components/chrome/EditorialLayout";
import { Brief } from "@/pages/editorial/Brief";
import Jobs from "@/pages/editorial/Jobs";
import Companies from "@/pages/editorial/Companies";
import Agents from "@/pages/editorial/Agents";
import AgentChat from "@/pages/editorial/AgentChat";
import Profile from "@/pages/editorial/Profile";
import Bulletins from "@/pages/editorial/Bulletins";

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/auth/callback" component={AuthCallback} />
      <Route>
        {() => (
          <EditorialLayout>
            <Switch>
              <Route path="/" component={Brief} />
              <Route path="/jobs/saved" component={Jobs} />
              <Route path="/jobs/matches" component={Jobs} />
              <Route path="/jobs" component={Jobs} />
              <Route path="/companies/discover" component={Companies} />
              <Route path="/companies/prh" component={Companies} />
              <Route path="/companies" component={Companies} />
              <Route path="/agents/:id" component={AgentChat} />
              <Route path="/agents" component={Agents} />
              <Route path="/profile" component={Profile} />
              <Route path="/bulletins/unread" component={Bulletins} />
              <Route path="/bulletins/archived" component={Bulletins} />
              <Route path="/bulletins" component={Bulletins} />
              <Route component={NotFound} />
            </Switch>
          </EditorialLayout>
        )}
      </Route>
    </Switch>
  );
}

function App() {
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
