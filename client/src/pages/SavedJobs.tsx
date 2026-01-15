import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Bookmark, Building2, Loader2, MapPin, Trash2, Euro } from "lucide-react";
import { toast } from "sonner";

export default function SavedJobs() {
  const { user, loading: authLoading } = useAuth();
  const { data: savedJobs, isLoading, refetch } = trpc.savedJobs.list.useQuery(undefined, {
    enabled: !!user,
  });
  const unsaveMutation = trpc.savedJobs.unsave.useMutation();

  const handleUnsave = async (jobId: number) => {
    try {
      await unsaveMutation.mutateAsync({ jobId });
      toast.success("Työpaikka poistettu tallennetuista");
      refetch();
    } catch (error) {
      toast.error("Poistaminen epäonnistui");
    }
  };

  if (authLoading || isLoading) {
    return (
      <DashboardLayout>
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    </DashboardLayout>
    );
  }

  if (!savedJobs || savedJobs.length === 0) {
    return (
      <div className="container max-w-6xl py-8">
        <div className="flex items-center gap-3 mb-6">
          <Bookmark className="w-8 h-8 text-primary" />
          <h1 className="text-3xl font-bold">Tallennetut Työpaikat</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Ei tallennettuja työpaikkoja</CardTitle>
            <CardDescription>
              Tallenna kiinnostavia työpaikkoja myöhempää tarkastelua varten
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <DashboardLayout>
    <div className="container max-w-6xl py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Bookmark className="w-8 h-8 text-primary" />
          <h1 className="text-3xl font-bold">Tallennetut Työpaikat</h1>
        </div>
        <Badge variant="secondary" className="text-lg px-4 py-2">
          {savedJobs.length} tallennettua
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {savedJobs.map(({ savedJob, job }) => (
          <Card key={savedJob.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-xl mb-2">{job.title}</CardTitle>
                  <CardDescription className="flex items-center gap-4 text-base">
                    <span className="flex items-center gap-1">
                      <Building2 className="w-4 h-4" />
                      {job.company}
                    </span>
                    {job.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        {job.location}
                      </span>
                    )}
                    {job.remoteType && (
                      <Badge variant="outline">{job.remoteType}</Badge>
                    )}
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleUnsave(job.id)}
                  disabled={unsaveMutation.isPending}
                >
                  <Trash2 className="w-5 h-5 text-destructive" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Job details */}
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  {job.salaryMin && (
                    <span className="flex items-center gap-1">
                      <Euro className="w-4 h-4" />
                      {job.salaryMin} - {job.salaryMax || job.salaryMin * 1.2} €/kk
                    </span>
                  )}
                  {job.employmentType && (
                    <Badge variant="secondary">{job.employmentType}</Badge>
                  )}
                </div>

                {/* Saved notes */}
                {savedJob.notes && (
                  <div className="p-3 bg-accent/50 rounded-lg border">
                    <p className="text-sm font-medium mb-1">Muistiinpanot:</p>
                    <p className="text-sm text-muted-foreground">{savedJob.notes}</p>
                  </div>
                )}

                {/* Description */}
                {job.description && (
                  <p className="text-sm text-muted-foreground line-clamp-3 pt-3 border-t">
                    {job.description}
                  </p>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-3">
                  {job.url && (
                    <Button asChild variant="default">
                      <a href={job.url} target="_blank" rel="noopener noreferrer">
                        Katso Ilmoitus
                      </a>
                    </Button>
                  )}
                </div>

                {/* Saved timestamp */}
                <p className="text-xs text-muted-foreground">
                  Tallennettu: {new Date(savedJob.savedAt).toLocaleString("fi-FI")}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
    </DashboardLayout>
  );
}
