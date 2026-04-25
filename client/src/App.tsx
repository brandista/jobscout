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
import JobsPlaceholder from "@/pages/editorial/JobsPlaceholder";
import CompaniesPlaceholder from "@/pages/editorial/CompaniesPlaceholder";
import AgentsPlaceholder from "@/pages/editorial/AgentsPlaceholder";
import ProfilePlaceholder from "@/pages/editorial/ProfilePlaceholder";
import BulletinsPlaceholder from "@/pages/editorial/BulletinsPlaceholder";

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
              <Route path="/jobs" component={JobsPlaceholder} />
              <Route path="/jobs/:rest*" component={JobsPlaceholder} />
              <Route path="/companies" component={CompaniesPlaceholder} />
              <Route path="/companies/:rest*" component={CompaniesPlaceholder} />
              <Route path="/agents" component={AgentsPlaceholder} />
              <Route path="/agents/:rest*" component={AgentsPlaceholder} />
              <Route path="/profile" component={ProfilePlaceholder} />
              <Route path="/bulletins" component={BulletinsPlaceholder} />
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
