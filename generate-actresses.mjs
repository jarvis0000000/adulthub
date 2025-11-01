// ===========================================
// Dareloom.fun — Generate Actor Pages + Sitemap + SEO Meta
// ===========================================

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// ----------------------
// CONFIG
// ----------------------
const BASE_URL = "https://dareloom.fun";
const DATA_CSV = path.join(process.cwd(), "data", "actresses.csv");
const OUT_DIR = path.join(process.cwd(), "actors");
const SITEMAP_ACTORS = path.join(process.cwd(), "sitemap-actors.xml");
const SEO_META = path.join(process.cwd(), "seo-meta-actors.json");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ----------------------
// HELPERS
// ----------------------
function slugify(text = "") {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function formatDate(d) {
  try {
    const dd = new Date(d);
    return isNaN(dd)
      ? new Date().toISOString().split("T")[0]
      : dd.toISOString().split("T")[0];
  } catch {
    return new Date().toISOString().split("T")[0];
  }
}

function parseCSV(csvText) {
  const lines = csvText.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const headers = lines.shift().split(",").map((h) => h.trim());
  return lines.map((line) => {
    const values = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
        continue;
      }
      if (ch === '"') {
        inQuotes = !inQuotes;
        continue;
      }
      if (ch === "," && !inQuotes) {
        values.push(cur);
        cur = "";
        continue;
      }
      cur += ch;
    }
    values.push(cur);
    const obj = {};
    headers.forEach((h, i) => (obj[h] = (values[i] ?? "").trim()));
    return obj;
  });
}

function actorPageHtml({ title, description, image, url, lastmod, keywords }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: title,
    url,
    description,
  };
  if (image) jsonLd.image = image;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${title} — Dareloom.fun</title>
  <meta name="description" content="${description}">
  <meta name="keywords" content="${keywords}">
  <link rel="canonical" href="${url}">
  <meta name="robots" content="index, follow">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
  <style>
    body { font-family: Arial, sans-serif; max-width: 700px; margin: 2rem auto; padding: 1rem; line-height: 1.6; }
    img { display: block; margin: 1rem auto; border-radius: 8px; max-width: 320px; }
    h1 { text-align: center; color: #e63946; }
    small { color: #666; }
  </style>
</head>
<body>
  <main>
    <h1>${title}</h1>
    ${image ? `<img src="${image}" alt="${title}">` : ""}
    <p>${description}</p>
    <p><small>Last updated: ${lastmod}</small></p>
  </main>
</body>
</html>`;
}

// ----------------------
// MAIN
// ----------------------
(async function () {
  try {
    if (!fs.existsSync(DATA_CSV)) {
      console.error("❌ Missing CSV file:", DATA_CSV);
      process.exit(1);
    }

    const rows = parseCSV(fs.readFileSync(DATA_CSV, "utf8"));
    if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

    const sitemapUrls = [];
    const metaArray = [];

    for (const r of rows) {
      const name = r.name || r.stage_name || "";
      if (!name) continue;

      const slug = slugify(r.stage_name || name);
      const fileName = `${slug}.html`;
      const url = `${BASE_URL}/actors/${fileName}`;
      const lastmod = formatDate(r.lastmod);
      const description =
        r.bio ||
        `${name} is a talented performer featured on Dareloom.fun. Discover her latest appearances and updates.`;
      const image = r.profile_image_url || "";
      const keywords = [name, r.stage_name || "", r.nationality || ""]
        .filter(Boolean)
        .join(", ");

      // write actor page
      fs.writeFileSync(
        path.join(OUT_DIR, fileName),
        actorPageHtml({ title: name, description, image, url, lastmod, keywords }),
        "utf8"
      );

      sitemapUrls.push({
        loc: url,
        lastmod,
        priority: "0.6",
      });

      metaArray.push({
        name,
        stage_name: r.stage_name || "",
        url,
        description,
        keywords,
        lastModified: lastmod,
        profile_image: image,
      });
    }

    // write sitemap xml
    const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapUrls
  .map(
    (u) =>
      `  <url><loc>${u.loc}</loc><lastmod>${u.lastmod}</lastmod><priority>${u.priority}</priority></url>`
  )
  .join("\n")}
</urlset>`;

    fs.writeFileSync(SITEMAP_ACTORS, sitemapXml, "utf8");
    fs.writeFileSync(SEO_META, JSON.stringify(metaArray, null, 2), "utf8");

    console.log(`✅ Successfully generated ${rows.length} actor pages.`);
    console.log(`🗺️ Sitemap: ${SITEMAP_ACTORS}`);
    console.log(`📄 SEO Meta: ${SEO_META}`);
  } catch (err) {
    console.error("❌ Error while generating sitemap:", err);
  }
})();
