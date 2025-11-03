// auto-seo.mjs
// Dareloom.fun – Auto SEO, Sitemap, Pages Generator from Google Sheets
// Run: SHEET_KEY=... node auto-seo.mjs

import fs from "fs";
import path from "path";
import zlib from "zlib";
import fetch from "node-fetch";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------- CONFIG ----------
const BASE_URL = "https://dareloom.fun";
const SHEET_ID = "1A2I6jODnR99Hwy9ZJXPkGDtAFKfpYwrm3taCWZWoZ7o";
const SHEET_RANGE = "Sheet1!A:U";
const SHEET_KEY = process.env.SHEET_KEY || "";
const SMARTLINK = process.env.SMARTLINK || "https://bulletinsituatedelectronics.com/b95e6swf?key=0f61d8bf1a7278d5cf9f161ab55bafbb";
const OUT_DIR = path.join(process.cwd(), "movies");
const SEO_META_PATH = path.join(process.cwd(), "seo-meta.json");
const SITEMAP_PATH = path.join(process.cwd(), "sitemap.xml");
const ROBOTS_PATH = path.join(process.cwd(), "robots.txt");

if (!SHEET_KEY) {
  console.error("❌ Missing SHEET_KEY env variable");
  process.exit(1);
}

// ---------- HELPERS ----------
const slugify = t => t?.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "";
const formatDate = d => new Date(d || Date.now()).toISOString().split("T")[0];
const escapeHtml = s => String(s).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
const sheetURL = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(SHEET_RANGE)}?key=${SHEET_KEY}`;

// ---------- HTML PAGE ----------
function buildHtml({ title, thumb, trailer, watch, date, category, type }) {
  const slug = slugify(title);
  const canonical = `${BASE_URL}/movies/${slug}-${type}.html`;
  const desc = `${title} — Watch ${type === "watch" ? "full video" : "trailer"} online on Dareloom.fun.`;

  const keywords = `${title}, ${category}, ${type}, web series, 2025 movies, dareloom.fun`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: title,
    description: desc,
    thumbnailUrl: thumb,
    uploadDate: formatDate(date),
    url: canonical,
    publisher: { "@type": "Organization", name: "Dareloom", url: BASE_URL }
  };

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)} | Dareloom.fun</title>
<meta name="description" content="${escapeHtml(desc)}">
<meta name="keywords" content="${escapeHtml(keywords)}">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="video.other">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(desc)}">
<meta property="og:image" content="${escapeHtml(thumb)}">
<meta property="og:url" content="${canonical}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(desc)}">
<meta name="twitter:image" content="${escapeHtml(thumb)}">
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
<style>
body{font-family:system-ui,Inter,sans-serif;background:#000;color:#fff;margin:0;padding:16px}
h1{color:#ff2b7f;font-size:1.8em}
.btn{display:inline-block;background:#ff2b7f;padding:12px 18px;margin:8px 4px;border-radius:8px;color:#fff;text-decoration:none}
img{border-radius:12px;max-width:100%}
</style>
</head>
<body>
<header><a href="${BASE_URL}" style="color:#fff;text-decoration:none;font-weight:700">Dareloom.fun</a> / ${escapeHtml(category||"Movies")}</header>
<main>
<h1>${escapeHtml(title)}</h1>
<p>${escapeHtml(desc)}</p>
<img src="${escapeHtml(thumb)}" alt="${escapeHtml(title)}" loading="lazy">
<div style="margin-top:10px">
${watch ? `<a href="${watch}" target="_blank" class="btn">Watch Now</a>` : ""}
${trailer ? `<a href="${trailer}" target="_blank" class="btn">Watch Trailer</a>` : ""}
</div>
</main>
<script async src="//bulletinsituatedelectronics.com/24/e4/33/24e43300238cf9b86a05c918e6b00561.js"></script>
<script async src="//bulletinsituatedelectronics.com/cb/63/19/cb6319838ced4608354b54fc6faddb8a.js"></script>
<script>
const smart="${SMARTLINK}";
document.addEventListener('click',()=>{if(!sessionStorage.getItem('s')){sessionStorage.setItem('s',1);window.open(smart,'_blank');}});
</script>
</body>
</html>`;
}

// ---------- MAIN ----------
async function fetchSheet() {
  const r = await fetch(sheetURL);
  if (!r.ok) throw new Error("Failed to fetch sheet");
  const j = await r.json();
  return j.values?.slice(1) || [];
}

async function generate() {
  const data = await fetchSheet();
  console.log(`📊 ${data.length} rows fetched`);
  const sitemapUrls = [];
  const seoMeta = [];
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const seen = new Set();

  for (const row of data) {
    const [title, , trailer, , , , watch, , , , , , , , , , , thumb, , date, cat] = row;
    if (!title || seen.has(title)) continue;
    seen.add(title);

    const slug = slugify(title);
    const category = slugify(cat || "movies");
    const dir = path.join(OUT_DIR, category);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    for (const type of ["watch", "trailer"]) {
      const html = buildHtml({ title, thumb, trailer, watch, date, category, type });
      const file = path.join(dir, `${slug}-${type}.html`);
      fs.writeFileSync(file, html);
      sitemapUrls.push(`${BASE_URL}/movies/${category}/${slug}-${type}.html`);
    }

    seoMeta.push({ title, category, thumb, date: formatDate(date) });
    console.log("✅", title);
  }

  // sitemap.xml
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapUrls.map(u=>`<url><loc>${u}</loc><lastmod>${formatDate()}</lastmod><priority>0.8</priority></url>`).join("\n")}\n</urlset>`;
  fs.writeFileSync(SITEMAP_PATH, xml);
  zlib.gzipSync && fs.writeFileSync(SITEMAP_PATH+".gz", zlib.gzipSync(xml));
  fs.writeFileSync(ROBOTS_PATH, `User-agent: *\nAllow: /\nSitemap: ${BASE_URL}/sitemap.xml\n`);
  fs.writeFileSync(SEO_META_PATH, JSON.stringify(seoMeta, null, 2));

  console.log("✅ sitemap + seo-meta updated");
}

generate().catch(e => {
  console.error("❌ Error:", e);
  process.exit(1);
});
