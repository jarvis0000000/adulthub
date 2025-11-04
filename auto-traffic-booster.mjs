// auto-traffic-booster.mjs
// 🔥 Google Trends Auto Keyword Fetcher
// Fetches trending keywords and generates CSV/JSON/TXT under ./data/
// Works without OAuth. Use service-account if you want direct Google Sheets update.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import googleTrends from "google-trends-api";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUT_DIR = path.join(process.cwd(), "data");
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const COUNTRY = process.env.TRENDS_COUNTRY || "IN";
const MAX_KEYWORDS = parseInt(process.env.TRENDS_MAX || "25", 10);

function slugify(s = "") {
  return String(s)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

function toRowObj(keyword) {
  return {
    A: `${keyword} — full video`,
    C: "",
    G: "",
    R: "",
    T: todayISO(),
    U: "adult",
  };
}

function rowsToCsv(rows) {
  const header = [
    "A","B","C","D","E","F","G","H","I","J",
    "K","L","M","N","O","P","Q","R","S","T","U",
  ];
  const lines = [header.join(",")];
  for (const r of rows) {
    const rowArray = header.map((col) => {
      const val = r[col] || "";
      return `"${String(val).replace(/"/g, '""')}"`;
    });
    lines.push(rowArray.join(","));
  }
  return lines.join("\n");
}

// 🟢 Try multiple trend sources for max reliability
async function fetchTrending(country = COUNTRY, max = MAX_KEYWORDS) {
  console.log(`📈 Fetching top ${max} trending keywords for: ${country}...`);
  let keywords = [];

  try {
    const res = await googleTrends.dailyTrends({ geo: country, hl: "en-US", tz: 0 });
    const json = JSON.parse(res);
    const days = json.default?.trendingSearchesDays || [];

    for (const day of days) {
      const searches = day.trendingSearches || [];
      for (const s of searches) {
        const title = s.title?.query || s.title?.title || s.title || s;
        if (title && !keywords.includes(title)) keywords.push(title);
        if (keywords.length >= max) break;
      }
      if (keywords.length >= max) break;
    }
  } catch (err) {
    console.warn("⚠️ dailyTrends failed:", err.message);
  }

  // Fallback: realTimeTrends
  if (keywords.length === 0) {
    try {
      console.log("🔁 Trying realTimeTrends...");
      const res = await googleTrends.realTimeTrends({ geo: country, category: "all" });
      const json = JSON.parse(res);
      const stories = json.storySummaries?.trendingStories || [];
      for (const story of stories) {
        const title = story.title || story.entityNames?.[0];
        if (title && !keywords.includes(title)) keywords.push(title);
        if (keywords.length >= max) break;
      }
    } catch (err) {
      console.warn("⚠️ realTimeTrends failed:", err.message);
    }
  }

  // Fallback: relatedTopics (generic)
  if (keywords.length === 0) {
    try {
      console.log("🔁 Trying relatedTopics (fallback)...");
      const res = await googleTrends.relatedTopics({ keyword: "movie", geo: country, hl: "en-US" });
      const json = JSON.parse(res);
      const topics = json.default?.rankedList?.[0]?.rankedKeyword || [];
      for (const t of topics) {
        const title = t.topic?.title || t.title;
        if (title && !keywords.includes(title)) keywords.push(title);
        if (keywords.length >= max) break;
      }
    } catch (err) {
      console.warn("⚠️ relatedTopics fallback failed:", err.message);
    }
  }

  if (keywords.length === 0) {
    console.error("❌ No keywords fetched from any source.");
  }

  return keywords.slice(0, max);
}

async function main() {
  const keywords = await fetchTrending(COUNTRY, MAX_KEYWORDS);

  if (!keywords.length) {
    console.warn("⚠️ No keywords found — nothing to save.");
    process.exit(0);
  }

  const rows = keywords.map(toRowObj);

  const jsonPath = path.join(OUT_DIR, "suggested-trending.json");
  fs.writeFileSync(
    jsonPath,
    JSON.stringify(
      {
        generated: new Date().toISOString(),
        country: COUNTRY,
        count: keywords.length,
        source: "google-trends",
        rows,
      },
      null,
      2
    ),
    "utf8"
  );
  console.log("✅ Wrote JSON:", jsonPath);

  const csvPath = path.join(OUT_DIR, "suggested-trending.csv");
  fs.writeFileSync(csvPath, rowsToCsv(rows), "utf8");
  console.log("✅ Wrote CSV:", csvPath);

  const txtPath = path.join(OUT_DIR, "suggested-trending-keywords.txt");
  fs.writeFileSync(txtPath, keywords.join("\n"), "utf8");
  console.log("✅ Wrote TXT:", txtPath);

  console.log("🎯 Done — Data ready in /data folder!");
  process.exit(0);
}

main().catch((err) => {
  console.error("💥 Fatal Error:", err);
  process.exit(1);
});
