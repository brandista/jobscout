import { useLocation } from "wouter";

const NAV: Array<{ path: string; label: string }> = [
  { path: "/", label: "Brief" },
  { path: "/jobs", label: "Jobs" },
  { path: "/companies", label: "Compan." },
  { path: "/agents", label: "Agents" },
  { path: "/profile", label: "Profile" },
  { path: "/bulletins", label: "Bull." },
];

function isActive(currentPath: string, navPath: string): boolean {
  if (navPath === "/") return currentPath === "/";
  return currentPath === navPath || currentPath.startsWith(navPath + "/");
}

export function MobileBottomBar() {
  const [location, setLocation] = useLocation();
  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-30 h-14 bg-[#FAF7F0] border-t border-slate-900/15 flex items-stretch"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {NAV.map((item) => {
        const active = isActive(location, item.path);
        return (
          <button
            key={item.path}
            onClick={() => setLocation(item.path)}
            className={`group relative flex-1 flex items-center justify-center text-[10px] uppercase tracking-[0.16em] font-bold transition-colors ${
              active ? "text-slate-900" : "text-slate-400"
            }`}
          >
            {active && (
              <span className="absolute top-0 left-3 right-3 h-[1.5px] bg-slate-900" />
            )}
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}
