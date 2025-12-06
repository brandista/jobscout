import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { 
  Loader2, 
  Building2, 
  Search,
  ExternalLink,
  TrendingUp,
  TrendingDown,
  Briefcase,
  Newspaper,
  DollarSign,
  Users,
  AlertTriangle,
  CheckCircle2,
  MinusCircle,
  Zap,
  Star
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

// Signal type configuration
const signalConfig: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  funding: { icon: <DollarSign className="w-4 h-4" />, color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200", label: "Rahoitus" },
  growth: { icon: <TrendingUp className="w-4 h-4" />, color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200", label: "Kasvu" },
  hiring: { icon: <Users className="w-4 h-4" />, color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200", label: "Rekrytointi" },
  layoffs: { icon: <AlertTriangle className="w-4 h-4" />, color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200", label: "YT/Irtisanomiset" },
  acquisition: { icon: <Zap className="w-4 h-4" />, color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200", label: "Yrityskauppa" },
};

// Sentiment icons
const sentimentIcons = {
  positive: <CheckCircle2 className="w-5 h-5 text-green-500" />,
  negative: <AlertTriangle className="w-5 h-5 text-red-500" />,
  neutral: <MinusCircle className="w-5 h-5 text-gray-500" />,
};

// Result item component
function ResultItem({ result }: { result: { title: string; snippet: string; link: string; date?: string } }) {
  return (
    <div className="p-4 border rounded-lg hover:bg-accent/50 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm line-clamp-2 mb-1">{result.title}</h4>
          <p className="text-xs text-muted-foreground line-clamp-2">{result.snippet}</p>
          {result.date && (
            <span className="text-xs text-muted-foreground mt-1 block">{result.date}</span>
          )}
        </div>
        <a 
          href={result.link} 
          target="_blank" 
          rel="noopener noreferrer"
          className="shrink-0 p-2 hover:bg-accent rounded-md transition-colors"
        >
          <ExternalLink className="w-4 h-4 text-muted-foreground" />
        </a>
      </div>
    </div>
  );
}

// Section component
function ResultSection({ 
  title, 
  icon, 
  results, 
  count,
  emptyMessage = "Ei tuloksia"
}: { 
  title: string; 
  icon: React.ReactNode; 
  results: any[]; 
  count?: number;
  emptyMessage?: string;
}) {
  if (!results || results.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-4">
        {icon}
        <h3 className="font-semibold">{title}</h3>
        {count !== undefined && (
          <Badge variant="secondary">{count} tulosta</Badge>
        )}
      </div>
      <div className="space-y-2">
        {results.map((result, idx) => (
          <ResultItem key={idx} result={result} />
        ))}
      </div>
    </div>
  );
}

export default function CompanyScout() {
  const { loading: authLoading } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [companyData, setCompanyData] = useState<any>(null);

  const companyIntelMutation = trpc.search.companyIntel.useMutation({
    onSuccess: (data) => {
      setCompanyData(data);
      toast.success(`Tiedustelu valmis: ${data.companyName}`);
    },
    onError: (error) => {
      toast.error("Tiedustelu epäonnistui: " + error.message);
      setCompanyData(null);
    },
  });

  const handleSearch = () => {
    if (!searchQuery.trim()) {
      toast.error("Kirjoita yrityksen nimi");
      return;
    }
    companyIntelMutation.mutate({ companyName: searchQuery });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
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
        <div className="flex items-center gap-3 mb-6">
          <Building2 className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Yritys-Skanneri</h1>
            <p className="text-muted-foreground">Kattava yritystiedustelu työnhakijan näkökulmasta</p>
          </div>
        </div>

        {/* Search Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Tiedustele yritystä</CardTitle>
            <CardDescription>
              Hae kattavat tiedot: rekrytointitilanne, uutiset, taloustiedot ja työntekijäkokemukset
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <Input
                placeholder="Kirjoita yrityksen nimi, esim. Reaktor, Supercell, Wolt..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                className="flex-1"
                disabled={companyIntelMutation.isPending}
              />
              <Button 
                onClick={handleSearch} 
                disabled={companyIntelMutation.isPending}
                size="lg"
              >
                {companyIntelMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Tiedustellaan...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4 mr-2" />
                    Tiedustele
                  </>
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Tiedustelu hakee tiedot useasta lähteestä ja analysoi yrityksen rekrytointisignaalit
            </p>
          </CardContent>
        </Card>

        {/* Results */}
        {companyData && (
          <div className="space-y-6">
            {/* Summary Card */}
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-2xl flex items-center gap-3">
                      {companyData.companyName}
                      {sentimentIcons[companyData.overallSentiment as keyof typeof sentimentIcons]}
                    </CardTitle>
                    <CardDescription>
                      Tiedustelu suoritettu {new Date(companyData.timestamp).toLocaleString("fi-FI")}
                    </CardDescription>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-muted-foreground mb-1">Rekrytointiaktiivisuus</div>
                    <div className="flex items-center gap-2">
                      <Progress value={companyData.hiringScore} className="w-24 h-3" />
                      <span className="font-bold text-lg">{companyData.hiringScore}</span>
                    </div>
                  </div>
                </div>
              </CardHeader>
              
              {/* Signals */}
              {companyData.signals && companyData.signals.length > 0 && (
                <CardContent className="pt-0">
                  <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                    <Zap className="w-4 h-4" />
                    Havaitut signaalit
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {companyData.signals.map((signal: any, idx: number) => {
                      const config = signalConfig[signal.type] || signalConfig.growth;
                      return (
                        <Badge 
                          key={idx} 
                          className={`${config.color} flex items-center gap-1`}
                          variant="secondary"
                        >
                          {config.icon}
                          <span className="max-w-[200px] truncate">{signal.text}</span>
                        </Badge>
                      );
                    })}
                  </div>
                </CardContent>
              )}

              {/* Knowledge Graph */}
              {companyData.knowledgeGraph && (
                <CardContent className="pt-0 border-t">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
                    {companyData.knowledgeGraph.type && (
                      <div>
                        <div className="text-xs text-muted-foreground">Tyyppi</div>
                        <div className="font-medium">{companyData.knowledgeGraph.type}</div>
                      </div>
                    )}
                    {companyData.knowledgeGraph.founded && (
                      <div>
                        <div className="text-xs text-muted-foreground">Perustettu</div>
                        <div className="font-medium">{companyData.knowledgeGraph.founded}</div>
                      </div>
                    )}
                    {companyData.knowledgeGraph.headquarters && (
                      <div>
                        <div className="text-xs text-muted-foreground">Pääkonttori</div>
                        <div className="font-medium">{companyData.knowledgeGraph.headquarters}</div>
                      </div>
                    )}
                    {companyData.knowledgeGraph.ceo && (
                      <div>
                        <div className="text-xs text-muted-foreground">Toimitusjohtaja</div>
                        <div className="font-medium">{companyData.knowledgeGraph.ceo}</div>
                      </div>
                    )}
                  </div>
                </CardContent>
              )}
            </Card>

            {/* Detailed Results in Tabs */}
            <Card>
              <CardContent className="pt-6">
                <Tabs defaultValue="jobs">
                  <TabsList className="grid w-full grid-cols-5">
                    <TabsTrigger value="jobs" className="flex items-center gap-1">
                      <Briefcase className="w-4 h-4" />
                      <span className="hidden sm:inline">Työpaikat</span>
                    </TabsTrigger>
                    <TabsTrigger value="news" className="flex items-center gap-1">
                      <Newspaper className="w-4 h-4" />
                      <span className="hidden sm:inline">Uutiset</span>
                    </TabsTrigger>
                    <TabsTrigger value="finance" className="flex items-center gap-1">
                      <DollarSign className="w-4 h-4" />
                      <span className="hidden sm:inline">Talous</span>
                    </TabsTrigger>
                    <TabsTrigger value="reviews" className="flex items-center gap-1">
                      <Star className="w-4 h-4" />
                      <span className="hidden sm:inline">Arviot</span>
                    </TabsTrigger>
                    <TabsTrigger value="basic" className="flex items-center gap-1">
                      <Building2 className="w-4 h-4" />
                      <span className="hidden sm:inline">Perustiedot</span>
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="jobs" className="mt-6">
                    <ResultSection
                      title="Rekrytointi & Avoimet työpaikat"
                      icon={<Briefcase className="w-5 h-5 text-emerald-600" />}
                      results={companyData.sections.jobs.results}
                      count={companyData.sections.jobs.count}
                      emptyMessage="Ei löytynyt avoimia työpaikkoja"
                    />
                  </TabsContent>

                  <TabsContent value="news" className="mt-6">
                    <ResultSection
                      title="Uutiset & Ajankohtaista"
                      icon={<Newspaper className="w-5 h-5 text-blue-600" />}
                      results={companyData.sections.news.results}
                      emptyMessage="Ei löytynyt uutisia"
                    />
                  </TabsContent>

                  <TabsContent value="finance" className="mt-6">
                    <ResultSection
                      title="Taloustiedot"
                      icon={<DollarSign className="w-5 h-5 text-green-600" />}
                      results={companyData.sections.finance.results}
                      emptyMessage="Ei löytynyt taloustietoja"
                    />
                  </TabsContent>

                  <TabsContent value="reviews" className="mt-6">
                    <ResultSection
                      title="Työntekijäkokemukset & Arviot"
                      icon={<Star className="w-5 h-5 text-yellow-600" />}
                      results={companyData.sections.reviews.results}
                      emptyMessage="Ei löytynyt arvioita"
                    />
                  </TabsContent>

                  <TabsContent value="basic" className="mt-6">
                    <ResultSection
                      title="Perustiedot"
                      icon={<Building2 className="w-5 h-5 text-gray-600" />}
                      results={companyData.sections.basic.results}
                      emptyMessage="Ei löytynyt perustietoja"
                    />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Empty state */}
        {!companyData && !companyIntelMutation.isPending && (
          <Card className="border-dashed">
            <CardContent className="py-16 text-center">
              <Building2 className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">Aloita yritystiedustelu</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                Kirjoita yrityksen nimi hakukenttään ja saat kattavan analyysin yrityksen 
                rekrytointitilanteesta, uutisista, taloustiedoista ja työntekijäkokemuksista.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
