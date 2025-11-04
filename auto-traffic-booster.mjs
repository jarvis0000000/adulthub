// auto-traffic-booster.mjs
// Fetch trending keywords from Google Trends and generate suggestion rows
// Output: ./data/suggested-trending.{csv,json,txt}
// Works even if google-trends-api partially fails — includes fallbacks and safe JSON parsing.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import googleTrends from "google-trends-api";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUT_DIR = path.join(process.cwd(), "data");
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const COUNTRY = process.env.TRENDS_COUNTRY || "IN"; // default: India
const MAX_KEYWORDS = parseInt(process.env.TRENDS_MAX || "25", 10);

// Helper: date ISO
function todayISO() {
  return new Date().toISOString().split("T")[0];
}

// Convert keyword → sheet row object
function toRowObj(keyword) {
  const title = `${keyword} — full video`;
  const trailer = "";
  const watch = "";
  const thumb = "";
  const date = todayISO();
  const category = "adult";
  return { A: title, C: trailer, G: watch, R: thumb, T: date, U: category };
}

// Build CSV from rows
function rowsToCsv(rows) {
  const header = ["A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U"];
  const lines = [header.join(",")];
  for (const r of rows) {
    const arr = header.map((col) => {
      const val = r[col] || "";
      return `"${String(val).replace(/"/g, '""')}"`;
    });
    lines.push(arr.join(","));
  }
  return lines.join("\n");
}

// Safe fetch with HTML/JSON detection
async function safeFetch(fn, label) {
  try {
    console.log(`⏳ Fetching ${label}...`);
    const res = await fn();
    const str = String(res);
    if (str.startsWith("<!doctype")) throw new Error("HTML returned instead of JSON");
    return JSON.parse(str);
  } catch (err) {
    console.warn(`⚠️ ${label} failed:`, err.message);
    return null;
  }
}

// Primary: fetch daily + realtime + related fallbacks
async function fetchTrending(country = COUNTRY, max = MAX_KEYWORDS) {
  console.log(`📈 Fetching top ${max} trending keywords for country: ${country} ...`);
  let keywords = [];

  // 1️⃣ Daily Trends
  const daily = await safeFetch(() => googleTrends.dailyTrends({ geo: country, hl: "en-US", tz: 0 }), "dailyTrends");
  if (daily?.default?.trendingSearchesDays?.length) {
    for (const day of daily.default.trendingSearchesDays) {
      for (const s of day.trendingSearches || []) {
        const title = s.title?.query || s.title?.title || s.title;
        if (title && !keywords.includes(title)) keywords.push(title);
        if (keywords.length >= max) break;
      }
      if (keywords.length >= max) break;
    }
  }

  // 2️⃣ Realtime fallback
  if (keywords.length < max) {
    const real = await safeFetch(() => googleTrends.realTimeTrends({ geo: country, category: "all" }), "realTimeTrends");
    const stories = real?.storySummaries?.trendingStories || [];
    for (const story of stories) {
      const title = story.title || story.entityNames?.[0];
      if (title && !keywords.includes(title)) keywords.push(title);
      if (keywords.length >= max) break;
    }
  }

  // 3️⃣ Related Queries fallback
  if (keywords.length < max) {
    const related = await safeFetch(() => googleTrends.relatedQueries({ keyword: "movies", geo: country }), "relatedQueries");
    const ranked = related?.default?.rankedList?.[0]?.rankedKeyword || [];
    for (const r of ranked) {
      const title = r.query || r.topic?.title;
      if (title && !keywords.includes(title)) keywords.push(title);
      if (keywords.length >= max) break;
    }
  }

  // 4️⃣ Related Topics fallback
  if (keywords.length < max) {
    const topics = await safeFetch(() => googleTrends.relatedTopics({ keyword: "video", geo: country }), "relatedTopics");
    const ranked = topics?.default?.rankedList?.[0]?.rankedKeyword || [];
    for (const r of ranked) {
      const title = r.topic?.title || r.title;
      if (title && !keywords.includes(title)) keywords.push(title);
      if (keywords.length >= max) break;
    }
  }

  keywords = keywords.map(k => k.trim()).filter(Boolean).slice(0, max);
  if (!keywords.length) console.warn("⚠️ No trending keywords found from any source.");
  return keywords;
}

async function main() {
  const keywords = await fetchTrending(COUNTRY, MAX_KEYWORDS);
  if (!keywords.length) {
    console.warn("⚠️ No keywords generated. Exiting safely.");
    return;
  }

  const rows = keywords.map(toRowObj);

  // Write JSON
  const jsonPath = path.join(OUT_DIR, "suggested-trending.json");
  fs.writeFileSync(jsonPath, JSON.stringify({ generated: new Date().toISOString(), country: COUNTRY, rows, source: "google-trends" }, null, 2), "utf8");
  console.log("✅ Wrote", jsonPath);

  // Write CSV
  const csvPath = path.join(OUT_DIR, "suggested-trending.csv");
  fs.writeFileSync(csvPath, rowsToCsv(rows), "utf8");
  console.log("✅ Wrote", csvPath);

  // Write TXT (plain keywords)
  const kwPath = path.join(OUT_DIR, "suggested-trending-keywords.txt");
  fs.writeFileSync(kwPath, keywords.join("\n"), "utf8");
  console.log("✅ Wrote", kwPath);

  console.log(`🎯 Done. Inspect:
   • ${csvPath}
   • ${jsonPath}
   • ${kwPath}
To push these into your Google Sheet, connect a service account or OAuth credentials.`);
}

main().catch((err) => {
  console.error("💥 Fatal Error:", err);
});
