# JobScout Agent — Changelog

## 2026-02-12 — PRH API v3 Migration
- **fix**: PRH API v1 kuollut → migroitu v3-endpointtiin (`avoindata.prh.fi/opendata-ytj-api/v3`)
- **feat**: PRH-hakutuloksiin lisätty tarkemmat yritystiedot (rekisterit, osoite, aktiivisuus)
- **feat**: Täysi PRH-yritysdata näytetään UI:ssa

## 2026-01-15 — Agent Expert Upgrade + Google OAuth
- **feat**: Kaikki 6 agenttia päivitetty asiantuntijatason system prompteilla (2026-2029 trendit)
- **feat**: Kaisa (career_coach) päivitetty CV-asiantuntijaksi — ATS-optimointi, LinkedIn 2026, kvantifiointi
- **feat**: Supabase-auth vaihdettu Google OAuth -kirjautumiseen (jose JWT)
- **fix**: TypeScript-virheet ja UI/UX-parannukset
- **fix**: Kriittiset bugikorjaukset ja suomalaisten työpaikkojen hakuparannukset

## 2025-12-13 — File Upload & Cleanup
- Tiedostojen lataus ja projektirakenne-päivitykset

## 2025-12-08 — Dashboard V2 + Signal Feed + Väinö
- **feat**: Dashboard V2 — tilastot, AI-suositukset, watchlist, onboarding flow
- **feat**: Signal Feed Dashboard + Email Digest + Agent Collaboration (AgentMessenger, SharedKnowledge, RunContext)
- **feat**: Watchlist + PRH/YTJ + Väinö Signal Scout (ennustava rekrytointitiedustelu)
- **feat**: Väinö — uusi agentti: `signal_scout` — YTJ/PRH-data, uutiset, rahoitus, kasvusignaalit
- **fix**: PRH API 404-käsittely
- **feat**: Fallback-haut parempiin tuloksiin

## 2025-12-07 — Real Job APIs + DB Overhaul
- **feat**: SerpApi Google Jobs + Adzuna fallback (Finland-tuki)
- **feat**: Serper.dev search-endpoint integraatio
- **fix**: Tietokantauudistus — raw SQL kaikille operaatioille (Drizzle ORM bug workaround)
- **fix**: Matches-taulun uudelleenluonti skeemakorjauksineen
- **fix**: Puuttuvat sarakkeet ja taulut lisätty (yhteensä 12 taulua)

## 2025-12-06 — Auto Scout + Matching Enhancement
- **feat**: Auto Scout — automaattinen työpaikkahaku + sähköposti-ilmoitukset (Resend)
- **feat**: Parannettu matchaus — title scoring, skill extraction, paremmat oletusarvot
- **feat**: autoScoutSettings-taulu sähköpostidigestien hallintaan
