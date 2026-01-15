import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import { 
  Loader2, 
  Play, 
  Building2, 
  TrendingUp, 
  TrendingDown,
  Briefcase, 
  Newspaper,
  Target,
  Zap,
  Users,
  DollarSign,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  RefreshCw
} from "lucide-react";
import { useState, useRef } from "react";
import { toast } from "sonner";

// Event type icons and colors
const eventTypeConfig: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  funding: { icon: <DollarSign className="w-4 h-4" />, color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200", label: "Rahoitus" },
  expansion: { icon: <TrendingUp className="w-4 h-4" />, color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200", label: "Laajentuminen" },
  new_unit: { icon: <Building2 className="w-4 h-4" />, color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200", label: "Uusi yksikkö" },
  acquisition: { icon: <Zap className="w-4 h-4" />, color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200", label: "Yrityskauppa" },
  leadership_change: { icon: <Users className="w-4 h-4" />, color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200", label: "Johdon muutos" },
  yt_layoff: { icon: <AlertTriangle className="w-4 h-4" />, color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200", label: "YT-neuvottelut" },
  yt_restructure: { icon: <RefreshCw className="w-4 h-4" />, color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200", label: "Uudelleenjärjestely" },
  hiring_spree: { icon: <Users className="w-4 h-4" />, color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200", label: "Rekrytointikampanja" },
  other: { icon: <Newspaper className="w-4 h-4" />, color: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200", label: "Muu" },
};

// Score indicator component
function ScoreIndicator({ score, label, size = "md" }: { score: number; label: string; size?: "sm" | "md" }) {
  const getScoreColor = (s: number) => {
    if (s >= 70) return "text-green-600 dark:text-green-400";
    if (s >= 40) return "text-yellow-600 dark:text-yellow-400";
    return "text-gray-500";
  };

  const getProgressColor = (s: number) => {
    if (s >= 70) return "bg-green-500";
    if (s >= 40) return "bg-yellow-500";
    return "bg-gray-400";
  };

  return (
    <div className={size === "sm" ? "space-y-1" : "space-y-2"}>
      <div className="flex justify-between items-center">
        <span className={`text-muted-foreground ${size === "sm" ? "text-xs" : "text-sm"}`}>{label}</span>
        <span className={`font-bold ${getScoreColor(score)} ${size === "sm" ? "text-sm" : "text-lg"}`}>
          {score}
        </span>
      </div>
      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div 
          className={`h-full ${getProgressColor(score)} transition-all duration-500`}
          style={{ width: `${Math.min(score, 100)}%` }}
        />
      </div>
    </div>
  );
}

// Company card component
function CompanyCard({ company, index }: { company: any; index: number }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary text-primary-foreground font-bold text-xl">
              {index + 1}
            </div>
            <div>
              <CardTitle className="text-2xl">{company.company.name}</CardTitle>
              {company.company.industry && (
                <CardDescription className="text-base">{company.company.industry}</CardDescription>
              )}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-4xl font-bold text-primary">{company.combinedScore}</div>
            <div className="text-sm text-muted-foreground">Yhteispisteet</div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Score bars */}
        <div className="grid grid-cols-2 gap-6">
          <ScoreIndicator score={company.talentNeedScore} label="Rekrytointitarve" size="md" />
          <ScoreIndicator score={company.profileMatchScore || 0} label="Profiili-match" size="md" />
        </div>

        {/* Recent events */}
        {company.events && company.events.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
              <Newspaper className="w-4 h-4" />
              Viimeisimmät tapahtumat
            </h4>
            <div className="space-y-2">
              {company.events.slice(0, expanded ? undefined : 2).map((event: any) => {
                const eventConfig = eventTypeConfig[event.eventType] || eventTypeConfig.other;
                return (
                  <div
                    key={event.id}
                    className="p-3 rounded-lg bg-accent/50 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="secondary" className={`${eventConfig.color} shrink-0`}>
                        {eventConfig.icon}
                        <span className="ml-1">{eventConfig.label}</span>
                      </Badge>
                      {event.sourceUrl && (
                        <a
                          href={event.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 text-muted-foreground hover:text-primary"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                    <p className="text-sm font-medium">{event.headline}</p>
                    {event.summary && (
                      <p className="text-xs text-muted-foreground line-clamp-3">{event.summary}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Open positions */}
        {company.jobs && company.jobs.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
              <Briefcase className="w-4 h-4" />
              Avoimet työpaikat ({company.jobs.length})
            </h4>
            <div className="flex flex-wrap gap-2">
              {company.jobs.slice(0, expanded ? undefined : 4).map((job: any) => (
                <Badge key={job.id} variant="outline" className="text-xs">
                  {job.title}
                </Badge>
              ))}
              {!expanded && company.jobs.length > 4 && (
                <Badge variant="outline" className="text-xs text-muted-foreground">
                  +{company.jobs.length - 4} muuta
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Reasons */}
        {company.reasons && company.reasons.length > 0 && expanded && (
          <div>
            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
              <Target className="w-4 h-4" />
              Pisteytyksen perusteet
            </h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              {company.reasons.map((reason: string, i: number) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  {reason}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Expand/collapse */}
        {(company.events?.length > 2 || company.jobs?.length > 4 || company.reasons?.length > 0) && (
          <Button 
            variant="ghost" 
            size="sm" 
            className="w-full"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <>
                <ChevronUp className="w-4 h-4 mr-2" />
                Näytä vähemmän
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4 mr-2" />
                Näytä lisää
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export default function CompanyScout() {
  const { user, loading: authLoading } = useAuth();
  const { data: profile } = trpc.profile.get.useQuery(undefined, { enabled: !!user });
  const { data: stats } = trpc.stats.get.useQuery(undefined, { enabled: !!user });
  const resultsRef = useRef<HTMLDivElement>(null);
  const { 
    data: topCompanies, 
    isLoading: companiesLoading,
    refetch: refetchCompanies 
  } = trpc.scout.topCompanies.useQuery(
    { limit: 20 },
    { enabled: !!user }
  );

  const runFullMutation = trpc.scout.runFull.useMutation();
  const [isRunning, setIsRunning] = useState(false);

  const handleRunFull = async () => {
    setIsRunning(true);
    try {
      const result = await runFullMutation.mutateAsync({
        newsDaysBack: 14,
        scoreDaysBack: 30,
      });

      toast.success(
        `Skannaus valmis! ${result.newsFetched} uutista, ${result.eventsCreated} tapahtumaa, ${result.scoresCalculated} pisteytettyä yritystä.`
      );
      await refetchCompanies();

      // Scroll to results after scan completes
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    } catch (error) {
      toast.error("Skannaus epäonnistui");
      console.error(error);
    } finally {
      setIsRunning(false);
    }
  };

  if (authLoading) {
    return (
      <DashboardLayout>
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
    <div className="container max-w-6xl py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Building2 className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Yritys-Skanneri</h1>
            <p className="text-muted-foreground">
              Löydä yritykset joilla on suurin rekrytointitarve
            </p>
          </div>
        </div>
      </div>

      {/* Stats & Action */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{stats?.companies || 0}</div>
                  <p className="text-xs text-muted-foreground">Yrityksiä</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                  <Newspaper className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{stats?.events || 0}</div>
                  <p className="text-xs text-muted-foreground">Tapahtumia</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900 flex items-center justify-center">
                  <Briefcase className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{stats?.jobs || 0}</div>
                  <p className="text-xs text-muted-foreground">Työpaikkoja</p>
                </div>
              </div>
            </div>
            <Button
              onClick={handleRunFull}
              disabled={isRunning}
              size="lg"
            >
              {isRunning ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Skannataan...
                </>
              ) : (
                <>
                  <Play className="w-5 h-5 mr-2" />
                  Käynnistä skannaus
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Profile notice */}
      {!profile && (
        <Card className="mb-6 border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-950">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Target className="w-5 h-5 text-yellow-600" />
              <div>
                <p className="font-medium text-yellow-900 dark:text-yellow-100">
                  Profiili puuttuu
                </p>
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  Luo profiili saadaksesi personoidut matchaus-pisteet yrityksille.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top Companies */}
      <div ref={resultsRef} className="mb-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          Top-yritykset rekrytointitarpeen mukaan
        </h2>
        <p className="text-sm text-muted-foreground">
          Yritykset joilla on eniten kasvusignaaleja ja avoimia paikkoja
        </p>
      </div>

      {companiesLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : !topCompanies || topCompanies.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Ei vielä yrityksiä</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Käynnistä skannaus löytääksesi yrityksiä joilla on rekrytointitarve.
            </p>
            <Button onClick={handleRunFull} disabled={isRunning}>
              {isRunning ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Skannataan...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Käynnistä ensimmäinen skannaus
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {topCompanies.map((company, index) => (
            <CompanyCard key={company.company.id} company={company} index={index} />
          ))}
        </div>
      )}

      {/* Legend */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-lg">Tapahtumatyypit</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {Object.entries(eventTypeConfig).map(([key, config]) => (
              <Badge key={key} variant="secondary" className={config.color}>
                {config.icon}
                <span className="ml-1">{config.label}</span>
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
    </DashboardLayout>
  );
}
