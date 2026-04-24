import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { useEditionNumber } from "@/hooks/useEditionNumber";
import { trpc } from "@/lib/trpc";

const NAV: Array<{ path: string; label: string }> = [
  { path: "/", label: "The Brief" },
  { path: "/jobs", label: "Jobs" },
  { path: "/companies", label: "Companies" },
  { path: "/agents", label: "Agents" },
  { path: "/profile", label: "Profile" },
  { path: "/bulletins", label: "Bulletins" },
];

function isActive(currentPath: string, navPath: string): boolean {
  if (navPath === "/") return currentPath === "/";
  return currentPath === navPath || currentPath.startsWith(navPath + "/");
}

export function EditorialSidebar() {
  const [location, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const issue = useEditionNumber();

  const unread =
    trpc.matches.list.useQuery(
      { limit: 10 },
      { enabled: !!user },
    ).data?.filter((m: { seen?: boolean }) => !m.seen).length ?? 0;

  const firstName = user?.name?.split(" ")[0] ?? "";
  const initial = (firstName || "?").charAt(0).toUpperCase();

  return (
    <aside className="hidden md:flex flex-col w-60 min-h-screen border-r border-slate-900 bg-[#FAF7F0] relative">
      <div className="px-6 pt-8 pb-6 border-b border-slate-900/15">
        <h1 className="font-[family-name:var(--font-display)] text-xl font-black tracking-tight text-slate-900">
          JOBSCOUT
        </h1>
        <p className="mt-1 text-[11px] italic text-slate-500">
          Edition Nº {issue}
          {firstName ? ` · ${firstName}` : ""}
        </p>
      </div>
      <nav className="flex-1 py-4">
        {NAV.map((item) => {
          const active = isActive(location, item.path);
          return (
            <button
              key={item.path}
              onClick={() => setLocation(item.path)}
              className={`group relative w-full flex items-center justify-between px-6 py-3 text-[11px] uppercase tracking-[0.22em] font-bold transition-colors ${
                active
                  ? "text-slate-900 bg-slate-900/[0.025]"
                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-900/[0.025]"
              }`}
            >
              {active && (
                <span className="absolute left-0 top-0 bottom-0 w-[1.5px] bg-slate-900" />
              )}
              <span>{item.label}</span>
              {item.path === "/bulletins" && unread > 0 && (
                <span className="text-slate-400 tabular-nums">· {unread}</span>
              )}
            </button>
          );
        })}
      </nav>
      <div className="px-6 py-6 border-t border-slate-900/15">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-sm border border-slate-900/25 bg-white flex items-center justify-center text-xs font-bold text-slate-900">
            {initial}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900 truncate">
              {firstName || "Käyttäjä"}
            </p>
            <button
              onClick={() => logout()}
              className="text-[11px] uppercase tracking-[0.18em] font-bold text-slate-500 hover:text-slate-900 transition-colors"
            >
              Kirjaudu ulos →
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
