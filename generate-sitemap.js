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

// Google Sheet API endpoint (range updated to include Date column T=19)
const SHEET_API = `https://sheets.googleapis.com/v4/spreadsheets/1A2I6jODnR99Hwy9ZJXPkGDtAFKfpYwrm3taCWZWoZ7o/values/Sheet1!A:T?alt=json&key=${API_KEY}`;

// Output folder (Path fix: scripts se repo root ke public folder tak)
const PUBLIC_DIR = path.join(__dirname, "..", "public");
const SITEMAP_PATH = path.join(PUBLIC_DIR, "sitemap.xml");
const HEADERS_PATH = path.join(PUBLIC_DIR, "_headers");

// --- Helpers ---
function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function escapeXML(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatDate(date) {
    if (date instanceof Date && !isNaN(date)) {
        return date.toISOString().split("T")[0];
    }
    return new Date().toISOString().split("T")[0];
}

function parseRows(values) {
  if (!values || values.length < 2) return [];
  const rows = values.slice(1);
  const out = [];

  for (let r of rows) {
    // Columns: Title(A)=0, Watch(G)=6, Date(T)=19 (API call includes up to T)
    const title = r[0] || "";
    const watch = r[6] || "";
    const dateStr = r[19] || ""; // Date string from column T

    if (title.trim() && watch.trim()) {
      const slug = slugify(title) || "video";
      
      // Creating a simple unique ID from the Watch URL (Base64)
      const uniqueId = Buffer.from(watch)
        .toString("base64")
        .slice(0, 8)
        .replace(/[^a-zA-Z0-9]/g, "");

      // Construct the final URL (URL path should not be XML escaped)
      out.push({
        // URL path should not be XML escaped, only slug is used here
        url: `${BASE_URL}/video/${slug}-${uniqueId}`, 
        date: dateStr, // Keep as string for later processing
      });
    }
  }
  return out;
}

// Generate sitemap
async function generateSitemap() {
  console.log("🧩 Starting sitemap generation...");
  try {
    const res = await fetch(SHEET_API);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);

    const j = await res.json();
    const items = parseRows(j.values);
    console.log(`✅ Fetched and parsed ${items.length} video entries.`);


    if (!fs.existsSync(PUBLIC_DIR)) {
      fs.mkdirSync(PUBLIC_DIR, { recursive: true });
    }

    // Determine latest modification date for the homepage
    const validDates = items
      .map((i) => new Date(i.date))
      .filter((d) => !isNaN(d));
      
    validDates.push(new Date()); // Always include current time
    validDates.sort((a, b) => b - a);
    const latestMod = formatDate(validDates[0]);

    // 3. XML Build
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
      const lastMod = formatDate(itemDate);

      xml += `  <url>\n`;
      xml += `    <loc>${item.url}</loc>\n`;
      xml += `    <lastmod>${lastMod}</lastmod>\n`;
      xml += `    <changefreq>weekly</changefreq>\n`;
      xml += `    <priority>0.8</priority>\n`;
      xml += `  </url>\n`;
    });

    xml += `</urlset>\n`;

    // 4. Write sitemap.xml (Using Buffer for BOM-free file writing)
    const sitemapBuffer = Buffer.from(xml.trim(), 'utf8');
    fs.writeFileSync(SITEMAP_PATH, sitemapBuffer); 
    console.log(`✅ Sitemap created at ${SITEMAP_PATH} with ${items.length + 1} entries.`);

    // 5. Write _headers file
    const headersContent = `/sitemap.xml\n  Content-Type: application/xml; charset=utf-8\n/robots.txt\n  Content-Type: text/plain; charset=utf-8\n`;
    const headersBuffer = Buffer.from(headersContent, 'utf8');
    fs.writeFileSync(HEADERS_PATH, headersBuffer); 
    console.log(`✅ _headers file created at ${HEADERS_PATH}`);
    
  } catch (e) {
    console.error("❌ Sitemap generation failed:", e.message);
    
    // Fail-safe
    if (!fs.existsSync(PUBLIC_DIR)) {
        fs.mkdirSync(PUBLIC_DIR, { recursive: true });
    }
    const failSafeContent = '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>';
    const failSafeBuffer = Buffer.from(failSafeContent, 'utf8');
    fs.writeFileSync(SITEMAP_PATH, failSafeBuffer);
    
    process.exit(1);
  }
}

generateSitemap();
