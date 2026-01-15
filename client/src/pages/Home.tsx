import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import DashboardLayout from "@/components/DashboardLayout";
import { 
  Sparkles, 
  TrendingUp, 
  Briefcase, 
  Target, 
  Eye,
  Bot,
  Building2,
  Search,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  Zap,
  Star,
  MessageSquare,
  FileText,
  BarChart3,
  TrendingDown,
  Plus
} from "lucide-react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

// Hook for dashboard data from API
const useDashboardData = () => {
  const { user } = useAuth();

  // Fetch real data from API
  const { data: savedJobsData } = trpc.savedJobs.list.useQuery(undefined, { enabled: !!user });
  const { data: matchesData } = trpc.matches.list.useQuery({ limit: 10 }, { enabled: !!user });
  const { data: watchlistData } = trpc.watchlist.list.useQuery(undefined, { enabled: !!user });
  const { data: profileData } = trpc.profile.get.useQuery(undefined, { enabled: !!user });

  // Calculate profile completion
  const profileCompletion = profileData ? calculateProfileCompletion(profileData) : 0;

  return {
    user,
    stats: {
      savedJobs: savedJobsData?.length || 0,
      activeMatches: matchesData?.length || 0,
      watchlistCompanies: watchlistData?.length || 0,
      profileCompletion,
    },
    recentActivity: [
      {
        id: "1",
        type: "match",
        title: "Uusi työmatch: Senior Developer",
        company: "Reaktor",
        timestamp: "2 tuntia sitten",
        score: 92,
        icon: Target,
        color: "text-green-500"
      },
      {
        id: "2",
        type: "signal",
        title: "Väinö: Rekrytointisignaali havaittu",
        company: "Supercell",
        timestamp: "5 tuntia sitten",
        score: 78,
        icon: Zap,
        color: "text-yellow-500"
      },
      {
        id: "3",
        type: "conversation",
        title: "Keskustelu: Kaisa (Career Coach)",
        company: null,
        timestamp: "Eilen",
        icon: MessageSquare,
        color: "text-blue-500"
      },
    ],
    topMatches: [
      {
        id: "1",
        title: "Senior Full Stack Developer",
        company: "Reaktor",
        location: "Helsinki",
        score: 92,
        salary: "5000-7000€",
        posted: "2 päivää sitten",
      },
      {
        id: "2",
        title: "Lead Frontend Engineer",
        company: "Wolt",
        location: "Helsinki",
        score: 88,
        salary: "5500-7500€",
        posted: "4 päivää sitten",
      },
      {
        id: "3",
        title: "Backend Developer",
        company: "Supercell",
        location: "Helsinki",
        score: 85,
        salary: "4500-6500€",
        posted: "1 viikko sitten",
      },
    ],
    aiRecommendations: [
      {
        agent: "Väinö",
        avatar: "V",
        message: "3 uutta rekrytointisignaalia watchlistillasi",
        action: "Tarkastele signaaleja",
        path: "/watchlist",
        urgent: true,
      },
      {
        agent: "Kaisa",
        avatar: "K",
        message: "Täydennä profiilisi saadaksesi parempia matcheja",
        action: "Paranna profiilia",
        path: "/profile",
        urgent: false,
      },
      {
        agent: "Sofia",
        avatar: "S",
        message: "Reaktor on mahdollisesti rekrytoimassa pian",
        action: "Analysoi yritys",
        path: "/companies",
        urgent: false,
      },
    ],
    watchlistSignals: [
      { company: "Reaktor", signals: 4, trend: "up" as const },
      { company: "Wolt", signals: 2, trend: "stable" as const },
      { company: "Supercell", signals: 3, trend: "up" as const },
    ],
  };
};

// Helper function to calculate profile completion percentage
function calculateProfileCompletion(profile: any): number {
  if (!profile) return 0;

  const fields = [
    profile.currentTitle,
    profile.yearsOfExperience,
    profile.skills,
    profile.languages,
    profile.preferredJobTitles,
    profile.preferredLocations,
    profile.salaryMin,
    profile.remotePreference,
    profile.degree,
    profile.workHistory,
  ];

  const filledFields = fields.filter(f => f !== null && f !== undefined && f !== '').length;
  return Math.round((filledFields / fields.length) * 100);
}

export default function DashboardHome() {
  const [, setLocation] = useLocation();
  const data = useDashboardData();

  // Get user's first name for greeting
  const userName = data.user?.name?.split(' ')[0] || '';

  return (
    <DashboardLayout>
      <div className="space-y-6 md:space-y-8">
        {/* Hero Section with Welcome Message */}
        <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 p-6 md:p-8 text-white shadow-2xl">
          <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-2">
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
                <Sparkles className="h-6 w-6 md:h-8 md:w-8" />
                Tervetuloa takaisin{userName ? `, ${userName}` : ''}!
              </h1>
              <p className="text-sm md:text-base text-white/90 max-w-xl">
                {data.stats.activeMatches > 0 ? (
                  <>Sinulla on <strong>{data.stats.activeMatches} aktiivista työmatcheja</strong> ja <strong>{data.stats.watchlistCompanies} yritystä</strong> watchlistillasi.</>
                ) : (
                  <>Aloita työpaikkojen scoutaus löytääksesi sinulle sopivia paikkoja!</>
                )}
              </p>
            </div>
            <Button 
              size="lg" 
              variant="secondary"
              className="shadow-xl hover:shadow-2xl transition-all whitespace-nowrap"
              onClick={() => setLocation('/scout')}
            >
              <Search className="mr-2 h-4 w-4" />
              Aloita Scout
            </Button>
          </div>
        </section>

        {/* Stats Cards Grid */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          <StatsCard
            title="Tallennetut työpaikat"
            value={data.stats.savedJobs}
            icon={Briefcase}
            gradient="from-blue-500 to-cyan-500"
            trend="+2 tällä viikolla"
            onClick={() => setLocation('/saved')}
          />
          <StatsCard
            title="Aktiiviset matchit"
            value={data.stats.activeMatches}
            icon={Target}
            gradient="from-green-500 to-emerald-500"
            trend="+3 uutta"
            onClick={() => setLocation('/jobs')}
          />
          <StatsCard
            title="Watchlist"
            value={data.stats.watchlistCompanies}
            icon={Eye}
            gradient="from-purple-500 to-pink-500"
            trend="4 signaalia"
            onClick={() => setLocation('/watchlist')}
          />
          <StatsCard
            title="Profiilin valmius"
            value={`${data.stats.profileCompletion}%`}
            icon={Star}
            gradient="from-orange-500 to-red-500"
            trend="Melkein valmis!"
            onClick={() => setLocation('/profile')}
          />
        </section>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Activity + Top Matches (2 columns) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Profile Completion Banner */}
            {data.stats.profileCompletion < 100 && (
              <Card className="border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <AlertCircle className="h-5 w-5 text-orange-500" />
                        Täydennä profiilisi
                      </CardTitle>
                      <CardDescription>
                        Saat parempia työmatcheja täydellisellä profiililla
                      </CardDescription>
                    </div>
                    <Badge variant="secondary">{data.stats.profileCompletion}%</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Progress value={data.stats.profileCompletion} className="h-2" />
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button 
                      size="sm" 
                      variant="default"
                      onClick={() => setLocation('/profile')}
                      className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      Täydennä profiili
                    </Button>
                    <Button size="sm" variant="outline">
                      Muistuta myöhemmin
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Recent Activity Feed */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-blue-500" />
                    Viimeisimmät tapahtumat
                  </CardTitle>
                  <Button variant="ghost" size="sm">
                    Näytä kaikki
                  </Button>
                </div>
                <CardDescription>
                  Mitä on tapahtunut viime aikoina
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.recentActivity.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group"
                    onClick={() => {
                      // TODO: Navigate to relevant page based on activity type
                    }}
                  >
                    <div className={cn(
                      "h-10 w-10 rounded-lg flex items-center justify-center shrink-0",
                      "bg-gradient-to-br from-muted to-muted/50 group-hover:scale-110 transition-transform"
                    )}>
                      <activity.icon className={cn("h-5 w-5", activity.color)} />
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <p className="text-sm font-medium leading-none">{activity.title}</p>
                      {activity.company && (
                        <p className="text-sm text-muted-foreground">{activity.company}</p>
                      )}
                      <p className="text-xs text-muted-foreground">{activity.timestamp}</p>
                    </div>
                    {activity.score && (
                      <Badge variant="secondary" className="shrink-0">
                        {activity.score}%
                      </Badge>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Top Matches */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-green-500" />
                    Parhaat matchit sinulle
                  </CardTitle>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setLocation('/jobs')}
                  >
                    Näytä kaikki
                  </Button>
                </div>
                <CardDescription>
                  Nämä työpaikat sopivat profiiliisi parhaiten
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.topMatches.map((job) => (
                  <div
                    key={job.id}
                    className="p-4 rounded-lg border hover:border-primary/50 hover:shadow-md transition-all cursor-pointer group"
                    onClick={() => setLocation(`/jobs/${job.id}`)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-2 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-sm group-hover:text-primary transition-colors">
                            {job.title}
                          </h3>
                          <Badge 
                            variant="secondary" 
                            className="bg-gradient-to-r from-green-100 to-emerald-100 text-green-700 border-green-200"
                          >
                            {job.score}% match
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          {job.company} • {job.location}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Briefcase className="h-3 w-3" />
                            {job.salary}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {job.posted}
                          </span>
                        </div>
                      </div>
                      <Button 
                        size="sm" 
                        variant="ghost"
                        className="shrink-0"
                      >
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Right Sidebar (1 column) */}
          <div className="space-y-6">
            {/* AI Recommendations */}
            <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-violet-50">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Bot className="h-5 w-5 text-purple-500" />
                  AI-suositukset
                </CardTitle>
                <CardDescription>
                  Agentit ovat huomanneet jotain sinulle
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.aiRecommendations.map((rec, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "p-3 rounded-lg border-2 cursor-pointer transition-all hover:shadow-md",
                      rec.urgent 
                        ? "border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50" 
                        : "border-border bg-background hover:border-primary/50"
                    )}
                    onClick={() => setLocation(rec.path)}
                  >
                    <div className="flex items-start gap-3">
                      <Avatar className="h-10 w-10 bg-gradient-to-br from-blue-500 to-purple-600 border-2 border-white shadow-md">
                        <AvatarFallback className="text-white font-bold">
                          {rec.avatar}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0 space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          {rec.agent}
                        </p>
                        <p className="text-sm leading-tight">{rec.message}</p>
                        <Button 
                          size="sm" 
                          variant={rec.urgent ? "default" : "outline"}
                          className={cn(
                            "w-full",
                            rec.urgent && "bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
                          )}
                        >
                          {rec.action}
                          <ArrowRight className="ml-2 h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Watchlist Quick View */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Eye className="h-5 w-5 text-cyan-500" />
                    Watchlist-signaalit
                  </CardTitle>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setLocation('/watchlist')}
                  >
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
                <CardDescription>
                  Seuraamasi yritykset
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.watchlistSignals.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 rounded-lg border hover:border-primary/50 transition-colors cursor-pointer"
                    onClick={() => setLocation(`/companies?q=${item.company}`)}
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{item.company}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.signals} signaalia havaittu
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {item.trend === "up" ? (
                        <TrendingUp className="h-4 w-4 text-green-500" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-muted-foreground" />
                      )}
                      <Badge variant="outline">{item.signals}</Badge>
                    </div>
                  </div>
                ))}
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => setLocation('/watchlist')}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Lisää yritys watchlistille
                </Button>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Pika-toiminnot</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-2">
                <QuickActionButton
                  icon={Bot}
                  label="AI-agentit"
                  gradient="from-purple-500 to-violet-500"
                  onClick={() => setLocation('/agents')}
                />
                <QuickActionButton
                  icon={Building2}
                  label="Yritykset"
                  gradient="from-orange-500 to-red-500"
                  onClick={() => setLocation('/companies')}
                />
                <QuickActionButton
                  icon={Search}
                  label="Scout"
                  gradient="from-green-500 to-emerald-500"
                  onClick={() => setLocation('/scout')}
                />
                <QuickActionButton
                  icon={BarChart3}
                  label="Tilastot"
                  gradient="from-blue-500 to-cyan-500"
                  onClick={() => setLocation('/stats')}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

// Stats Card Component
interface StatsCardProps {
  title: string;
  value: number | string;
  icon: React.ElementType;
  gradient: string;
  trend?: string;
  onClick?: () => void;
}

function StatsCard({ title, value, icon: Icon, gradient, trend, onClick }: StatsCardProps) {
  return (
    <Card 
      className="hover:shadow-lg transition-all cursor-pointer group overflow-hidden relative"
      onClick={onClick}
    >
      {/* Gradient background (subtle) */}
      <div className={cn(
        "absolute inset-0 opacity-0 group-hover:opacity-5 transition-opacity bg-gradient-to-br",
        gradient
      )} />
      
      <CardContent className="p-6 relative z-10">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground font-medium">{title}</p>
            <p className="text-3xl font-bold tracking-tight">{value}</p>
            {trend && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-green-500" />
                {trend}
              </p>
            )}
          </div>
          <div className={cn(
            "h-12 w-12 rounded-xl flex items-center justify-center bg-gradient-to-br group-hover:scale-110 transition-transform shadow-md",
            gradient
          )}>
            <Icon className="h-6 w-6 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Quick Action Button Component
interface QuickActionButtonProps {
  icon: React.ElementType;
  label: string;
  gradient: string;
  onClick?: () => void;
}

function QuickActionButton({ icon: Icon, label, gradient, onClick }: QuickActionButtonProps) {
  return (
    <Button
      variant="outline"
      className="h-auto flex flex-col items-center gap-2 p-4 hover:shadow-md transition-all group relative overflow-hidden"
      onClick={onClick}
    >
      <div className={cn(
        "absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity bg-gradient-to-br",
        gradient
      )} />
      <div className={cn(
        "h-10 w-10 rounded-lg flex items-center justify-center bg-gradient-to-br group-hover:scale-110 transition-transform relative z-10",
        gradient
      )}>
        <Icon className="h-5 w-5 text-white" />
      </div>
      <span className="text-xs font-medium relative z-10">{label}</span>
    </Button>
  );
}
