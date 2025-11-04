/**
 * 🗺️ Dareloom.fun — Unified Sitemap + Robots.txt + SEO Meta + IndexNow (Movies + SEO)
 * ✅ Cloudflare / Vercel / Node-ready
 * ⚡ Final Optimized Version — by Namo & GPT-5
 */

import fs from "fs";
import fetch from "node-fetch";
import path from "path";
import zlib from "zlib";
import { fileURLToPath } from "url";

// ========== CONFIG ==========
const BASE_URL = "https://dareloom.fun";
const API_KEY = process.env.SHEET_KEY || "";
const INDEXNOW_KEY = "c5b6124b5f8744fbb1a44a96266b9aa7";
const SHEET_URL = `https://sheets.googleapis.com/v4/spreadsheets/1A2I6jODnR99Hwy9ZJXPkGDtAFKfpYwrm3taCWZWoZ7o/values/Sheet2!A:T?alt=json&key=${API_KEY}`;

// ========== PATHS ==========
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = __dirname;

const FILES = {
  SITEMAP: path.join(ROOT, "sitemap.xml"),
  SITEMAP_GZ: path.join(ROOT, "sitemap.xml.gz"),
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

const parseRows = (values) => {
  if (!values || values.length < 2) return [];
  const rows = values.slice(1);
  const out = [];

  for (const r of rows) {
    const title = r[0] || "";
    const watch = r[6] || "";
    const date = r[19] || "";

    if (title && watch) {
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

const pingSearchEngines = async (urls) => {
  console.log("📡 Pinging Google, Bing & IndexNow...");
  try {
    await Promise.allSettled([
      fetch(`https://www.google.com/ping?sitemap=${BASE_URL}/sitemap.xml`),
      fetch(`https://www.bing.com/ping?sitemap=${BASE_URL}/sitemap.xml`),
      fetch("https://api.indexnow.org/indexnow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host: "dareloom.fun",
          key: INDEXNOW_KEY,
          keyLocation: `${BASE_URL}/indexnow-key.txt`,
          urlList: urls.slice(0, 100),
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

    const staticPages = [
      "/",
      "/watch.html",
      "/seo/main.html",
      "/seo/global.html",
      "/movies/",
    ];
    const seoCats = [
      "amateur", "anal", "asian", "bdsm", "big-tits", "cosplay", "creampie", "cumshot",
      "ebony", "gangbang", "global", "handjob", "interracial", "lesbian",
      "massage", "milf", "pov", "public", "rough-sex", "squirting",
      "step-fantasy", "teen", "threesome"
    ];

    const latestMod = formatDate(
      items.map((i) => new Date(i.date)).filter((d) => !isNaN(d)).sort((a, b) => b - a)[0] ||
        new Date()
    );

    // ========== SITEMAP.XML ==========
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

    for (const page of staticPages)
      xml += `  <url><loc>${BASE_URL}${page}</loc><lastmod>${latestMod}</lastmod><priority>1.0</priority></url>\n`;

    for (const cat of seoCats)
      xml += `  <url><loc>${BASE_URL}/seo/${cat}.html</loc><lastmod>${latestMod}</lastmod><priority>0.8</priority></url>\n`;

    for (const i of items)
      xml += `  <url><loc>${i.url}</loc><lastmod>${i.date}</lastmod><priority>0.7</priority></url>\n`;

    xml += `</urlset>`;
    fs.writeFileSync(FILES.SITEMAP, xml.trim());
    zlib.gzip(xml.trim(), (err, buf) => !err && fs.writeFileSync(FILES.SITEMAP_GZ, buf));
    console.log("✅ sitemap.xml + sitemap.xml.gz created");

    // ========== ROBOTS.TXT ==========
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

Sitemap: ${BASE_URL}/sitemap.xml
Sitemap: ${BASE_URL}/sitemap.xml.gz
`;
    fs.writeFileSync(FILES.ROBOTS, robotsTxt);
    console.log("✅ robots.txt generated");

    // ========== SEO META JSON ==========
    const meta = items.map((i) => ({
      title: i.title,
      url: i.url,
      description: `${i.title} — Watch full HD video on Dareloom.fun for free.`,
      keywords: i.title.split(" ").join(", "),
      lastModified: i.date,
    }));
    fs.writeFileSync(FILES.META, JSON.stringify(meta, null, 2));
    console.log("✅ seo-meta.json created");

    // ========== HEADERS & INDEXNOW ==========
    const headers = `/sitemap.xml
  Content-Type: application/xml; charset=utf-8
/sitemap.xml.gz
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

    await pingSearchEngines(items.map((i) => i.url));

    console.log("🎉 DONE — Sitemap + Robots + SEO + IndexNow fully generated!");
  } catch (err) {
    console.error("❌ ERROR:", err.message);
    fs.writeFileSync(
      FILES.SITEMAP,
      '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>'
    );
  }
}

generate();
