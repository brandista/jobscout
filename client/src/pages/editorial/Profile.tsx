import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import {
  EditorialShell,
  Masthead,
  BriefSectionLabel,
  BriefMetricRow,
  InlineEditRow,
} from "@/components/editorial";
import { formatBriefDate } from "@shared/lib/editorial-date";
import { toast } from "sonner";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function computeCompleteness(profile: any): { pct: number; missing: string[] } {
  const missing: string[] = [];
  let filled = 0;

  const checks: Array<[boolean, string]> = [
    [!!profile?.currentTitle, "Nykyinen titteli"],
    [Array.isArray(parseJson(profile?.skills, [])) && parseJson<string[]>(profile?.skills, []).length > 0, "Taidot"],
    [!!profile?.yearsOfExperience, "Kokemusvuodet"],
    [Array.isArray(parseJson(profile?.workHistory, [])) && parseJson<any[]>(profile?.workHistory, []).length > 0, "Työhistoria"],
    [!!profile?.degree, "Koulutus"],
    [Array.isArray(parseJson(profile?.languages, [])) && parseJson<string[]>(profile?.languages, []).length > 0, "Kielet"],
    [!!profile?.salaryMin, "Palkkapreferenssi"],
  ];

  for (const [ok, label] of checks) {
    if (ok) filled++;
    else missing.push(label);
  }

  return { pct: Math.round((filled / checks.length) * 100), missing };
}

// ─── Edit modals (simple inline) ─────────────────────────────────────────────

function SkillsSection({
  skills,
  onSave,
}: {
  skills: string[];
  onSave: (skills: string[]) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState(skills.join(", "));

  function save() {
    const parsed = raw.split(",").map((s) => s.trim()).filter(Boolean);
    onSave(parsed);
    setEditing(false);
  }

  return (
    <InlineEditRow label="TAIDOT" onEdit={() => setEditing(!editing)}>
      {editing ? (
        <div>
          <p className="text-xs text-slate-500 mb-2 italic">Pilkulla eroteltu lista taidoista</p>
          <input
            type="text"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            className="w-full bg-transparent border-b border-slate-900 text-slate-900 text-sm py-2 outline-none"
            autoFocus
          />
          <div className="mt-3 flex gap-4 text-[11px] uppercase tracking-[0.18em] font-bold">
            <button onClick={save} className="text-slate-900 hover:opacity-70">Tallenna</button>
            <button onClick={() => setEditing(false)} className="text-slate-400 hover:text-slate-900">Peruuta</button>
          </div>
        </div>
      ) : skills.length > 0 ? (
        <p className="text-base text-slate-900">{skills.join("  ·  ")}</p>
      ) : (
        <p className="text-base italic text-slate-400">Ei taitoja lisätty.</p>
      )}
    </InlineEditRow>
  );
}

function WorkHistorySection({
  history,
  onSave,
}: {
  history: Array<{ company: string; title: string; duration: string; description: string }>;
  onSave: (h: any[]) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [entries, setEntries] = useState(history);

  function updateEntry(i: number, field: string, value: string) {
    setEntries((prev) => prev.map((e, idx) => idx === i ? { ...e, [field]: value } : e));
  }

  function addEntry() {
    setEntries((prev) => [...prev, { company: "", title: "", duration: "", description: "" }]);
  }

  function removeEntry(i: number) {
    setEntries((prev) => prev.filter((_, idx) => idx !== i));
  }

  function save() {
    onSave(entries.filter((e) => e.company || e.title));
    setEditing(false);
  }

  return (
    <InlineEditRow label="KOKEMUS" onEdit={() => setEditing(!editing)}>
      {editing ? (
        <div className="space-y-6">
          {entries.map((e, i) => (
            <div key={i} className="space-y-2 pb-4 border-b border-slate-900/15">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  value={e.title}
                  onChange={(ev) => updateEntry(i, "title", ev.target.value)}
                  placeholder="Titteli"
                  className="bg-transparent border-b border-slate-900/40 text-sm py-1 outline-none"
                />
                <input
                  value={e.company}
                  onChange={(ev) => updateEntry(i, "company", ev.target.value)}
                  placeholder="Yritys"
                  className="bg-transparent border-b border-slate-900/40 text-sm py-1 outline-none"
                />
              </div>
              <input
                value={e.duration}
                onChange={(ev) => updateEntry(i, "duration", ev.target.value)}
                placeholder="Ajanjakso (esim. 2023 – Nyt)"
                className="w-full bg-transparent border-b border-slate-900/40 text-sm py-1 outline-none"
              />
              <textarea
                value={e.description}
                onChange={(ev) => updateEntry(i, "description", ev.target.value)}
                placeholder="Kuvaus"
                rows={2}
                className="w-full bg-transparent border-b border-slate-900/40 text-sm py-1 outline-none resize-none"
              />
              <button onClick={() => removeEntry(i)} className="text-[10px] uppercase tracking-[0.18em] text-slate-400 hover:text-red-500 transition-colors">Poista</button>
            </div>
          ))}
          <button onClick={addEntry} className="text-[11px] uppercase tracking-[0.18em] font-bold text-slate-500 hover:text-slate-900">+ Lisää kokemus</button>
          <div className="flex gap-4 text-[11px] uppercase tracking-[0.18em] font-bold mt-2">
            <button onClick={save} className="text-slate-900 hover:opacity-70">Tallenna</button>
            <button onClick={() => { setEntries(history); setEditing(false); }} className="text-slate-400 hover:text-slate-900">Peruuta</button>
          </div>
        </div>
      ) : history.length > 0 ? (
        <div className="space-y-5">
          {history.map((e, i) => (
            <div key={i}>
              <div className="flex items-baseline justify-between gap-4 flex-wrap">
                <p className="font-[family-name:var(--font-display)] text-base font-black uppercase tracking-tight text-slate-900">
                  {e.title}{e.company ? `, ${e.company}` : ""}
                </p>
                <p className="text-[11px] uppercase tracking-[0.12em] font-bold text-slate-500">{e.duration}</p>
              </div>
              {e.description && <p className="mt-1 text-sm text-slate-700 leading-relaxed">{e.description}</p>}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-base italic text-slate-400">Ei työhistoriaa lisätty.</p>
      )}
    </InlineEditRow>
  );
}

function EducationSection({
  degree,
  field,
  university,
  graduationYear,
  onSave,
}: {
  degree?: string;
  field?: string;
  university?: string;
  graduationYear?: number;
  onSave: (data: { degree: string; field: string; university: string; graduationYear?: number }) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ degree: degree ?? "", field: field ?? "", university: university ?? "", graduationYear: graduationYear?.toString() ?? "" });

  function save() {
    onSave({
      degree: form.degree,
      field: form.field,
      university: form.university,
      graduationYear: form.graduationYear ? parseInt(form.graduationYear) : undefined,
    });
    setEditing(false);
  }

  return (
    <InlineEditRow label="KOULUTUS" onEdit={() => setEditing(!editing)}>
      {editing ? (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input value={form.degree} onChange={(e) => setForm((f) => ({ ...f, degree: e.target.value }))} placeholder="Tutkinto" className="bg-transparent border-b border-slate-900/40 text-sm py-1 outline-none" />
            <input value={form.field} onChange={(e) => setForm((f) => ({ ...f, field: e.target.value }))} placeholder="Ala" className="bg-transparent border-b border-slate-900/40 text-sm py-1 outline-none" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input value={form.university} onChange={(e) => setForm((f) => ({ ...f, university: e.target.value }))} placeholder="Yliopisto / koulu" className="bg-transparent border-b border-slate-900/40 text-sm py-1 outline-none" />
            <input value={form.graduationYear} onChange={(e) => setForm((f) => ({ ...f, graduationYear: e.target.value }))} placeholder="Valmistumisvuosi" className="bg-transparent border-b border-slate-900/40 text-sm py-1 outline-none" />
          </div>
          <div className="flex gap-4 text-[11px] uppercase tracking-[0.18em] font-bold mt-2">
            <button onClick={save} className="text-slate-900 hover:opacity-70">Tallenna</button>
            <button onClick={() => setEditing(false)} className="text-slate-400 hover:text-slate-900">Peruuta</button>
          </div>
        </div>
      ) : degree ? (
        <p className="text-base text-slate-900">
          {[degree, field, university, graduationYear].filter(Boolean).join(" · ")}
        </p>
      ) : (
        <p className="text-base italic text-slate-400">Ei koulutustietoja lisätty.</p>
      )}
    </InlineEditRow>
  );
}

function LanguagesSection({ languages, onSave }: { languages: string[]; onSave: (l: string[]) => void }) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState(languages.join(", "));

  function save() {
    onSave(raw.split(",").map((s) => s.trim()).filter(Boolean));
    setEditing(false);
  }

  return (
    <InlineEditRow label="KIELET" onEdit={() => setEditing(!editing)}>
      {editing ? (
        <div>
          <p className="text-xs text-slate-500 mb-2 italic">Esim. suomi (äidinkieli), englanti (erinomainen)</p>
          <input
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            className="w-full bg-transparent border-b border-slate-900 text-sm py-2 outline-none"
            autoFocus
          />
          <div className="mt-3 flex gap-4 text-[11px] uppercase tracking-[0.18em] font-bold">
            <button onClick={save} className="text-slate-900 hover:opacity-70">Tallenna</button>
            <button onClick={() => setEditing(false)} className="text-slate-400 hover:text-slate-900">Peruuta</button>
          </div>
        </div>
      ) : languages.length > 0 ? (
        <p className="text-base text-slate-900">{languages.join("  ·  ")}</p>
      ) : (
        <p className="text-base italic text-slate-400">Ei kieliä lisätty.</p>
      )}
    </InlineEditRow>
  );
}

function PreferencesSection({
  profile,
  onSave,
}: {
  profile: any;
  onSave: (data: { salaryMin?: number; salaryMax?: number; remotePreference?: string; preferredLocations?: string[] }) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    salaryMin: profile?.salaryMin?.toString() ?? "",
    salaryMax: profile?.salaryMax?.toString() ?? "",
    remotePreference: profile?.remotePreference ?? "",
    preferredLocations: parseJson<string[]>(profile?.preferredLocations, []).join(", "),
  });

  function save() {
    onSave({
      salaryMin: form.salaryMin ? parseInt(form.salaryMin) : undefined,
      salaryMax: form.salaryMax ? parseInt(form.salaryMax) : undefined,
      remotePreference: form.remotePreference || undefined,
      preferredLocations: form.preferredLocations.split(",").map((s) => s.trim()).filter(Boolean),
    });
    setEditing(false);
  }

  return (
    <InlineEditRow label="PREFERENSSIT" onEdit={() => setEditing(!editing)}>
      {editing ? (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input value={form.salaryMin} onChange={(e) => setForm((f) => ({ ...f, salaryMin: e.target.value }))} placeholder="Palkka min (€)" className="bg-transparent border-b border-slate-900/40 text-sm py-1 outline-none" />
            <input value={form.salaryMax} onChange={(e) => setForm((f) => ({ ...f, salaryMax: e.target.value }))} placeholder="Palkka max (€)" className="bg-transparent border-b border-slate-900/40 text-sm py-1 outline-none" />
          </div>
          <input value={form.remotePreference} onChange={(e) => setForm((f) => ({ ...f, remotePreference: e.target.value }))} placeholder="Etätyöpreferenssi (esim. Hybrid)" className="w-full bg-transparent border-b border-slate-900/40 text-sm py-1 outline-none" />
          <input value={form.preferredLocations} onChange={(e) => setForm((f) => ({ ...f, preferredLocations: e.target.value }))} placeholder="Sijainnit, pilkulla eroteltu" className="w-full bg-transparent border-b border-slate-900/40 text-sm py-1 outline-none" />
          <div className="flex gap-4 text-[11px] uppercase tracking-[0.18em] font-bold mt-2">
            <button onClick={save} className="text-slate-900 hover:opacity-70">Tallenna</button>
            <button onClick={() => setEditing(false)} className="text-slate-400 hover:text-slate-900">Peruuta</button>
          </div>
        </div>
      ) : (
        <div className="divide-y divide-slate-900/15">
          <BriefMetricRow label="Palkka" value={profile?.salaryMin && profile?.salaryMax ? `${profile.salaryMin.toLocaleString("fi")}–${profile.salaryMax.toLocaleString("fi")} €` : profile?.salaryMin ? `${profile.salaryMin.toLocaleString("fi")} €+` : "—"} />
          <BriefMetricRow label="Etätyö" value={profile?.remotePreference ?? "—"} />
          <BriefMetricRow label="Sijainti" value={parseJson<string[]>(profile?.preferredLocations, []).join(", ") || "—"} />
        </div>
      )}
    </InlineEditRow>
  );
}

// ─── CV Upload ────────────────────────────────────────────────────────────────

function CvUpload({ onParsed }: { onParsed: (data: any) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const parseCV = trpc.profile.parseCV.useMutation({
    onSuccess: (data) => {
      toast.success("CV parsittu – tarkista tiedot ja tallenna");
      onParsed(data);
    },
    onError: (err) => toast.error(`CV:n parsinta epäonnistui: ${err.message}`),
  });

  function submitFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      parseCV.mutate({
        fileBase64: reader.result as string,
        fileName: file.name,
        fileType: file.type,
      });
    };
    reader.readAsDataURL(file);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) submitFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) submitFile(file);
  }

  return (
    <div>
      <BriefSectionLabel>CV-tiedosto</BriefSectionLabel>
      <div
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragEnter={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`border border-dashed p-6 text-center cursor-pointer transition-colors ${
          dragging ? "border-slate-900 bg-slate-900/[0.04]" : "border-slate-900/30 hover:border-slate-900"
        }`}
      >
        {parseCV.isPending ? (
          <p className="text-sm italic text-slate-400">Parsitaan CV:tä…</p>
        ) : (
          <p className="text-sm italic text-slate-500">Raahaa CV tähän tai klikkaa – PDF tai DOCX</p>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        onChange={handleChange}
        className="hidden"
      />
    </div>
  );
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────

function ProfileSidebar({
  pct,
  missing,
  onSectionFocus,
}: {
  pct: number;
  missing: string[];
  onSectionFocus: (label: string) => void;
}) {
  const segments = 7;
  const filled = Math.round((pct / 100) * segments);

  return (
    <div className="space-y-8">
      <div>
        <BriefSectionLabel>Profiilin kattavuus</BriefSectionLabel>
        <p className="font-[family-name:var(--font-display)] text-5xl font-extrabold tabular-nums tracking-[-0.02em] text-slate-900">
          {pct}<span className="text-2xl font-bold text-slate-400">%</span>
        </p>
        <div className="flex gap-1 mt-3">
          {Array.from({ length: segments }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 ${i < filled ? "bg-slate-900" : "bg-slate-200"}`}
            />
          ))}
        </div>
      </div>

      {missing.length > 0 && (
        <div>
          <BriefSectionLabel>Paranna profiilia</BriefSectionLabel>
          <div className="space-y-3">
            {missing.map((m) => (
              <button
                key={m}
                onClick={() => onSectionFocus(m)}
                className="group w-full text-left flex items-center justify-between gap-2 py-3 border-b border-slate-900/15 hover:bg-slate-900/[0.025] -mx-2 px-2 transition-colors"
              >
                <div>
                  <p className="text-sm font-bold text-slate-900">{m}</p>
                  <p className="text-xs text-slate-500 mt-0.5">Parempia matcheja tarjolla</p>
                </div>
                <span className="text-slate-400 group-hover:text-slate-900 group-hover:translate-x-0.5 transition-all text-sm">→</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Profile() {
  const utils = trpc.useUtils();
  const { data: profile, isLoading } = trpc.profile.get.useQuery();
  const upsert = trpc.profile.upsert.useMutation({
    onSuccess: () => {
      toast.success("Profiili päivitetty");
      utils.profile.get.invalidate();
    },
    onError: () => toast.error("Tallennus epäonnistui"),
  });

  const { data: user } = trpc.auth.me.useQuery();

  if (isLoading) {
    return (
      <EditorialShell>
        <p className="py-16 text-slate-400 italic">Ladataan profiilia…</p>
      </EditorialShell>
    );
  }

  const skills = parseJson<string[]>(profile?.skills, []);
  const languages = parseJson<string[]>(profile?.languages, []);
  const workHistory = parseJson<any[]>(profile?.workHistory, []);

  const { pct, missing } = computeCompleteness(profile);
  const firstName = user?.name?.split(" ")[0] ?? "";
  const lastName = user?.name?.split(" ").slice(1).join(" ") ?? "";
  const displayName = user?.name ? user.name.toUpperCase() : "PROFIILI";

  function saveSkills(s: string[]) {
    upsert.mutate({ skills: s });
  }
  function saveWorkHistory(h: any[]) {
    upsert.mutate({ workHistory: h });
  }
  function saveEducation(data: any) {
    upsert.mutate(data);
  }
  function saveLanguages(l: string[]) {
    upsert.mutate({ languages: l });
  }
  function savePreferences(data: any) {
    upsert.mutate(data);
  }
  function handleCvParsed(data: any) {
    // Apply parsed CV data to the profile
    upsert.mutate({
      currentTitle: data.currentTitle ?? undefined,
      yearsOfExperience: data.yearsOfExperience ?? undefined,
      skills: data.skills ?? undefined,
      languages: data.languages ?? undefined,
      degree: data.degree ?? undefined,
      field: data.field ?? undefined,
      university: data.university ?? undefined,
      graduationYear: data.graduationYear ?? undefined,
      workHistory: data.workHistory ?? undefined,
    });
  }

  return (
    <EditorialShell>
      <Masthead
        dateStr={formatBriefDate(new Date(), "fi")}
        statusLabel="PUBLISHED"
        title={displayName}
        subtitle={[profile?.currentTitle, "Helsinki"].filter(Boolean).join("  ·  ")}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-8">
        <div className="lg:col-span-8">
          <SkillsSection skills={skills} onSave={saveSkills} />
          <WorkHistorySection history={workHistory} onSave={saveWorkHistory} />
          <EducationSection
            degree={profile?.degree ?? undefined}
            field={profile?.field ?? undefined}
            university={profile?.university ?? undefined}
            graduationYear={profile?.graduationYear ?? undefined}
            onSave={saveEducation}
          />
          <LanguagesSection languages={languages} onSave={saveLanguages} />
          <PreferencesSection profile={profile} onSave={savePreferences} />
        </div>

        <div className="lg:col-span-4">
          <div className="lg:sticky lg:top-20 space-y-8">
            <ProfileSidebar
              pct={pct}
              missing={missing}
              onSectionFocus={() => {
                // Could scroll to section — for now just a no-op
              }}
            />
            <CvUpload onParsed={handleCvParsed} />
          </div>
        </div>
      </div>
    </EditorialShell>
  );
}
