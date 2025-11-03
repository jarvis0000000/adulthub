// auto-traffic-booster.mjs
// Fetch trending keywords from Google Trends and generate suggestion rows
// Output: ./data/suggested-trending.csv and ./data/suggested-trending.json
// NOTE: This script reads public trends (no OAuth). To automatically write to Google Sheets you need OAuth/service-account - instructions below.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import googleTrends from "google-trends-api";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUT_DIR = path.join(process.cwd(), "data");
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const COUNTRY = process.env.TRENDS_COUNTRY || "IN"; // change to your target e.g. "US","IN","GB"
const MAX_KEYWORDS = parseInt(process.env.TRENDS_MAX || "25", 10);

// Helper: slug (simple)
function slugify(s = "") {
  return String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

// Convert a trend label -> sheet row object
function toRowObj(keyword) {
  // A: Title, C: Trailer, G: Watch, R: Thumbnail, T: Date, U: Category
  // We create a basic title that includes a trigger phrase to improve search match.
  const title = `${keyword} — full video`;
  const trailer = ""; // left blank for manual / downstream pipeline
  const watch = "";   // left blank
  const thumb = "";   // left blank
  const date = todayISO();
  const category = "adult"; // default category; you can map common keywords to nicer categories
  return { A: title, C: trailer, G: watch, R: thumb, T: date, U: category };
}

// Build CSV from rows
function rowsToCsv(rows) {
  // header row with columns names (A..U style)
  const header = ["A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U"];
  // We'll only populate A,C,G,R,T,U — others empty
  const lines = [header.join(",")];
  for (const r of rows) {
    const rowArray = header.map(col => {
      if (col === "A") return `"${(r.A||"").replace(/"/g,'""')}"`;
      if (col === "C") return `"${(r.C||"").replace(/"/g,'""')}"`;
      if (col === "G") return `"${(r.G||"").replace(/"/g,'""')}"`;
      if (col === "R") return `"${(r.R||"").replace(/"/g,'""')}"`;
      if (col === "T") return `"${(r.T||"").replace(/"/g,'""')}"`;
      if (col === "U") return `"${(r.U||"").replace(/"/g,'""')}"`;
      return `""`;
    });
    lines.push(rowArray.join(","));
  }
  return lines.join("\n");
}

// Primary function: fetch daily trending searches for a country
async function fetchTrending(country = COUNTRY, max = MAX_KEYWORDS) {
  console.log(`📈 Fetching top ${max} trending keywords for country: ${country} ...`);
  try {
    // google-trends-api: use dailyTrends with geo
    const res = await googleTrends.dailyTrends({ geo: country, hl: "en-US" , tz: 0 });
    const json = JSON.parse(res);

    // Traversal depends on API structure
    // dailyTrends contains timelineTrends[0].trendingSearchesDays array — each day object contains trendingSearches
    const days = (json.default && json.default.trendingSearchesDays) || [];
    if (!days.length) {
      console.warn("⚠️ No dailyTrends returned — fallback to top trending queries (if available)");
    }
    const keywords = [];
    for (const day of days) {
      const searches = day.trendingSearches || [];
      for (const s of searches) {
        const title = s.title && (s.title.query || s.title.title) || s.title || s;
        if (title && !keywords.includes(title)) keywords.push(title);
        if (keywords.length >= max) break;
      }
      if (keywords.length >= max) break;
    }

    // Fallback: if empty, try related topics
    if (keywords.length === 0 && json.default && json.default.rankedList && json.default.rankedList.length) {
      for (const list of json.default.rankedList) {
        for (const item of list.rankedKeyword) {
          if (item && item.topic && item.topic.title && !keywords.includes(item.topic.title)) {
            keywords.push(item.topic.title);
            if (keywords.length >= max) break;
          }
        }
        if (keywords.length >= max) break;
      }
    }

    return keywords.slice(0, max);
  } catch (err) {
    console.error("❌ google-trends fetch error:", err.message || err);
    return [];
  }
}

async function main() {
  const keywords = await fetchTrending(COUNTRY, MAX_KEYWORDS);
  if (!keywords.length) {
    console.warn("⚠️ No trending keywords found. Exiting.");
    process.exit(0);
  }

  // convert to rows
  const rows = keywords.map(k => toRowObj(k));

  // Write JSON
  const jsonPath = path.join(OUT_DIR, "suggested-trending.json");
  fs.writeFileSync(jsonPath, JSON.stringify({ generated: new Date().toISOString(), country: COUNTRY, rows, source: "google-trends" }, null, 2), "utf8");
  console.log("✅ Wrote", jsonPath);

  // Write CSV
  const csvPath = path.join(OUT_DIR, "suggested-trending.csv");
  fs.writeFileSync(csvPath, rowsToCsv(rows), "utf8");
  console.log("✅ Wrote", csvPath);

  // Also write a plain keyword list
  const kwPath = path.join(OUT_DIR, "suggested-trending-keywords.txt");
  fs.writeFileSync(kwPath, keywords.join("\n"), "utf8");
  console.log("✅ Wrote", kwPath);

  console.log(`🎯 Done. Inspect ${csvPath} and ${jsonPath}. To push these into your Google Sheet you need OAuth/service-account — instructions below.`);
  process.exit(0);
}

main();
