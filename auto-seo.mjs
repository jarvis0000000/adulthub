// ⚡ Dareloom Auto SEO Generator + Sitemap + IndexNow + Adsterra Integration
// Fetches movie data from Google Sheet → generates trailer & watch pages
// Adds Popunder, Social Bar & Smartlink ads + trending keywords section
// Usage: SHEET_KEY=your_api_key SMARTLINK="https://..." node auto-seo.mjs

import fs from "fs";
import path from "path";
import zlib from "zlib";
import fetch from "node-fetch";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// -------- CONFIG --------
const BASE_URL = "https://dareloom.fun";
const SHEET_ID = "1A2I6jODnR99Hwy9ZJXPkGDtAFKfpYwrm3taCWZWoZ7o";
const SHEET_RANGE = "Sheet1!A:U";
const SHEET_KEY = process.env.SHEET_KEY || "";
const SMARTLINK = process.env.SMARTLINK || "https://bulletinsituatedelectronics.com/b95e6swf?key=0f61d8bf1a7278d5cf9f161ab55bafbb";

const OUT_DIR = path.join(process.cwd(), "movies");
const SEO_DIR = path.join(process.cwd(), "seo");
const TRENDING_FILE = path.join(process.cwd(), "trending.html");
const SITEMAP_PATH = path.join(process.cwd(), "sitemap.xml");
const SITEMAP_GZ_PATH = path.join(process.cwd(), "sitemap.xml.gz");
const SEO_META_PATH = path.join(process.cwd(), "seo-meta.json");
const ROBOTS_PATH = path.join(process.cwd(), "robots.txt");
const HEADERS_PATH = path.join(process.cwd(), "_headers");
const INDEXNOW_FILE = path.join(process.cwd(), "indexnow-key.txt");

if (!SHEET_KEY) {
  console.error("❌ SHEET_KEY not set. Please export your Google Sheets API key.");
  process.exit(1);
}

// -------- HELPERS --------
function slugify(text = "") {
  return text.toLowerCase().trim().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
function formatDate(d) {
  try {
    if (!d) return new Date().toISOString().split("T")[0];
    const dd = new Date(d);
    return isNaN(dd) ? new Date().toISOString().split("T")[0] : dd.toISOString().split("T")[0];
  } catch {
    return new Date().toISOString().split("T")[0];
  }
}
function escapeHtml(s = "") {
  return String(s).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
}

// -------- FETCH SHEET --------
const SHEET_URL = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(SHEET_RANGE)}?key=${SHEET_KEY}`;
async function fetchSheet() {
  console.log("📡 Fetching Google Sheet...");
  const res = await fetch(SHEET_URL);
  if (!res.ok) throw new Error(`Sheet fetch failed ${res.status}`);
  const json = await res.json();
  return json.values || [];
}

// -------- BUILD PAGE --------
function buildHtmlPage({ title, description, thumbnail, watchUrl, trailerUrl, date, category, pageType }) {
  const canonical = `${BASE_URL}/movies/${slugify(title)}-${pageType}.html`;
  const metaTitle = `${title} — ${pageType === "watch" ? "Watch Online" : "Trailer"} | Dareloom.fun`;
  const metaDescription = description || `${title} — ${pageType === "watch" ? "Watch full movie" : "Watch trailer"} on Dareloom.fun`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: title,
    description: metaDescription,
    thumbnailUrl: thumbnail || `${BASE_URL}/web-app-manifest-512x512.png`,
    uploadDate: date || formatDate(new Date()),
    url: canonical,
    publisher: { "@type": "Organization", name: "Dareloom.fun", url: BASE_URL },
  };

  const ads = `
  <!-- Adsterra Popunder -->
  <script async src="//bulletinsituatedelectronics.com/24/e4/33/24e43300238cf9b86a05c918e6b00561.js"></script>
  <!-- Adsterra Social Bar -->
  <script async src="//bulletinsituatedelectronics.com/cb/63/19/cb6319838ced4608354b54fc6faddb8a.js"></script>
  <!-- Smartlink -->
  <script>
    (function(){
      const SMARTLINK="${SMARTLINK}";
      function openSmart(){
        if(sessionStorage.getItem('smartDone')) return;
        sessionStorage.setItem('smartDone','1');
        setTimeout(()=>window.open(SMARTLINK,'_blank'),1200);
      }
      document.addEventListener('click',openSmart,{once:true});
      document.addEventListener('touchstart',openSmart,{once:true});
      document.addEventListener('scroll',openSmart,{once:true});
    })();
  </script>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(metaTitle)}</title>
<meta name="description" content="${escapeHtml(metaDescription)}">
<meta property="og:title" content="${escapeHtml(metaTitle)}">
<meta property="og:description" content="${escapeHtml(metaDescription)}">
<meta property="og:image" content="${escapeHtml(thumbnail)}">
<link rel="canonical" href="${canonical}">
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
<style>
body{background:#000;color:#fff;font-family:Inter,system-ui,sans-serif;padding:16px;margin:0;}
h1{color:#ff377f;}
.btn{display:inline-block;padding:10px 16px;background:#ff377f;color:#fff;text-decoration:none;border-radius:8px;margin:8px 4px;}
</style>
</head>
<body>
<header><a href="${BASE_URL}" style="color:#fff;text-decoration:none;font-weight:bold;">Dareloom Hub</a></header>
<main style="max-width:900px;margin:auto;">
<h1>${escapeHtml(title)}</h1>
<p>${escapeHtml(metaDescription)}</p>
${thumbnail ? `<img src="${thumbnail}" alt="${escapeHtml(title)}" style="max-width:100%;border-radius:10px;margin:10px 0;">` : ""}
<div>${watchUrl ? `<a href="${watchUrl}" class="btn">Watch Now</a>` : ""}${trailerUrl ? `<a href="${trailerUrl}" class="btn">Trailer</a>` : ""}</div>
<p style="margin-top:20px;"><b>Category:</b> ${category || "Movies"} | <b>Date:</b> ${formatDate(date)}</p>
</main>
${ads}
</body></html>`;
}

// -------- PARSE SHEET --------
function parseRows(values) {
  const rows = values.slice(1);
  return rows
    .map((r) => ({
      title: r[0] || "",
      trailer: r[2] || "",
      watch: r[6] || "",
      thumbnail: r[17] || "",
      date: r[19] || "",
      category: r[20] || "",
    }))
    .filter((x) => x.title && (x.watch || x.trailer));
}

// -------- WRITE FILES --------
async function writeFiles(items) {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  if (!fs.existsSync(SEO_DIR)) fs.mkdirSync(SEO_DIR, { recursive: true });

  const sitemapUrls = [];
  const seoMeta = [];

  for (const it of items) {
    const slug = slugify(it.title);
    const watchFile = path.join(OUT_DIR, `${slug}-watch.html`);
    const trailerFile = path.join(OUT_DIR, `${slug}-trailer.html`);

    fs.writeFileSync(watchFile, buildHtmlPage({ ...it, pageType: "watch" }), "utf8");
    fs.writeFileSync(trailerFile, buildHtmlPage({ ...it, pageType: "trailer" }), "utf8");

    const lastmod = formatDate(it.date);
    sitemapUrls.push({ loc: `${BASE_URL}/movies/${slug}-watch.html`, lastmod });
    sitemapUrls.push({ loc: `${BASE_URL}/movies/${slug}-trailer.html`, lastmod });

    seoMeta.push({
      title: it.title,
      url_watch: `${BASE_URL}/movies/${slug}-watch.html`,
      url_trailer: `${BASE_URL}/movies/${slug}-trailer.html`,
      thumbnail: it.thumbnail,
      date: lastmod,
      category: it.category,
    });
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapUrls
    .map((u) => `<url><loc>${u.loc}</loc><lastmod>${u.lastmod}</lastmod></url>`)
    .join("\n")}\n</urlset>`;
  fs.writeFileSync(SITEMAP_PATH, xml, "utf8");
  zlib.gzip(xml, (_, buf) => fs.writeFileSync(SITEMAP_GZ_PATH, buf));

  fs.writeFileSync(ROBOTS_PATH, `User-agent: *\nAllow: /\nSitemap: ${BASE_URL}/sitemap.xml\n`, "utf8");
  fs.writeFileSync(SEO_META_PATH, JSON.stringify(seoMeta, null, 2), "utf8");
  fs.writeFileSync(
    HEADERS_PATH,
    `/sitemap.xml\n  Content-Type: application/xml; charset=utf-8\n/movies/*\n  Content-Type: text/html; charset=utf-8\n`,
    "utf8"
  );
  fs.writeFileSync(INDEXNOW_FILE, "c5b6124b5f8744fbb1a44a96266b9aa7", "utf8");

  console.log("✅ Files + sitemap + meta written.");

  // -------- Trending HTML --------
  const trendingList = seoMeta
    .slice(0, 50)
    .map(
      (v) =>
        `<li><a href="${v.url_watch}" target="_blank">${escapeHtml(v.title)}</a> — <small>${escapeHtml(
          v.category
        )}</small></li>`
    )
    .join("\n");

  const trendingHtml = `<!doctype html><html><head><meta charset="utf-8"><title>🔥 Trending Movies — Dareloom.fun</title>
  <meta name="description" content="Trending movies, web series & trailers from Dareloom.fun">
  <style>body{font-family:Inter;background:#000;color:#fff;padding:20px;}a{color:#ff377f;text-decoration:none;}</style></head>
  <body><h1>🔥 Trending Movies</h1><ul>${trendingList}</ul></body></html>`;

  fs.writeFileSync(TRENDING_FILE, trendingHtml, "utf8");
  console.log("✅ trending.html generated.");
}

// -------- PING SEARCH --------
async function pingSearch() {
  console.log("📡 Pinging search engines...");
  const sitemapUrl = `${BASE_URL}/sitemap.xml`;
  await Promise.allSettled([
    fetch(`https://www.google.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`),
    fetch(`https://www.bing.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`),
  ]);
  console.log("✅ Ping complete.");
}

// -------- MAIN --------
(async () => {
  try {
    const data = await fetchSheet();
    const parsed = parseRows(data);
    if (!parsed.length) throw new Error("No data in Sheet!");
    await writeFiles(parsed);
    await pingSearch();
    console.log("🎉 All Done — Auto SEO + Trending Page generated!");
  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  }
})();
