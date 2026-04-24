import { ChevronRight } from "lucide-react";
import type { ReactNode, ElementType } from "react";
import { PaperGrain } from "./paper-grain";

export function EditorialShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#FAF7F0] relative font-[family-name:var(--font-body)]">
      <PaperGrain />
      <div className="relative max-w-6xl mx-auto px-6 lg:px-10 py-8 md:py-12">
        {children}
      </div>
    </div>
  );
}

export function Masthead({
  dateStr,
  issueLabel,
  statusLabel,
  title,
  subtitle,
}: {
  dateStr: string;
  issueLabel?: string;
  statusLabel: string;
  title: string;
  subtitle: string;
}) {
  return (
    <>
      <div className="flex items-center justify-between pb-3 border-b-[1.5px] border-slate-900">
        <div className="flex items-baseline gap-5 text-[11px] uppercase tracking-[0.22em] font-bold text-slate-900">
          <span>{dateStr}</span>
          {issueLabel && (
            <span className="italic font-normal text-slate-500 tracking-[0.18em]">
              {issueLabel}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] font-bold text-slate-900">
          <span className="relative flex w-1.5 h-1.5">
            <span className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-75" />
            <span className="relative rounded-full w-1.5 h-1.5 bg-emerald-500" />
          </span>
          {statusLabel}
        </div>
      </div>
      <div className="py-2 border-b border-slate-900 flex items-baseline gap-3 flex-wrap">
        <h1 className="font-[family-name:var(--font-display)] text-3xl md:text-4xl font-black tracking-[-0.02em] text-slate-900">
          {title}
        </h1>
        <span className="text-slate-300 text-2xl font-light">·</span>
        <span className="text-slate-500 text-base md:text-lg italic font-normal">
          {subtitle}
        </span>
      </div>
    </>
  );
}

export function BriefSectionLabel({ children }: { children: ReactNode }) {
  return (
    <h3 className="text-[11px] uppercase tracking-[0.22em] font-bold text-slate-900 mb-5 pb-2 border-b border-slate-900">
      {children}
    </h3>
  );
}

export function BriefActionRow({
  icon: Icon,
  label,
  desc,
  onClick,
}: {
  icon: ElementType;
  label: string;
  desc: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group w-full text-left py-4 flex items-center gap-3 hover:bg-slate-900/[0.025] px-2 -mx-2 transition-colors"
    >
      <div className="w-9 h-9 rounded-sm border border-slate-900/25 bg-white flex items-center justify-center flex-shrink-0 group-hover:border-slate-900 group-hover:bg-slate-900 transition-colors">
        <Icon className="w-4 h-4 text-slate-900 group-hover:text-white transition-colors" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-slate-900 tracking-tight">{label}</p>
        <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-900 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
    </button>
  );
}

export function BriefMetricRow({
  label,
  value,
  note,
  accent,
}: {
  label: string;
  value: number | string;
  note?: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between py-3.5">
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-[0.2em] font-bold text-slate-500">{label}</p>
        {note && <p className="text-xs text-slate-400 italic mt-0.5">{note}</p>}
      </div>
      <p
        className={`font-[family-name:var(--font-display)] text-3xl font-extrabold tabular-nums tracking-[-0.02em] ${
          accent
            ? "bg-gradient-to-r from-emerald-500 via-teal-500 to-sky-500 bg-clip-text text-transparent"
            : "text-slate-900"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

export function BriefTickerItem({
  time,
  text,
}: {
  time: string;
  text: string;
}) {
  return (
    <li className="flex gap-3 items-baseline">
      <time className="text-[10px] uppercase tracking-[0.16em] font-bold text-slate-400 tabular-nums flex-shrink-0 w-14">
        {time}
      </time>
      <span className="text-slate-700 leading-snug">{text}</span>
    </li>
  );
}
