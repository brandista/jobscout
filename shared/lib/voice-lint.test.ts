import { describe, it, expect } from "vitest";
import { lintAgentNote } from "./voice-lint";

describe("lintAgentNote — signal_scout (Väinö)", () => {
  it("passes a valid kenttäraportti note", () => {
    const result = lintAgentNote("signal_scout",
      "Reaktor kirjasi osoitteenmuutoksen PRH-rekisteriin — siirtyi Espooseen viime viikolla.");
    expect(result.ok).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it("flags second-person pronoun 'sinun'", () => {
    const result = lintAgentNote("signal_scout",
      "Reaktor avasi paikkoja, mutta sinun kannattaa tarkistaa palkka.");
    expect(result.ok).toBe(false);
    expect(result.violations[0]).toMatch(/toisen persoonan/);
  });

  it("flags 'profiilistasi'", () => {
    const result = lintAgentNote("signal_scout",
      "Reaktor kasvaa. Päivitä profiilistasi taidot ensin.");
    expect(result.ok).toBe(false);
  });

  it("flags standalone 'Sinä' (Finnish word boundary)", () => {
    const result = lintAgentNote("signal_scout",
      "Sinä voisit hakea tähän paikkaan.");
    expect(result.ok).toBe(false);
    expect(result.violations[0]).toMatch(/toisen persoonan/);
  });
});

describe("lintAgentNote — career_coach (Kaisa)", () => {
  it("passes a valid kolumni note", () => {
    const result = lintAgentNote("career_coach",
      "Profiilistasi puuttuu ainoa asia jonka Reaktorin rekrytoijat etsivät — projektikokemusta. Lisää se nyt.");
    expect(result.ok).toBe(true);
  });

  it("flags field-reporter label 'Signaali:'", () => {
    const result = lintAgentNote("career_coach",
      "Signaali: Reaktor avasi paikkoja. Kannattaa hakea.");
    expect(result.ok).toBe(false);
    expect(result.violations[0]).toMatch(/kenttäraportteri/);
  });

  it("flags 'PRH-rekisteri' jargon", () => {
    const result = lintAgentNote("career_coach",
      "PRH-rekisteristä näkyy kasvu. Päivitä CV.");
    expect(result.ok).toBe(false);
  });
});

describe("lintAgentNote — job_analyzer (Kriitikko)", () => {
  it("passes a valid kritiikki note", () => {
    const result = lintAgentNote("job_analyzer",
      "Woltin uusi ilmoitus on geneerinen — vaatimukset epämääräiset, palkka ei näy. Ohita.");
    expect(result.ok).toBe(true);
  });

  it("flags cheerful opener 'Hienoa'", () => {
    const result = lintAgentNote("job_analyzer",
      "Hienoa — Reaktorin ilmoitus sopii sinulle erinomaisesti!");
    expect(result.ok).toBe(false);
    expect(result.violations[0]).toMatch(/kehuvaa kieltä/);
  });

  it("flags 'Mahtavaa'", () => {
    const result = lintAgentNote("job_analyzer", "Mahtavaa, löysit erinomaisen paikan.");
    expect(result.ok).toBe(false);
  });
});
