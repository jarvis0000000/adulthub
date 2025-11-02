// sitemap-index.mjs
import fs from "fs";
import path from "path";

const BASE_URL = "https://dareloom.fun"; // ⚡ change if your domain changes
const OUT_FILE = path.join(process.cwd(), "sitemap-index.xml");

// All possible sitemap files
const sitemapFiles = [
  "sitemap.xml",
  "sitemap-actors.xml",
  "sitemap-videos.xml", // optional, for future
  "sitemap-categories.xml"
].filter(file => fs.existsSync(file));

if (sitemapFiles.length === 0) {
  console.error("❌ No sitemap files found to index.");
  process.exit(1);
}

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapFiles.map(file => {
  const stats = fs.statSync(file);
  const lastmod = stats.mtime.toISOString().split("T")[0];
  return `  <sitemap>
    <loc>${BASE_URL}/${file}</loc>
    <lastmod>${lastmod}</lastmod>
  </sitemap>`;
}).join("\n")}
</sitemapindex>`;

fs.writeFileSync(OUT_FILE, xml, "utf8");
console.log(`✅ sitemap-index.xml created (${sitemapFiles.length} sitemaps)`);
