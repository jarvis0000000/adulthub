// fetch-trending.js
import fs from "fs";
import path from "path";
import fetch from "node-fetch";

const DATA_DIR = path.join(process.cwd(), "data");
const OUT_FILE = path.join(DATA_DIR, "trending-keywords.json");

// Optional API (replace with real source)
const TRENDING_URL = "https://api.example.com/adult-trending-keywords"; // placeholder

async function main() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

    let keywords = [
      "porn", "xxx", "sex", "full video", "HD scenes", "MILF", "teen",
      "lesbian", "anal", "cumshot", "gangbang", "ebony", "blowjob", "oral"
    ];

    // ✅ Try fetching from live API (if available)
    /*
    const res = await fetch(TRENDING_URL);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length) {
        keywords = data.map(k => k.trim()).filter(Boolean);
      }
    }
    */

    // ✅ Clean and sort
    keywords = [...new Set(keywords.map(k => k.toLowerCase().trim()))].sort();

    // ✅ Add timestamp for reference
    const output = {
      updatedAt: new Date().toISOString(),
      count: keywords.length,
      keywords,
    };

    fs.writeFileSync(OUT_FILE, JSON.stringify(output, null, 2), "utf8");
    console.log(`✅ Trending keywords updated (${keywords.length})`);
  } catch (err) {
    console.error("❌ Error fetching trending keywords:", err);
  }
}

main();
