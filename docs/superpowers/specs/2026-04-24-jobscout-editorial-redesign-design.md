# JobScout Editorial Redesign — Design Spec

**Date:** 2026-04-24
**Status:** Draft
**Replaces:** Current JobScout dashboard (shadcn/ui + gradient-cards + Dashboard V2)
**Inspiration:** Brandista Growth Engine "The Brief" editorial redesign (Apr 2026)

---

## 1. Overview

Redesign the entire JobScout web app around a newspaper/editorial design language — the same "The Brief" direction used in the Growth Engine dashboard. JobScout becomes a daily briefing on the job market: watchlist companies are "beats", recruiter signals are a ticker, matches are headlines, and the six AI agents are masthead contributors (columnist, field reporter, critic, etc.).

The app currently mixes Dashboard V2 gradient hero banners, colorful stat cards, and 16 pages with overlapping responsibility. This redesign consolidates to 6 sections and moves all chrome to an ivory-paper, ink-typography aesthetic with Sora display + DM Sans body.

### Key Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Scope | Full app redesign (all pages) | Editorial language only works if consistent across the product |
| Design language | "The Brief" editorial (newspaper) | Brandista GE dashboard uses this; proven direction, user approved |
| Color family | Same ivory paper as Brandista, **own accent gradient** | Emerald→teal→sky instead of blue→purple→cyan; sister publication, not clone |
| Page consolidation | 16 pages → 6 sections | Editorial IA requires clear hierarchy; 16 sidebar links = enterprise dashboard, not editorial |
| Typography | Sora display, DM Sans body (same as GE) | Part of same editorial universe |
| Gradient budget | 1-2 intentional moments per page, zero in chrome | Avoid "startup neon"; gradient must earn its place |
| Component model | Shared editorial primitives | Port GE `editorial.tsx` pattern: `EditorialShell`, `Masthead`, `BriefSectionLabel`, `BriefActionRow`, `BriefMetricRow`, `BriefTickerItem` |

### What stays the same

- React 19 + TypeScript + Vite + Tailwind + wouter
- tRPC data layer, all existing queries/endpoints
- Backend agents, matching algorithm, PRH/YTJ integration
- Business logic of every page

This is a pure frontend/UX redesign. No backend changes.

---

## 2. Design System

### Palette

| Token | Value | Use |
|---|---|---|
| `paper` | `#FAF7F0` | Background (entire app) |
| `ink` | `slate-900` | Primary type, hairlines |
| `meta` | `slate-500` | Italic subtitles, bylines, notes |
| `muted` | `slate-400` | Timestamps, tabular-nums meta, inactive nav |
| `hairline` | `slate-900 @ 1-1.5px` | Masthead rule, section rules, sidebar edge |
| `live` | `emerald-500` | LIVE indicator dot, unread bulletin dot |
| `accent-gradient` | `from-emerald-500 via-teal-500 to-sky-500` | **Rare** — lead story score, Talent Score ≥ 80, agent mission ornament |

No other colors. No shadcn gradient presets. No per-card gradient variety. The restraint is the point.

### Paper grain

Full-page SVG noise overlay at `opacity 0.035`, `mix-blend-multiply`. Same filter definition as Brandista `EditorialShell`. Adds tactile paper texture without distracting.

### Typography

| Role | Font | Size / Weight / Tracking |
|---|---|---|
| Masthead title | Sora | `text-3xl md:text-4xl font-black tracking-[-0.02em]` |
| Lead story headline | Sora | `text-5xl md:text-6xl font-black tracking-[-0.025em] leading-[0.95]` |
| Section headlines | Sora | `text-2xl md:text-[28px] font-semibold tracking-tight` |
| Section label | Sora | `text-[11px] uppercase tracking-[0.22em] font-bold` |
| Metric number | Sora | `text-3xl font-extrabold tabular-nums tracking-[-0.02em]` |
| Body | DM Sans | `text-base md:text-lg leading-relaxed` |
| Ingress / byline / mission | DM Sans | `italic text-base md:text-lg text-slate-500` |
| Ticker timestamp | DM Sans | `text-[10px] uppercase tracking-[0.16em] font-bold tabular-nums` |
| Meta (match% · city · age) | DM Sans | `text-[11px] tracking-[0.12em] uppercase text-slate-400` |

Both fonts loaded via `@import` in `client/src/index.css`, same approach as Brandista.

### Editorial primitives (shared components)

Port the Brandista `editorial.tsx` module to JobScout verbatim, then extend. Primitives:

- `EditorialShell` — paper bg + grain overlay + centered max-w-6xl container
- `Masthead` — date strip row + title row, both with hairline rules
- `BriefSectionLabel` — uppercase tracking-wide bold with hairline underline
- `BriefMetricRow` — label left (small caps), value right (large number)
- `BriefActionRow` — icon + label + desc + chevron, newsroom-style action
- `BriefTickerItem` — timestamp + text, tabular-nums
- `formatBriefDate(date, language)` — localized, uppercased

New JobScout-specific primitives to add:

- `EditorialListItem` — headline + meta row + ingress + action link (used for Jobs, Bulletins, CompanyDossier)
- `CompanyDossier` — masthead-inside-card: name + meta line + recent signals + action
- `ContributorCard` — agent "masthead card" for Agents page
- `TabRail` — masthead-row uppercase links, active = ink + underline, inactive = slate-400 (replaces shadcn Tabs)
- `InlineEditRow` — section with small "Edit →" link aligned right for Profile page

### Effects / motion

- Hover on action rows: `bg-slate-900/[0.025]` + chevron translates 2px right
- Hover on list items: hairline-marker appears at left edge (1.5px ink bar, 40ms ease)
- Page transitions: fade-only, 150ms. No slide/scale.
- Ticker items: subtle stagger on mount (40ms per item), fade + 2px rise
- LIVE dot: `animate-ping` halo layer (already in Brandista primitives)

No card lifts, no neon glows, no gradient animations, no parallax.

### Layout grid

- Desktop: 12-col grid, `max-w-6xl` container, `gap-8`
- Main column: typically 8 of 12
- Sidebar: typically 4 of 12
- Mobile: single column, sidebar stacks below main content
- Gutter: `px-6 lg:px-10`

---

## 3. Information Architecture

16 existing pages consolidate into 6 sections. Sidebar carries 6 labels only.

| Section | Replaces | Role |
|---|---|---|
| **The Brief** | `Home.tsx` | Daily briefing — lead story, headlines, beat, agent notes, key numbers, ticker |
| **Jobs** | `Jobs.tsx` + `SavedJobs.tsx` + `Scout.tsx` | Classified job listings (tabs: Haut / Tallennetut / Matchatut) |
| **Companies** | `Watchlist.tsx` + `CompanyScout.tsx` + `PrhSearch.tsx` | Company dossiers (tabs: Seurannassa / Löydä / PRH-haku) |
| **Agents** | `Agents.tsx` + `Agents_mobile.tsx` | The masthead — 6 contributors with roles |
| **Profile** | `Profile.tsx` | By-line page — user's editorial identity |
| **Bulletins** | `Notifications.tsx` | Ticker feed — all signals, day-grouped |

### Utility pages (keep, restyled)

- `Login.tsx` → editorial login (masthead + "Sign in to today's edition")
- `AuthCallback.tsx` → minimal loading state
- `NotFound.tsx` → editorial 404 ("This page has gone to press")
- `JobDetail.tsx` → full-article view of a single job (kept as dedicated page, reachable from Jobs lists)
- `ComponentShowcase.tsx` → removed (dev-only, no longer needed once primitives stabilize)

### Routes (wouter)

```
/                    → The Brief
/jobs                → Jobs (default tab: Haut)
/jobs/saved          → Jobs (tab: Tallennetut)
/jobs/matches        → Jobs (tab: Matchatut)
/jobs/:id            → JobDetail (full article view)
/companies           → Companies (default tab: Seurannassa)
/companies/discover  → Companies (tab: Löydä)
/companies/prh       → Companies (tab: PRH-haku)
/agents              → Agents
/agents/:id          → AgentChat (in-context editorial chat)
/profile             → Profile
/bulletins           → Bulletins
/login               → Login
```

---

## 4. Page Designs

### 4.1 The Brief (Home)

**Masthead (full width, top of page):**

Row 1 — date strip, hairline below:
```
TORSTAI 24. HUHTIKUUTA    ISSUE Nº 142          ● LIVE
```

Row 2 — title row, hairline below:
```
JOBSCOUT BRIEFING  ·  Kiertokirje työnhaun huipulta, Tuukka.
```

Issue number = days since user's account creation (computed client-side).

**Main grid (below masthead):**

Left column (8 col):

1. **LEAD STORY** — highest-scoring fresh match (today or yesterday)
   - Headline (Sora black 56px, leading-[0.95])
   - Meta row: `92% · REAKTOR · HELSINKI · 2 h`
   - Ingress (italic DM Sans 18px slate-500): AI-generated 1-2 sentence summary of why this match is strong
   - Score number displayed as **accent gradient** (the one intentional moment in main column)
   - Action link: "Avaa juttu →"

2. **MORE HEADLINES** (BriefSectionLabel)
   - 4 more matches (max 4, not 5)
   - Each: headline (Sora semibold 24px) + meta line (`88% · Helsinki · 2 h sitten` uppercase tracking-wide 11px slate-400)
   - Hairline rule between items
   - "Kaikki matchit →" link at bottom leading to /jobs/matches

3. **THE BEAT** (BriefSectionLabel)
   - Watchlist companies with recent signal activity (top 3)
   - Each entry is a mini-column (not a feed item):
     ```
     REAKTOR avasi 2 paikkaa — backend painottuu
     Kolmen viikon aikana rekrytointitahti tuplaantunut. Johdossa uusi CTO viime viikolla.
     [Avaa dossier →]
     ```
   - Interpretation-style, not `Company +2 open` raw feed
   - Hairline rule between entries

4. **FROM OUR AGENTS** (BriefSectionLabel)
   - 3 agent notes, distinct voices:
     - **Väinö — kenttäraportti**: market signal ("Reaktorin PRH-rekisteriin kirjattu osoitteenmuutos — Espooseen, mahdollinen laajentuminen.")
     - **Kaisa — kolumni**: CV/profile advice ("Profiilistasi puuttuu ainoa asia jonka Reaktor rekrytoijat etsivät...")
     - **Työpaikka-analyytikko — kritiikki**: match analysis or red flag ("Woltin uusi ilmoitus on geneerinen — säästä aikaa, ohita.")
   - Each: byline italic slate-500, 2-3 sentence body, "Jatka keskustelua →" link

Right sidebar (4 col, sticky from top):

1. **KEY NUMBERS** (BriefSectionLabel)
   - `BriefMetricRow` × 4:
     - Matchit tänään
     - Tallennetut työpaikat
     - Watchlistillä
     - Profiili valmius (%)
   - Hairline rules between rows

2. **SIGNAL TICKER** (BriefSectionLabel)
   - `BriefTickerItem` list, today's signals, max 6 items
   - "Kaikki signaalit →" link leading to /bulletins

3. **QUICK ACTIONS** (BriefSectionLabel)
   - `BriefActionRow` × 3:
     - Aloita Scout (Search icon) — opens scout flow
     - Päivitä CV (FileText icon) — /profile with upload section focused
     - Keskustele Kaisan kanssa (MessageSquare icon) — /agents/kaisa
   - Icons are 16px lucide outline, no fills

**Intentional gradient moments:**
- Lead story score number (one)
- Total of **one** on this page

### 4.2 Jobs

**Masthead:**
```
JOBS  ·  Klassifioitu työtarjonta, päivittyy elävänä
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HAUT  ·  TALLENNETUT  ·  MATCHATUT
```

Tab rail below masthead — `TabRail` primitive. Active tab = ink-black + bottom hairline underline. Inactive = slate-400, no underline. Hover = slate-600.

**Main column (8 col) — results list:**

Each result is an `EditorialListItem`:
```
SENIOR FULL STACK DEVELOPER
92% · REAKTOR · HELSINKI · 4 500–6 500 € · 2 h sitten
────────────────────────────────────────────────────
Tämä ilmoitus painottaa backend-osaamista; Next.js ja
Postgres-kokemuksesi sopivat hyvin. Palkkahaarukka vastaa
preferenssejäsi.

[Lue koko ilmoitus →]         [Tallenna]     [Ohita]
```

- Headline: Sora semibold 28px
- Meta line: 11px uppercase tracking-wide slate-400, tabular-nums
- Ingress: DM Sans 16px italic slate-700 (slightly darker than regular meta for readability), 2-3 lines, AI-generated per match
- Action row: three links right-aligned, tracking-wide small caps
- Hairline rule between items

**Sidebar (4 col):**

1. **HAKU** (BriefSectionLabel)
   - Large italic question: *"Mitä etsit tänään?"* above a hairline-underline text input (no shadcn Input box)
   - Below: filter groups as tracking-wide labels with checkboxes:
     - SIJAINTI · Helsinki · Espoo · Remote · Ulkomaat
     - KOKEMUS · Junior · Mid · Senior · Lead
     - PALKKA · 3k · 4k · 5k · 6k+
     - TYYPPI · Vakituinen · Määräaikainen · Freelance

2. **AKTIIVISET SUODATTIMET** (BriefSectionLabel)
   - Small tag row, each tag has × to remove
   - Hidden if no active filters

3. **TALLENNETUT HAUT** (BriefSectionLabel)
   - Up to 5 saved search rows as small editorial entries:
     ```
     Senior FullStack · Helsinki
     Haettu viimeksi 3 päivää sitten · 14 osumaa
     [Aja haku →]
     ```

**Tabs specifics:**

- **HAUT**: raw search results from Serper/Adzuna, no match scores
- **TALLENNETUT**: user's saved jobs, sorted by save date
- **MATCHATUT**: computed matches from matching algo, sorted by score desc

### 4.3 Companies

**Masthead:**
```
COMPANIES  ·  Yritykset joita seuraat, ja joita et vielä
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SEURANNASSA  ·  LÖYDÄ  ·  PRH-HAKU
```

**Tab 1 — SEURANNASSA (Watchlist):**

Main (8 col) — `CompanyDossier` list:
```
REAKTOR                                      ● ACTIVE
Konsultointi · Helsinki · 620 työntekijää · Talent Score 87
──────────────────────────────────────────────────────
Viimeisin signaali: Avasi 2 backend-paikkaa 14. huhtikuuta.
Kolmen viikon aikana rekrytointitahti tuplaantunut.

  09:42 · 2 uutta paikkaa julkaistu
  ke · Johtoryhmään uusi CTO
  ma · YTJ: osoitteenmuutos

[Avaa koko dossier →]
```

- Name: Sora black 32px
- Meta line: 11px uppercase tracking-wide slate-500
- Interpretation: DM Sans 16px, 2 lines max
- Recent signals: 3 BriefTickerItem rows inside dossier
- `● ACTIVE` / `● QUIET` / `● COLD` status indicator right-aligned, tracking-wide 11px

**Talent Score gradient rule:**
- Score ≥ 80: number in accent gradient
- Score < 80: number in ink-black
- This is breaking-news treatment for high-talent-need companies

Sidebar (4 col):
- **FILTER BY SIGNAL** — checkbox list: Hakemassa / Rahoitus / Johtomuutos / YTJ-muutos / Uusi toimisto
- **SORT** — radio: Talent Score · Viimeisin · Aakkosellinen
- **REMOVE FROM BEAT** — small link bottom

**Tab 2 — LÖYDÄ (CompanyScout):**

Same dossier layout but in "suggestion" mode. Each company gets a *"Miksi suositus"* italic paragraph:
> *"Profiilisi React-kokemus + Reaktorin portfolio-yritykset painottavat frontend-osaamista."*

Two actions: `[+ Lisää seurantalistalle]` and `[Ohita]` as BriefActionRow-style links (not buttons).

Sidebar: same filter/sort as Watchlist tab.

**Tab 3 — PRH-HAKU:**

Tool-style page, no sidebar (main column stretches full-width max-w-4xl).

Top:
- Large italic question: *"Mitä yritystä etsit?"*
- Single hairline-underline text input
- Placeholder: "Y-tunnus, nimi tai osoite"

Results list (editorial items):
```
REAKTOR OY                                    Y-tunnus 1947825-8
Tietotekniikka · Helsinki · Aktiivinen · Rekisterit: Kaupparekisteri
──────────────────────────────────────────────────────────────
Annankatu 34 A, 00100 Helsinki

[+ Lisää seurantalistalle →]
```

### 4.4 Agents

**Masthead:**
```
AGENTS  ·  Toimituksen kuusi asiantuntijaa palveluksessasi
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Layout:** 2-column grid of `ContributorCard` components (on mobile: single column).

```
KAISA — URAVALMENTAJA                         ● KÄYTÖSSÄ
Kolumnisti · CV, LinkedIn, palkkaneuvottelu
──────────────────────────────────────────────────────
"Kirjoitan profiilisi niin että rekrytoija lukee sen loppuun."

Asiantuntemus:  ATS-optimointi · Henkilöbrandi · Neuvottelu
Keskusteluja:   14
Viimeisin:      Eilen 16:42

[Aloita keskustelu →]
```

**Contributor roles and voices:**

| Agent | Role (masthead label) | Voice |
|---|---|---|
| Kaisa | Kolumnisti | CV, LinkedIn, interview readiness, strategy |
| Väinö | Kenttäreportteri | Market signals, PRH/YTJ, hiring intel |
| Työpaikka-analyytikko | Kriitikko | Match analysis, red flags, hidden requirements |
| Yritystiedustelu | Tutkiva toimittaja | Company research, culture, growth signals |
| Haastatteluvalmennus | Toimittaja | Interview prep, STAR method, mock interviews |
| Neuvotteluapu | Taloustoimittaja | Salary data, offer comparison, counter-proposals |

- Name: Sora black 28px
- Role label after em dash: tracking-wide uppercase 11px
- Mission statement: italic DM Sans 18px slate-700 (one sentence, first-person)
- Status dot right-aligned: `● KÄYTÖSSÄ` / `● VARATTU` / `● LOMALLA`
- Three meta rows inside card: Asiantuntemus, Keskusteluja, Viimeisin

**Intentional gradient moment:** small 6×6 gradient dot as bullet inside mission statement, one per card maximum. Subtle enough that it doesn't dominate; sets agents apart from regular editorial content.

**`/agents/:id` route** — full-screen AgentChat keeping editorial chrome: masthead shows `KAISA — URAVALMENTAJA`, chat transcript renders each user message as regular text and each agent message as italic quote block with byline.

### 4.5 Profile

**Layout:** single column `max-w-3xl` centered, long-read essay feel. Sticky 4-col sidebar on desktop.

**Masthead (narrower, page-local):**
```
● PUBLISHED

TUUKKA TUOMISTO
Growth & AI engineer · Helsinki · Available Q2/2026
Päivitetty 24.4.2026
```

**Ingress (italic, full-width):**
> *"Rakennan AI-järjestelmiä PK-yrityksille.
> Edellinen: Brandista, Kirjanpitosovellus, BemuFix."*

Stored as `profile.bio`, free-form, editable.

**Sections** (each uses `InlineEditRow` — BriefSectionLabel with "Edit →" right-aligned):

1. **TAIDOT** — tag list, hairline-separated:
   ```
   Python  ·  TypeScript  ·  React  ·  Claude API  ·  FastAPI
   ```

2. **KOKEMUS** — editorial list of work entries, each entry:
   ```
   LEAD ENGINEER, BRANDISTA OY              2026 – NYT
   Rakennan Growth Engineä: FastAPI-backend + React-frontend.
   7 AI-agenttia, multi-agent orchestration, Stripe Checkout.
   ```

3. **KOULUTUS** — similar editorial list, shorter

4. **KIELET** — single row: `Suomi (äidinkieli) · Englanti (erinomainen) · Ruotsi (välttävä)`

5. **PREFERENSSIT** — `BriefMetricRow` x 4: Palkka, Sijainti, Etätyö, Toimiala

**Sticky sidebar (4 col, desktop only):**

1. **PROFILE COMPLETENESS**
   - Large percentage number (ink-black, not gradient)
   - Progress bar as 8 segments (hairline stroked when incomplete, filled ink when complete)

2. **PARANNA PROFIILIA** (BriefSectionLabel)
   - 3-4 missing fields as BriefActionRow items:
     ```
     Lisää työhistoria
     Parempia matcheja tarjolla.
     ```

3. **CV-TIEDOSTO** (BriefSectionLabel)
   - Upload drop zone as hairline-bordered rectangle with italic label *"Raahaa CV tähän — PDF tai DOCX"*
   - If CV already uploaded: shows filename + "Päivitä →" link

### 4.6 Bulletins

**Masthead:**
```
BULLETINS  ·  Kaikki hälytykset, aikajärjestyksessä
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
KAIKKI  ·  LUKEMATTA  ·  ARKISTOITU
```

**Layout:** single full-width column (no sidebar). This is a feed view.

**Grouped by day** — day header is a tracking-wide uppercase row:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TORSTAI 24. HUHTIKUUTA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Hairline above and below. Day header repeats for each day going back.

**Each bulletin:**
```
● 09:42  Reaktor avasi kaksi backend-paikkaa
          Match 88%  ·  Helsinki  ·  4 500–6 500 €
          [Avaa ilmoitus →]  [Arkistoi]
```

- Unread indicator: `●` emerald-500 left-aligned, 4px dot
- Read state: no dot, 4px empty space so alignment stays
- Timestamp: tabular-nums, 11px uppercase tracking-wide slate-500
- Headline: DM Sans 16px slate-900
- Sub-meta: 11px slate-400
- Action row: 2 links tracking-wide small caps

**Filter tabs** (TabRail):
- KAIKKI: everything
- LUKEMATTA: only `● `-marked items
- ARKISTOITU: user-archived

**Hover:** bg slate-900/[0.025], left-edge hairline marker appears.

---

## 5. Chrome

### Sidebar (desktop, 240px wide)

```
┌──────────────────────────┐
│ JOBSCOUT                 │   ← Sora black 20px tracking-tight
│ Edition Nº 142 · Tuukka  │   ← italic 11px slate-500
│ ─────────────────────── │   ← hairline
│                          │
│ THE BRIEF                │   ← active: ink-black + left 1.5px marker
│ JOBS                     │   ← inactive: slate-500, no icons
│ COMPANIES                │
│ AGENTS                   │
│ PROFILE                  │
│ BULLETINS         · 3    │   ← unread count tabular-nums slate-400
│                          │
│ ─────────────────────── │
│                          │
│ [K] TUUKKA               │   ← small avatar + name
│     Kirjaudu ulos →      │
└──────────────────────────┘
```

- Bg: same paper `#FAF7F0` (no sidebar-specific bg)
- Right edge: 1px `slate-900` hairline separating from main
- Nav items: py-3, px-6, 11px uppercase tracking-[0.22em] font-bold
- Active state: ink-black + 1.5px ink vertical bar at left edge
- Inactive: `slate-500`
- Hover: `bg-slate-900/[0.025]` + text-slate-700
- Edition Nº = days since user account creation
- No icons in nav — editorial puritanism

### Topbar (64px)

Single row, baseline-aligned, hairline below:

```
TORSTAI 24. HUHTIKUUTA    ━━━━━    _Mitä etsit?_    ━━━━━    ● LIVE  [bulletins ▣]
```

- Left: date strip 11px uppercase tracking-[0.22em] ink-black
- Center: global search — hairline-underline text input (no border-box), italic placeholder, `Cmd+K` opens command palette overlay
- Right:
  - LIVE indicator — emerald dot + `LIVE` or `QUIET` label, clickable → /bulletins
  - Bulletins icon — outline envelope, shows red dot if unread, clickable → /bulletins

### Global command palette (Cmd+K)

Full-screen overlay, paper bg, single hairline-underline search field:
- Search across jobs, companies, agents, bulletins in parallel
- Results grouped with BriefSectionLabel sections: HEADLINES (jobs), COMPANIES, AGENTS, BULLETINS
- Keyboard navigation, Enter to open
- Esc to close

### Mobile chrome (< 768px)

- **Top:** compact masthead row — logo left, bulletins icon + LIVE right. Height 56px, hairline below.
- **No sidebar.**
- **Bottom bar:** 6 sections as text-only labels, tracking-wide 10px uppercase:
  ```
  BRIEF  JOBS  COMPANIES  AGENTS  PROFILE  BULLETINS
  ```
  Active = ink-black + top hairline marker; inactive = slate-400.
- Bottom bar height 56px, hairline above. Safe-area inset padding for home indicator.
- Content area: single column, sidebar content stacks below main on each page.

---

## 6. Gradient budget (per page)

Hard rule: **1-2 intentional moments maximum per page**. Chrome has zero.

| Page | Gradient moment(s) |
|---|---|
| The Brief | Lead story score number (1) |
| Jobs | None — list stays pure ink |
| Companies | Talent Score number **only when ≥ 80** (conditional, 0 or 1 per dossier) |
| Agents | Small 6×6 bullet dot inside mission statement (1 per card) |
| Profile | None — ink-only for essay aesthetic |
| Bulletins | None — ticker stays pure ink |
| Chrome | Zero |

If a new page or component is added later and has no existing allocation, the default is **zero**. Adding a new gradient moment requires explicit design review.

---

## 7. Component migration

### Phase 1 — foundation

1. Copy `editorial.tsx` from Brandista verbatim
2. Load Sora + DM Sans in `client/src/index.css` via Google Fonts
3. Update Tailwind config: paper color, custom spacing if needed
4. Add paper grain SVG to public/ or inline
5. Build new JobScout primitives (`EditorialListItem`, `CompanyDossier`, `ContributorCard`, `TabRail`, `InlineEditRow`)

### Phase 2 — chrome

1. Replace `DashboardLayout.tsx` with `EditorialLayout.tsx` (sidebar + topbar + content slot)
2. Move routing into new layout
3. Mobile bottom bar component
4. Cmd+K command palette

### Phase 3 — sections

In priority order (highest-usage first):

1. **The Brief** (replaces Home) — biggest visual impact, most frequently viewed
2. **Jobs** (merges Jobs + SavedJobs + Scout) — core user task
3. **Companies** (merges Watchlist + CompanyScout + PrhSearch) — signature feature
4. **Bulletins** (replaces Notifications) — high-frequency view
5. **Agents** (merges Agents + Agents_mobile) — medium frequency
6. **Profile** — lower frequency, but editorial treatment is most distinctive

Each section ships behind a feature flag / route alias so old and new can coexist during rollout.

### Phase 4 — utility pages + cleanup

1. Login, AuthCallback, NotFound restyled
2. JobDetail restyled as full-article view
3. Delete old page files (`Dashboard V2` gradient hero, `StatsCard` component, `ComponentShowcase`)
4. Delete shadcn Tabs usage replaced by TabRail
5. Remove unused gradient utility classes from Tailwind

### Data / backend

Zero changes. All tRPC endpoints stay identical. The redesign is pure presentation.

One addition: `profile.bio` field for the by-line ingress if not already present (plain text, 280 char max). If schema lacks it, add migration.

---

## 8. Success criteria

The redesign is complete when:

1. All 6 sections render in editorial style with the primitives from Section 2.
2. No shadcn `Card`, `Badge gradient`, or rainbow stat card appears in any main-flow page.
3. Sidebar shows exactly 6 labels, text-only, no icons.
4. Gradient budget is respected (audit per page against Section 6 table).
5. Mobile bottom bar covers all 6 sections and paper grain reads well under 56px chrome.
6. Cmd+K opens command palette and returns grouped results within 200ms on local dev.
7. A cold visitor without context can identify this is "the same publishing house" as Brandista GE within 3 seconds (shared typography, shared paper, but distinct emerald/teal accent).

---

## 9. Open questions

- Should the sidebar auto-collapse on smaller desktop (< 1200px) to a 64px icon rail? Decision: **no icons in nav** is a deliberate editorial choice; collapse would force icons. Keep sidebar at 240px, accept slightly less main-column width on medium screens.
- Does AgentChat (/agents/:id) keep its existing implementation, or get a full editorial rewrite? **Decision deferred to plan**: likely restyle only, keep underlying logic.
- Command palette: new dependency or hand-rolled? **Default**: hand-rolled — no new deps, editorial aesthetic hard to match from a library.
