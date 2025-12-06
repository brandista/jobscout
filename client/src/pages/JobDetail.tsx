import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Bookmark, Building2, Calendar, Euro, ExternalLink, Loader2, MapPin } from "lucide-react";
import { Link, useRoute } from "wouter";
import { toast } from "sonner";

export default function JobDetail() {
  const [, params] = useRoute("/jobs/:id");
  const jobId = parseInt(params?.id || "0", 10);
  
  const { user, loading: authLoading } = useAuth();
  const { data: job, isLoading: jobLoading } = trpc.jobs.getById.useQuery(
    { id: jobId },
    { enabled: !!user && jobId > 0 }
  );
  const saveJobMutation = trpc.savedJobs.save.useMutation();

  const handleSaveJob = async () => {
    if (!job) return;
    try {
      await saveJobMutation.mutateAsync({ jobId: job.id });
      toast.success("Työpaikka tallennettu!");
    } catch (error) {
      toast.error("Tallentaminen epäonnistui");
    }
  };

  if (authLoading || jobLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="container max-w-4xl py-8">
        <Card>
          <CardHeader>
            <CardTitle>Työpaikkaa ei löytynyt</CardTitle>
            <CardDescription>
              Työpaikkailmoitusta ei löytynyt tai se on vanhentunut.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/jobs">
              <Button variant="outline">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Takaisin listaan
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Parse required skills
  let requiredSkills: string[] = [];
  try {
    if (job.requiredSkills) {
      requiredSkills = JSON.parse(job.requiredSkills);
    }
  } catch {}

  return (
    <div className="container max-w-4xl py-8">
      {/* Back button */}
      <div className="mb-6">
        <Link href="/jobs">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Takaisin
          </Button>
        </Link>
      </div>

      {/* Main job card */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-2xl mb-2">{job.title}</CardTitle>
              <CardDescription className="flex flex-wrap items-center gap-4 text-base">
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
              variant="outline"
              onClick={handleSaveJob}
              disabled={saveJobMutation.isPending}
            >
              <Bookmark className="w-4 h-4 mr-2" />
              Tallenna
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Key details */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
            {job.salaryMin && (
              <div>
                <div className="text-xs text-muted-foreground mb-1">Palkka</div>
                <div className="font-semibold flex items-center gap-1">
                  <Euro className="w-4 h-4" />
                  {job.salaryMin} - {job.salaryMax || Math.round(job.salaryMin * 1.2)} €/kk
                </div>
              </div>
            )}
            {job.employmentType && (
              <div>
                <div className="text-xs text-muted-foreground mb-1">Työsuhde</div>
                <div className="font-semibold">{job.employmentType}</div>
              </div>
            )}
            {job.experienceRequired && (
              <div>
                <div className="text-xs text-muted-foreground mb-1">Kokemus</div>
                <div className="font-semibold">{job.experienceRequired} vuotta</div>
              </div>
            )}
            {job.industry && (
              <div>
                <div className="text-xs text-muted-foreground mb-1">Ala</div>
                <div className="font-semibold">{job.industry}</div>
              </div>
            )}
          </div>

          {/* Description */}
          {job.description && (
            <div>
              <h3 className="font-semibold mb-2">Kuvaus</h3>
              <p className="text-muted-foreground whitespace-pre-wrap">{job.description}</p>
            </div>
          )}

          {/* Required skills */}
          {requiredSkills.length > 0 && (
            <div>
              <h3 className="font-semibold mb-2">Vaaditut taidot</h3>
              <div className="flex flex-wrap gap-2">
                {requiredSkills.map((skill, index) => (
                  <Badge key={index} variant="secondary">{skill}</Badge>
                ))}
              </div>
            </div>
          )}

          {/* Dates */}
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground pt-4 border-t">
            {job.postedAt && (
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                Julkaistu: {new Date(job.postedAt).toLocaleDateString("fi-FI")}
              </span>
            )}
            {job.expiresAt && (
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                Päättyy: {new Date(job.expiresAt).toLocaleDateString("fi-FI")}
              </span>
            )}
            {job.companyRating && (
              <span>Yrityksen arvosana: {job.companyRating}/100</span>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            {job.url && (
              <Button asChild>
                <a href={job.url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Avaa alkuperäinen ilmoitus
                </a>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
