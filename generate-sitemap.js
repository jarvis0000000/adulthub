// scripts/generate-sitemap.js
const fs = require("fs");
const fetch = require("node-fetch");
const path = require("path");

// Base URL of your website
const BASE_URL = "https://dareloom.fun";

// API Key (from GitHub Secret)
const API_KEY = process.env.SHEET_KEY;
if (!API_KEY) {
  console.error("❌ Error: SHEET_KEY environment variable is not set.");
  process.exit(1);
}

// Google Sheet API endpoint (replace spreadsheetId & range as per your sheet)
const SHEET_API = `https://sheets.googleapis.com/v4/spreadsheets/1A2I6jODnR99Hwy9ZJXPkGDtAFKfpYwrm3taCWZWoZ7o/values/Sheet1?alt=json&key=${API_KEY}`;

// Output folder (Cloudflare Pages default is "public")
const PUBLIC_DIR = path.join(__dirname, "..", "public");
const SITEMAP_PATH = path.join(PUBLIC_DIR, "sitemap.xml");
const HEADERS_PATH = path.join(PUBLIC_DIR, "_headers");

// Slugify helper
function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Parse rows from sheet
function parseRows(values) {
  if (!values || values.length < 2) return [];
  const rows = values.slice(1);
  const out = [];

  for (let r of rows) {
    const title = r[0] || "";
    const watch = r[6] || "";
    const date = r[19] || "";

    if (title.trim() && watch.trim()) {
      const slug = slugify(title) || "video";
      const uniqueId = Buffer.from(watch)
        .toString("base64")
        .slice(0, 8)
        .replace(/[^a-zA-Z0-9]/g, "");

      out.push({
        url: `${BASE_URL}/video/${slug}-${uniqueId}`,
        date: date || new Date().toISOString().split("T")[0],
      });
    }
  }
  return out;
}

// Generate sitemap
async function generateSitemap() {
  try {
    const res = await fetch(SHEET_API);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);

    const j = await res.json();
    const items = parseRows(j.values);

    if (!fs.existsSync(PUBLIC_DIR)) {
      fs.mkdirSync(PUBLIC_DIR, { recursive: true });
    }

    let latestMod = new Date().toISOString().split("T")[0];
    const validDates = items
      .map((i) => new Date(i.date))
      .filter((d) => !isNaN(d));
    if (validDates.length > 0) {
      validDates.sort((a, b) => b - a);
      latestMod = validDates[0].toISOString().split("T")[0];
    }

    // XML Build
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

    // Homepage
    xml += `  <url>\n`;
    xml += `    <loc>${BASE_URL}/</loc>\n`;
    xml += `    <lastmod>${latestMod}</lastmod>\n`;
    xml += `    <changefreq>daily</changefreq>\n`;
    xml += `    <priority>1.0</priority>\n`;
    xml += `  </url>\n`;

    // Video Pages
    items.forEach((item) => {
      const itemDate = new Date(item.date);
      const lastMod = !isNaN(itemDate)
        ? itemDate.toISOString().split("T")[0]
        : latestMod;

      xml += `  <url>\n`;
      xml += `    <loc>${item.url}</loc>\n`;
      xml += `    <lastmod>${lastMod}</lastmod>\n`;
      xml += `    <changefreq>weekly</changefreq>\n`;
      xml += `    <priority>0.8</priority>\n`;
      xml += `  </url>\n`;
    });

    xml += `</urlset>`;

    fs.writeFileSync(SITEMAP_PATH, xml, "utf8");
    console.log(`✅ Sitemap created at ${SITEMAP_PATH}`);

    // Create _headers for correct content-type
    const headersContent = `/sitemap.xml\n  Content-Type: application/xml; charset=utf-8\n`;
    fs.writeFileSync(HEADERS_PATH, headersContent, "utf8");
    console.log(`✅ _headers file created at ${HEADERS_PATH}`);
  } catch (e) {
    console.error("❌ Sitemap generation failed:", e.message);
    process.exit(1);
  }
}

generateSitemap();
