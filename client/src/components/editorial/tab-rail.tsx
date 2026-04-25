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
    <div className="overflow-x-auto -mx-6 px-6 lg:-mx-10 lg:px-10 border-b border-slate-900/15">
      <div className="flex items-center gap-5 md:gap-7 py-3 text-[11px] uppercase tracking-[0.22em] font-bold min-w-max">
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            onClick={() => onSelect(tab.id)}
            className={`relative pb-2 flex-shrink-0 transition-colors ${
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
    </div>
  );
}
