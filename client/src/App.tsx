import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Profile from "./pages/Profile";
import Jobs from "./pages/Jobs";
import JobDetail from "./pages/JobDetail";
import Scout from "./pages/Scout";
import SavedJobs from "./pages/SavedJobs";
import CompanyScout from "./pages/CompanyScout";
import Agents from "./pages/Agents";
import Login from "./pages/Login";
import AuthCallback from "./pages/AuthCallback";
import Watchlist from "./pages/Watchlist";
import PrhSearch from "./pages/PrhSearch";
import Notifications from "./pages/Notifications";

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/login"} component={Login} />
      <Route path={"/auth/callback"} component={AuthCallback} />
      <Route path={"/profile"} component={Profile} />
      <Route path={"/agents"} component={Agents} />
      <Route path={"/jobs/:id"} component={JobDetail} />
      <Route path={"/jobs"} component={Jobs} />
      <Route path={"/scout"} component={Scout} />
      <Route path={"/companies"} component={CompanyScout} />
      <Route path={"/company-scout"} component={CompanyScout} />
      <Route path={"/saved"} component={SavedJobs} />
      <Route path={"/watchlist"} component={Watchlist} />
      <Route path={"/notifications"} component={Notifications} />
      <Route path={"/prh"} component={PrhSearch} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
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
