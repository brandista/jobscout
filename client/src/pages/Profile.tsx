import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Loader2, Save, User, Upload, FileText, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";

export default function Profile() {
  const { user, loading: authLoading } = useAuth();
  const { data: profile, isLoading: profileLoading, refetch } = trpc.profile.get.useQuery(undefined, {
    enabled: !!user,
  });
  const upsertMutation = trpc.profile.upsert.useMutation();
  const parseCVMutation = trpc.profile.parseCV.useMutation();

  // Form state
  const [currentTitle, setCurrentTitle] = useState("");
  const [yearsOfExperience, setYearsOfExperience] = useState<number>(0);
  const [skills, setSkills] = useState("");
  const [languages, setLanguages] = useState("");
  const [certifications, setCertifications] = useState("");
  const [degree, setDegree] = useState("");
  const [field, setField] = useState("");
  const [university, setUniversity] = useState("");
  const [graduationYear, setGraduationYear] = useState<number>(2020);
  const [preferredJobTitles, setPreferredJobTitles] = useState("");
  const [preferredIndustries, setPreferredIndustries] = useState("");
  const [preferredLocations, setPreferredLocations] = useState("");
  const [employmentTypes, setEmploymentTypes] = useState("");
  const [salaryMin, setSalaryMin] = useState<number>(0);
  const [salaryMax, setSalaryMax] = useState<number>(0);
  const [remotePreference, setRemotePreference] = useState("hybrid");
  
  // CV Upload state
  const [uploadedCV, setUploadedCV] = useState<File | null>(null);
  const [isParsingCV, setIsParsingCV] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load profile data when available
  useEffect(() => {
    if (profile) {
      setCurrentTitle(profile.currentTitle || "");
      setYearsOfExperience(profile.yearsOfExperience || 0);
      setSkills(profile.skills ? JSON.parse(profile.skills).join(", ") : "");
      setLanguages(profile.languages ? JSON.parse(profile.languages).join(", ") : "");
      setCertifications(profile.certifications ? JSON.parse(profile.certifications).join(", ") : "");
      setDegree(profile.degree || "");
      setField(profile.field || "");
      setUniversity(profile.university || "");
      setGraduationYear(profile.graduationYear || 2020);
      setPreferredJobTitles(profile.preferredJobTitles ? JSON.parse(profile.preferredJobTitles).join(", ") : "");
      setPreferredIndustries(profile.preferredIndustries ? JSON.parse(profile.preferredIndustries).join(", ") : "");
      setPreferredLocations(profile.preferredLocations ? JSON.parse(profile.preferredLocations).join(", ") : "");
      setEmploymentTypes(profile.employmentTypes ? JSON.parse(profile.employmentTypes).join(", ") : "");
      setSalaryMin(profile.salaryMin || 0);
      setSalaryMax(profile.salaryMax || 0);
      setRemotePreference(profile.remotePreference || "hybrid");
    }
  }, [profile]);

  // Handle CV upload and parsing
  const handleCVUpload = useCallback(async (file: File) => {
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
    ];

    if (!allowedTypes.includes(file.type)) {
      toast.error("Vain PDF, DOCX tai TXT tiedostot sallittu");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("Tiedosto on liian suuri (max 10MB)");
      return;
    }

    setUploadedCV(file);
    setIsParsingCV(true);

    try {
      // Convert to base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // Parse CV via backend
      const parsed = await parseCVMutation.mutateAsync({
        fileBase64: base64,
        fileName: file.name,
        fileType: file.type,
      });

      // Update form fields with parsed data
      if (parsed.currentTitle) setCurrentTitle(parsed.currentTitle);
      if (parsed.yearsOfExperience) setYearsOfExperience(parsed.yearsOfExperience);
      if (parsed.skills?.length) setSkills(parsed.skills.join(", "));
      if (parsed.languages?.length) setLanguages(parsed.languages.join(", "));
      if (parsed.certifications?.length) setCertifications(parsed.certifications.join(", "));
      if (parsed.degree) setDegree(parsed.degree);
      if (parsed.field) setField(parsed.field);
      if (parsed.university) setUniversity(parsed.university);
      if (parsed.graduationYear) setGraduationYear(parsed.graduationYear);

      toast.success("CV analysoitu onnistuneesti! Tarkista ja täydennä tiedot.");
    } catch (error) {
      toast.error("CV:n analysointi epäonnistui");
      console.error(error);
    } finally {
      setIsParsingCV(false);
    }
  }, [parseCVMutation]);

  // Handle drag & drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleCVUpload(file);
  }, [handleCVUpload]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await upsertMutation.mutateAsync({
        currentTitle: currentTitle || undefined,
        yearsOfExperience: yearsOfExperience || undefined,
        skills: skills ? skills.split(",").map(s => s.trim()) : undefined,
        languages: languages ? languages.split(",").map(l => l.trim()) : undefined,
        certifications: certifications ? certifications.split(",").map(c => c.trim()) : undefined,
        degree: degree || undefined,
        field: field || undefined,
        university: university || undefined,
        graduationYear: graduationYear || undefined,
        preferredJobTitles: preferredJobTitles ? preferredJobTitles.split(",").map(t => t.trim()) : undefined,
        preferredIndustries: preferredIndustries ? preferredIndustries.split(",").map(i => i.trim()) : undefined,
        preferredLocations: preferredLocations ? preferredLocations.split(",").map(l => l.trim()) : undefined,
        employmentTypes: employmentTypes ? employmentTypes.split(",").map(t => t.trim()) : undefined,
        salaryMin: salaryMin || undefined,
        salaryMax: salaryMax || undefined,
        remotePreference: remotePreference || undefined,
      });

      toast.success("Profiili tallennettu onnistuneesti!");
      refetch();
    } catch (error) {
      toast.error("Profiilin tallentaminen epäonnistui");
      console.error(error);
    }
  };

  if (authLoading || profileLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="container max-w-4xl py-8">
        <div className="flex items-center gap-3 mb-6">
          <User className="w-8 h-8 text-primary" />
          <h1 className="text-3xl font-bold">Ammatillinen Profiili</h1>
        </div>

        {/* CV Upload Card */}
        <Card 
          className="mb-6 border-2 border-dashed hover:border-primary/50 transition-colors"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Lataa CV
            </CardTitle>
            <CardDescription>
              Lataa CV (PDF, DOCX tai TXT) ja täytämme profiilisi automaattisesti
            </CardDescription>
          </CardHeader>
          <CardContent>
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept=".pdf,.docx,.txt"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleCVUpload(file);
              }}
            />
            
            {uploadedCV ? (
              <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
                <FileText className="w-10 h-10 text-primary" />
                <div className="flex-1">
                  <p className="font-medium">{uploadedCV.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(uploadedCV.size / 1024).toFixed(1)} KB
                    {isParsingCV && " • Analysoidaan..."}
                  </p>
                </div>
                {isParsingCV ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setUploadedCV(null)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ) : (
              <div 
                className="flex flex-col items-center justify-center p-8 cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground text-center">
                  Vedä ja pudota CV tähän tai <span className="text-primary font-medium">klikkaa valitaksesi</span>
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  PDF, DOCX tai TXT (max 10MB)
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Professional Information */}
          <Card>
            <CardHeader>
              <CardTitle>Ammatilliset Tiedot</CardTitle>
              <CardDescription>Kerro itsestäsi ammattilaisena</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="currentTitle">Nykyinen Ammattinimike</Label>
                  <Input
                    id="currentTitle"
                    value={currentTitle}
                    onChange={(e) => setCurrentTitle(e.target.value)}
                    placeholder="esim. Senior Software Developer"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="yearsOfExperience">Kokemus (vuosia)</Label>
                  <Input
                    id="yearsOfExperience"
                    type="number"
                    value={yearsOfExperience}
                    onChange={(e) => setYearsOfExperience(Number(e.target.value))}
                    placeholder="5"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="skills">Taidot (pilkulla erotettu)</Label>
                <Textarea
                  id="skills"
                  value={skills}
                  onChange={(e) => setSkills(e.target.value)}
                  placeholder="JavaScript, TypeScript, React, Node.js, Python"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="languages">Kielet (pilkulla erotettu)</Label>
                  <Input
                    id="languages"
                    value={languages}
                    onChange={(e) => setLanguages(e.target.value)}
                    placeholder="Suomi, Englanti, Ruotsi"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="certifications">Sertifikaatit (pilkulla erotettu)</Label>
                  <Input
                    id="certifications"
                    value={certifications}
                    onChange={(e) => setCertifications(e.target.value)}
                    placeholder="AWS Certified, Scrum Master"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Education */}
          <Card>
            <CardHeader>
              <CardTitle>Koulutus</CardTitle>
              <CardDescription>Koulutustietosi</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="degree">Tutkinto</Label>
                  <Input
                    id="degree"
                    value={degree}
                    onChange={(e) => setDegree(e.target.value)}
                    placeholder="esim. DI, FM"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="field">Ala</Label>
                  <Input
                    id="field"
                    value={field}
                    onChange={(e) => setField(e.target.value)}
                    placeholder="esim. Tietotekniikka"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="university">Yliopisto</Label>
                  <Input
                    id="university"
                    value={university}
                    onChange={(e) => setUniversity(e.target.value)}
                    placeholder="esim. Aalto-yliopisto"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="graduationYear">Valmistumisvuosi</Label>
                  <Input
                    id="graduationYear"
                    type="number"
                    value={graduationYear}
                    onChange={(e) => setGraduationYear(Number(e.target.value))}
                    placeholder="2020"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Preferences */}
          <Card>
            <CardHeader>
              <CardTitle>Työpreferenssit</CardTitle>
              <CardDescription>Mitä etsit seuraavasta työpaikasta?</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="preferredJobTitles">Toivotut Ammattinimikkeet (pilkulla erotettu)</Label>
                <Textarea
                  id="preferredJobTitles"
                  value={preferredJobTitles}
                  onChange={(e) => setPreferredJobTitles(e.target.value)}
                  placeholder="Full Stack Developer, Software Engineer, Tech Lead"
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="preferredIndustries">Toivotut Alat (pilkulla erotettu)</Label>
                <Input
                  id="preferredIndustries"
                  value={preferredIndustries}
                  onChange={(e) => setPreferredIndustries(e.target.value)}
                  placeholder="Technology, Finance, Healthcare"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="preferredLocations">Toivotut Sijainnit (pilkulla erotettu)</Label>
                <Input
                  id="preferredLocations"
                  value={preferredLocations}
                  onChange={(e) => setPreferredLocations(e.target.value)}
                  placeholder="Helsinki, Espoo, Tampere"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="employmentTypes">Työsuhteen Tyyppi (pilkulla erotettu)</Label>
                  <Input
                    id="employmentTypes"
                    value={employmentTypes}
                    onChange={(e) => setEmploymentTypes(e.target.value)}
                    placeholder="full-time, part-time, contract"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="remotePreference">Etätyöpreferenssi</Label>
                  <Select value={remotePreference} onValueChange={setRemotePreference}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="remote">Etätyö</SelectItem>
                      <SelectItem value="hybrid">Hybridi</SelectItem>
                      <SelectItem value="on-site">Toimistolla</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="salaryMin">Minimipalkka (€/kk)</Label>
                  <Input
                    id="salaryMin"
                    type="number"
                    value={salaryMin}
                    onChange={(e) => setSalaryMin(Number(e.target.value))}
                    placeholder="3500"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="salaryMax">Maksimipalkka (€/kk)</Label>
                  <Input
                    id="salaryMax"
                    type="number"
                    value={salaryMax}
                    onChange={(e) => setSalaryMax(Number(e.target.value))}
                    placeholder="6000"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Button type="submit" size="lg" disabled={upsertMutation.isPending} className="w-full md:w-auto">
            {upsertMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Tallennetaan...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Tallenna Profiili
              </>
            )}
          </Button>
        </form>
      </div>
    </DashboardLayout>
  );
}
