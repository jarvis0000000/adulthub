// auto-sitemap-generator.mjs
// ===============================
// Dareloom.fun - Auto Sitemap Generator (for SEO)
// ===============================

import fs from "fs";
import path from "path";

const BASE_URL = "https://dareloom.fun"; // <-- apna domain yahan daalna
const ROOT_DIR = path.join(process.cwd(), "public"); // ya jahan tumhare .html pages hain
const OUT_FILE = path.join(ROOT_DIR, "sitemap.xml");

// Priority config based on folder type
const PRIORITY_RULES = {
  "/": 1.0,
  "/watch.html": 1.0,
  "/movies": 0.9,
  "/seo": 0.8,
};

// Utility: get today’s date in ISO format
function getToday() {
  return new Date().toISOString().split("T")[0];
}

// Recursive HTML file collector
function collectHTMLFiles(dir, files = []) {
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      collectHTMLFiles(fullPath, files);
    } else if (item.endsWith(".html")) {
      files.push(fullPath);
    }
  }
  return files;
}

// Main function
async function main() {
  console.log("🔍 Generating sitemap...");

  const htmlFiles = collectHTMLFiles(ROOT_DIR);
  const today = getToday();

  const urls = htmlFiles.map((filePath) => {
    const relativePath = filePath.replace(ROOT_DIR, "").replace(/\\/g, "/");
    const loc = `${BASE_URL}${relativePath}`;
    const priority =
      PRIORITY_RULES[relativePath] ||
      Object.entries(PRIORITY_RULES).find(([key]) => relativePath.startsWith(key))?.[1] ||
      0.8;
    return { loc, lastmod: today, priority };
  });

  // XML Build
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `
  <url>
    <loc>${u.loc}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <priority>${u.priority}</priority>
  </url>`
  )
  .join("")}
</urlset>`;

  fs.writeFileSync(OUT_FILE, xml.trim(), "utf8");
  console.log(`✅ Sitemap generated successfully (${urls.length} URLs) → ${OUT_FILE}`);
}

main().catch((err) => console.error("❌ Error:", err));
