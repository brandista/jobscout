# JobScout Editorial — Foundation & Chrome Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Phase 1 (foundation primitives, fonts, paper) and Phase 2 (chrome: sidebar, topbar, mobile bars, Cmd+K command palette) of the JobScout editorial redesign. After this plan, the app renders inside editorial chrome and each of the 6 sections has a placeholder editorial page. No real content yet — that's Plan 2+.

**Architecture:** Port Brandista's `editorial.tsx` primitives verbatim into `client/src/components/editorial/primitives.tsx`. Add JobScout-specific primitives (EditorialListItem, CompanyDossier, ContributorCard, TabRail, InlineEditRow) in sibling files under the same folder. Build `EditorialLayout` that replaces `DashboardLayout` behind a `VITE_EDITORIAL` feature flag (and a per-user override in localStorage). Route table rewritten to 6 sections; old pages stay alive and served when flag is off so rollback is instant.

**Tech Stack:** React 19 + TypeScript + Vite + Tailwind CSS 4 + wouter routing + `cmdk` (already installed) for Cmd+K. Testing: vitest on `shared/lib/*.test.ts` for pure logic only; visual/interaction checks happen in `npm run dev` browser.

**Spec reference:** [docs/superpowers/specs/2026-04-24-jobscout-editorial-redesign-design.md](../specs/2026-04-24-jobscout-editorial-redesign-design.md) — sections §2 (design system), §3 (IA), §4.1 masthead, §5 (chrome), §6 (gradient budget), §7 Phase 1 + Phase 2.

---

## File Structure

New files this plan creates:

```
client/src/
├─ components/editorial/
│  ├─ primitives.tsx          ← ported from Brandista editorial.tsx
│  ├─ list-item.tsx           ← EditorialListItem
│  ├─ company-dossier.tsx     ← CompanyDossier
│  ├─ contributor-card.tsx    ← ContributorCard
│  ├─ tab-rail.tsx            ← TabRail
│  ├─ inline-edit-row.tsx     ← InlineEditRow
│  ├─ paper-grain.tsx         ← shared SVG noise overlay
│  └─ index.ts                ← barrel export
├─ components/chrome/
│  ├─ EditorialLayout.tsx     ← new layout shell
│  ├─ EditorialSidebar.tsx    ← desktop sidebar, 6 nav links
│  ├─ EditorialTopbar.tsx     ← date + search + LIVE + bulletins icon
│  ├─ MobileTopbar.tsx        ← compact masthead row
│  ├─ MobileBottomBar.tsx     ← 6 section tabs
│  └─ CommandPalette.tsx      ← Cmd+K overlay
├─ hooks/
│  ├─ useEditionNumber.ts     ← days since account creation
│  └─ useEditorialFlag.ts     ← feature flag read/toggle
├─ pages/editorial/
│  ├─ BriefPlaceholder.tsx
│  ├─ JobsPlaceholder.tsx
│  ├─ CompaniesPlaceholder.tsx
│  ├─ AgentsPlaceholder.tsx
│  ├─ ProfilePlaceholder.tsx
│  └─ BulletinsPlaceholder.tsx
shared/lib/
├─ editorial-date.ts          ← formatBriefDate, issueNumber
└─ editorial-date.test.ts
```

Files modified:

- `client/src/index.css` — import Sora + DM Sans, define paper token
- `client/src/App.tsx` — add editorial route aliases, gate on flag
- `vitest.config.ts` — include shared/lib tests

Total: 20 new files, 3 modified. No backend / shared schema changes.

---

## Task 1: Vitest config — include shared lib tests

**Files:**
- Modify: `vitest.config.ts`

- [ ] **Step 1: Update vitest config to include shared/lib tests**

Replace the file contents:

```ts
import { defineConfig } from "vitest/config";
import path from "path";

const templateRoot = path.resolve(import.meta.dirname);

export default defineConfig({
  root: templateRoot,
  resolve: {
    alias: {
      "@": path.resolve(templateRoot, "client", "src"),
      "@shared": path.resolve(templateRoot, "shared"),
      "@assets": path.resolve(templateRoot, "attached_assets"),
    },
  },
  test: {
    environment: "node",
    include: [
      "server/**/*.test.ts",
      "server/**/*.spec.ts",
      "shared/**/*.test.ts",
    ],
  },
});
```

- [ ] **Step 2: Verify vitest still passes existing tests**

Run: `npm test`
Expected: exits 0. If no existing tests match, output shows "0 test files" — that's fine.

- [ ] **Step 3: Commit**

```bash
git add vitest.config.ts
git commit -m "test: include shared/**/*.test.ts in vitest config"
```

---

## Task 2: Pure logic — formatBriefDate + issueNumber (TDD)

**Files:**
- Create: `shared/lib/editorial-date.ts`
- Test: `shared/lib/editorial-date.test.ts`

- [ ] **Step 1: Write failing tests**

Create `shared/lib/editorial-date.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { formatBriefDate, issueNumber } from "./editorial-date";

describe("formatBriefDate", () => {
  it("formats Finnish date uppercase with weekday", () => {
    const d = new Date("2026-04-24T10:00:00Z");
    expect(formatBriefDate(d, "fi")).toBe("PERJANTAI 24. HUHTIKUUTA");
  });

  it("formats English date uppercase with weekday", () => {
    const d = new Date("2026-04-24T10:00:00Z");
    expect(formatBriefDate(d, "en")).toBe("FRIDAY, APRIL 24");
  });

  it("falls back to English for unknown language code", () => {
    const d = new Date("2026-04-24T10:00:00Z");
    expect(formatBriefDate(d, "sv")).toBe("FRIDAY, APRIL 24");
  });
});

describe("issueNumber", () => {
  it("returns 1 for the same day as account creation", () => {
    const createdAt = new Date("2026-04-24T08:00:00Z");
    const now = new Date("2026-04-24T20:00:00Z");
    expect(issueNumber(createdAt, now)).toBe(1);
  });

  it("returns 2 the day after creation", () => {
    const createdAt = new Date("2026-04-23T08:00:00Z");
    const now = new Date("2026-04-24T09:00:00Z");
    expect(issueNumber(createdAt, now)).toBe(2);
  });

  it("returns 142 after 141 days", () => {
    const createdAt = new Date("2026-01-01T00:00:00Z");
    const now = new Date("2026-05-22T00:00:00Z");
    expect(issueNumber(createdAt, now)).toBe(142);
  });

  it("returns 1 if createdAt is in the future (clock skew)", () => {
    const createdAt = new Date("2026-05-01T00:00:00Z");
    const now = new Date("2026-04-24T00:00:00Z");
    expect(issueNumber(createdAt, now)).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- shared/lib/editorial-date.test.ts`
Expected: FAIL — "Failed to resolve import './editorial-date'"

- [ ] **Step 3: Write minimal implementation**

Create `shared/lib/editorial-date.ts`:

```ts
export function formatBriefDate(date: Date, language: string): string {
  const locale = language === "fi" ? "fi-FI" : "en-US";
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  })
    .format(date)
    .toUpperCase();
}

export function issueNumber(createdAt: Date, now: Date = new Date()): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  const start = Date.UTC(
    createdAt.getUTCFullYear(),
    createdAt.getUTCMonth(),
    createdAt.getUTCDate(),
  );
  const today = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  const days = Math.floor((today - start) / msPerDay);
  return Math.max(1, days + 1);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- shared/lib/editorial-date.test.ts`
Expected: all 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add shared/lib/editorial-date.ts shared/lib/editorial-date.test.ts
git commit -m "feat(editorial): formatBriefDate and issueNumber utils"
```

---

## Task 3: Load Sora + DM Sans fonts, define paper token

**Files:**
- Modify: `client/src/index.css`

- [ ] **Step 1: Read current index.css to see where to insert**

```bash
head -20 client/src/index.css
```

Expected: file starts with `@import "tailwindcss";`

- [ ] **Step 2: Insert font imports at top + define paper color**

Prepend **before** `@import "tailwindcss";`:

```css
@import url("https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800;900&family=DM+Sans:ital,wght@0,400;0,500;0,600;1,400;1,500&display=swap");
```

Inside the existing `:root` block (find the `:root {` that contains `--primary:` around line 45), add these new tokens at the end of the block:

```css
  --font-display: "Sora", system-ui, sans-serif;
  --font-body: "DM Sans", system-ui, sans-serif;
  --paper: #FAF7F0;
  --ink: oklch(0.235 0.015 65);
```

Under the `@theme inline` block, add at the end (before closing `}`):

```css
  --color-paper: var(--paper);
  --color-ink: var(--ink);
  --font-family-display: var(--font-display);
  --font-family-body: var(--font-body);
```

- [ ] **Step 3: Start dev server and verify fonts load**

Run: `npm run dev`
Open browser dev tools → Network tab → filter by "font" → reload page.
Expected: requests to fonts.googleapis.com and fonts.gstatic.com return 200. Visit Home page; no visual change yet but no console errors.

- [ ] **Step 4: Commit**

```bash
git add client/src/index.css
git commit -m "feat(editorial): load Sora + DM Sans fonts, add paper tokens"
```

---

## Task 4: PaperGrain component

**Files:**
- Create: `client/src/components/editorial/paper-grain.tsx`

- [ ] **Step 1: Create PaperGrain component**

Create `client/src/components/editorial/paper-grain.tsx`:

```tsx
/**
 * PaperGrain — full-cover SVG noise overlay for editorial paper texture.
 * Pointer-events-none, mix-blend-multiply, low opacity. Sits inside any
 * relative/absolute parent.
 */
export function PaperGrain() {
  return (
    <div
      aria-hidden
      className="absolute inset-0 opacity-[0.035] pointer-events-none mix-blend-multiply"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85'/%3E%3CfeColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.6 0'/%3E%3C/filter%3E%3Crect width='400' height='400' filter='url(%23n)'/%3E%3C/svg%3E")`,
      }}
    />
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/editorial/paper-grain.tsx
git commit -m "feat(editorial): PaperGrain SVG noise overlay"
```

---

## Task 5: Port editorial primitives from Brandista

**Files:**
- Create: `client/src/components/editorial/primitives.tsx`

- [ ] **Step 1: Create primitives file**

Create `client/src/components/editorial/primitives.tsx`:

```tsx
/**
 * Editorial primitives — shared UI chrome for "The Brief" design language.
 *
 * Ported from Brandista Growth Engine (editorial.tsx). Extended here with
 * the JobScout language variant (Finnish-first) and with the imported
 * PaperGrain component.
 *
 * Design rules:
 * - Ivory paper background (#FAF7F0) + subtle SVG noise overlay
 * - Ink (slate-900) for type, slate-500 for meta, slate-400 for muted
 * - Sora for display/headings, DM Sans for body (loaded in index.css)
 * - Uppercase tracking-[0.22em] font-bold for section labels
 * - Italic for subtitles, bylines, and notes
 * - Accent gradient (emerald→teal→sky) reserved for 1-2 moments per page
 * - Thin black hairlines for masthead + section rules
 */
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
```

Note: the accent gradient here uses **emerald→teal→sky** (JobScout's own), not Brandista's blue→purple→cyan.

- [ ] **Step 2: Commit**

```bash
git add client/src/components/editorial/primitives.tsx
git commit -m "feat(editorial): port editorial primitives with JobScout accent"
```

---

## Task 6: EditorialListItem primitive

**Files:**
- Create: `client/src/components/editorial/list-item.tsx`

- [ ] **Step 1: Create EditorialListItem**

Create `client/src/components/editorial/list-item.tsx`:

```tsx
import type { ReactNode } from "react";

/**
 * EditorialListItem — a single entry in a long editorial list.
 * Used for Jobs results, Companies dossier summaries, Bulletins, etc.
 *
 * Composition: headline (large) + meta row (small caps) + optional ingress
 * (italic, only when AI is *interpreting*) + optional action row.
 *
 * Hairline rule appears below each item via a trailing border.
 */
export function EditorialListItem({
  headline,
  meta,
  ingress,
  actions,
  onClick,
}: {
  headline: ReactNode;
  meta: ReactNode;
  ingress?: ReactNode;
  actions?: ReactNode;
  onClick?: () => void;
}) {
  const clickable = typeof onClick === "function";
  return (
    <article
      onClick={onClick}
      className={`group py-6 border-b border-slate-900/15 ${
        clickable
          ? "cursor-pointer hover:bg-slate-900/[0.02] -mx-2 px-2 transition-colors"
          : ""
      }`}
    >
      <h2 className="font-[family-name:var(--font-display)] text-2xl md:text-[28px] font-semibold tracking-tight text-slate-900 leading-tight">
        {headline}
      </h2>
      <div className="mt-1.5 text-[11px] uppercase tracking-[0.12em] text-slate-400 tabular-nums">
        {meta}
      </div>
      {ingress && (
        <p className="mt-3 text-base md:text-[17px] italic text-slate-600 leading-relaxed max-w-prose">
          {ingress}
        </p>
      )}
      {actions && (
        <div className="mt-4 flex items-center gap-5 text-[11px] uppercase tracking-[0.18em] font-bold text-slate-900">
          {actions}
        </div>
      )}
    </article>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/editorial/list-item.tsx
git commit -m "feat(editorial): EditorialListItem primitive"
```

---

## Task 7: CompanyDossier primitive

**Files:**
- Create: `client/src/components/editorial/company-dossier.tsx`

- [ ] **Step 1: Create CompanyDossier**

Create `client/src/components/editorial/company-dossier.tsx`:

```tsx
import type { ReactNode } from "react";

export type DossierStatus = "active" | "quiet" | "cold";

const STATUS_LABEL_FI: Record<DossierStatus, string> = {
  active: "ACTIVE",
  quiet: "QUIET",
  cold: "COLD",
};

/**
 * CompanyDossier — a company entry in Companies section (Watchlist / Löydä).
 *
 * Composition: name (Sora black 32px) + meta line (small caps) + status dot
 * + interpretation paragraph + up to 3 recent signals (timestamped) + actions.
 *
 * Talent Score rendered with gradient ONLY when >= 80 (see spec §6).
 */
export function CompanyDossier({
  name,
  meta,
  status,
  interpretation,
  signals,
  talentScore,
  actions,
}: {
  name: string;
  meta: string;
  status: DossierStatus;
  interpretation?: ReactNode;
  signals?: Array<{ time: string; text: string }>;
  talentScore?: number;
  actions?: ReactNode;
}) {
  return (
    <article className="py-8 border-b border-slate-900/15">
      <div className="flex items-baseline justify-between gap-4 flex-wrap">
        <h2 className="font-[family-name:var(--font-display)] text-3xl md:text-[32px] font-black tracking-tight text-slate-900">
          {name}
        </h2>
        <span className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] font-bold text-slate-900">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              status === "active"
                ? "bg-emerald-500"
                : status === "quiet"
                  ? "bg-slate-400"
                  : "bg-slate-300"
            }`}
          />
          {STATUS_LABEL_FI[status]}
        </span>
      </div>
      <div className="mt-1 text-[11px] uppercase tracking-[0.12em] font-bold text-slate-500 tabular-nums">
        {meta}
        {typeof talentScore === "number" && (
          <>
            {" · Talent Score "}
            <span
              className={
                talentScore >= 80
                  ? "bg-gradient-to-r from-emerald-500 via-teal-500 to-sky-500 bg-clip-text text-transparent font-extrabold"
                  : "text-slate-900 font-extrabold"
              }
            >
              {talentScore}
            </span>
          </>
        )}
      </div>
      {interpretation && (
        <p className="mt-4 text-base md:text-[17px] text-slate-700 leading-relaxed max-w-prose">
          {interpretation}
        </p>
      )}
      {signals && signals.length > 0 && (
        <ul className="mt-4 space-y-2">
          {signals.slice(0, 3).map((s, i) => (
            <li key={i} className="flex gap-3 items-baseline">
              <time className="text-[10px] uppercase tracking-[0.16em] font-bold text-slate-400 tabular-nums flex-shrink-0 w-14">
                {s.time}
              </time>
              <span className="text-slate-700 leading-snug">{s.text}</span>
            </li>
          ))}
        </ul>
      )}
      {actions && (
        <div className="mt-5 flex items-center gap-5 text-[11px] uppercase tracking-[0.18em] font-bold text-slate-900">
          {actions}
        </div>
      )}
    </article>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/editorial/company-dossier.tsx
git commit -m "feat(editorial): CompanyDossier primitive with conditional gradient"
```

---

## Task 8: ContributorCard primitive

**Files:**
- Create: `client/src/components/editorial/contributor-card.tsx`

- [ ] **Step 1: Create ContributorCard**

Create `client/src/components/editorial/contributor-card.tsx`:

```tsx
import type { ReactNode } from "react";

export type ContributorStatus = "available" | "busy" | "off";

const STATUS_LABEL_FI: Record<ContributorStatus, string> = {
  available: "KÄYTÖSSÄ",
  busy: "VARATTU",
  off: "LOMALLA",
};

/**
 * ContributorCard — one of the six AI agents in the masthead layout.
 *
 * Composition: name + role label + status dot + mission statement (italic,
 * first-person) + expertise tags + meta rows + action link.
 *
 * Mission statement sits inside a subtle 6×6 gradient bullet dot — this is
 * the one intentional gradient moment per card (see spec §6).
 */
export function ContributorCard({
  name,
  role,
  status,
  mission,
  expertise,
  conversations,
  lastSeen,
  action,
}: {
  name: string;
  role: string;
  status: ContributorStatus;
  mission: string;
  expertise: string[];
  conversations: number;
  lastSeen: string;
  action: ReactNode;
}) {
  return (
    <article className="p-6 border border-slate-900/15 bg-white/40 backdrop-blur-sm">
      <div className="flex items-baseline justify-between gap-4 pb-4 border-b border-slate-900/15">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-2xl md:text-[28px] font-black tracking-tight text-slate-900">
            {name}
            <span className="ml-2 text-[11px] uppercase tracking-[0.22em] font-bold text-slate-500">
              — {role}
            </span>
          </h2>
        </div>
        <span className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] font-bold text-slate-900">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              status === "available"
                ? "bg-emerald-500"
                : status === "busy"
                  ? "bg-amber-500"
                  : "bg-slate-300"
            }`}
          />
          {STATUS_LABEL_FI[status]}
        </span>
      </div>
      <p className="mt-4 flex items-start gap-3 text-[17px] italic text-slate-700 leading-relaxed max-w-prose">
        <span className="mt-2 w-1.5 h-1.5 rounded-full bg-gradient-to-r from-emerald-500 via-teal-500 to-sky-500 flex-shrink-0" />
        <span>&ldquo;{mission}&rdquo;</span>
      </p>
      <dl className="mt-6 space-y-2 text-sm">
        <div className="flex gap-3">
          <dt className="text-[11px] uppercase tracking-[0.2em] font-bold text-slate-500 w-32 flex-shrink-0 pt-0.5">
            Asiantuntemus
          </dt>
          <dd className="text-slate-900">{expertise.join(" · ")}</dd>
        </div>
        <div className="flex gap-3">
          <dt className="text-[11px] uppercase tracking-[0.2em] font-bold text-slate-500 w-32 flex-shrink-0 pt-0.5">
            Keskusteluja
          </dt>
          <dd className="text-slate-900 tabular-nums">{conversations}</dd>
        </div>
        <div className="flex gap-3">
          <dt className="text-[11px] uppercase tracking-[0.2em] font-bold text-slate-500 w-32 flex-shrink-0 pt-0.5">
            Viimeisin
          </dt>
          <dd className="text-slate-900">{lastSeen}</dd>
        </div>
      </dl>
      <div className="mt-6 pt-4 border-t border-slate-900/15 text-[11px] uppercase tracking-[0.18em] font-bold text-slate-900">
        {action}
      </div>
    </article>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/editorial/contributor-card.tsx
git commit -m "feat(editorial): ContributorCard with gradient mission bullet"
```

---

## Task 9: TabRail primitive

**Files:**
- Create: `client/src/components/editorial/tab-rail.tsx`

- [ ] **Step 1: Create TabRail**

Create `client/src/components/editorial/tab-rail.tsx`:

```tsx
/**
 * TabRail — masthead-row uppercase tab labels, replaces shadcn Tabs in
 * editorial sections. Active tab = ink-black + bottom hairline underline;
 * inactive = slate-400.
 */
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
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/editorial/tab-rail.tsx
git commit -m "feat(editorial): TabRail primitive"
```

---

## Task 10: InlineEditRow primitive

**Files:**
- Create: `client/src/components/editorial/inline-edit-row.tsx`

- [ ] **Step 1: Create InlineEditRow**

Create `client/src/components/editorial/inline-edit-row.tsx`:

```tsx
import type { ReactNode } from "react";

/**
 * InlineEditRow — a Profile-page section with its own BriefSectionLabel-style
 * header plus an "Edit →" link right-aligned. Children render the section's
 * content below.
 */
export function InlineEditRow({
  label,
  editLabel = "Muokkaa →",
  onEdit,
  children,
}: {
  label: string;
  editLabel?: string;
  onEdit?: () => void;
  children: ReactNode;
}) {
  return (
    <section className="mt-10">
      <div className="flex items-baseline justify-between mb-5 pb-2 border-b border-slate-900">
        <h3 className="text-[11px] uppercase tracking-[0.22em] font-bold text-slate-900">
          {label}
        </h3>
        {onEdit && (
          <button
            onClick={onEdit}
            className="text-[11px] uppercase tracking-[0.18em] font-bold text-slate-500 hover:text-slate-900 transition-colors"
          >
            {editLabel}
          </button>
        )}
      </div>
      <div>{children}</div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/editorial/inline-edit-row.tsx
git commit -m "feat(editorial): InlineEditRow primitive"
```

---

## Task 11: Editorial barrel export

**Files:**
- Create: `client/src/components/editorial/index.ts`

- [ ] **Step 1: Create barrel file**

Create `client/src/components/editorial/index.ts`:

```ts
export { PaperGrain } from "./paper-grain";
export {
  EditorialShell,
  Masthead,
  BriefSectionLabel,
  BriefActionRow,
  BriefMetricRow,
  BriefTickerItem,
} from "./primitives";
export { EditorialListItem } from "./list-item";
export { CompanyDossier } from "./company-dossier";
export type { DossierStatus } from "./company-dossier";
export { ContributorCard } from "./contributor-card";
export type { ContributorStatus } from "./contributor-card";
export { TabRail } from "./tab-rail";
export { InlineEditRow } from "./inline-edit-row";
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run check`
Expected: exits 0, no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add client/src/components/editorial/index.ts
git commit -m "feat(editorial): barrel export for editorial primitives"
```

---

## Task 12: useEditorialFlag hook (feature flag)

**Files:**
- Create: `client/src/hooks/useEditorialFlag.ts`

- [ ] **Step 1: Create hook**

Create `client/src/hooks/useEditorialFlag.ts`:

```ts
import { useEffect, useState } from "react";

const STORAGE_KEY = "jobscout.editorial";
const URL_PARAM = "editorial";

/**
 * Returns whether the editorial chrome is enabled.
 *
 * Resolution order (first match wins):
 *  1. URL param `?editorial=1` / `?editorial=0` — also persists to localStorage
 *  2. localStorage value set by #1 or by toggle()
 *  3. Vite env var VITE_EDITORIAL (build-time default)
 *  4. `false`
 *
 * Returns a tuple [enabled, toggle].
 */
export function useEditorialFlag(): [boolean, () => void] {
  const [enabled, setEnabled] = useState<boolean>(() => resolve());

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setEnabled(resolve());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const toggle = () => {
    const next = !enabled;
    localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    setEnabled(next);
  };

  return [enabled, toggle];
}

function resolve(): boolean {
  if (typeof window === "undefined") return false;

  const url = new URL(window.location.href);
  const param = url.searchParams.get(URL_PARAM);
  if (param === "1" || param === "0") {
    localStorage.setItem(STORAGE_KEY, param);
    return param === "1";
  }

  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "1") return true;
  if (stored === "0") return false;

  return import.meta.env.VITE_EDITORIAL === "1";
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run check`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add client/src/hooks/useEditorialFlag.ts
git commit -m "feat(chrome): useEditorialFlag feature flag hook"
```

---

## Task 13: useEditionNumber hook

**Files:**
- Create: `client/src/hooks/useEditionNumber.ts`

- [ ] **Step 1: Create hook**

Create `client/src/hooks/useEditionNumber.ts`:

```ts
import { useAuth } from "@/_core/hooks/useAuth";
import { issueNumber } from "@shared/lib/editorial-date";

/**
 * Returns the issue number for the current user — days since their account
 * was created, minimum 1. Returns 1 for unauthenticated or missing data.
 */
export function useEditionNumber(): number {
  const { user } = useAuth();
  const createdAt = user?.createdAt;
  if (!createdAt) return 1;
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return 1;
  return issueNumber(d, new Date());
}
```

- [ ] **Step 2: Verify useAuth exposes createdAt**

Run: `grep -n "createdAt" client/src/_core/hooks/useAuth.ts client/src/_core/contexts/*.ts 2>/dev/null || true`
Expected: see a `createdAt` field. **If missing:** read `client/src/_core/hooks/useAuth.ts`, confirm the auth context shape. If `createdAt` is not provided but another field like `created_at` exists, adjust the hook accordingly. If the user object does not include creation timestamp, fall back to `return 1;` with a TODO to surface `createdAt` from the backend in Plan 2.

- [ ] **Step 3: Run typecheck**

Run: `npm run check`
Expected: exits 0. If type error for `user.createdAt`, the user object doesn't have it — adjust hook to match actual shape (see Step 2 fallback).

- [ ] **Step 4: Commit**

```bash
git add client/src/hooks/useEditionNumber.ts
git commit -m "feat(chrome): useEditionNumber hook reading from useAuth"
```

---

## Task 14: EditorialSidebar component

**Files:**
- Create: `client/src/components/chrome/EditorialSidebar.tsx`

- [ ] **Step 1: Create sidebar**

Create `client/src/components/chrome/EditorialSidebar.tsx`:

```tsx
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
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run check`
Expected: exits 0. If `logout` is not on the auth context, adjust call (may be `signOut`, check `useAuth.ts`).

- [ ] **Step 3: Commit**

```bash
git add client/src/components/chrome/EditorialSidebar.tsx
git commit -m "feat(chrome): EditorialSidebar with 6 nav links"
```

---

## Task 15: EditorialTopbar component

**Files:**
- Create: `client/src/components/chrome/EditorialTopbar.tsx`

- [ ] **Step 1: Create topbar**

Create `client/src/components/chrome/EditorialTopbar.tsx`:

```tsx
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
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/chrome/EditorialTopbar.tsx
git commit -m "feat(chrome): EditorialTopbar with date, search launcher, LIVE, bulletins"
```

---

## Task 16: MobileTopbar + MobileBottomBar

**Files:**
- Create: `client/src/components/chrome/MobileTopbar.tsx`
- Create: `client/src/components/chrome/MobileBottomBar.tsx`

- [ ] **Step 1: Create MobileTopbar**

Create `client/src/components/chrome/MobileTopbar.tsx`:

```tsx
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
```

- [ ] **Step 2: Create MobileBottomBar**

Create `client/src/components/chrome/MobileBottomBar.tsx`:

```tsx
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
```

- [ ] **Step 3: Verify typecheck**

Run: `npm run check`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add client/src/components/chrome/MobileTopbar.tsx client/src/components/chrome/MobileBottomBar.tsx
git commit -m "feat(chrome): mobile top + bottom bars"
```

---

## Task 17: CommandPalette (Cmd+K)

**Files:**
- Create: `client/src/components/chrome/CommandPalette.tsx`

- [ ] **Step 1: Create CommandPalette using cmdk**

Create `client/src/components/chrome/CommandPalette.tsx`:

```tsx
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
```

- [ ] **Step 2: Verify cmdk is installed**

Run: `grep -q '"cmdk"' package.json && echo OK || echo MISSING`
Expected: `OK`.

- [ ] **Step 3: Verify typecheck**

Run: `npm run check`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add client/src/components/chrome/CommandPalette.tsx
git commit -m "feat(chrome): CommandPalette with Cmd+K shortcut"
```

---

## Task 18: EditorialLayout — assemble the chrome

**Files:**
- Create: `client/src/components/chrome/EditorialLayout.tsx`

- [ ] **Step 1: Create EditorialLayout**

Create `client/src/components/chrome/EditorialLayout.tsx`:

```tsx
import { useState, type ReactNode } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { PaperGrain } from "@/components/editorial";
import { EditorialSidebar } from "./EditorialSidebar";
import { EditorialTopbar } from "./EditorialTopbar";
import { MobileTopbar } from "./MobileTopbar";
import { MobileBottomBar } from "./MobileBottomBar";
import { CommandPalette } from "./CommandPalette";

export function EditorialLayout({ children }: { children: ReactNode }) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const { user } = useAuth();

  const unread =
    trpc.matches.list.useQuery(
      { limit: 10 },
      { enabled: !!user },
    ).data?.filter((m: { seen?: boolean }) => !m.seen).length ?? 0;

  const live = unread > 0;

  return (
    <div className="min-h-screen bg-[#FAF7F0] relative flex">
      <PaperGrain />
      <EditorialSidebar />
      <div className="flex-1 min-w-0 flex flex-col relative">
        <MobileTopbar unreadBulletins={unread} />
        <EditorialTopbar
          live={live}
          unreadBulletins={unread}
          onOpenCommand={() => setPaletteOpen(true)}
        />
        <main className="flex-1 pb-16 md:pb-0">{children}</main>
        <MobileBottomBar />
      </div>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run check`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add client/src/components/chrome/EditorialLayout.tsx
git commit -m "feat(chrome): EditorialLayout assembling sidebar + topbars + palette"
```

---

## Task 19: Placeholder pages for 6 sections

**Files:**
- Create: `client/src/pages/editorial/BriefPlaceholder.tsx`
- Create: `client/src/pages/editorial/JobsPlaceholder.tsx`
- Create: `client/src/pages/editorial/CompaniesPlaceholder.tsx`
- Create: `client/src/pages/editorial/AgentsPlaceholder.tsx`
- Create: `client/src/pages/editorial/ProfilePlaceholder.tsx`
- Create: `client/src/pages/editorial/BulletinsPlaceholder.tsx`

- [ ] **Step 1: Create BriefPlaceholder**

Create `client/src/pages/editorial/BriefPlaceholder.tsx`:

```tsx
import { useAuth } from "@/_core/hooks/useAuth";
import { EditorialShell, Masthead } from "@/components/editorial";
import { formatBriefDate } from "@shared/lib/editorial-date";
import { useEditionNumber } from "@/hooks/useEditionNumber";

export default function BriefPlaceholder() {
  const { user } = useAuth();
  const first = user?.name?.split(" ")[0] ?? "Lukija";
  const issue = useEditionNumber();

  return (
    <EditorialShell>
      <Masthead
        dateStr={formatBriefDate(new Date(), "fi")}
        issueLabel={`Issue Nº ${issue}`}
        statusLabel="LIVE"
        title="JOBSCOUT BRIEFING"
        subtitle={`Kiertokirje työnhaun huipulta, ${first}.`}
      />
      <p className="mt-16 text-base italic text-slate-500">
        Tulossa: Lead story · More headlines · The Beat · From our agents.
      </p>
    </EditorialShell>
  );
}
```

- [ ] **Step 2: Create other placeholders**

For each of the remaining 5 files, use the same shape. Replace the title/subtitle:

`JobsPlaceholder.tsx`:
```tsx
import { EditorialShell, Masthead } from "@/components/editorial";
import { formatBriefDate } from "@shared/lib/editorial-date";

export default function JobsPlaceholder() {
  return (
    <EditorialShell>
      <Masthead
        dateStr={formatBriefDate(new Date(), "fi")}
        statusLabel="LIVE"
        title="JOBS"
        subtitle="Klassifioitu työtarjonta, päivittyy elävänä."
      />
      <p className="mt-16 text-base italic text-slate-500">
        Tulossa: Haut · Tallennetut · Matchatut.
      </p>
    </EditorialShell>
  );
}
```

`CompaniesPlaceholder.tsx`:
```tsx
import { EditorialShell, Masthead } from "@/components/editorial";
import { formatBriefDate } from "@shared/lib/editorial-date";

export default function CompaniesPlaceholder() {
  return (
    <EditorialShell>
      <Masthead
        dateStr={formatBriefDate(new Date(), "fi")}
        statusLabel="LIVE"
        title="COMPANIES"
        subtitle="Yritykset joita seuraat, ja joita et vielä."
      />
      <p className="mt-16 text-base italic text-slate-500">
        Tulossa: Seurannassa · Löydä · PRH-haku.
      </p>
    </EditorialShell>
  );
}
```

`AgentsPlaceholder.tsx`:
```tsx
import { EditorialShell, Masthead } from "@/components/editorial";
import { formatBriefDate } from "@shared/lib/editorial-date";

export default function AgentsPlaceholder() {
  return (
    <EditorialShell>
      <Masthead
        dateStr={formatBriefDate(new Date(), "fi")}
        statusLabel="LIVE"
        title="AGENTS"
        subtitle="Toimituksen kuusi asiantuntijaa palveluksessasi."
      />
      <p className="mt-16 text-base italic text-slate-500">
        Tulossa: Kaisa · Väinö · Työpaikka-analyytikko · Yritystiedustelu · Haastattelu · Neuvottelu.
      </p>
    </EditorialShell>
  );
}
```

`ProfilePlaceholder.tsx`:
```tsx
import { EditorialShell, Masthead } from "@/components/editorial";
import { formatBriefDate } from "@shared/lib/editorial-date";

export default function ProfilePlaceholder() {
  return (
    <EditorialShell>
      <Masthead
        dateStr={formatBriefDate(new Date(), "fi")}
        statusLabel="PUBLISHED"
        title="PROFILE"
        subtitle="By-line — sinun editorial-identiteettisi."
      />
      <p className="mt-16 text-base italic text-slate-500">
        Tulossa: Taidot · Kokemus · Koulutus · Kielet · Preferenssit.
      </p>
    </EditorialShell>
  );
}
```

`BulletinsPlaceholder.tsx`:
```tsx
import { EditorialShell, Masthead } from "@/components/editorial";
import { formatBriefDate } from "@shared/lib/editorial-date";

export default function BulletinsPlaceholder() {
  return (
    <EditorialShell>
      <Masthead
        dateStr={formatBriefDate(new Date(), "fi")}
        statusLabel="LIVE"
        title="BULLETINS"
        subtitle="Kaikki hälytykset, aikajärjestyksessä."
      />
      <p className="mt-16 text-base italic text-slate-500">
        Tulossa: Ticker-virta, päiväryhmiteltynä.
      </p>
    </EditorialShell>
  );
}
```

- [ ] **Step 3: Verify typecheck**

Run: `npm run check`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/editorial/
git commit -m "feat(editorial): placeholder pages for 6 sections"
```

---

## Task 20: Wire editorial chrome into App.tsx behind feature flag

**Files:**
- Modify: `client/src/App.tsx`

- [ ] **Step 1: Read current App.tsx**

```bash
cat client/src/App.tsx | head -80
```

Look for where routes are defined. Identify the main `<Route>` or routing block. Save mental note of how `DashboardLayout` currently wraps pages.

- [ ] **Step 2: Add feature-flagged route rendering**

Find the top of `App.tsx`. Add imports near the other component imports:

```tsx
import { useEditorialFlag } from "@/hooks/useEditorialFlag";
import { EditorialLayout } from "@/components/chrome/EditorialLayout";
import BriefPlaceholder from "@/pages/editorial/BriefPlaceholder";
import JobsPlaceholder from "@/pages/editorial/JobsPlaceholder";
import CompaniesPlaceholder from "@/pages/editorial/CompaniesPlaceholder";
import AgentsPlaceholder from "@/pages/editorial/AgentsPlaceholder";
import ProfilePlaceholder from "@/pages/editorial/ProfilePlaceholder";
import BulletinsPlaceholder from "@/pages/editorial/BulletinsPlaceholder";
import { Route, Switch } from "wouter";
```

Replace the routing section (find the existing `<Switch>` or route block for the authenticated app). At the top of that function component's return, add:

```tsx
const [editorial] = useEditorialFlag();

if (editorial) {
  return (
    <EditorialLayout>
      <Switch>
        <Route path="/" component={BriefPlaceholder} />
        <Route path="/jobs" component={JobsPlaceholder} />
        <Route path="/jobs/:rest*" component={JobsPlaceholder} />
        <Route path="/companies" component={CompaniesPlaceholder} />
        <Route path="/companies/:rest*" component={CompaniesPlaceholder} />
        <Route path="/agents" component={AgentsPlaceholder} />
        <Route path="/agents/:rest*" component={AgentsPlaceholder} />
        <Route path="/profile" component={ProfilePlaceholder} />
        <Route path="/bulletins" component={BulletinsPlaceholder} />
        <Route>{() => <BriefPlaceholder />}</Route>
      </Switch>
    </EditorialLayout>
  );
}
```

The existing non-editorial routing block stays **exactly as-is** below this. This is an early-return branch — when the flag is off, old routing runs untouched.

**If App.tsx is structured differently** (e.g., top-level auth gate returns one of several layouts): place the `if (editorial)` branch inside the authenticated-user branch only. Unauthenticated users should never hit editorial chrome (no user context).

- [ ] **Step 3: Typecheck + dev-run sanity**

Run: `npm run check`
Expected: exits 0.

Run in another terminal: `npm run dev`
Open `http://localhost:3000/?editorial=1` in the browser after logging in. Expected:
- Sidebar shows JOBSCOUT + 6 nav links text-only
- Topbar shows date + search stub + LIVE/QUIET + bulletins icon
- Masthead renders with today's date and issue number
- Hard-refresh without the param: editorial still on (localStorage persists)
- Visit `/?editorial=0`: falls back to original DashboardLayout

Resize browser to < 768px:
- Sidebar hides
- Mobile top bar (JOBSCOUT logo + bulletins icon) appears
- Mobile bottom bar (6 labels) appears, active highlighted
- Content area respects safe-area inset

Press Cmd+K:
- Command palette overlay opens
- "Mitä etsit?" placeholder italic
- 6 sections listed
- Click one — navigates + closes palette
- Cmd+K again closes; Esc closes

- [ ] **Step 4: Commit**

```bash
git add client/src/App.tsx
git commit -m "feat(chrome): wire editorial layout behind VITE_EDITORIAL flag"
```

---

## Task 21: Visual QA pass + restraint audit

**Files:** none (manual review)

- [ ] **Step 1: Gradient budget audit**

Open `http://localhost:3000/?editorial=1` and navigate each section. Confirm against spec §6:
- Sidebar: no gradient
- Topbar: no gradient
- Brief placeholder: no gradient (the real lead-story gradient ships in Plan 2)
- All other placeholders: no gradient
- Mobile bars: no gradient

If any gradient leaked into chrome, find and remove.

- [ ] **Step 2: Italic budget audit**

For each placeholder, scroll the page. Count visible italic elements per viewport (≈900px desktop, ≈800px mobile). Should be ≤ 2. If a placeholder shows 3+ italics (e.g., masthead subtitle + body italic + something else), reduce.

- [ ] **Step 3: Typography check**

Dev tools → inspect a Masthead `<h1>`. Computed `font-family` should contain `Sora`. Inspect body paragraph — should contain `DM Sans`. If system sans only, fonts didn't load — revisit Task 3.

- [ ] **Step 4: Paper grain check**

At zoom 100%, texture should be barely perceptible. At zoom 200%, visible subtle noise. If grain is too strong or invisible: adjust `opacity-[0.035]` in `paper-grain.tsx`.

- [ ] **Step 5: Dead code check**

Old `DashboardLayout` is still referenced in old routes (that's intended — rollback path). But `DashboardLayoutSkeleton` should still be reachable too. Don't delete any old file in this plan.

- [ ] **Step 6: Commit any tuning changes**

If any adjustments made in Steps 1-4, commit them:

```bash
git add -p  # stage only reviewed changes
git commit -m "fix(editorial): visual QA tuning per spec §6 and §9"
```

If no changes needed, skip this commit.

---

## Task 22: Final typecheck + test run

**Files:** none

- [ ] **Step 1: Full typecheck**

Run: `npm run check`
Expected: exits 0.

- [ ] **Step 2: Full test run**

Run: `npm test`
Expected: all tests pass, including the 7 tests from Task 2.

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: builds successfully, no warnings about missing fonts or unused imports.

If any step fails, fix inline before marking task complete.

- [ ] **Step 4: Commit if anything fixed**

If Steps 1-3 required fixes, commit:

```bash
git add -A
git commit -m "fix: address typecheck/test/build issues from final QA"
```

---

## Done gate

Before declaring Plan 1 complete:

- [ ] All 22 tasks checked off
- [ ] `npm run check` exits 0
- [ ] `npm test` all green
- [ ] `npm run build` succeeds
- [ ] Manual: `/?editorial=1` shows editorial chrome with 6 placeholder sections at desktop + mobile
- [ ] Manual: `/?editorial=0` falls back to old DashboardLayout
- [ ] Manual: Cmd+K opens palette, navigates, closes
- [ ] Spec §6 gradient budget respected (zero in chrome, zero in placeholders)
- [ ] Spec §9 "Don't over-magazine it" restraint rules respected

Once done, open a separate plan for **Plan 2 — The Brief** (Phase 3 Step 1): real Lead Story selector (6-tier tRPC procedure), More Headlines, The Beat, From Our Agents with voice-lint, sidebar (Key Numbers, Signal Ticker, Quick Actions).
