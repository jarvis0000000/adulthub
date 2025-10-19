/**
 * 🗺️ Dareloom.fun — Unified Sitemap + Robots.txt + SEO Meta + IndexNow
 * Author: Namo ⚡ Updated with Movies Integration
 */

import fs from "fs";
import fetch from "node-fetch";
import path from "path";
import zlib from "zlib";
import { fileURLToPath } from "url";
import { promisify } from "util";
const gzip = promisify(zlib.gzip);

// --- CONFIG ---
const BASE_URL = "https://dareloom.fun";
const API_KEY = process.env.SHEET_KEY || "";
const INDEXNOW_KEY = "c5b6124b5f8744fbb1a44a96266b9aa7";
const SHEET_URL = `https://sheets.googleapis.com/v4/spreadsheets/YOUR_SHEET_ID/values/Sheet2!A:T?alt=json&key=${API_KEY}`;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = __dirname;

const SITEMAP_PATH = path.join(ROOT_DIR, "sitemap.xml");
const SITEMAP_GZ_PATH = path.join(ROOT_DIR, "sitemap.xml.gz");
const ROBOTS_PATH = path.join(ROOT_DIR, "robots.txt");
const HEADERS_PATH = path.join(ROOT_DIR, "_headers");
const META_PATH = path.join(ROOT_DIR, "seo-meta.json");
const INDEXNOW_FILE = path.join(ROOT_DIR, "indexnow-key.txt");

// --- HELPERS ---
function slugify(text) {
  return text.toString().toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function formatDate(date) {
  if (date instanceof Date && !isNaN(date)) return date.toISOString().split("T")[0];
  return new Date().toISOString().split("T")[0];
}

function parseRows(values) {
  if (!values || values.length < 2) return [];
  return values.slice(1).map(r => {
    const title = r[0] || "";
    const watch = r[6] || "";
    const dateStr = r[19] || "";

    if (!title || !watch) return null;
    const slug = slugify(title);
    const uniqueId = Buffer.from(watch).toString("base64").slice(0, 8).replace(/[^a-zA-Z0-9]/g, "") || "0000";
    const url = `${BASE_URL}/movies/${slug}-${uniqueId}`;
    return { url, title, date: dateStr || formatDate(new Date()) };
  }).filter(Boolean);
}

async function pingSearchEngines(urls) {
  try {
    console.log("📡 Sending PINGs to Google, Bing & IndexNow...");
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
          urlList: urls.slice(0, 100)
        })
      })
    ]);
    console.log("✅ Search engine pings done!");
  } catch (err) {
    console.error("⚠️ Ping failed:", err.message);
  }
}

// --- MAIN ---
async function generate() {
  console.log("⚙️ Generating sitemap & SEO...");

  try {
    const res = await fetch(SHEET_URL);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const json = await res.json();
    const items = parseRows(json.values || []);
    console.log(`✅ ${items.length} movies parsed.`);

    const staticPages = ["/", "/watch.html", "/seo/main.html", "/seo/global.html", "/seo/categories.html", "/movies/"];
    const seoCategories = [
      "amateur","anal","asian","bdsm","big-tits","categories","cosplay","creampie","cumshot",
      "ebony","gangbang","global","handjob","interracial","lesbian","lingerie","main","massage",
      "milf","orgy","petite","pov","public","rough-sex","squirting","step-fantasy","teen","threesome"
    ];

    const latestMod = formatDate(
      items.map(i => new Date(i.date)).filter(d => !isNaN(d)).sort((a,b)=>b-a)[0] || new Date()
    );

    // --- XML Sitemap ---
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

    staticPages.forEach(page => {
      xml += `  <url><loc>${BASE_URL}${page}</loc><lastmod>${latestMod}</lastmod><priority>1.0</priority></url>\n`;
    });
    seoCategories.forEach(cat => {
      xml += `  <url><loc>${BASE_URL}/seo/${cat}.html</loc><lastmod>${latestMod}</lastmod><priority>0.8</priority></url>\n`;
    });
    items.forEach(item => {
      xml += `  <url><loc>${item.url}</loc><lastmod>${formatDate(new Date(item.date))}</lastmod><priority>0.7</priority></url>\n`;
    });
    xml += "</urlset>";

    fs.writeFileSync(SITEMAP_PATH, xml.trim());
    await gzip(xml.trim()).then(buf => fs.writeFileSync(SITEMAP_GZ_PATH, buf));
    console.log("✅ sitemap.xml + sitemap.xml.gz generated");

    // --- Robots.txt ---
    const robots = `# Dareloom Hub Robots\n
User-agent: GPTBot
Disallow: /
User-agent: ClaudeBot
Disallow: /
User-agent: *
Allow: /
Sitemap: ${BASE_URL}/sitemap.xml
Sitemap: ${BASE_URL}/sitemap.xml.gz
`;
    fs.writeFileSync(ROBOTS_PATH, robots);
    console.log("✅ robots.txt created");

    // --- SEO Meta ---
    const metaData = items.map(item => ({
      title: item.title,
      url: item.url,
      description: `${item.title} — Watch full HD movie on Dareloom.fun for free.`,
      keywords: item.title.split(" ").join(", "),
      lastModified: item.date || latestMod
    }));
    fs.writeFileSync(META_PATH, JSON.stringify(metaData,null,2));
    console.log("✅ seo-meta.json created");

    // --- Headers & IndexNow ---
    const headers = `/sitemap.xml
  Content-Type: application/xml; charset=utf-8
/robots.txt
  Content-Type: text/plain; charset=utf-8
/seo-meta.json
  Content-Type: application/json; charset=utf-8
/indexnow-key.txt
  Content-Type: text/plain; charset=utf-8
`;
    fs.writeFileSync(HEADERS_PATH, headers);
    fs.writeFileSync(INDEXNOW_FILE, INDEXNOW_KEY);
    console.log("✅ _headers + indexnow-key.txt created");

    // --- Ping Search Engines ---
    await pingSearchEngines(items.map(i => i.url));

    console.log("🎉 SEO + Sitemap generation done!");
  } catch(err) {
    console.error("❌ Error:", err.message);
    fs.writeFileSync(SITEMAP_PATH, '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>');
  }
}

generate();
