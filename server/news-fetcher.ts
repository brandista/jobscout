/**
 * News Fetcher - hakee YT-uutiset ja muut bisnesuutiset
 */

export interface RawNewsItem {
  headline: string;
  summary: string;
  url: string;
  source: string;
  publishedAt: Date;
  rawText?: string;
}

// Hakusanat
const YT_KEYWORDS = [
  "yt-neuvottelu", "yt-neuvottelut", "yhteistoimintaneuvottelu",
  "irtisano", "irtisanominen", "lomauttaa", "lomautus",
  "henkilöstövähennys", "vähentää työpaikkoja", "supistaa",
  "saneeraus", "säästöohjelma"
];

const GROWTH_KEYWORDS = [
  "rahoituskierros", "sijoitus", "investointi", "kasvurahoitus",
  "listautuminen", "ipo", "yrityskauppa", "ostaa", "hankkii",
  "laajentaa", "avaa uuden", "perustaa", "kasvattaa", "rekrytoi",
  "palkkaa", "uusi toimitusjohtaja", "nimitetty", "nimitys"
];

/**
 * Hae bisnesuutiset RSS-syötteistä
 */
export async function fetchNews(daysBack: number = 14): Promise<RawNewsItem[]> {
  const allNews: RawNewsItem[] = [];
  const cutoffDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

  // Yle RSS (yleinen uutissyöte)
  try {
    const yucNews = await fetchRssFeed(
      "https://feeds.yle.fi/uutiset/v1/recent.rss?publisherIds=YLE_UUTISET",
      "yle"
    );
    allNews.push(...yucNews.filter(n => n.publishedAt >= cutoffDate));
  } catch (error) {
    console.error("[NewsFetcher] Yle RSS error:", error);
  }

  // Suodata vain relevantit uutiset
  const relevantNews = allNews.filter(item => isRelevantNews(item));
  console.log(`[NewsFetcher] Found ${relevantNews.length} relevant news out of ${allNews.length}`);

  return relevantNews;
}

/**
 * Hae YT-uutiset
 */
export async function fetchYtNews(daysBack: number = 14): Promise<RawNewsItem[]> {
  const allNews = await fetchNews(daysBack);
  return allNews.filter(isYtNews);
}

/**
 * Hae kasvuuutiset
 */
export async function fetchGrowthNews(daysBack: number = 14): Promise<RawNewsItem[]> {
  const allNews = await fetchNews(daysBack);
  return allNews.filter(isGrowthNews);
}

/**
 * Parsii RSS-syötteen
 */
async function fetchRssFeed(feedUrl: string, sourceName: string): Promise<RawNewsItem[]> {
  const news: RawNewsItem[] = [];

  try {
    const response = await fetch(feedUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; JobScoutBot/1.0)",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const text = await response.text();
    
    // Simple RSS parsing (item tags)
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    const titleRegex = /<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/;
    const descRegex = /<description><!\[CDATA\[(.*?)\]\]><\/description>|<description>(.*?)<\/description>/;
    const linkRegex = /<link>(.*?)<\/link>/;
    const pubDateRegex = /<pubDate>(.*?)<\/pubDate>/;

    let match;
    while ((match = itemRegex.exec(text)) !== null) {
      const itemXml = match[1];
      
      const titleMatch = itemXml.match(titleRegex);
      const descMatch = itemXml.match(descRegex);
      const linkMatch = itemXml.match(linkRegex);
      const pubDateMatch = itemXml.match(pubDateRegex);

      const title = titleMatch ? (titleMatch[1] || titleMatch[2] || "") : "";
      const description = descMatch ? (descMatch[1] || descMatch[2] || "") : "";
      const link = linkMatch ? linkMatch[1] : "";
      const pubDate = pubDateMatch ? pubDateMatch[1] : "";

      // Strip HTML from description
      const cleanDesc = description.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

      let publishedAt = new Date();
      if (pubDate) {
        try {
          publishedAt = new Date(pubDate);
        } catch {}
      }

      if (title) {
        news.push({
          headline: title,
          summary: cleanDesc.slice(0, 500),
          url: link,
          source: sourceName,
          publishedAt,
          rawText: `${title} ${cleanDesc}`,
        });
      }
    }
  } catch (error) {
    console.error(`[NewsFetcher] RSS fetch error (${feedUrl}):`, error);
  }

  return news;
}

function isRelevantNews(item: RawNewsItem): boolean {
  return isYtNews(item) || isGrowthNews(item);
}

function isYtNews(item: RawNewsItem): boolean {
  const text = `${item.headline} ${item.summary}`.toLowerCase();
  return YT_KEYWORDS.some(kw => text.includes(kw));
}

function isGrowthNews(item: RawNewsItem): boolean {
  const text = `${item.headline} ${item.summary}`.toLowerCase();
  return GROWTH_KEYWORDS.some(kw => text.includes(kw));
}

export { isYtNews, isGrowthNews };
