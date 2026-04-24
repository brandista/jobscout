import { Mail } from "lucide-react";
import { useLocation } from "wouter";

export function MobileTopbar({ unreadBulletins }: { unreadBulletins: number }) {
  const [, setLocation] = useLocation();
  return (
    <header className="md:hidden sticky top-0 z-30 h-14 bg-[#FAF7F0] border-b border-slate-900/15 px-5 flex items-center justify-between">
      <h1 className="font-[family-name:var(--font-display)] text-lg font-black tracking-tight text-slate-900">
        JOBSCOUT
      </h1>
      <button
        onClick={() => setLocation("/bulletins")}
        className="relative text-slate-900"
        aria-label="Bulletins"
      >
        <Mail className="w-5 h-5" />
        {unreadBulletins > 0 && (
          <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-500" />
        )}
      </button>
    </header>
  );
}
