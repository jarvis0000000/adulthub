// generate-actresses.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// ================================
// CONFIG
// ================================
const BASE_URL = "https://dareloom.fun";
const DATA_CSV = path.join(process.cwd(), "data", "actresses.csv");
const OUT_DIR = path.join(process.cwd(), "actors");
const SITEMAP_ACTORS = path.join(process.cwd(), "sitemap-actors.xml");
const SEO_META = path.join(process.cwd(), "seo-meta-actors.json");
const SITEMAP_INDEX = path.join(process.cwd(), "sitemap-index.xml");

// ================================
// HELPERS
// ================================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function slugify(text = "") {
  return text.toString().toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function formatDate(d) {
  if (!d) return (new Date()).toISOString().split("T")[0];
  try {
    const dd = new Date(d);
    if (isNaN(dd)) return (new Date()).toISOString().split("T")[0];
    return dd.toISOString().split("T")[0];
  } catch {
    return (new Date()).toISOString().split("T")[0];
  }
}

function parseCSV(csvText) {
  const lines = csvText.split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return [];
  const headers = lines.shift().split(",").map(h => h.trim());
  return lines.map(line => {
    const values = [];
    let cur = "", inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"' && line[i+1] === '"') { cur += '"'; i++; continue; }
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if (ch === ',' && !inQuotes) { values.push(cur); cur = ""; continue; }
      cur += ch;
    }
    values.push(cur);
    const obj = {};
    headers.forEach((h, idx) => obj[h] = (values[idx] ?? "").trim());
    return obj;
  });
}

// ================================
// AUTO SEO METADATA
// ================================
function autoMeta(actor) {
  const name = actor.name || actor.stage_name || "";
  const nationality = actor.nationality || "";
  const baseKeywords = ["porn", "xxx", "sex", "full video", "HD scenes", "trending", "clips"];
  
  // Auto title
  const title = `${name} — Full HD Videos & Scenes | Dareloom.fun`;

  // Auto meta description
  const description = `Watch ${name} full HD videos, trending xxx scenes, and exclusive clips online. Explore ${name}'s top performances on Dareloom.fun.`;

  // Auto keywords
  const keywords = [name, nationality, ...baseKeywords].join(", ");

  return { title, description, keywords };
}

// ================================
// HTML GENERATOR
// ================================
function actorPageHtml({ title, description, image, url, lastmod, keywords }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    "name": title,
    "url": url,
    "description": description,
  };
  if (image) jsonLd.image = image;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <meta name="keywords" content="${escapeHtml(keywords)}" />
  <link rel="canonical" href="${url}" />
  <meta name="robots" content="index, follow" />
  <meta property="og:type" content="profile" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  ${image ? `<meta property="og:image" content="${image}" />` : ""}
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
</head>
<body>
  <main>
    <h1>${escapeHtml(title)}</h1>
    ${image ? `<img src="${image}" alt="${escapeHtml(title)}" style="max-width:320px;"/>` : ""}
    <p>${escapeHtml(description)}</p>
    <p><small>Last updated: ${lastmod}</small></p>
  </main>
</body>
</html>`;
}

function escapeHtml(s = "") {
  return s.replace(/[&<>"']/g, (m) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"
  })[m]);
}

// ================================
// MAIN GENERATOR
// ================================
(async function main(){
  try {
    if (!fs.existsSync(DATA_CSV)) {
      console.error("Missing data file:", DATA_CSV);
      process.exit(1);
    }
    const csv = fs.readFileSync(DATA_CSV, "utf8");
    const rows = parseCSV(csv);

    if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

    const sitemapUrls = [];
    const metaArray = [];

    for (const r of rows) {
      const name = r.name || r.stage_name || "";
      if (!name) continue;

      const slugSource = r.stage_name || name;
      const slug = slugify(slugSource);
      const fileName = `${slug}.html`;
      const url = `${BASE_URL}/actors/${fileName}`;
      const lastmod = formatDate(r.lastmod);
      const image = r.profile_image_url || "";

      // Auto SEO metadata
      const { title, description, keywords } = autoMeta(r);

      // Write static HTML page
      const html = actorPageHtml({ title, description, image, url, lastmod, keywords });
      fs.writeFileSync(path.join(OUT_DIR, fileName), html, "utf8");

      // Add to sitemap entries
      sitemapUrls.push({ loc: url, lastmod, priority: "0.6" });

      // Add to SEO meta JSON
      metaArray.push({ name, stage_name: r.stage_name || "", url, description, keywords, lastModified: lastmod, profile_image: image });
    }

    // Create sitemap-actors.xml
    const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      sitemapUrls.map(u => `  <url><loc>${u.loc}</loc><lastmod>${u.lastmod}</lastmod><priority>${u.priority}</priority></url>`).join("\n") +
      `\n</urlset>\n`;
    fs.writeFileSync(SITEMAP_ACTORS, sitemapXml, "utf8");

    // Write SEO meta JSON
    fs.writeFileSync(SEO_META, JSON.stringify(metaArray, null, 2), "utf8");

    // Update sitemap-index.xml
    const indexList = [`${BASE_URL}/sitemap.xml`, `${BASE_URL}/sitemap-actors.xml`];
    const sitemapIndexXml = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      indexList.map(loc => `  <sitemap><loc>${loc}</loc></sitemap>`).join("\n") +
      `\n</sitemapindex>\n`;
    fs.writeFileSync(SITEMAP_INDEX, sitemapIndexXml, "utf8");

    console.log(`✅ Generated ${rows.length} actress pages → ${OUT_DIR}`);
    console.log(`✅ sitemap-actors.xml & seo-meta-actors.json written`);
  } catch (err) {
    console.error("Error generating actress pages:", err);
    process.exit(1);
  }
})();
