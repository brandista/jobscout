import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Bell, Briefcase, Building2, TrendingUp, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";

export default function Notifications() {
  const { user, loading: authLoading } = useAuth();
  const { data: matches } = trpc.matches.list.useQuery(
    { limit: 5 },
    { enabled: !!user }
  );
  const { data: watchlist } = trpc.watchlist.list.useQuery(
    undefined,
    { enabled: !!user }
  );

  if (authLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  const recentMatches = matches?.slice(0, 3) || [];
  const activeWatchlist = watchlist?.filter(w => w.alertsEnabled) || [];

  return (
    <DashboardLayout>
      <div className="container max-w-4xl py-8">
        <div className="flex items-center gap-3 mb-6">
          <Bell className="w-8 h-8 text-primary" />
          <h1 className="text-3xl font-bold">Ilmoitukset</h1>
        </div>

        <div className="space-y-6">
          {/* Recent Matches */}
          {recentMatches.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Briefcase className="w-5 h-5" />
                  Uudet tyopaikkamatchit
                </CardTitle>
                <CardDescription>Viimeisimmat sinulle sopivat tyopaikat</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {recentMatches.map(({ match, job }) => (
                    <Link key={match.id} href={`/jobs/${job.id}`}>
                      <div className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                        <div>
                          <p className="font-medium">{job.title}</p>
                          <p className="text-sm text-muted-foreground">{job.company}</p>
                        </div>
                        <Badge variant="secondary">{match.totalScore}% match</Badge>
                      </div>
                    </Link>
                  ))}
                </div>
                <Link href="/jobs" className="text-sm text-primary hover:underline mt-4 inline-block">
                  Nayta kaikki matchit
                </Link>
              </CardContent>
            </Card>
          )}

          {/* Active Watchlist */}
          {activeWatchlist.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="w-5 h-5" />
                  Aktiiviset seurannat
                </CardTitle>
                <CardDescription>Yritykset joita seuraat</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {activeWatchlist.slice(0, 5).map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                      <div>
                        <p className="font-medium">{item.companyName}</p>
                        {item.reason && <p className="text-sm text-muted-foreground">{item.reason}</p>}
                      </div>
                      <Badge variant="outline">Seurannassa</Badge>
                    </div>
                  ))}
                </div>
                <Link href="/watchlist" className="text-sm text-primary hover:underline mt-4 inline-block">
                  Hallinnoi seurantoja
                </Link>
              </CardContent>
            </Card>
          )}

          {/* Empty state */}
          {recentMatches.length === 0 && activeWatchlist.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <Bell className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Ei uusia ilmoituksia</h3>
                <p className="text-muted-foreground mb-4">
                  Aloita scoutaus loytaaksesi tyopaikkoja ja lisaa yrityksia seurantaan.
                </p>
                <Link href="/scout">
                  <span className="text-primary hover:underline inline-flex items-center gap-1">
                    <TrendingUp className="w-4 h-4" />
                    Aloita scoutaus
                  </span>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
