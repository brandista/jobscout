import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { useIsMobile } from "@/hooks/useMobile";
import { 
  Home, 
  User, 
  Bot, 
  Building2, 
  Search, 
  Briefcase, 
  Bookmark, 
  LogOut, 
  PanelLeft,
  Eye,
  FileText,
  Bell,
  Sparkles,
  TrendingUp,
  Settings
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";

// Hook that fetches real notification count from API
const useNotificationCount = () => {
  const { user } = useAuth();

  // Fetch matches and watchlist to calculate notification count
  const { data: matches } = trpc.matches.list.useQuery(
    { limit: 10 },
    { enabled: !!user }
  );
  const { data: watchlist } = trpc.watchlist.list.useQuery(
    undefined,
    { enabled: !!user }
  );

  // Count: recent matches + active watchlist items with alerts
  const matchCount = matches?.length || 0;
  const watchlistAlerts = watchlist?.filter(w => w.alertsEnabled)?.length || 0;

  return matchCount + watchlistAlerts;
};

const menuItems = [
  { 
    icon: Home, 
    label: "Etusivu", 
    path: "/", 
    badge: null,
    gradient: "from-blue-500 to-cyan-500"
  },
  { 
    icon: User, 
    label: "Profiili", 
    path: "/profile",
    badge: null,
    gradient: "from-purple-500 to-pink-500"
  },
  { 
    icon: Bot, 
    label: "AI-agentit", 
    path: "/agents",
    badge: "6",
    gradient: "from-violet-500 to-purple-500"
  },
  { 
    icon: Building2, 
    label: "Yritys-Skanneri", 
    path: "/companies",
    badge: null,
    gradient: "from-orange-500 to-red-500"
  },
  { 
    icon: Search, 
    label: "Työpaikka-Scout", 
    path: "/scout",
    badge: null,
    gradient: "from-green-500 to-emerald-500"
  },
  { 
    icon: Briefcase, 
    label: "Työpaikat", 
    path: "/jobs",
    badge: null,
    gradient: "from-blue-500 to-indigo-500"
  },
  { 
    icon: Bookmark, 
    label: "Tallennetut", 
    path: "/saved",
    badge: null,
    gradient: "from-yellow-500 to-orange-500"
  },
  { 
    icon: Eye, 
    label: "Watchlist", 
    path: "/watchlist",
    badge: null, // TODO: Badge jos uusia signaaleja
    gradient: "from-cyan-500 to-blue-500"
  },
  { 
    icon: FileText, 
    label: "PRH-haku", 
    path: "/prh",
    badge: null,
    gradient: "from-slate-500 to-gray-500"
  },
];

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 260;
const MIN_WIDTH = 200;
const MAX_WIDTH = 400;

export default function DashboardLayout({
  children,
  allowGuest = false,
}: {
  children: React.ReactNode;
  allowGuest?: boolean;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user, isAuthenticated } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) {
    return <DashboardLayoutSkeleton />
  }

  if (!isAuthenticated && !allowGuest) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <div className="flex flex-col items-center gap-8 p-8 max-w-md w-full">
          <div className="flex flex-col items-center gap-6">
            {/* Logo placeholder - voit korvata omalla logolla */}
            <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-2xl">
              <Sparkles className="h-10 w-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-center bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Tervetuloa JobScoutiin
            </h1>
            <p className="text-sm text-muted-foreground text-center max-w-sm leading-relaxed">
              JobScout auttaa sinua löytämään unelmatyösi älykkään matchauksen ja 6 AI-agentin avulla. 
              Aloita matkasi nyt! 🚀
            </p>
          </div>
          <Button
            onClick={() => {
              window.location.href = '/login';
            }}
            size="lg"
            className="w-full shadow-lg hover:shadow-xl transition-all bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Kirjaudu sisään
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const activeMenuItem = menuItems.find(item => item.path === location);
  const isMobile = useIsMobile();
  const notificationCount = useNotificationCount();

  useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
    }
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar
          collapsible="icon"
          className="border-r-0 bg-gradient-to-b from-background to-muted/20"
          disableTransition={isResizing}
        >
          <SidebarHeader className="h-16 justify-center border-b">
            <div className="flex items-center gap-3 px-2 transition-all w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-accent rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              {!isCollapsed ? (
                <div className="flex items-center gap-2 min-w-0">
                  <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shrink-0">
                    <Sparkles className="h-4 w-4 text-white" />
                  </div>
                  <span className="font-bold tracking-tight truncate text-lg bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                    JobScout
                  </span>
                </div>
              ) : null}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0">
            <SidebarMenu className="px-2 py-2">
              {menuItems.map(item => {
                const isActive = location === item.path;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={item.label}
                      className={cn(
                        "h-11 transition-all font-normal group relative overflow-hidden",
                        isActive && "bg-gradient-to-r " + item.gradient + " text-white hover:opacity-90"
                      )}
                    >
                      {/* Gradient glow effect on hover (non-active) */}
                      {!isActive && (
                        <div className={cn(
                          "absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity bg-gradient-to-r",
                          item.gradient
                        )} />
                      )}
                      
                      <item.icon
                        className={cn(
                          "h-4 w-4 relative z-10 transition-transform group-hover:scale-110",
                          isActive ? "text-white" : ""
                        )}
                      />
                      <span className="relative z-10">{item.label}</span>
                      
                      {/* Badge for items with counts */}
                      {item.badge && !isCollapsed && (
                        <Badge 
                          variant="secondary" 
                          className="ml-auto h-5 px-1.5 text-xs relative z-10"
                        >
                          {item.badge}
                        </Badge>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>

            {/* Divider */}
            <div className="my-2 px-4">
              <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />
            </div>

            {/* Quick Settings Section */}
            {!isCollapsed && (
              <div className="px-4 py-2">
                <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                  Asetukset
                </p>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => setLocation('/settings')}
                      className="h-10"
                    >
                      <Settings className="h-4 w-4" />
                      <span>Asetukset</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </div>
            )}
          </SidebarContent>

          <SidebarFooter className="p-3 border-t">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-accent/50 transition-all w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring relative">
                  {/* Gradient border effect */}
                  <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 opacity-0 group-hover:opacity-20 transition-opacity" />
                  
                  <Avatar className="h-9 w-9 border-2 border-gradient-to-r from-blue-500 to-purple-600 shrink-0 relative z-10">
                    <AvatarFallback className="text-xs font-medium bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                      {user?.name?.charAt(0).toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden relative z-10">
                    <p className="text-sm font-medium truncate leading-none">
                      {user?.name || "-"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-1.5">
                      {user?.email || "-"}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem
                  onClick={() => setLocation('/profile')}
                  className="cursor-pointer"
                >
                  <User className="mr-2 h-4 w-4" />
                  <span>Profiili</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setLocation('/settings')}
                  className="cursor-pointer"
                >
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Asetukset</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Kirjaudu ulos</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        
        {/* Resize handle */}
        <div
          className={cn(
            "absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-gradient-to-b from-blue-500 to-purple-600 transition-colors",
            isCollapsed && "hidden"
          )}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset className="bg-gradient-to-br from-background via-muted/5 to-background">
        {/* Top Bar for Mobile + Notifications */}
        <div className={cn(
          "flex border-b h-14 items-center justify-between bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40",
          !isMobile && "border-none h-16"
        )}>
          <div className="flex items-center gap-3">
            {isMobile && (
              <SidebarTrigger className="h-9 w-9 rounded-lg bg-background" />
            )}
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold tracking-tight text-foreground flex items-center gap-2">
                {activeMenuItem?.label ?? "JobScout"}
                {location === "/" && (
                  <Badge variant="secondary" className="text-xs">
                    <TrendingUp className="h-3 w-3 mr-1" />
                    Aktiivinen
                  </Badge>
                )}
              </span>
              {!isMobile && activeMenuItem && (
                <span className="text-xs text-muted-foreground">
                  {getPageDescription(activeMenuItem.path)}
                </span>
              )}
            </div>
          </div>

          {/* Notification Bell */}
          <Button 
            variant="ghost" 
            size="icon"
            className="relative"
            onClick={() => setLocation('/notifications')} // TODO: Create notifications page
          >
            <Bell className="h-5 w-5" />
            {notificationCount > 0 && (
              <Badge 
                variant="destructive" 
                className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
              >
                {notificationCount}
              </Badge>
            )}
          </Button>
        </div>

        <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          {children}
        </main>
      </SidebarInset>
    </>
  );
}

// Helper function for page descriptions
function getPageDescription(path: string): string {
  const descriptions: Record<string, string> = {
    "/": "Tervetuloa takaisin! Tässä on tämänhetkinen tilanteesi.",
    "/profile": "Hallitse profiiliasi ja CV:täsi",
    "/agents": "Keskustele 6 AI-agentin kanssa",
    "/companies": "Skannaa yrityksiä ja analysoi signaaleja",
    "/scout": "Etsi ja löydä parhaat työpaikat",
    "/jobs": "Selaa kaikkia työpaikkoja",
    "/saved": "Tallentamasi työpaikat",
    "/watchlist": "Seuraamasi yritykset ja signaalit",
    "/prh": "Hae yritystietoja PRH:sta",
  };
  return descriptions[path] || "";
}
