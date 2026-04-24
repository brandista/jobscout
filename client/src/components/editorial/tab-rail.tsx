export function TabRail<T extends string>({
  tabs,
  active,
  onSelect,
}: {
  tabs: Array<{ id: T; label: string }>;
  active: T;
  onSelect: (id: T) => void;
}) {
  return (
    <div className="flex items-center gap-7 py-3 border-b border-slate-900/15 text-[11px] uppercase tracking-[0.22em] font-bold">
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            onClick={() => onSelect(tab.id)}
            className={`relative pb-2 transition-colors ${
              isActive
                ? "text-slate-900"
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            {tab.label}
            {isActive && (
              <span className="absolute left-0 right-0 -bottom-[calc(0.75rem+1px)] h-[1.5px] bg-slate-900" />
            )}
          </button>
        );
      })}
    </div>
  );
}
