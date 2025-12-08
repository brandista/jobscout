import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { 
  Briefcase, TrendingUp, Target, Zap, ArrowRight, User, 
  CheckCircle2, Circle, Sparkles, Building2, Clock, ChevronRight,
  Search, Bot, Eye, FileText
} from "lucide-react";
import { Link } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { fi } from "date-fns/locale";

// Onboarding steps
const ONBOARDING_STEPS = [
  { id: "profile", label: "Luo profiili", href: "/profile", icon: User },
  { id: "preferences", label: "Aseta preferenssit", href: "/profile", icon: Target },
  { id: "firstSearch", label: "Aja ensimmäinen haku", href: "/scout", icon: Search },
  { id: "exploreAgents", label: "Tutustu AI-agentteihin", href: "/agents", icon: Bot },
];

function OnboardingProgress({ profile }: { profile: any }) {
  // Calculate completion
  const steps = [
    { done: !!profile?.currentTitle, id: "profile" },
    { done: !!profile?.preferredJobTitles?.length, id: "preferences" },
    { done: false, id: "firstSearch" }, // TODO: check from scout history
    { done: false, id: "exploreAgents" },
  ];
  
  const completedCount = steps.filter(s => s.done).length;
  const progress = (completedCount / steps.length) * 100;
  
  if (progress === 100) return null; // Hide when complete
  
  return (
    <Card className="border-2 border-dashed border-blue-200 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-lg">Aloita tästä 👋</h3>
            <p className="text-sm text-muted-foreground">
              Täydennä profiilisi parempiin matcheihin
            </p>
          </div>
          <div className="text-right">
            <span className="text-2xl font-bold text-blue-600">{Math.round(progress)}%</span>
            <p className="text-xs text-muted-foreground">valmis</p>
          </div>
        </div>
        
        <Progress value={progress} className="h-2 mb-4" />
        
        <div className="space-y-2">
          {ONBOARDING_STEPS.map((step, index) => {
            const stepState = steps[index];
            const Icon = step.icon;
            
            return (
              <Link key={step.id} href={step.href}>
                <div className={`flex items-center gap-3 p-3 rounded-lg transition-colors cursor-pointer ${
                  stepState.done 
                    ? 'bg-green-50 dark:bg-green-950/20' 
                    : 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}>
                  {stepState.done ? (
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                  ) : (
                    <Circle className="w-5 h-5 text-gray-300" />
                  )}
                  <Icon className="w-4 h-4 text-muted-foreground" />
                  <span className={stepState.done ? 'line-through text-muted-foreground' : 'font-medium'}>
                    {step.label}
                  </span>
                  {!stepState.done && (
                    <ChevronRight className="w-4 h-4 ml-auto text-muted-foreground" />
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function QuickActions() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Link href="/scout">
        <Card className="group hover:border-blue-500 hover:shadow-lg transition-all cursor-pointer h-full">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-xl group-hover:scale-110 transition-transform">
                <Search className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-1">Etsi työpaikkoja</h3>
                <p className="text-sm text-muted-foreground">
                  Scout etsii sinulle sopivia paikkoja automaattisesti
                </p>
              </div>
              <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
            </div>
          </CardContent>
        </Card>
      </Link>

      <Link href="/agents">
        <Card className="group hover:border-purple-500 hover:shadow-lg transition-all cursor-pointer h-full bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/30 dark:to-blue-950/30">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-purple-100 dark:bg-purple-900 rounded-xl group-hover:scale-110 transition-transform">
                <Sparkles className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-1">Kysy Väinöltä</h3>
                <p className="text-sm text-muted-foreground">
                  AI ennustaa rekrytointeja ennen kuin paikat julkaistaan
                </p>
              </div>
              <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
            </div>
          </CardContent>
        </Card>
      </Link>
    </div>
  );
}

function SignalHighlights() {
  const { data: topCompanies, isLoading } = trpc.signalFeed.topCompanies.useQuery({ limit: 3 });
  
  if (isLoading || !topCompanies?.length) return null;
  
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-500" />
            Kuumat signaalit
          </CardTitle>
          <Link href="/companies">
            <Button variant="ghost" size="sm">
              Näytä kaikki
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </div>
        <CardDescription>
          Yritykset joissa vahvimmat rekrytointisignaalit
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {topCompanies.map((company: any, index: number) => (
            <div 
              key={company.id}
              className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white ${
                  index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : 'bg-orange-400'
                }`}>
                  {index + 1}
                </div>
                <div>
                  <div className="font-medium">{company.name}</div>
                  {company.industry && (
                    <div className="text-xs text-muted-foreground">{company.industry}</div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className={`px-3 py-1 rounded-full text-sm font-bold ${
                  company.talentNeedScore >= 7 
                    ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' 
                    : company.talentNeedScore >= 4 
                      ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
                      : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                }`}>
                  {company.talentNeedScore?.toFixed(0) || '—'}%
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ToolsGrid() {
  const tools = [
    { 
      href: "/watchlist", 
      icon: Eye, 
      label: "Watchlist", 
      desc: "Seuraa yrityksiä",
      color: "text-blue-600",
      bg: "bg-blue-100 dark:bg-blue-900"
    },
    { 
      href: "/prh", 
      icon: FileText, 
      label: "YTJ-haku", 
      desc: "Yritystiedot",
      color: "text-green-600",
      bg: "bg-green-100 dark:bg-green-900"
    },
    { 
      href: "/jobs", 
      icon: Briefcase, 
      label: "Matchit", 
      desc: "Sopivat paikat",
      color: "text-purple-600",
      bg: "bg-purple-100 dark:bg-purple-900"
    },
    { 
      href: "/companies", 
      icon: Building2, 
      label: "Yritykset", 
      desc: "Tutustu yrityksiin",
      color: "text-orange-600",
      bg: "bg-orange-100 dark:bg-orange-900"
    },
  ];
  
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {tools.map(tool => (
        <Link key={tool.href} href={tool.href}>
          <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
            <CardContent className="pt-4 pb-4 text-center">
              <div className={`w-10 h-10 rounded-lg ${tool.bg} flex items-center justify-center mx-auto mb-2`}>
                <tool.icon className={`w-5 h-5 ${tool.color}`} />
              </div>
              <div className="font-medium text-sm">{tool.label}</div>
              <div className="text-xs text-muted-foreground">{tool.desc}</div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}

// Landing page for non-authenticated users
function LandingPage() {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="container max-w-4xl py-20 md:py-32 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 dark:bg-blue-900 rounded-full text-sm font-medium text-blue-900 dark:text-blue-100 mb-6">
            <Sparkles className="w-4 h-4" />
            AI-pohjainen työnhaku
          </div>
          
          <h1 className="text-4xl md:text-6xl font-bold leading-tight mb-6">
            Löydä työpaikat 
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent"> ennen muita</span>
          </h1>
          
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            JobScout ennustaa rekrytoinnit AI:n avulla. Saat 2-4 viikon etumatkan 
            kun tiedät mitkä yritykset rekrytoivat seuraavaksi.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/login">
              <Button size="lg" className="text-lg px-8">
                Aloita ilmaiseksi
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
          </div>
          
          {/* Social proof */}
          <div className="mt-12 flex items-center justify-center gap-8 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-600" />
              <span>500+ signaaliviestiä/kk</span>
            </div>
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-600" />
              <span>100+ yritystä seurannassa</span>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 bg-white dark:bg-gray-950">
        <div className="container max-w-4xl">
          <h2 className="text-3xl font-bold text-center mb-12">Miten se toimii?</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <User className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="font-semibold text-lg mb-2">1. Luo profiili</h3>
              <p className="text-muted-foreground">
                Kerro taidoistasi ja mitä etsit
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Zap className="w-8 h-8 text-purple-600" />
              </div>
              <h3 className="font-semibold text-lg mb-2">2. Väinö analysoi</h3>
              <p className="text-muted-foreground">
                AI seuraa signaaleja ja ennustaa rekrytointeja
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Target className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="font-semibold text-lg mb-2">3. Hae ajoissa</h3>
              <p className="text-muted-foreground">
                Ota yhteyttä ennen kuin paikka julkaistaan
              </p>
            </div>
          </div>
          
          <div className="text-center mt-12">
            <Link href="/login">
              <Button size="lg">
                Kokeile ilmaiseksi
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

// Dashboard for authenticated users
function Dashboard({ user }: { user: any }) {
  const { data: profile, isLoading } = trpc.profile.get.useQuery();
  
  const firstName = user?.name?.split(' ')[0] || 'käyttäjä';
  const timeOfDay = new Date().getHours();
  const greeting = timeOfDay < 12 ? 'Huomenta' : timeOfDay < 18 ? 'Päivää' : 'Iltaa';
  
  return (
    <div className="container max-w-4xl py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold mb-2">
          {greeting}, {firstName}! 👋
        </h1>
        <p className="text-muted-foreground">
          Mitä haluaisit tehdä tänään?
        </p>
      </div>
      
      <div className="space-y-6">
        {/* Onboarding (shows if not complete) */}
        {!isLoading && <OnboardingProgress profile={profile} />}
        
        {/* Main actions */}
        <QuickActions />
        
        {/* Signal highlights */}
        <SignalHighlights />
        
        {/* Tools grid */}
        <div>
          <h2 className="text-lg font-semibold mb-3">Työkalut</h2>
          <ToolsGrid />
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const { user, isAuthenticated } = useAuth();

  return (
    <DashboardLayout allowGuest>
      {isAuthenticated ? (
        <Dashboard user={user} />
      ) : (
        <LandingPage />
      )}
    </DashboardLayout>
  );
}
