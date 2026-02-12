import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import {
  Loader2, Search, Building2, AlertTriangle, CheckCircle2,
  Calendar, Globe, Users, TrendingUp, Plus, FileText,
  ExternalLink, Clock, MapPin, XCircle, ShieldCheck
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";

export default function PrhSearch() {
  const { user, loading: authLoading } = useAuth();
  const [searchType, setSearchType] = useState<"name" | "ytunnus">("name");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  // Search by name
  const { data: nameResults, refetch: searchByName, isFetching: isFetchingName } = 
    trpc.prh.searchByName.useQuery(
      { name: searchQuery, maxResults: 20 },
      { enabled: false }
    );

  // Search by Y-tunnus
  const { data: ytunnusResult, refetch: searchByYTunnus, isFetching: isFetchingYTunnus } = 
    trpc.prh.searchByYTunnus.useQuery(
      { yTunnus: searchQuery },
      { enabled: false }
    );

  // Enrich company mutation
  const enrichMutation = trpc.prh.enrichCompany.useMutation({
    onSuccess: (data) => {
      if (data) {
        toast.success(`${data.companyName} lisätty järjestelmään`);
      }
    },
    onError: () => toast.error("Yrityksen lisäys epäonnistui"),
  });

  // Add to watchlist mutation
  const addToWatchlistMutation = trpc.watchlist.add.useMutation({
    onSuccess: () => {
      toast.success("Yritys lisätty watchlistille");
    },
    onError: () => toast.error("Lisäys epäonnistui"),
  });

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      toast.error("Syötä hakutermi");
      return;
    }

    setIsSearching(true);
    try {
      if (searchType === "name") {
        await searchByName();
      } else {
        await searchByYTunnus();
      }
    } finally {
      setIsSearching(false);
    }
  };

  const handleEnrichAndWatch = async (yTunnus: string) => {
    const result = await enrichMutation.mutateAsync({ yTunnus });
    // After enriching, we'd need the company ID to add to watchlist
    // For now, just show success
    if (result) {
      toast.success(`${result.companyName} käsitelty - hae uudelleen lisätäksesi watchlistille`);
    }
  };

  const isFetching = isFetchingName || isFetchingYTunnus || isSearching;

  if (authLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!user) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold mb-4">Kirjaudu sisään</h2>
          <p className="text-muted-foreground mb-4">
            PRH-haku vaatii kirjautumisen.
          </p>
          <Link href="/login">
            <Button>Kirjaudu</Button>
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">PRH Yritystiedot</h1>
          <p className="text-muted-foreground">
            Hae suomalaisten yritysten virallisia tietoja Patentti- ja rekisterihallituksen avoimesta datasta
          </p>
        </div>

        {/* Search */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Hae yrityksiä</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs value={searchType} onValueChange={(v) => setSearchType(v as "name" | "ytunnus")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="name">Nimellä</TabsTrigger>
                <TabsTrigger value="ytunnus">Y-tunnuksella</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder={searchType === "name" ? "Esim. Nokia, Supercell..." : "Esim. 1234567-8"}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="pl-10"
                />
              </div>
              <Button onClick={handleSearch} disabled={isFetching}>
                {isFetching ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Hae"
                )}
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Tiedot haetaan PRH:n avoimesta rajapinnasta (avoindata.prh.fi)
            </p>
          </CardContent>
        </Card>

        {/* Results */}
        {searchType === "ytunnus" && ytunnusResult && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                {ytunnusResult.companyName}
              </CardTitle>
              <CardDescription>{ytunnusResult.yTunnus}</CardDescription>
            </CardHeader>
            <CardContent>
              <CompanyDetails data={ytunnusResult} onEnrich={handleEnrichAndWatch} />
            </CardContent>
          </Card>
        )}

        {searchType === "name" && nameResults && nameResults.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">
              Hakutulokset ({nameResults.length})
            </h2>
            
            <div className="grid gap-4">
              {nameResults.map((company) => (
                <Card key={company.yTunnus} className={`hover:shadow-md transition-shadow ${!company.active ? 'opacity-60' : ''}`}>
                  <CardContent className="p-4 space-y-3">
                    {/* Row 1: Name + status badges + action */}
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold">{company.name}</h3>
                          {company.active ? (
                            <Badge variant="default" className="bg-green-600 text-xs">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Aktiivinen
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="text-xs">
                              <XCircle className="w-3 h-3 mr-1" />
                              Lopetettu
                            </Badge>
                          )}
                          {company.liquidation && (
                            <Badge variant="destructive" className="text-xs">
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              Selvitystilassa
                            </Badge>
                          )}
                        </div>

                        {/* Row 2: Y-tunnus, form, date, city */}
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <FileText className="w-3.5 h-3.5" />
                            {company.yTunnus}
                          </span>
                          {company.companyForm && (
                            <span>• {company.companyForm}</span>
                          )}
                          {company.registrationDate && (
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(company.registrationDate).toLocaleDateString('fi-FI')}
                            </span>
                          )}
                          {company.address?.city && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {company.address.city}
                            </span>
                          )}
                        </div>
                      </div>

                      <Button
                        size="sm"
                        onClick={() => handleEnrichAndWatch(company.yTunnus)}
                        disabled={enrichMutation.isPending}
                      >
                        {enrichMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Plus className="w-4 h-4 mr-1" />
                            Lisää
                          </>
                        )}
                      </Button>
                    </div>

                    {/* Row 3: Address */}
                    {company.address?.street && (
                      <div className="text-sm text-muted-foreground">
                        {company.address.street}, {company.address.postCode} {company.address.city}
                      </div>
                    )}

                    {/* Row 4: Industry + website */}
                    <div className="flex flex-wrap gap-2 items-center">
                      {company.industry && (
                        <Badge variant="secondary" className="text-xs">
                          {company.industryCode && <span className="opacity-60 mr-1">{company.industryCode}</span>}
                          {company.industry}
                        </Badge>
                      )}
                      {company.website && (
                        <a
                          href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline flex items-center gap-1"
                        >
                          <Globe className="w-3 h-3" />
                          {company.website}
                        </a>
                      )}
                    </div>

                    {/* Row 5: Register status chips */}
                    {company.registers && (
                      <div className="flex flex-wrap gap-1.5">
                        <Badge variant={company.registers.tradeRegister ? "outline" : "destructive"} className="text-xs">
                          {company.registers.tradeRegister ? <ShieldCheck className="w-3 h-3 mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
                          Kaupparekisteri
                        </Badge>
                        <Badge variant={company.registers.taxPrepayment ? "outline" : "secondary"} className="text-xs">
                          {company.registers.taxPrepayment ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <XCircle className="w-3 h-3 mr-1 opacity-40" />}
                          Ennakkoperintä
                        </Badge>
                        <Badge variant={company.registers.employerRegister ? "outline" : "secondary"} className="text-xs">
                          {company.registers.employerRegister ? <Users className="w-3 h-3 mr-1" /> : <XCircle className="w-3 h-3 mr-1 opacity-40" />}
                          Työnantajarek.
                        </Badge>
                        <Badge variant={company.registers.vatLiable ? "outline" : "secondary"} className="text-xs">
                          {company.registers.vatLiable ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <XCircle className="w-3 h-3 mr-1 opacity-40" />}
                          ALV
                        </Badge>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {searchType === "name" && nameResults && nameResults.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <Search className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">Ei tuloksia</h3>
              <p className="text-muted-foreground">
                Hakuehdoilla ei löytynyt yrityksiä
              </p>
            </CardContent>
          </Card>
        )}

        {/* Info */}
        <Card className="bg-muted/50">
          <CardContent className="p-4">
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Miksi PRH-tiedot ovat tärkeitä?
            </h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• <strong>Selvitystila-tieto</strong> - Vältä yritykset jotka ovat lopettamassa</li>
              <li>• <strong>Toimiala</strong> - Tunnista relevantit yritykset omalle alallesi</li>
              <li>• <strong>Rekisteröintipäivä</strong> - Löydä uudet kasvuyritykset</li>
              <li>• <strong>Yhtiömuoto</strong> - Tunnista vakiintuneet vs. startup-yritykset</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

// Company details component
function CompanyDetails({ 
  data, 
  onEnrich 
}: { 
  data: any;
  onEnrich: (yTunnus: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Status */}
        <div className="flex items-center gap-2">
          {data.liquidation ? (
            <Badge variant="destructive">
              <AlertTriangle className="w-4 h-4 mr-1" />
              Selvitystilassa
            </Badge>
          ) : (
            <Badge variant="default" className="bg-green-600">
              <CheckCircle2 className="w-4 h-4 mr-1" />
              Aktiivinen
            </Badge>
          )}
        </div>

        {/* Company Form */}
        {data.companyForm && (
          <div className="flex items-center gap-2 text-sm">
            <Building2 className="w-4 h-4 text-muted-foreground" />
            <span>{data.companyForm}</span>
          </div>
        )}

        {/* Registration Date */}
        {data.registrationDate && (
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <span>Rekisteröity: {new Date(data.registrationDate).toLocaleDateString('fi-FI')}</span>
          </div>
        )}

        {/* Website */}
        {data.website && (
          <div className="flex items-center gap-2 text-sm">
            <Globe className="w-4 h-4 text-muted-foreground" />
            <a 
              href={data.website.startsWith('http') ? data.website : `https://${data.website}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline flex items-center gap-1"
            >
              {data.website}
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}
      </div>

      {/* Business Line */}
      {data.businessLine && (
        <div className="p-3 bg-muted rounded-lg">
          <div className="text-xs text-muted-foreground mb-1">Päätoimiala</div>
          <div className="text-sm">
            {data.businessLine}
            {data.businessLineCode && (
              <span className="text-muted-foreground ml-2">({data.businessLineCode})</span>
            )}
          </div>
        </div>
      )}

      {/* Financial Data (if available) */}
      {(data.latestRevenue || data.latestEmployees) && (
        <div className="grid grid-cols-2 gap-4">
          {data.latestRevenue && (
            <div className="p-3 bg-muted rounded-lg">
              <div className="text-xs text-muted-foreground mb-1">
                Liikevaihto {data.latestRevenueYear && `(${data.latestRevenueYear})`}
              </div>
              <div className="text-lg font-semibold">
                {(data.latestRevenue / 1000000).toFixed(1)} M€
              </div>
            </div>
          )}
          {data.latestEmployees && (
            <div className="p-3 bg-muted rounded-lg">
              <div className="text-xs text-muted-foreground mb-1">Henkilöstö</div>
              <div className="text-lg font-semibold flex items-center gap-2">
                <Users className="w-5 h-5" />
                {data.latestEmployees}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-4 border-t">
        <Button onClick={() => onEnrich(data.yTunnus)}>
          <Plus className="w-4 h-4 mr-2" />
          Lisää järjestelmään
        </Button>
        <Link href="/watchlist">
          <Button variant="outline">
            Avaa Watchlist
          </Button>
        </Link>
      </div>
    </div>
  );
}
