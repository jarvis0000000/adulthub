/**
 * 🗺️ Dareloom.fun Sitemap + Robots.txt Generator
 * Works with Google Sheets API + Cloudflare Pages
 */

const fs = require("fs");
const fetch = require("node-fetch");
const path = require("path");

// --- CONFIG ---
const BASE_URL = "https://dareloom.fun";
const API_KEY = process.env.SHEET_KEY || "";
const SHEET_URL = `https://sheets.googleapis.com/v4/spreadsheets/1A2I6jODnR99Hwy9ZJXPkGDtAFKfpYwrm3taCWZWoZ7o/values/Sheet1!A:T?alt=json&key=${API_KEY}`;
const PUBLIC_DIR = path.join(__dirname, "public");
const SITEMAP_PATH = path.join(PUBLIC_DIR, "sitemap.xml");
const ROBOTS_PATH = path.join(PUBLIC_DIR, "robots.txt");
const HEADERS_PATH = path.join(PUBLIC_DIR, "_headers");

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
      out.push({
        url: `${BASE_URL}/video/${slug}-${uniqueId}`,
        date: dateStr,
      });
    }
  }

  return out;
}

// --- MAIN FUNCTION ---
async function generate() {
  console.log("⚙️ Generating sitemap...");

  try {
    if (!fs.existsSync(PUBLIC_DIR)) fs.mkdirSync(PUBLIC_DIR, { recursive: true });

    if (!API_KEY) {
      console.warn("⚠️ SHEET_KEY not found — using fallback empty sitemap.");
    }

    const res = await fetch(SHEET_URL);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const json = await res.json();
    const items = parseRows(json.values);
    console.log(`✅ Parsed ${items.length} entries from Google Sheets.`);

    // Build XML
    const latestMod = formatDate(
      items
        .map(i => new Date(i.date))
        .filter(d => !isNaN(d))
        .sort((a, b) => b - a)[0] || new Date()
    );

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
    xml += `  <url><loc>${BASE_URL}/</loc><lastmod>${latestMod}</lastmod><priority>1.0</priority></url>\n`;
    for (const item of items) {
      xml += `  <url><loc>${item.url}</loc><lastmod>${formatDate(new Date(item.date))}</lastmod><priority>0.8</priority></url>\n`;
    }
    xml += `</urlset>`;

    fs.writeFileSync(SITEMAP_PATH, xml.trim());
    console.log(`✅ Sitemap written to ${SITEMAP_PATH}`);

    // Robots.txt
    const robots = `# Robots.txt generated automatically
User-agent: *
Allow: /

Disallow: /_next/
Disallow: /api/
Disallow: /static/
Disallow: /sw.js

Sitemap: ${BASE_URL}/sitemap.xml
`;
    fs.writeFileSync(ROBOTS_PATH, robots);
    console.log("✅ Robots.txt written.");

    // Cloudflare _headers
    const headers = `/sitemap.xml
  Content-Type: application/xml; charset=utf-8
/robots.txt
  Content-Type: text/plain; charset=utf-8
`;
    fs.writeFileSync(HEADERS_PATH, headers);
    console.log("✅ _headers written.");

    console.log("🎉 Sitemap + Robots.txt + Headers generation complete!");
  } catch (err) {
    console.error("❌ Error generating sitemap:", err.message);
    fs.writeFileSync(SITEMAP_PATH, '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>');
  }
}

generate();
