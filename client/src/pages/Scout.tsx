import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Loader2, Play, History, TrendingUp, CheckCircle2, AlertCircle, Globe, Bell, Mail, Zap } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Link } from "wouter";

const AVAILABLE_SOURCES = [
  { id: "google", name: "Google Jobs + Suomalaiset", description: "Duunitori, Oikotie, Monster, TE-palvelut, Kuntarekry, LinkedIn, Indeed" },
  { id: "vantaa", name: "Vantaan avoimet paikat", description: "Vantaan kaupungin avoimet työpaikat (ilmainen)" },
  { id: "linkedin", name: "LinkedIn Direct (tulossa)", description: "Suora LinkedIn-integraatio - tulossa pian", disabled: true },
];

export default function Scout() {
  const { user, loading: authLoading } = useAuth();
  const { data: profile } = trpc.profile.get.useQuery(undefined, { enabled: !!user });
  const { data: history, refetch: refetchHistory } = trpc.scout.history.useQuery(
    { limit: 10 },
    { enabled: !!user }
  );
  const { data: autoScoutSettings, refetch: refetchAutoScout } = trpc.autoScout.getSettings.useQuery(
    undefined,
    { enabled: !!user }
  );
  
  const scoutMutation = trpc.scout.run.useMutation();
  const updateAutoScoutMutation = trpc.autoScout.updateSettings.useMutation();
  const runAutoScoutNowMutation = trpc.autoScout.runNow.useMutation();
  
  const [isRunning, setIsRunning] = useState(false);
  const [selectedSources, setSelectedSources] = useState<string[]>(["google"]);
  
  // Auto Scout state
  const [autoScoutEnabled, setAutoScoutEnabled] = useState(false);
  const [autoScoutFrequency, setAutoScoutFrequency] = useState<"daily" | "weekly" | "biweekly">("weekly");
  const [autoScoutEmail, setAutoScoutEmail] = useState("");
  const [autoScoutEmailEnabled, setAutoScoutEmailEnabled] = useState(true);

  // Load auto scout settings
  useEffect(() => {
    if (autoScoutSettings) {
      setAutoScoutEnabled(autoScoutSettings.enabled);
      setAutoScoutFrequency(autoScoutSettings.frequency as "daily" | "weekly" | "biweekly");
      setAutoScoutEmail(autoScoutSettings.emailAddress || "");
      setAutoScoutEmailEnabled(autoScoutSettings.emailEnabled);
    }
  }, [autoScoutSettings]);

  const handleSaveAutoScout = async () => {
    try {
      await updateAutoScoutMutation.mutateAsync({
        enabled: autoScoutEnabled,
        frequency: autoScoutFrequency,
        emailEnabled: autoScoutEmailEnabled,
        emailAddress: autoScoutEmail || undefined,
        sources: selectedSources,
      });
      toast.success(autoScoutEnabled ? "Auto Scout aktivoitu!" : "Auto Scout pois päältä");
      refetchAutoScout();
    } catch (error) {
      toast.error("Tallennus epäonnistui");
    }
  };

  const handleTestAutoScout = async () => {
    try {
      const result = await runAutoScoutNowMutation.mutateAsync();
      toast.success(`Löydettiin ${result.jobsFound} työpaikkaa${result.emailSent ? ", sähköposti lähetetty!" : ""}`);
    } catch (error: any) {
      toast.error(error.message || "Testi epäonnistui");
    }
  };

  const toggleSource = (sourceId: string) => {
    setSelectedSources(prev => 
      prev.includes(sourceId) 
        ? prev.filter(s => s !== sourceId)
        : [...prev, sourceId]
    );
  };

  const handleRunScout = async () => {
    if (!profile) {
      toast.error("Luo ensin profiili ennen scoutauksen aloittamista!");
      return;
    }

    if (selectedSources.length === 0) {
      toast.error("Valitse vähintään yksi lähde!");
      return;
    }

    setIsRunning(true);
    try {
      const result = await scoutMutation.mutateAsync({
        sources: selectedSources,
        maxResults: 50,
      });

      toast.success(
        `Scoutaus valmis! Löydettiin ${result.totalJobs} työpaikkaa, joista ${result.newMatches} uutta matchia.`
      );
      refetchHistory();
    } catch (error) {
      toast.error("Scoutaus epäonnistui. Yritä uudelleen.");
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
    <div className="container max-w-4xl py-8">
      <div className="flex items-center gap-3 mb-6">
        <TrendingUp className="w-8 h-8 text-primary" />
        <h1 className="text-3xl font-bold">Työpaikka-Scoutaus</h1>
      </div>

      {/* Scout Action Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Aloita Scoutaus</CardTitle>
          <CardDescription>
            Agentti etsii sinulle sopivia työpaikkoja profiilisi perusteella
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!profile ? (
            <div className="flex items-start gap-3 p-4 bg-yellow-50 dark:bg-yellow-950 rounded-lg border border-yellow-200 dark:border-yellow-800">
              <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-yellow-900 dark:text-yellow-100">
                  Profiili puuttuu
                </p>
                <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                  Luo ensin ammatillinen profiili, jotta agentti voi etsiä sinulle sopivia työpaikkoja.
                </p>
                <Link href="/profile">
                  <Button variant="outline" size="sm" className="mt-3">
                    Luo Profiili
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                <CheckCircle2 className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-blue-900 dark:text-blue-100">
                    Profiili valmis
                  </p>
                  <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                    Agentti käyttää profiiliasi etsiäkseen sinulle sopivia työpaikkoja.
                  </p>
                </div>
              </div>

              {/* Source Selection */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">Valitse lähteet</Label>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {AVAILABLE_SOURCES.map((source) => (
                    <div
                      key={source.id}
                      className={`flex items-start gap-3 p-3 border rounded-lg transition-colors ${
                        source.disabled 
                          ? "opacity-50 cursor-not-allowed"
                          : selectedSources.includes(source.id)
                            ? "border-primary bg-primary/5 cursor-pointer"
                            : "border-border hover:bg-accent/50 cursor-pointer"
                      }`}
                      onClick={() => !source.disabled && toggleSource(source.id)}
                    >
                      <Checkbox
                        checked={selectedSources.includes(source.id)}
                        onCheckedChange={() => !source.disabled && toggleSource(source.id)}
                        disabled={source.disabled}
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{source.name}</p>
                        <p className="text-xs text-muted-foreground">{source.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Button
                onClick={handleRunScout}
                disabled={isRunning || selectedSources.length === 0}
                size="lg"
                className="w-full"
              >
                {isRunning ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Scoutataan työpaikkoja...
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5 mr-2" />
                    Käynnistä Scoutaus ({selectedSources.length} lähdettä)
                  </>
                )}
              </Button>

              <p className="text-sm text-muted-foreground text-center">
                Scoutaus kestää muutaman sekunnin. Agentti etsii työpaikkoja valituista lähteistä ja
                laskee matchaus-scoret profiilisi perusteella.
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {/* Scout History */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <History className="w-5 h-5" />
            <CardTitle>Scoutaus-Historia</CardTitle>
          </div>
          <CardDescription>Aiemmat scoutaus-ajot</CardDescription>
        </CardHeader>
        <CardContent>
          {!history || history.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Ei scoutaus-historiaa vielä. Aloita ensimmäinen scoutaus yllä!
            </p>
          ) : (
            <div className="space-y-3">
              {history.map((run) => (
                <div
                  key={run.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">
                        {new Date(run.executedAt).toLocaleString("fi-FI")}
                      </span>
                      {run.status === "success" ? (
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-red-600" />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {run.resultsCount} työpaikkaa löydetty, {run.newMatchesCount} matchit
                    </p>
                    {run.errorMessage && (
                      <p className="text-sm text-red-600 mt-1">{run.errorMessage}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">
                        Lähteet: {run.sources ? JSON.parse(run.sources).join(", ") : "N/A"}
                      </p>
                    </div>
                    {run.resultsCount > 0 && (
                      <Link href="/jobs">
                        <Button variant="outline" size="sm">
                          Katso tulokset
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Auto Scout Settings */}
      <Card className="mt-6">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary" />
            <CardTitle>Automaattinen Scoutaus</CardTitle>
          </div>
          <CardDescription>
            Saat uudet työpaikat automaattisesti sähköpostiisi
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enable/Disable */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="auto-scout-toggle" className="text-base font-medium">
                Aktivoi Auto Scout
              </Label>
              <p className="text-sm text-muted-foreground">
                Hae työpaikat automaattisesti ja lähetä sähköpostilla
              </p>
            </div>
            <Switch
              id="auto-scout-toggle"
              checked={autoScoutEnabled}
              onCheckedChange={setAutoScoutEnabled}
            />
          </div>

          {autoScoutEnabled && (
            <>
              {/* Frequency */}
              <div className="space-y-2">
                <Label>Hakutiheys</Label>
                <Select value={autoScoutFrequency} onValueChange={(v) => setAutoScoutFrequency(v as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Päivittäin</SelectItem>
                    <SelectItem value="weekly">Viikoittain</SelectItem>
                    <SelectItem value="biweekly">Joka toinen viikko</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Email settings */}
              <div className="space-y-4 pt-4 border-t">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <Label className="text-base font-medium">Sähköposti-ilmoitukset</Label>
                </div>
                
                <div className="flex items-center justify-between">
                  <Label htmlFor="email-toggle" className="text-sm">Lähetä tulokset sähköpostiin</Label>
                  <Switch
                    id="email-toggle"
                    checked={autoScoutEmailEnabled}
                    onCheckedChange={setAutoScoutEmailEnabled}
                  />
                </div>

                {autoScoutEmailEnabled && (
                  <div className="space-y-2">
                    <Label htmlFor="email-address">Sähköpostiosoite</Label>
                    <Input
                      id="email-address"
                      type="email"
                      placeholder="nimi@esimerkki.fi"
                      value={autoScoutEmail}
                      onChange={(e) => setAutoScoutEmail(e.target.value)}
                    />
                  </div>
                )}
              </div>

              {/* Status */}
              {autoScoutSettings?.lastRunAt && (
                <div className="text-sm text-muted-foreground pt-4 border-t">
                  <p>Edellinen ajo: {new Date(autoScoutSettings.lastRunAt).toLocaleString("fi-FI")}</p>
                  {autoScoutSettings.nextRunAt && (
                    <p>Seuraava ajo: {new Date(autoScoutSettings.nextRunAt).toLocaleString("fi-FI")}</p>
                  )}
                </div>
              )}
            </>
          )}

          {/* Action buttons */}
          <div className="flex gap-3 pt-4">
            <Button 
              onClick={handleSaveAutoScout} 
              disabled={updateAutoScoutMutation.isPending}
            >
              {updateAutoScoutMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4 mr-2" />
              )}
              Tallenna asetukset
            </Button>
            
            {autoScoutEnabled && (
              <Button 
                variant="outline" 
                onClick={handleTestAutoScout}
                disabled={runAutoScoutNowMutation.isPending}
              >
                {runAutoScoutNowMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Zap className="w-4 h-4 mr-2" />
                )}
                Testaa nyt
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Info about supported sources */}
      <Card className="mt-6 border-dashed">
        <CardHeader>
          <CardTitle className="text-lg">Tuetut Lähteet</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-muted-foreground">
            <div>
              <p className="font-medium text-foreground mb-2">Suomalaiset sivustot:</p>
              <ul className="space-y-1">
                <li>✅ Duunitori.fi</li>
                <li>✅ Oikotie.fi/työpaikat</li>
                <li>✅ Monster.fi</li>
                <li>✅ TE-palvelut / Työmarkkinatori</li>
                <li>✅ Kuntarekry.fi</li>
                <li>✅ Vantaan avoimet työpaikat</li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-foreground mb-2">Kansainväliset:</p>
              <ul className="space-y-1">
                <li>✅ LinkedIn Jobs</li>
                <li>✅ Indeed</li>
                <li>✅ Yritysten omat rekrysivut</li>
              </ul>
              <p className="font-medium text-foreground mt-4 mb-2">Tulossa:</p>
              <ul className="space-y-1">
                <li>🔜 Suora LinkedIn-integraatio</li>
                <li>🔜 Piilossa olevien paikkojen etsintä</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
    </DashboardLayout>
  );
}