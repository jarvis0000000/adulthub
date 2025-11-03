// 🧠 Auto SEO + Sitemap + Dareloom Generator
// Generates trailer/watch pages from Google Sheet, injects Adsterra ads, builds sitemap + SEO JSON
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

// -------- HTML BUILDER --------
function buildHtmlPage({ title, description, thumbnail, watchUrl, trailerUrl, date, category, pageType }) {
  const canonical = `${BASE_URL}/movies/${slugify(title)}-${pageType}.html`;
  const metaTitle = `${title} — ${pageType === "watch" ? "Watch" : "Trailer"} | Dareloom Hub`;
  const metaDescription =
    description || `${title} — Watch ${pageType === "watch" ? "full video" : "trailer"} on Dareloom.fun`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: title,
    description: metaDescription,
    thumbnailUrl: thumbnail || `${BASE_URL}/web-app-manifest-512x512.png`,
    uploadDate: date || formatDate(new Date()),
    url: pageType === "watch" ? watchUrl : trailerUrl,
    publisher: { "@type": "Organization", name: "Dareloom Hub", url: BASE_URL },
  };

  const adsterraScripts = `
  <!-- Popunder -->
  <script async src='//bulletinsituatedelectronics.com/24/e4/33/24e43300238cf9b86a05c918e6b00561.js'></script>
  <!-- Social Bar -->
  <script async src='//bulletinsituatedelectronics.com/cb/63/19/cb6319838ced4608354b54fc6faddb8a.js'></script>
  <!-- Smartlink -->
  <script>
    (function(){
      const SMARTLINK="${SMARTLINK}";
      function openSmart(){
        if(sessionStorage.getItem('smartDone')) return;
        sessionStorage.setItem('smartDone','1');
        setTimeout(()=>window.open(SMARTLINK,'_blank'),1500);
      }
      document.addEventListener('click',openSmart,{once:true});
      document.addEventListener('touchstart',openSmart,{once:true});
      document.addEventListener('scroll',openSmart,{once:true});
    })();
  </script>`;

  const player = `
    <div id="playerWrap">
      ${thumbnail ? `<img src="${escapeHtml(thumbnail)}" alt="${escapeHtml(title)}" style="max-width:100%;border-radius:12px;">` : ""}
      <div style="margin-top:12px;">
        ${watchUrl ? `<a href="${escapeHtml(watchUrl)}" target="_blank" class="btn">Watch Now</a>` : ""}
        ${trailerUrl ? `<a href="${escapeHtml(trailerUrl)}" target="_blank" class="btn">Trailer</a>` : ""}
      </div>
    </div>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(metaTitle)}</title>
<meta name="description" content="${escapeHtml(metaDescription)}">
<meta property="og:title" content="${escapeHtml(metaTitle)}">
<meta property="og:description" content="${escapeHtml(metaDescription)}">
<meta property="og:image" content="${escapeHtml(thumbnail || `${BASE_URL}/web-app-manifest-512x512.png`)}">
<link rel="canonical" href="${canonical}">
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
<style>
body{background:#000;color:#fff;font-family:Inter,system-ui,sans-serif;padding:16px;margin:0;}
h1{color:#ff377f;margin-bottom:10px}
.btn{display:inline-block;padding:10px 16px;background:#ff377f;color:#fff;text-decoration:none;border-radius:8px;margin:6px 4px;}
</style>
</head>
<body>
<header style="margin-bottom:20px"><a href="${BASE_URL}" style="color:#fff;text-decoration:none;font-weight:bold;">Dareloom Hub</a></header>
<main style="max-width:900px;margin:auto;">
<h1>${escapeHtml(title)}</h1>
<p>${escapeHtml(metaDescription)}</p>
${player}
<section style="margin-top:18px"><h3>Details</h3>
<p><b>Category:</b> ${escapeHtml(category || "Movies")}<br>
<b>Date:</b> ${escapeHtml(formatDate(date))}</p></section>
</main>
${adsterraScripts}
</body></html>`;
}

// -------- PARSE SHEET --------
function parseRows(values) {
  if (!Array.isArray(values) || values.length < 2) return [];
  const headers = values[0];
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

// -------- WRITE FILES + SITEMAP --------
async function writeFiles(items) {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const sitemapUrls = [];
  const seoMeta = [];

  for (const it of items) {
    const slug = slugify(it.title);
    const watchFile = path.join(OUT_DIR, `${slug}-watch.html`);
    const trailerFile = path.join(OUT_DIR, `${slug}-trailer.html`);

    fs.writeFileSync(
      watchFile,
      buildHtmlPage({ ...it, pageType: "watch", description: `${it.title} — Watch full video on Dareloom.fun` }),
      "utf8"
    );
    fs.writeFileSync(
      trailerFile,
      buildHtmlPage({ ...it, pageType: "trailer", description: `${it.title} — Watch trailer on Dareloom.fun` }),
      "utf8"
    );

    const lastmod = formatDate(it.date);
    sitemapUrls.push({ loc: `${BASE_URL}/movies/${slug}-watch.html`, lastmod, priority: "0.8" });
    sitemapUrls.push({ loc: `${BASE_URL}/movies/${slug}-trailer.html`, lastmod, priority: "0.7" });

    seoMeta.push({
      title: it.title,
      url_watch: `${BASE_URL}/movies/${slug}-watch.html`,
      url_trailer: `${BASE_URL}/movies/${slug}-trailer.html`,
      thumbnail: it.thumbnail,
      date: lastmod,
      category: it.category,
    });

    console.log("✅ Generated:", it.title);
  }

  // Sitemap
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapUrls
    .map((u) => `<url><loc>${u.loc}</loc><lastmod>${u.lastmod}</lastmod><priority>${u.priority}</priority></url>`)
    .join("\n")}\n</urlset>`;
  fs.writeFileSync(SITEMAP_PATH, xml, "utf8");
  zlib.gzip(xml, (err, buf) => !err && fs.writeFileSync(SITEMAP_GZ_PATH, buf));

  fs.writeFileSync(ROBOTS_PATH, `User-agent: *\nAllow: /\nSitemap: ${BASE_URL}/sitemap.xml\n`, "utf8");
  fs.writeFileSync(SEO_META_PATH, JSON.stringify(seoMeta, null, 2), "utf8");
  fs.writeFileSync(
    HEADERS_PATH,
    `/sitemap.xml\n  Content-Type: application/xml; charset=utf-8\n/robots.txt\n  Content-Type: text/plain; charset=utf-8\n/movies/*\n  Content-Type: text/html; charset=utf-8\n`,
    "utf8"
  );
  fs.writeFileSync(INDEXNOW_FILE, "c5b6124b5f8744fbb1a44a96266b9aa7", "utf8");
  console.log("✅ Sitemap, SEO, robots, headers written.");
}

// -------- PING SEARCH ENGINES --------
async function pingSearch(urls = []) {
  console.log("📣 Pinging Google, Bing, IndexNow...");
  const sitemapUrl = `${BASE_URL}/sitemap.xml`;
  await Promise.allSettled([
    fetch(`https://www.google.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`),
    fetch(`https://www.bing.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`),
  ]);
  console.log("✅ Search engines pinged.");
}

// -------- MAIN --------
(async () => {
  try {
    const data = await fetchSheet();
    const parsed = parseRows(data);
    if (!parsed.length) throw new Error("No data found in sheet.");
    await writeFiles(parsed);
    const urls = parsed.slice(0, 100).flatMap((p) => {
      const slug = slugify(p.title);
      return [`${BASE_URL}/movies/${slug}-watch.html`, `${BASE_URL}/movies/${slug}-trailer.html`];
    });
    await pingSearch(urls);
    console.log("🎉 Auto SEO completed successfully.");
  } catch (e) {
    console.error("❌ Error:", e);
    process.exit(1);
  }
})();
