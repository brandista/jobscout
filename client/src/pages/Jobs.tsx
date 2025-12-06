import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Briefcase, Building2, Calendar, Loader2, MapPin, TrendingUp, Euro, Bookmark } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";

export default function Jobs() {
  const { user, loading: authLoading } = useAuth();
  const { data: matches, isLoading: matchesLoading, refetch } = trpc.matches.list.useQuery(
    { limit: 50 },
    { enabled: !!user }
  );
  const saveJobMutation = trpc.savedJobs.save.useMutation();

  const handleSaveJob = async (jobId: number) => {
    try {
      await saveJobMutation.mutateAsync({ jobId });
      toast.success("Työpaikka tallennettu!");
      refetch();
    } catch (error) {
      toast.error("Tallentaminen epäonnistui");
    }
  };

  const getMatchBadgeColor = (category: string) => {
    switch (category) {
      case "perfect": return "bg-green-500 text-white";
      case "good": return "bg-blue-500 text-white";
      case "fair": return "bg-yellow-500 text-white";
      case "possible": return "bg-orange-500 text-white";
      default: return "bg-gray-500 text-white";
    }
  };

  const getMatchLabel = (category: string) => {
    switch (category) {
      case "perfect": return "Täydellinen";
      case "good": return "Hyvä";
      case "fair": return "Kohtuullinen";
      case "possible": return "Mahdollinen";
      default: return "Heikko";
    }
  };

  if (authLoading || matchesLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!matches || matches.length === 0) {
    return (
      <DashboardLayout>
        <div className="container max-w-6xl py-8">
          <div className="flex items-center gap-3 mb-6">
            <Briefcase className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold">Työpaikka-Matchit</h1>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Ei matcheja vielä</CardTitle>
              <CardDescription>Aloita scoutaus löytääksesi sinulle sopivia työpaikkoja!</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/scout">
                <Button>
                  <TrendingUp className="w-4 h-4 mr-2" />
                  Aloita Scoutaus
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="container max-w-6xl py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Briefcase className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold">Työpaikka-Matchit</h1>
          </div>
          <Badge variant="secondary" className="text-lg px-4 py-2">{matches.length} matchit</Badge>
        </div>
        <div className="grid grid-cols-1 gap-4">
          {matches.map(({ match, job }) => (
            <Card key={match.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <CardTitle className="text-xl">{job.title}</CardTitle>
                      <Badge className={getMatchBadgeColor(match.matchCategory || "weak")}>
                        {match.totalScore}% - {getMatchLabel(match.matchCategory || "weak")}
                      </Badge>
                    </div>
                    <CardDescription className="flex items-center gap-4 text-base">
                      <span className="flex items-center gap-1"><Building2 className="w-4 h-4" />{job.company}</span>
                      {job.location && <span className="flex items-center gap-1"><MapPin className="w-4 h-4" />{job.location}</span>}
                      {job.remoteType && <Badge variant="outline">{job.remoteType}</Badge>}
                    </CardDescription>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => handleSaveJob(job.id)} disabled={saveJobMutation.isPending}>
                    <Bookmark className="w-5 h-5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                    {job.salaryMin && <span className="flex items-center gap-1"><Euro className="w-4 h-4" />{job.salaryMin} - {job.salaryMax || job.salaryMin * 1.2} €/kk</span>}
                    {job.employmentType && <Badge variant="secondary">{job.employmentType}</Badge>}
                    {job.postedAt && <span className="flex items-center gap-1"><Calendar className="w-4 h-4" />{new Date(job.postedAt).toLocaleDateString("fi-FI")}</span>}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-3 border-t">
                    <div><div className="text-xs text-muted-foreground">Taidot</div><div className="font-semibold">{match.skillScore}%</div></div>
                    <div><div className="text-xs text-muted-foreground">Kokemus</div><div className="font-semibold">{match.experienceScore}%</div></div>
                    <div><div className="text-xs text-muted-foreground">Sijainti</div><div className="font-semibold">{match.locationScore}%</div></div>
                  </div>
                  {job.description && <p className="text-sm text-muted-foreground line-clamp-2 pt-3 border-t">{job.description}</p>}
                  <div className="flex gap-2 pt-3">
                    {job.url && <Button asChild variant="default"><a href={job.url} target="_blank" rel="noopener noreferrer">Katso Ilmoitus</a></Button>}
                    <Link href={`/jobs/${job.id}`}><Button variant="outline">Lisätiedot</Button></Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
