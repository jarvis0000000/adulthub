/**
 * 🗺️ Dareloom.fun — Ultimate Sitemap + Robots.txt + SEO Meta JSON Generator
 * ✅ Compatible with Cloudflare Pages + GitHub repo (no public folder)
 * Author: Namo ⚡️
 */

const fs = require("fs");
const fetch = require("node-fetch");
const path = require("path");
const zlib = require("zlib");

// --- CONFIG ---
const BASE_URL = "https://dareloom.fun";
const API_KEY = process.env.SHEET_KEY || "";
const SHEET_URL = `https://sheets.googleapis.com/v4/spreadsheets/1A2I6jODnR99Hwy9ZJXPkGDtAFKfpYwrm3taCWZWoZ7o/values/Sheet1!A:T?alt=json&key=${API_KEY}`;

const ROOT_DIR = path.join(__dirname);
const SITEMAP_PATH = path.join(ROOT_DIR, "sitemap.xml");
const SITEMAP_GZ_PATH = path.join(ROOT_DIR, "sitemap.xml.gz");
const ROBOTS_PATH = path.join(ROOT_DIR, "robots.txt");
const HEADERS_PATH = path.join(ROOT_DIR, "_headers");
const META_PATH = path.join(ROOT_DIR, "seo-meta.json");

// --- HELPERS ---
function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function formatDate(date) {
  if (date instanceof Date && !isNaN(date)) return date.toISOString().split("T")[0];
  return new Date().toISOString().split("T")[0];
}

function parseRows(values) {
  if (!values || values.length < 2) return [];
  const rows = values.slice(1);
  const out = [];

  for (let r of rows) {
    const title = r[0] || "";
    const watch = r[6] || "";
    const dateStr = r[19] || "";

    if (title && watch) {
      const slug = slugify(title);
      const uniqueId = Buffer.from(watch).toString("base64").slice(0, 8).replace(/[^a-zA-Z0-9]/g, "");
      const url = `${BASE_URL}/video/${slug}-${uniqueId}`;
      out.push({ url, title, date: dateStr });
    }
  }

  return out;
}

// --- MAIN FUNCTION ---
async function generate() {
  console.log("⚙️ Generating Dareloom SEO assets...");

  try {
    // --- Fetch Google Sheet Data ---
    const res = await fetch(SHEET_URL);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const json = await res.json();
    const items = parseRows(json.values);
    console.log(`✅ Parsed ${items.length} entries from Google Sheets.`);

    // --- Static Pages ---
    const staticPages = ["/", "/watch.html", "/seo/main.html", "/seo/global.html", "/seo/categories.html"];

    // --- SEO Category Pages (from seo folder) ---
    const seoCategories = [
      "amateur", "anal", "asian", "bdsm", "big-tits", "categories", "cosplay", "creampie",
      "cumshot", "ebony", "gangbang", "global", "handjob", "interracial", "lesbian",
      "lingerie", "main", "massage", "milf", "orgy", "petite", "pov", "public", "rough-sex",
      "squirting", "step-fantasy", "teen", "threesome"
    ];

    const latestMod = formatDate(
      items
        .map(i => new Date(i.date))
        .filter(d => !isNaN(d))
        .sort((a, b) => b - a)[0] || new Date()
    );

    // --- Build XML Sitemap ---
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

    // Static pages
    for (const page of staticPages) {
      xml += `  <url><loc>${BASE_URL}${page}</loc><lastmod>${latestMod}</lastmod><priority>1.0</priority></url>\n`;
    }

    // SEO pages
    for (const cat of seoCategories) {
      xml += `  <url><loc>${BASE_URL}/seo/${cat}.html</loc><lastmod>${latestMod}</lastmod><priority>0.8</priority></url>\n`;
    }

    // Dynamic video URLs from Google Sheets
    for (const item of items) {
      xml += `  <url><loc>${item.url}</loc><lastmod>${formatDate(new Date(item.date))}</lastmod><priority>0.7</priority></url>\n`;
    }

    xml += `</urlset>`;
    fs.writeFileSync(SITEMAP_PATH, xml.trim());
    console.log(`✅ sitemap.xml created`);

    // --- Compress Sitemap ---
    zlib.gzip(xml.trim(), (err, buffer) => {
      if (!err) {
        fs.writeFileSync(SITEMAP_GZ_PATH, buffer);
        console.log("✅ sitemap.xml.gz created");
      }
    });

    // --- Robots.txt ---
    const robots = `# 🤖 Robots.txt — Dareloom.fun (Auto-generated)
User-agent: *
Allow: /

Disallow: /_next/
Disallow: /api/
Disallow: /node_modules/
Disallow: /private/
Disallow: /temp/
Disallow: /static/
Disallow: /sw.js

Crawl-delay: 5

Sitemap: ${BASE_URL}/sitemap.xml
Sitemap: ${BASE_URL}/sitemap.xml.gz
`;
    fs.writeFileSync(ROBOTS_PATH, robots);
    console.log("✅ robots.txt created");

    // --- SEO Meta JSON ---
    const metaData = items.map(item => ({
      title: item.title,
      url: item.url,
      description: `${item.title} — Watch now on Dareloom.fun in full HD.`,
      keywords: item.title.split(" ").join(", "),
      lastModified: item.date || latestMod,
    }));
    fs.writeFileSync(META_PATH, JSON.stringify(metaData, null, 2));
    console.log("✅ seo-meta.json created");

    // --- Cloudflare Headers ---
    const headers = `/sitemap.xml
  Content-Type: application/xml; charset=utf-8
/sitemap.xml.gz
  Content-Type: application/gzip
/robots.txt
  Content-Type: text/plain; charset=utf-8
/seo-meta.json
  Content-Type: application/json; charset=utf-8
`;
    fs.writeFileSync(HEADERS_PATH, headers);
    console.log("✅ _headers created");

    // --- Ping Google & Bing ---
    await Promise.all([
      fetch(`https://www.google.com/ping?sitemap=${BASE_URL}/sitemap.xml`),
      fetch(`https://www.bing.com/ping?sitemap=${BASE_URL}/sitemap.xml`),
    ]);
    console.log("📡 Pinged Google & Bing — sitemap updated!");

    console.log("🎉 All SEO assets generated successfully in ROOT folder!");
  } catch (err) {
    console.error("❌ Error:", err.message);
    fs.writeFileSync(
      SITEMAP_PATH,
      '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>'
    );
  }
}

generate();
