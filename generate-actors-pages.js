// generate-actors-pages.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// ---------------- CONFIG ----------------
const BASE_URL = "https://dareloom.fun";
const DATA_CSV = path.join(process.cwd(), "data", "actresses.csv");
const OUT_DIR = path.join(process.cwd(), "actors");
const SITEMAP_FILE = path.join(process.cwd(), "sitemap-actors.xml");
const SEO_JSON_FILE = path.join(process.cwd(), "seo-meta-actors.json");

// ---------------- HELPERS ----------------
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
    let cur = "";
    let inQuotes = false;
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

function escapeHtml(s = "") {
  return s.replace(/[&<>"']/g, (m) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"
  })[m]);
}

// ---------------- GENERATE HTML ----------------
function actorPageHtml({ name, description, image, url, lastmod, keywords, related }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    "name": name,
    "url": url,
    "description": description,
  };
  if (image) jsonLd.image = image;

  const relatedLinks = related.map(r => `<li><a href="/actors/${slugify(r)}.html">${r}</a></li>`).join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(name)} — Full HD Videos & Scenes | Dareloom.fun</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <meta name="keywords" content="${escapeHtml(keywords)}" />
  <link rel="canonical" href="${url}" />
  <meta name="robots" content="index, follow" />
  <meta property="og:type" content="profile" />
  <meta property="og:title" content="${escapeHtml(name)} — Full HD Videos | Dareloom.fun" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  ${image ? `<meta property="og:image" content="${image}" />` : ""}
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
</head>
<body>
  <main>
    <h1>${escapeHtml(name)} — Full HD Videos & Scenes</h1>
    ${image ? `<img src="${image}" alt="${escapeHtml(name)} full HD scenes" style="max-width:320px;"/>` : ""}
    <p>${escapeHtml(description)}</p>
    <p><strong>Last Updated:</strong> ${lastmod}</p>

    <h2>Related Stars</h2>
    <ul>
      ${relatedLinks}
    </ul>
  </main>
</body>
</html>`;
}

// ---------------- MAIN SCRIPT ----------------
(async function main(){
  try {
    if (!fs.existsSync(DATA_CSV)) throw new Error(`Missing CSV file: ${DATA_CSV}`);
    const csv = fs.readFileSync(DATA_CSV, "utf8");
    const rows = parseCSV(csv);

    if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

    const sitemapUrls = [];
    const seoMeta = [];

    // For related actors (random 3 per page)
    function pickRelated(currentName) {
      const others = rows.map(r => r.name).filter(n => n !== currentName);
      others.sort(() => 0.5 - Math.random());
      return others.slice(0, 3);
    }

    for (const r of rows) {
      const name = r.name || r.stage_name || "";
      if (!name) continue;
      const slug = slugify(r.stage_name || name);
      const url = `${BASE_URL}/actors/${slug}.html`;
      const lastmod = formatDate(r.lastmod);
      const description = r.bio || `${name} — performer profile on Dareloom.fun.`;
      const image = r.profile_image_url || "";
      const keywords = `${name}, ${r.stage_name || ""}, ${r.nationality || ""}, full HD videos, porn clips, latest scenes 2025, full movies, adult videos online`;
      const related = pickRelated(name);

      // Write HTML page
      const html = actorPageHtml({ name, description, image, url, lastmod, keywords, related });
      fs.writeFileSync(path.join(OUT_DIR, `${slug}.html`), html, "utf8");

      // Sitemap
      sitemapUrls.push({ loc: url, lastmod, priority: "0.6" });

      // SEO JSON
      seoMeta.push({
        name,
        stage_name: r.stage_name || "",
        url,
        description,
        keywords,
        lastModified: lastmod,
        profile_image: image
      });
    }

    // Write sitemap
    const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      sitemapUrls.map(u => `  <url><loc>${u.loc}</loc><lastmod>${u.lastmod}</lastmod><priority>${u.priority}</priority></url>`).join("\n") +
      `\n</urlset>\n`;
    fs.writeFileSync(SITEMAP_FILE, sitemapXml, "utf8");

    // Write SEO meta JSON
    fs.writeFileSync(SEO_JSON_FILE, JSON.stringify(seoMeta, null, 2), "utf8");

    console.log(`✅ Generated ${rows.length} actor pages → ${OUT_DIR}`);
    console.log(`✅ sitemap-actors.xml & seo-meta-actors.json updated.`);
  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  }
})();
