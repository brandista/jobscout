import { Mail } from "lucide-react";
import { useLocation } from "wouter";
import { formatBriefDate } from "@shared/lib/editorial-date";

export function EditorialTopbar({
  language = "fi",
  live,
  unreadBulletins,
  onOpenCommand,
}: {
  language?: "fi" | "en";
  live: boolean;
  unreadBulletins: number;
  onOpenCommand: () => void;
}) {
  const [, setLocation] = useLocation();
  const dateStr = formatBriefDate(new Date(), language);

  return (
    <header className="sticky top-0 z-30 bg-[#FAF7F0] border-b border-slate-900/15 px-6 lg:px-10">
      <div className="max-w-6xl mx-auto h-16 flex items-center justify-between gap-8">
        <div className="text-[11px] uppercase tracking-[0.22em] font-bold text-slate-900 tabular-nums">
          {dateStr}
        </div>
        <button
          onClick={onOpenCommand}
          className="group flex-1 max-w-md flex items-center gap-3 py-2 border-b border-slate-900/25 hover:border-slate-900 transition-colors"
        >
          <span className="text-sm italic text-slate-400 group-hover:text-slate-600 transition-colors">
            Mitä etsit?
          </span>
          <kbd className="ml-auto text-[10px] uppercase tracking-[0.18em] font-bold text-slate-400">
            ⌘K
          </kbd>
        </button>
        <div className="flex items-center gap-5">
          <button
            onClick={() => setLocation("/bulletins")}
            className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] font-bold text-slate-900 hover:text-slate-600 transition-colors"
          >
            <span className="relative flex w-1.5 h-1.5">
              {live && (
                <span className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-75" />
              )}
              <span
                className={`relative rounded-full w-1.5 h-1.5 ${
                  live ? "bg-emerald-500" : "bg-slate-300"
                }`}
              />
            </span>
            {live ? "LIVE" : "QUIET"}
          </button>
          <button
            onClick={() => setLocation("/bulletins")}
            className="relative text-slate-900 hover:text-slate-600 transition-colors"
          >
            <Mail className="w-5 h-5" />
            {unreadBulletins > 0 && (
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-500" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
