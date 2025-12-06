# Job Scout Agent - TODO

## Tietokanta
- [x] Käyttäjäprofiilien taulukko (skills, experience, preferences)
- [x] Työpaikkojen taulukko (title, company, description, salary, location)
- [x] Matchausten taulukko (user_id, job_id, score)
- [x] Tallennettujen työpaikkojen taulukko
- [x] Scoutaus-historian taulukko

## Backend API
- [x] Profiilin CRUD-operaatiot (create, read, update)
- [x] Työpaikkojen haku ja suodatus
- [x] Matchaus-algoritmin toteutus
- [x] Scoutaus-agentin toteutus (demo-data)
- [x] Tallennettujen työpaikkojen hallinta

## Käyttöliittymä
- [x] Etusivu esittelyllä
- [x] Profiilin muokkaussivu
- [x] Työpaikkojen listaussivu matcheilla
- [x] Scoutaus-sivu agentin käynnistämiseen
- [x] Tallennetut työpaikat -sivu
- [ ] Yksittäisen työpaikan yksityiskohtasivu
- [ ] Tilastot ja analytiikka -sivu

## Scoutaus-agentti
- [x] Demo-data scoutaus
- [ ] LinkedIn Jobs API -integraatio
- [ ] Indeed API -integraatio
- [ ] Suomalaisten työpaikkasivustojen scraping
- [ ] Automaattinen scoutaus-toiminnallisuus
- [ ] Notifikaatiot uusista matcheista

## Matchaus-algoritmi
- [x] Taidot-matchaus (30%)
- [x] Kokemus-matchaus (20%)
- [x] Sijainti-matchaus (15%)
- [x] Palkka-matchaus (15%)
- [x] Ala-matchaus (10%)
- [x] Yritys-matchaus (10%)

## Testaus
- [x] Vitest-testit tRPC-proseduureille
- [x] Profiilin toiminnallisuuden testaus
- [ ] Matchaus-algoritmin yksikkötestaus
- [ ] API-integraatioiden testaus
