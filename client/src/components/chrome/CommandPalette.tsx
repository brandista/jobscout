import { Command } from "cmdk";
import { useEffect } from "react";
import { useLocation } from "wouter";

const SECTIONS: Array<{ path: string; label: string; hint: string }> = [
  { path: "/", label: "The Brief", hint: "Päivän yhteenveto" },
  { path: "/jobs", label: "Jobs", hint: "Työpaikat" },
  { path: "/companies", label: "Companies", hint: "Seurannassa / Löydä / PRH" },
  { path: "/agents", label: "Agents", hint: "6 asiantuntijaa" },
  { path: "/profile", label: "Profile", hint: "Oma profiili" },
  { path: "/bulletins", label: "Bulletins", hint: "Hälytykset" },
];

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [, setLocation] = useLocation();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  if (!open) return null;

  const go = (path: string) => {
    onOpenChange(false);
    setLocation(path);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/10 backdrop-blur-sm flex items-start justify-center pt-32 px-6"
      onClick={() => onOpenChange(false)}
    >
      <Command
        label="Global command palette"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl bg-[#FAF7F0] border border-slate-900/25 shadow-xl"
      >
        <Command.Input
          autoFocus
          placeholder="Mitä etsit?"
          className="w-full px-6 py-4 bg-transparent border-b border-slate-900/15 text-base italic text-slate-900 placeholder:text-slate-400 focus:outline-none"
        />
        <Command.List className="max-h-80 overflow-y-auto py-2">
          <Command.Empty className="px-6 py-4 text-sm italic text-slate-500">
            Ei osumia.
          </Command.Empty>
          <Command.Group
            heading="SECTIONS"
            className="[&_[cmdk-group-heading]]:px-6 [&_[cmdk-group-heading]]:pt-4 [&_[cmdk-group-heading]]:pb-2 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.22em] [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:text-slate-900"
          >
            {SECTIONS.map((s) => (
              <Command.Item
                key={s.path}
                onSelect={() => go(s.path)}
                className="px-6 py-3 flex items-baseline justify-between text-sm cursor-pointer data-[selected=true]:bg-slate-900/[0.03]"
              >
                <span className="font-bold text-slate-900">{s.label}</span>
                <span className="text-xs italic text-slate-500">{s.hint}</span>
              </Command.Item>
            ))}
          </Command.Group>
        </Command.List>
      </Command>
    </div>
  );
}
