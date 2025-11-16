/**
 * 🗺️ Dareloom.fun — Unified Sitemap + Robots.txt + SEO Meta + IndexNow (Movies + SEO)
 * ✅ Cloudflare / Vercel / Node-ready
 * ⚡ Final Optimized Version
 * 🛠️ FIX: SITEMAP_URL changed to sitemap-index.xml for better structure and consistency.
 */

import fs from "fs";
import fetch from "node-fetch";
import path from "path";
import zlib from "zlib";
import { fileURLToPath } from "url";

// ========== CONFIG ==========
const BASE_URL = "https://dareloom.fun";
// API_KEY को environment variables से लोड करना security के लिए सबसे अच्छा है
const API_KEY = process.env.SHEET_KEY || ""; 
// IndexNow Key, robots.txt और indexnow-key.txt में उपयोग होता है
const INDEXNOW_KEY = "c5b6124b5f8744fbb1a44a96266b9aa7"; 
const SHEET_URL = `https://sheets.googleapis.com/v4/spreadsheets/1A2I6jODnR99Hwy9ZJXPkGDtAFKfpYwrm3taCWZWoZ7o/values/Sheet2!A:T?alt=json&key=${API_KEY}`;

// ========== PATHS ==========
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = __dirname;

const SITEMAP_MASTER_FILE = "sitemap-index.xml"; // नया मास्टर फ़ाइल नाम
const SITEMAP_GZIP_FILE = "sitemap-index.xml.gz"; // नया GZIP फ़ाइल नाम

const FILES = {
  SITEMAP: path.join(ROOT, SITEMAP_MASTER_FILE), // अब यह sitemap-index.xml है
  SITEMAP_GZ: path.join(ROOT, SITEMAP_GZIP_FILE), // अब यह sitemap-index.xml.gz है
  ROBOTS: path.join(ROOT, "robots.txt"),
  META: path.join(ROOT, "seo-meta.json"),
  HEADERS: path.join(ROOT, "_headers"),
  INDEXNOW: path.join(ROOT, "indexnow-key.txt"),
};

// ========== HELPERS ==========
const slugify = (t) =>
  t
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const formatDate = (d) => {
  const date = new Date(d);
  return !isNaN(date)
    ? date.toISOString().split("T")[0]
    : new Date().toISOString().split("T")[0];
};

/**
 * Google Sheet Rows को URL Objects में बदलता है
 * @param {Array<Array<string>>} values - Google Sheet data
 * @returns {Array<{url: string, title: string, date: string}>}
 */
const parseRows = (values) => {
  if (!values || values.length < 2) return [];
  const rows = values.slice(1);
  const out = [];

  for (const r of rows) {
    const title = r[0] || "";
    const watch = r[6] || ""; // Assuming 'watch' link is in column G (index 6)
    const date = r[19] || ""; // Assuming Last Modified Date is in column T (index 19)

    if (title && watch) {
      // Slugify and append unique ID for the movie URL structure
      const slug = slugify(title);
      const id = Buffer.from(watch)
        .toString("base64")
        .slice(0, 8)
        .replace(/[^a-zA-Z0-9]/g, "");
      out.push({
        url: `${BASE_URL}/movies/${slug}-${id}`,
        title,
        date: formatDate(date),
      });
    }
  }
  return out;
};

/**
 * Sitemap जनरेट होने के बाद Google, Bing, और IndexNow को पिंग करता है
 * @param {Array<string>} urls - नई/अपडेटेड URLs की लिस्ट
 */
const pingSearchEngines = async (urls) => {
  console.log(`📡 Pinging Google, Bing & IndexNow with ${SITEMAP_MASTER_FILE}...`);
  try {
    await Promise.allSettled([
      // Google Ping को अब sitemap-index.xml पर भेजें
      fetch(`https://www.google.com/ping?sitemap=${BASE_URL}/${SITEMAP_MASTER_FILE}`),
      // Bing Ping को अब sitemap-index.xml पर भेजें
      fetch(`https://www.bing.com/ping?sitemap=${BASE_URL}/${SITEMAP_MASTER_FILE}`),
      // IndexNow API Call (Critical for instant indexing)
      fetch("https://api.indexnow.org/indexnow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host: "dareloom.fun",
          key: INDEXNOW_KEY,
          keyLocation: `${BASE_URL}/indexnow-key.txt`,
          urlList: urls.slice(0, 100), // IndexNow only accepts max 100 URLs per submission
        }),
      }),
    ]);
    console.log("✅ Pings sent successfully!");
  } catch (err) {
    console.error("⚠️ Ping failed:", err.message);
  }
};

// ========== MAIN ==========
async function generate() {
  console.log("⚙️ Generating Dareloom SEO Sitemap...");

  try {
    const res = await fetch(SHEET_URL);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const json = await res.json();
    const items = parseRows(json.values);
    console.log(`✅ Loaded ${items.length} movies from Google Sheets`);

    // Statically defined crucial pages (Highest Priority)
    const staticPages = [
      "/",              // Homepage
      "/watch.html",    // Main Watch Hub
      "/seo/main.html", // SEO Main Hub
      "/seo/global.html",
      "/movies/",       // Main Movies Index
    ];
    
    // Category pages (Medium Priority)
    const seoCats = [
      "amateur", "anal", "asian", "bdsm", "big-tits", "cosplay", "creampie", "cumshot",
      "ebony", "gangbang", "global", "handjob", "interracial", "lesbian",
      "massage", "milf", "pov", "public", "rough-sex", "squirting",
      "step-fantasy", "teen", "threesome"
    ];

    // Find the latest modification date across all movies for static page 'lastmod'
    const latestMod = formatDate(
      items.map((i) => new Date(i.date)).filter((d) => !isNaN(d)).sort((a, b) => b - a)[0] ||
        new Date()
    );

    // ========== SITEMAP (sitemap-index.xml) GENERATION ==========
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

    // 1. Static Pages (Priority 1.0)
    for (const page of staticPages)
      xml += `  <url><loc>${BASE_URL}${page}</loc><lastmod>${latestMod}</lastmod><priority>1.0</priority><changefreq>daily</changefreq></url>\n`;
      
    // 2. SEO Category Pages (Priority 0.8)
    for (const cat of seoCats)
      xml += `  <url><loc>${BASE_URL}/seo/${cat}.html</loc><lastmod>${latestMod}</lastmod><priority>0.8</priority><changefreq>weekly</changefreq></url>\n`;

    // 3. Movie Pages (Priority 0.7)
    for (const i of items)
      xml += `  <url><loc>${i.url}</loc><lastmod>${i.date}</lastmod><priority>0.7</priority><changefreq>weekly</changefreq></url>\n`;

    xml += `</urlset>`;
    
    // फ़ाइल नाम बदला गया: sitemap.xml -> sitemap-index.xml
    fs.writeFileSync(FILES.SITEMAP, xml.trim()); 
    
    // Gzipped version
    zlib.gzip(xml.trim(), (err, buf) => !err && fs.writeFileSync(FILES.SITEMAP_GZ, buf));
    console.log(`✅ ${SITEMAP_MASTER_FILE} + ${SITEMAP_GZIP_FILE} created`);

    // ========== ROBOTS.TXT GENERATION (Template updated to use sitemap-index.xml) ==========
    const robotsTxt = `# 🤖 Dareloom Robots.txt — SEO & Secure Crawling
User-agent: GPTBot
Disallow: /
User-agent: ClaudeBot
Disallow: /
User-agent: PerplexityBot
Disallow: /
User-agent: OmgiliBot
Disallow: /
User-agent: ChatGPT
Disallow: /

User-agent: Googlebot
Allow: /
Disallow: /admin/
Disallow: /private/

User-agent: Bingbot
Allow: /

User-agent: *
Disallow: /admin/
Disallow: /api/
Disallow: /private/
Disallow: /temp/
Disallow: /*?*utm_*
Allow: /

Crawl-delay: 5

Sitemap: ${BASE_URL}/${SITEMAP_MASTER_FILE}
Sitemap: ${BASE_URL}/${SITEMAP_GZIP_FILE}
`;
    fs.writeFileSync(FILES.ROBOTS, robotsTxt);
    console.log("✅ robots.txt generated");

    // ========== SEO META JSON (Optional but useful for frontend) ==========
    const meta = items.map((i) => ({
      title: i.title,
      url: i.url,
      description: `${i.title} — Watch full HD video on Dareloom.fun for free.`,
      keywords: i.title.split(" ").join(", "),
      lastModified: i.date,
    }));
    fs.writeFileSync(FILES.META, JSON.stringify(meta, null, 2));
    console.log("✅ seo-meta.json created");

    // ========== HEADERS & INDEXNOW KEY (Header updated to use sitemap-index.xml) ==========
    const headers = `/${SITEMAP_MASTER_FILE}
  Content-Type: application/xml; charset=utf-8
/${SITEMAP_GZIP_FILE}
  Content-Type: application/gzip
/robots.txt
  Content-Type: text/plain; charset=utf-8
/seo-meta.json
  Content-Type: application/json; charset=utf-8
/indexnow-key.txt
  Content-Type: text/plain; charset=utf-8
`;
    fs.writeFileSync(FILES.HEADERS, headers);
    fs.writeFileSync(FILES.INDEXNOW, INDEXNOW_KEY);
    console.log("✅ _headers & indexnow key saved");

    // Ping search engines with up to 100 movie URLs
    await pingSearchEngines(items.map((i) => i.url));

    console.log("🎉 DONE — Sitemap + Robots + SEO + IndexNow fully generated!");
  } catch (err) {
    console.error("❌ ERROR:", err.message);
    // On failure, write an empty sitemap to prevent errors in GSC
    fs.writeFileSync(
      FILES.SITEMAP,
      '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>'
    );
  }
}

generate();
