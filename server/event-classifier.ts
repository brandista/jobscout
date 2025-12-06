/**
 * Event Classifier - LLM-pohjainen uutisten luokittelu
 */
import OpenAI from "openai";
import type { RawNewsItem } from "./news-fetcher";
import type { EventType } from "../drizzle/schema";

export interface ClassifiedEvent {
  companyName: string;
  eventType: EventType;
  impactStrength: number; // 1-5
  functionFocus: string[];
  affectedCount: number | null;
  confidence: number; // 0-1
  summary: string;
  // Original data
  headline: string;
  sourceUrl: string;
  publishedAt: Date;
}

const CLASSIFICATION_PROMPT = `Olet suomalaisten bisnesuutisten analysoija. Analysoi seuraava uutinen ja palauta tiedot JSON-muodossa.

UUTINEN:
Otsikko: {headline}
Sisältö: {summary}

TEHTÄVÄ:
1. Tunnista yrityksen nimi (jos mainittu)
2. Luokittele tapahtuman tyyppi
3. Arvioi vaikutuksen voimakkuus (1-5)
4. Tunnista mihin funktioihin vaikuttaa eniten
5. Jos mainitaan lukumäärä (esim. irtisanottavat), poimi se

TAPAHTUMAN TYYPIT:
- yt_layoff: YT-neuvottelut johtavat irtisanomisiin
- yt_restructure: YT-neuvottelut ilman merkittäviä irtisanomisia
- funding: Rahoituskierros tai investointi
- new_unit: Uusi yksikkö, toimipiste tai markkina
- expansion: Kasvu, rekrytointi, laajentuminen
- acquisition: Yrityskauppa
- strategy_change: Strategiamuutos
- leadership_change: Johdon muutos
- other: Muu relevantti tapahtuma

FUNKTIOT (valitse 1-3 relevanteinta):
- marketing, sales, it, hr, finance, operations, production, rd, management, other

VAIKUTUKSEN VOIMAKKUUS (1-5):
1 = Pieni, 2 = Kohtalainen, 3 = Merkittävä, 4 = Suuri, 5 = Erittäin suuri

VASTAA VAIN JSON-MUODOSSA:
{
    "company_name": "Yrityksen nimi tai null",
    "event_type": "tyyppi",
    "impact_strength": 1-5,
    "function_focus": ["lista"],
    "affected_count": numero tai null,
    "confidence": 0.0-1.0,
    "summary": "Lyhyt yhteenveto"
}`;

/**
 * Luokittele uutinen OpenAI:lla
 */
export async function classifyNews(newsItem: RawNewsItem): Promise<ClassifiedEvent | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    console.warn("[EventClassifier] OPENAI_API_KEY not set - using rule-based fallback");
    return ruleBasedClassify(newsItem);
  }

  try {
    const openai = new OpenAI({ apiKey });
    
    const prompt = CLASSIFICATION_PROMPT
      .replace("{headline}", newsItem.headline)
      .replace("{summary}", newsItem.summary.slice(0, 1500));

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [
        { role: "system", content: "Olet bisnesuutisten analysoija. Vastaa aina validilla JSON:illa." },
        { role: "user", content: prompt }
      ],
      temperature: 0.1,
      max_tokens: 500,
    });

    const content = response.choices[0]?.message?.content || "";
    
    // Parse JSON from response
    let jsonStr = content;
    if (content.includes("```json")) {
      jsonStr = content.split("```json")[1].split("```")[0];
    } else if (content.includes("```")) {
      jsonStr = content.split("```")[1].split("```")[0];
    }

    const data = JSON.parse(jsonStr.trim());
    return parseClassification(data, newsItem);

  } catch (error) {
    console.error("[EventClassifier] OpenAI error:", error);
    return ruleBasedClassify(newsItem);
  }
}

/**
 * Luokittele useita uutisia
 */
export async function classifyNewsBatch(newsItems: RawNewsItem[]): Promise<ClassifiedEvent[]> {
  const results: ClassifiedEvent[] = [];

  for (const item of newsItems) {
    const classified = await classifyNews(item);
    if (classified) {
      results.push(classified);
    }
  }

  return results;
}

function parseClassification(data: any, newsItem: RawNewsItem): ClassifiedEvent | null {
  try {
    const companyName = data.company_name;
    if (!companyName || companyName === "null") {
      return null;
    }

    const eventType = data.event_type || "other";
    const impact = Math.max(1, Math.min(5, parseInt(data.impact_strength) || 3));
    let functions = data.function_focus || ["other"];
    if (typeof functions === "string") functions = [functions];
    
    let affected = data.affected_count;
    if (affected) {
      try { affected = parseInt(affected); } catch { affected = null; }
    }

    const confidence = Math.max(0, Math.min(1, parseFloat(data.confidence) || 0.8));

    return {
      companyName,
      eventType: eventType as EventType,
      impactStrength: impact,
      functionFocus: functions,
      affectedCount: affected,
      confidence,
      summary: (data.summary || "").slice(0, 500),
      headline: newsItem.headline,
      sourceUrl: newsItem.url,
      publishedAt: newsItem.publishedAt,
    };
  } catch (error) {
    console.error("[EventClassifier] Parse error:", error);
    return null;
  }
}

/**
 * Rule-based fallback kun OpenAI ei käytössä
 */
function ruleBasedClassify(newsItem: RawNewsItem): ClassifiedEvent | null {
  const text = `${newsItem.headline} ${newsItem.summary}`.toLowerCase();
  
  // Extract company name (simple heuristic)
  const companyName = extractCompanyName(newsItem.headline);
  if (!companyName) return null;

  let eventType: EventType = "other";
  let impact = 3;
  let functions = ["other"];

  // Detect YT
  if (["yt-neuvo", "irtisano", "lomautta", "vähent"].some(kw => text.includes(kw))) {
    eventType = "yt_layoff";
    impact = 4;
    functions = ["hr", "management"];
  }
  // Detect funding
  else if (["rahoitus", "sijoitus", "miljoonaa euroa"].some(kw => text.includes(kw))) {
    eventType = "funding";
    impact = 3;
    functions = ["management", "finance"];
  }
  // Detect acquisition
  else if (["ostaa", "hankkii", "yrityskauppa"].some(kw => text.includes(kw))) {
    eventType = "acquisition";
    impact = 4;
    functions = ["management"];
  }
  // Detect leadership change
  else if (["toimitusjohtaja", "nimitetty", "nimitys"].some(kw => text.includes(kw))) {
    eventType = "leadership_change";
    impact = 3;
    functions = ["management"];
  }
  // Detect expansion
  else if (["rekrytoi", "palkkaa", "avaa", "laajenta"].some(kw => text.includes(kw))) {
    eventType = "expansion";
    impact = 2;
    functions = ["hr"];
  }

  return {
    companyName,
    eventType,
    impactStrength: impact,
    functionFocus: functions,
    affectedCount: null,
    confidence: 0.6,
    summary: newsItem.summary.slice(0, 200),
    headline: newsItem.headline,
    sourceUrl: newsItem.url,
    publishedAt: newsItem.publishedAt,
  };
}

function extractCompanyName(headline: string): string | null {
  const stopwords = new Set([
    "suomi", "suomen", "helsinki", "tampere", "turku", "oulu",
    "uusi", "uudet", "tänään", "ensi", "viime", "yle", "hs",
    "euro", "euroa", "miljoonaa", "miljardia", "prosenttia"
  ]);

  const words = headline.split(/\s+/);
  const candidates: string[] = [];

  for (const word of words) {
    const clean = word.replace(/[,:;.!?()[\]"']/g, "");
    if (clean.length < 2) continue;
    if (clean[0] === clean[0].toUpperCase() && !stopwords.has(clean.toLowerCase())) {
      candidates.push(clean);
    }
  }

  return candidates[0] || null;
}
