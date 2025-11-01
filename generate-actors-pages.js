// generate-actors-pages.mjs
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
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function formatDate(d) {
  if (!d) return new Date().toISOString().split("T")[0];
  try {
    const dd = new Date(d);
    return isNaN(dd) ? new Date().toISOString().split("T")[0] : dd.toISOString().split("T")[0];
  } catch {
    return new Date().toISOString().split("T")[0];
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
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"'; i++; continue;
      }
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if (ch === ',' && !inQuotes) { values.push(cur); cur = ""; continue; }
      cur += ch;
    }
    values.push(cur);
    const obj = {};
    headers.forEach((h, idx) => (obj[h] = (values[idx] ?? "").trim()));
    return obj;
  });
}

function escapeHtml(s = "") {
  return s.replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
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
    ...(image ? { image } : {})
  };

  const relatedLinks = related && related.length
    ? related.map(r => `<li><a href="/actors/${slugify(r)}.html">${escapeHtml(r)}</a></li>`).join("\n")
    : "<li>No related profiles available.</li>";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(name)} — Full HD Videos & Scenes | Dareloom.fun</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <meta name="keywords" content="${escapeHtml(keywords)}" />
  <link rel="canonical" href="${url}" />
  <meta name="robots" content="index, follow" />
  <meta property="og:type" content="profile" />
  <meta property="og:site_name" content="Dareloom.fun" />
  <meta property="og:title" content="${escapeHtml(name)} — Full HD Videos | Dareloom.fun" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  ${image ? `<meta property="og:image" content="${image}" />` : ""}
  <meta name="twitter:card" content="summary_large_image" />
  ${image ? `<meta name="twitter:image" content="${image}" />` : ""}
  <link rel="icon" href="/favicon.ico" />
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
</head>
<body style="font-family:sans-serif;max-width:700px;margin:auto;padding:20px;">
  <main>
    <h1>${escapeHtml(name)} — Full HD Videos & Scenes</h1>
    ${image ? `<img src="${image}" alt="${escapeHtml(name)} full HD scenes" style="max-width:320px;border-radius:12px;box-shadow:0 0 8px rgba(0,0,0,0.2);margin:10px 0;"/>` : ""}
    <p>${escapeHtml(description)}</p>
    <p><strong>Last Updated:</strong> ${lastmod}</p>

    <h2>Related Stars</h2>
    <ul>
      ${relatedLinks}
    </ul>

    <footer style="margin-top:40px;font-size:14px;color:#666;">
      <p>© ${new Date().getFullYear()} Dareloom.fun — All Rights Reserved.</p>
    </footer>
  </main>
</body>
</html>`;
}

// ---------------- MAIN SCRIPT ----------------
(async function main() {
  try {
    if (!fs.existsSync(DATA_CSV)) throw new Error(`Missing CSV file: ${DATA_CSV}`);
    const csv = fs.readFileSync(DATA_CSV, "utf8");
    const rows = parseCSV(csv);
    if (!rows.length) throw new Error("CSV file empty or invalid format.");

    if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

    const sitemapUrls = [];
    const seoMeta = [];

    const pickRelated = (currentName) => {
      const others = rows.map(r => r.name).filter(n => n && n !== currentName);
      others.sort(() => 0.5 - Math.random());
      return others.slice(0, 3);
    };

    for (const r of rows) {
      const name = r.name || r.stage_name || "";
      if (!name) continue;
      const slug = slugify(r.stage_name || name);
      const url = `${BASE_URL}/actors/${slug}.html`;
      const lastmod = formatDate(r.lastmod);
      const description = r.bio || `${name} — performer profile on Dareloom.fun. Watch full HD scenes & videos.`;
      const image = r.profile_image_url || "";
      const keywords = `${name}, ${r.stage_name || ""}, ${r.nationality || ""}, adult videos, full HD clips, latest ${new Date().getFullYear()} scenes, porn movies, Dareloom`;
      const related = pickRelated(name);

      const html = actorPageHtml({ name, description, image, url, lastmod, keywords, related });
      fs.writeFileSync(path.join(OUT_DIR, `${slug}.html`), html, { encoding: "utf8", flag: "w" });

      sitemapUrls.push({ loc: url, lastmod, priority: "0.6" });
      seoMeta.push({ name, url, description, keywords, lastModified: lastmod, profile_image: image });
    }

    const sitemapXml =
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      sitemapUrls
        .map(u => `  <url><loc>${u.loc}</loc><lastmod>${u.lastmod}</lastmod><priority>${u.priority}</priority></url>`)
        .join("\n") +
      `\n</urlset>\n`;

    fs.writeFileSync(SITEMAP_FILE, sitemapXml, { encoding: "utf8", flag: "w" });
    fs.writeFileSync(SEO_JSON_FILE, JSON.stringify(seoMeta, null, 2), { encoding: "utf8", flag: "w" });

    console.log(`✅ Generated ${rows.length} actor pages → ${OUT_DIR}`);
    console.log(`✅ sitemap-actors.xml (${sitemapUrls.length} URLs) & seo-meta-actors.json (${seoMeta.length} entries) updated.`);
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
})();
