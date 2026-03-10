# JobScout Agent - Projektin muisti

## Yleiskuvaus
AI-pohjainen työnhakuassistentti Suomen työmarkkinoille. Multi-agent -arkkitehtuuri jossa 6 erikoistunutta agenttia auttavat työnhaussa, CV-optimoinnissa, yritystiedustelussa ja haastatteluvalmennuksessa.

## Tekniset tiedot
- **Frontend**: React 19 + TypeScript + Vite 7 + Tailwind + shadcn/ui + wouter (routing)
- **Backend**: Express + tRPC + TypeScript
- **Tietokanta**: MySQL (Drizzle ORM + raw SQL)
- **AI**: Anthropic Claude (agenttijärjestelmä) + OpenAI (index.ts/legacy)
- **Työpaikkahaku**: Serper.dev Search API
- **Yritysdata**: PRH/YTJ Open Data API v3
- **Auth**: Google OAuth (jose JWT)
- **Sähköposti**: Resend
- **Deployment**: Railway (auto-deploy GitHubista)
- **Repo**: https://github.com/brandista/jobscout.git

## Tuotanto
- **URL**: (Railway)
- **Port**: 3000 (auto-detect vapaa portti)
- **Build**: `vite build && esbuild server/_core/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist`
- **Start**: `node dist/index.js` (production), `tsx watch server/_core/index.ts` (dev)

## Agentit (6 kpl)

### Kaisa — Uravalmentaja (`career_coach`)
- CV-analyysi ja -optimointi (ATS-järjestelmät)
- LinkedIn-profiilin optimointi
- Työnhakustrategia, palkkaneuvottelu
- Asiantuntijatason system prompt (2026-2029 trendit)

### Työpaikka-analyytikko (`job_analyzer`)
- Työpaikkailmoitusten syvällinen analyysi
- Piilovaatimukset ja red flagit
- Match-sopivuus profiilin kanssa

### Yritystiedustelu (`company_intel`)
- Yritystutkimus ja kulttuurianalyysi
- Kasvusignaalit ja markkinatiedustelu
- PRH/YTJ-datan hyödyntäminen

### Haastatteluvalmennus (`interview_prep`)
- Harjoituskysymykset ja STAR-metodi
- Yrityskohtainen valmistelu
- Mock-haastattelut

### Neuvotteluapu (`negotiator`)
- Palkkatiedot ja -neuvottelu
- Tarjousten vertailu ja edut
- Vastaehdotusstrategiat

### Väinö — Signaalitietäjä (`signal_scout`)
- Ennustava rekrytointitiedustelu
- YTJ/PRH-yritysdata-analyysi
- Uutiset, rahoitus, kasvusignaalit
- Watchlist ja hälytykset

## Agenttijärjestelmän arkkitehtuuri
- **AgentMessenger**: Pub/sub viestinvälitys agenttien välillä
- **SharedKnowledge**: Yhteinen tietopohja per ajokerta
- **RunContext**: Per-request -eristys (ei ristikkäisiä tiloja)
- **Tools**: `search_jobs`, `analyze_job`, `compare_jobs`, `profile_gaps`, `salary_insights` + inter-agent tools

## Matchaus-algoritmi
- **Taidot**: 30% (keyword + synonym matching)
- **Kokemus**: 20%
- **Sijainti**: 15%
- **Palkka**: 15%
- **Toimiala**: 10%
- **Yritys**: 10%
- Kategoriat: perfect / good / fair / possible / weak

## Tietokanta (MySQL / Drizzle)
- `users` — Google OAuth käyttäjät
- `profiles` — Käyttäjäprofiilit (taidot, kokemus, preferenssit)
- `companies` — Yritykset (PRH-data, talentNeedScore)
- `companyScores` — Yrityskohtaiset pisteytykset per käyttäjä
- `events` — Yritystapahtumia (YT, rahoitus, laajennus, johtomuutokset)
- `jobs` — Työpaikat (Serper-hausta)
- `matches` — Profiili-työpaikka matchaukset
- `savedJobs` — Tallennetut työpaikat
- `scoutHistory` — Hakuhistoria
- `conversations` — Agenttikeskustelut
- `messages` — Chat-viestit (user/assistant/system/tool)
- `autoScoutSettings` — Automaattinen haku + sähköposti-asetukset
- **Schema**: `drizzle/schema.ts`
- **Migraatiot**: `drizzle-kit generate && drizzle-kit migrate`

## PRH/YTJ-integraatio
- **API v3**: `https://avoindata.prh.fi/opendata-ytj-api/v3/companies`
- **Tiedosto**: `server/prh-api.ts`
- Hakee: y-tunnus, toimiala, rekisterit, osoite, aktiivisuus
- Normalisointi: `normalizeCompanyName()` poistaa Oy/Oyj/Ab/Ltd suffiksit
- **Bugihistoria**: v1 API kuoli → migroitu v3:een (2026-02-12)

## Tärkeät tiedostot
- `server/_core/index.ts` — Express-serveri, tRPC-middleware, OAuth, Vite
- `server/routers.ts` — tRPC-reitittimet (~55k riviä, kaikki API-endpointit)
- `server/index.ts` — OpenAI-pohjainen chat-orkestoija (legacy)
- `server/agents/index.ts` — Claude-pohjainen agenttijärjestelmä (uudempi)
- `server/agents/types.ts` — Agenttityypit ja -konfiguraatiot
- `server/agents/core/` — AgentMessenger, SharedKnowledge, RunContext
- `server/agents/tools/index.ts` — Agenttien työkalut
- `server/scout.ts` — Työpaikkahaku (Serper.dev)
- `server/matching.ts` — Matchaus-algoritmi
- `server/prh-api.ts` — PRH/YTJ v3 API
- `server/db.ts` — Tietokantafunktiot (Drizzle + raw SQL)
- `server/auto-scout.ts` — Automaattinen cron-haku
- `server/email-digest.ts` — Sähköpostidigestit
- `server/cv-parser.ts` — CV-tiedostojen parsinta
- `server/company-scoring.ts` — Yritysten pisteytys
- `server/event-classifier.ts` — Yritystapahtumien luokittelu
- `drizzle/schema.ts` — Tietokantaskeema (12 taulua)
- `client/src/pages/` — 16 sivua (Home, Agents, Jobs, Scout, Profile, Watchlist, PrhSearch, ym.)
- `client/src/components/AIChatBox.tsx` — Chat-komponentti

## Ympäristömuuttujat (.env)
- `DATABASE_URL` — MySQL connection string
- `GOOGLE_CLIENT_ID` / `VITE_GOOGLE_CLIENT_ID` — Google OAuth
- `OPENAI_API_KEY` — OpenAI (legacy chat)
- `ANTHROPIC_API_KEY` — Anthropic Claude (agenttijärjestelmä)
- `SERPER_API_KEY` — Serper.dev (työpaikkahaku)
- `JWT_SECRET` — Session-tokenin salaus
- `NODE_ENV` — production / development

## Kehityskäytännöt
- **Dev**: `npm run dev` (tsx watch, port 3000)
- **Build**: `npm run build` (vite + esbuild)
- **Tarkistus**: `tsc --noEmit`
- **Testaus**: `vitest run`
- **DB-migraatiot**: `npm run db:push` (drizzle-kit generate + migrate)

## Versiohistoria
- **Versio**: 1.0.0
- **Changelog**: `CHANGELOG.md`

## Käyttäjäpreferenssit
- Kieli: Suomi
- Omistaja: Tuukka
