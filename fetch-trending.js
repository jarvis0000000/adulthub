// fetch-trending.js
import fs from "fs";
import path from "path";
import fetch from "node-fetch";

const OUT_FILE = path.join(process.cwd(), "data", "trending-keywords.json");

// Example: Using a public adult search trends API or placeholder
// (Replace with real API if you have one)
const TRENDING_URL = "https://api.example.com/adult-trending-keywords"; // placeholder

async function main() {
  try {
    // Placeholder: if no API, fallback to static popular adult keywords
    let keywords = [
      "porn", "xxx", "sex", "full video", "HD scenes", "MILF", "teen",
      "lesbian", "anal", "cumshot", "gangbang", "ebony", "blowjob", "oral"
    ];

    // Uncomment below to fetch real data from an API
    /*
    const res = await fetch(TRENDING_URL);
    if (res.ok) {
      const data = await res.json();
      // Assuming API returns array of strings
      keywords = Array.isArray(data) ? data : keywords;
    }
    */

    fs.writeFileSync(OUT_FILE, JSON.stringify(keywords, null, 2), "utf8");
    console.log(`✅ Trending keywords updated (${keywords.length})`);
  } catch (err) {
    console.error("Error fetching trending keywords:", err);
  }
}

main();
