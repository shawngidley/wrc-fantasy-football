import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, Redirect, useLocation } from "wouter";
import { useEffect } from "react";
import { useAuth } from "./contexts/AuthContext";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider } from "./contexts/AuthContext";

// All 16 pages
import Login from "./pages/Login";
import Standings from "./pages/Standings";
import LiveScoring from "./pages/LiveScoring";
import Lineup from "./pages/Lineup";
import DraftBoard from "./pages/DraftBoard";
import Protections from "./pages/Protections";
import Rundown from "./pages/Rundown";
import PlayerNews from "./pages/PlayerNews";
import Transactions from "./pages/Transactions";
import Results from "./pages/Results";
import Trades from "./pages/Trades";
import History from "./pages/History";
import Playoffs from "./pages/Playoffs";
import Schedule from "./pages/Schedule";
import Rules from "./pages/Rules";
import NFLSites from "./pages/NFLSites";
import Rosters from "./pages/Rosters";
import Money from "./pages/Money";
import Settings from "./pages/Settings";
import DraftRecap from "./pages/DraftRecap";
import PlayerPage from "./pages/PlayerPage";
import FreeAgents from "./pages/FreeAgents";

// Scroll to top on every route change
function ScrollToTop() {
  const [location] = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [location]);
  return null;
}

// Route guard — redirects to login if no team is authenticated
function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { franchise } = useAuth();
  if (!franchise) return <Redirect to="/" />;
  return <Component />;
}

function Router() {
  return (
    <>
      <ScrollToTop />
      <Switch>
      <Route path="/" component={Login} />
      <Route path="/standings" component={Standings} />
      <Route path="/live" component={LiveScoring} />
      <Route path="/lineup">{() => <ProtectedRoute component={Lineup} />}</Route>
      <Route path="/lineup/:teamId" component={Lineup} />
      <Route path="/draft" component={DraftBoard} />
      <Route path="/protections" component={Protections} />
      <Route path="/rundown" component={Rundown} />
      <Route path="/news" component={PlayerNews} />
      <Route path="/transactions" component={Transactions} />
      <Route path="/results" component={Results} />
      <Route path="/trades" component={Trades} />
      <Route path="/history" component={History} />
      <Route path="/playoffs" component={Playoffs} />
      <Route path="/schedule" component={Schedule} />
      <Route path="/rules" component={Rules} />
      <Route path="/nfl-sites" component={NFLSites} />
      <Route path="/rosters" component={Rosters} />
      <Route path="/money" component={Money} />
      <Route path="/settings">{() => <ProtectedRoute component={Settings} />}</Route>
      <Route path="/draft-recap" component={DraftRecap} />
      <Route path="/player/:playerName" component={PlayerPage} />
      <Route path="/free-agents" component={FreeAgents} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
    </>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
