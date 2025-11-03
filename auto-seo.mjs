// auto-seo.mjs
// Generates trailer/watch pages from Google Sheet, updates sitemap + SEO files, injects Adsterra scripts
// Usage: SHEET_KEY=... SMARTLINK="https://..." node auto-seo.mjs
// Node 18+ recommended

import fs from "fs";
import path from "path";
import zlib from "zlib";
import fetch from "node-fetch";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// -------- CONFIG (edit if needed) --------
const BASE_URL = "https://dareloom.fun";
const SHEET_ID = "1A2I6jODnR99Hwy9ZJXPkGDtAFKfpYwrm3taCWZWoZ7o"; // your sheet id
const SHEET_RANGE = "Sheet1!A:U"; // sheet range - columns include A..U
const SHEET_KEY = process.env.SHEET_KEY || ""; // must be set
const SMARTLINK = process.env.SMARTLINK || "https://bulletinsituatedelectronics.com/b95e6swf?key=0f61d8bf1a7278d5cf9f161ab55bafbb"; // your smartlink
const OUT_DIR = path.join(process.cwd(), "movies"); // generated pages go here
const SITEMAP_PATH = path.join(process.cwd(), "sitemap.xml");
const SITEMAP_GZ_PATH = path.join(process.cwd(), "sitemap.xml.gz");
const SEO_META_PATH = path.join(process.cwd(), "seo-meta.json");
const ROBOTS_PATH = path.join(process.cwd(), "robots.txt");
const HEADERS_PATH = path.join(process.cwd(), "_headers");
const INDEXNOW_FILE = path.join(process.cwd(), "indexnow-key.txt");

if (!SHEET_KEY) {
  console.error("❌ SHEET_KEY is not set. Export your Google Sheets API key to SHEET_KEY env.");
  process.exit(1);
}

// -------- helpers --------
function slugify(text = "") {
  return text.toString().toLowerCase().trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
function formatDate(d) {
  try {
    if (!d) return new Date().toISOString().split("T")[0];
    const dd = new Date(d);
    return isNaN(dd) ? new Date().toISOString().split("T")[0] : dd.toISOString().split("T")[0];
  } catch { return new Date().toISOString().split("T")[0]; }
}
function escapeHtml(s = "") {
  return String(s).replace(/[&<>"']/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]));
}

// Build sheet URL
const SHEET_URL = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(SHEET_RANGE)}?key=${SHEET_KEY}`;

// -------- page templates --------
function buildHtmlPage({ title, description, thumbnail, watchUrl, trailerUrl, date, category, pageType }) {
  // pageType: "watch" or "trailer"
  const canonical = `${BASE_URL}/movies/${slugify(title)}-${pageType}.html`;
  const metaTitle = `${title} — ${pageType === "watch" ? "Watch" : "Trailer"} | Dareloom Hub`;
  const metaDescription = description || `${title} — Watch ${pageType === "watch" ? "full video" : "trailer"} on Dareloom.fun`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    "name": title,
    "description": metaDescription,
    "thumbnailUrl": thumbnail || `${BASE_URL}/web-app-manifest-512x512.png`,
    "uploadDate": date || formatDate(new Date()),
    "url": pageType === "watch" ? (watchUrl || "") : (trailerUrl || ""),
    "publisher": {
      "@type": "Organization",
      "name": "Dareloom Hub",
      "url": BASE_URL
    }
  };

  // Adsterra scripts to inject (popunder + social bar + smartlink)
  const adsterraScripts = `
  <!-- Adsterra: popunder -->
  <script type='text/javascript' src='//bulletinsituatedelectronics.com/24/e4/33/24e43300238cf9b86a05c918e6b00561.js' async></script>
  <!-- Adsterra: social bar -->
  <script type='text/javascript' src='//bulletinsituatedelectronics.com/cb/63/19/cb6319838ced4608354b54fc6faddb8a.js' async></script>
  <!-- SmartLink trigger (fires on user interaction) -->
  <script>
    (function(){
      const SMARTLINK="${SMARTLINK}";
      function openSmart(){ if(sessionStorage.getItem('smartDone')) return; sessionStorage.setItem('smartDone','1'); setTimeout(()=>window.open(SMARTLINK,'_blank'), 1500); }
      document.addEventListener('click', openSmart, {once:true});
      document.addEventListener('touchstart', openSmart, {once:true});
      document.addEventListener('scroll', openSmart, {once:true});
    })();
  </script>`;

  // Player area: if watchUrl/trailerUrl provided they often include multiple sources separated by commas.
  const playerScript = `
  <div id="playerWrap">
    ${thumbnail ? `<img src="${escapeHtml(thumbnail)}" alt="${escapeHtml(title)}" style="max-width:100%;border-radius:12px;"/>` : ""}
    <div style="margin-top:12px;">
      ${watchUrl ? `<a href="${escapeHtml(watchUrl)}" target="_blank" rel="noopener" class="btn">Open Source</a>` : ""}
      ${trailerUrl ? `<a href="${escapeHtml(trailerUrl)}" target="_blank" rel="noopener" class="btn">Open Trailer Source</a>` : ""}
    </div>
  </div>
  `;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${escapeHtml(metaTitle)}</title>
  <meta name="description" content="${escapeHtml(metaDescription)}" />
  <meta name="keywords" content="${escapeHtml((title+" "+category).split(" ").slice(0,15).join(", "))}" />
  <link rel="canonical" href="${canonical}" />
  <meta name="robots" content="index, follow" />
  <meta property="og:title" content="${escapeHtml(metaTitle)}" />
  <meta property="og:description" content="${escapeHtml(metaDescription)}" />
  <meta property="og:image" content="${escapeHtml(thumbnail || `${BASE_URL}/web-app-manifest-512x512.png`)}" />
  <meta property="og:url" content="${canonical}" />
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
  <style>
    body{background:#000;color:#fff;font-family:Inter,system-ui,Arial,Helvetica;padding:16px}
    .btn{display:inline-block;padding:12px 18px;background:#ff377f;color:#fff;border-radius:8px;text-decoration:none;margin:6px 4px}
  </style>
</head>
<body>
  <header style="display:flex;gap:12px;align-items:center">
    <a href="${BASE_URL}" style="color:#fff;text-decoration:none;font-weight:700">Dareloom Hub</a>
    <span style="opacity:0.7">/</span>
    <span style="opacity:0.9">${escapeHtml(category||"Movies")}</span>
  </header>

  <main style="max-width:1000px;margin:20px auto">
    <h1 style="color:#ff377f">${escapeHtml(title)}</h1>
    <p style="color:#ddd">${escapeHtml(metaDescription)}</p>

    ${playerScript}

    <section style="margin-top:18px">
      <h3>Details</h3>
      <ul>
        <li><strong>Category:</strong> ${escapeHtml(category || "Movies")}</li>
        <li><strong>Published:</strong> ${escapeHtml(formatDate(date))}</li>
      </ul>
    </section>
  </main>

  ${adsterraScripts}

</body>
</html>`;
}

// -------- main flow --------
async function fetchSheet() {
  console.log("📡 Fetching Google Sheet...");
  const res = await fetch(SHEET_URL);
  if (!res.ok) throw new Error(`Sheet fetch failed ${res.status}`);
  const json = await res.json();
  // Values are in json.values as array of arrays; first row is header
  return json.values || [];
}

function parseRows(values) {
  if (!Array.isArray(values) || values.length < 2) return [];
  const headers = values[0].map(h => (h||"").toString().trim());
  const rows = values.slice(1).map(r => {
    const obj = {};
    headers.forEach((h, i) => { obj[h || `col${i}`] = r[i] ?? ""; });
    return obj;
  });
  // But user said fixed columns: A=Title, C=Trailer, G=Watch, R=Thumbnail, T=Date, U=Category
  // We can also fallback to indexes:
  return rows.map((r, idx) => {
    const title = r["A"] || r["Title"] || r["a"] || r.col0 || r[Object.keys(r)[0]] || r[Object.keys(r)[0]] || Object.values(r)[0] || "";
    // attempt to read by position if header unknown:
    const trailer = r["C"] || r["Trailer"] || Object.values(r)[2] || "";
    const watch = r["G"] || r["Watch"] || Object.values(r)[6] || "";
    const thumb = r["R"] || r["Thumbnail"] || Object.values(r)[17] || "";
    const date = r["T"] || r["Date"] || Object.values(r)[19] || "";
    const cat = r["U"] || r["Category"] || Object.values(r)[20] || "";
    return { title: String(title).trim(), trailer: String(trailer).trim(), watch: String(watch).trim(), thumbnail: String(thumb).trim(), date: String(date).trim(), category: String(cat).trim() };
  }).filter(x => x.title && (x.watch || x.trailer));
}

async function writeFiles(items) {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  const sitemapUrls = [];
  const seoMeta = [];

  for (const it of items) {
    const baseSlug = slugify(it.title);
    // watch page
    const watchHtml = buildHtmlPage({
      title: it.title,
      description: `${it.title} — Watch full video on Dareloom.fun`,
      thumbnail: it.thumbnail,
      watchUrl: it.watch,
      trailerUrl: it.trailer,
      date: it.date,
      category: it.category,
      pageType: "watch"
    });
    const watchFile = path.join(OUT_DIR, `${baseSlug}-watch.html`);
    fs.writeFileSync(watchFile, watchHtml, "utf8");

    // trailer page
    const trailerHtml = buildHtmlPage({
      title: it.title,
      description: `${it.title} — Watch trailer on Dareloom.fun`,
      thumbnail: it.thumbnail,
      watchUrl: it.watch,
      trailerUrl: it.trailer,
      date: it.date,
      category: it.category,
      pageType: "trailer"
    });
    const trailerFile = path.join(OUT_DIR, `${baseSlug}-trailer.html`);
    fs.writeFileSync(trailerFile, trailerHtml, "utf8");

    // Add to sitemap entries
    const watchUrl = `${BASE_URL}/movies/${baseSlug}-watch.html`;
    const trailerUrl = `${BASE_URL}/movies/${baseSlug}-trailer.html`;
    const lastmod = formatDate(it.date);
    sitemapUrls.push({ loc: watchUrl, lastmod, priority: "0.8" });
    sitemapUrls.push({ loc: trailerUrl, lastmod, priority: "0.7" });

    // seo-meta entry
    seoMeta.push({
      title: it.title,
      url_watch: watchUrl,
      url_trailer: trailerUrl,
      thumbnail: it.thumbnail || "",
      date: lastmod,
      category: it.category || ""
    });

    console.log("✅ Generated:", it.title);
  }

  // write sitemap.xml
  const lastmodOverall = formatDate(new Date());
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
  // include main pages (keep as you had)
  const mainPages = ["/", "/watch.html", "/seo/main.html", "/seo/global.html", "/seo/categories.html", "/movies/"];
  for (const p of mainPages) xml += `  <url><loc>${BASE_URL}${p}</loc><lastmod>${lastmodOverall}</lastmod><priority>1.0</priority></url>\n`;
  for (const u of sitemapUrls) xml += `  <url><loc>${u.loc}</loc><lastmod>${u.lastmod}</lastmod><priority>${u.priority}</priority></url>\n`;
  xml += `</urlset>\n`;
  fs.writeFileSync(SITEMAP_PATH, xml, "utf8");
  zlib.gzip(xml, (err, buf) => { if (!err) fs.writeFileSync(SITEMAP_GZ_PATH, buf); });

  // robots
  const robots = `User-agent: *\nAllow: /\nSitemap: ${BASE_URL}/sitemap.xml\n`;
  fs.writeFileSync(ROBOTS_PATH, robots, "utf8");

  // seo-meta.json
  fs.writeFileSync(SEO_META_PATH, JSON.stringify(seoMeta, null, 2), "utf8");

  // headers
  const headers = `/sitemap.xml\n  Content-Type: application/xml; charset=utf-8\n/robots.txt\n  Content-Type: text/plain; charset=utf-8\n/movies/*\n  Content-Type: text/html; charset=utf-8\n`;
  fs.writeFileSync(HEADERS_PATH, headers, "utf8");

  // indexnow key
  const INDEXNOW_KEY = process.env.INDEXNOW_KEY || "c5b6124b5f8744fbb1a44a96266b9aa7";
  fs.writeFileSync(INDEXNOW_FILE, INDEXNOW_KEY, "utf8");

  console.log("✅ sitemap, seo-meta, robots, headers updated.");
}

async function pingSearch(urls = []) {
  console.log("📣 Pinging search engines (google, bing, indexnow)...");
  try {
    const sitemapUrl = `${BASE_URL}/sitemap.xml`;
    await Promise.allSettled([
      fetch(`https://www.google.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`),
      fetch(`https://www.bing.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`),
      fetch("https://api.indexnow.org/indexnow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host: "dareloom.fun",
          key: fs.readFileSync(INDEXNOW_FILE, "utf8").trim(),
          keyLocation: `${BASE_URL}/indexnow-key.txt`,
          urlList: urls.slice(0, 100)
        })
      })
    ]);
    console.log("✅ Pings finished (some may have failed silently).");
  } catch (e) {
    console.warn("⚠️ Ping error:", e.message);
  }
}

async function main() {
  try {
    const raw = await fetchSheet();
    const parsed = parseRows(raw);
    if (!parsed.length) {
      console.warn("⚠️ No rows parsed from sheet. Make sure sheet has data and headers or A/C/G/R/T/U columns.");
      return;
    }

    await writeFiles(parsed);

    // Build list of URLs for ping (first 200)
    const urls = [];
    for (const p of parsed.slice(0, 200)) {
      const s = slugify(p.title);
      urls.push(`${BASE_URL}/movies/${s}-watch.html`);
      urls.push(`${BASE_URL}/movies/${s}-trailer.html`);
    }

    await pingSearch(urls);
    console.log("🎉 Auto SEO generation complete.");
  } catch (err) {
    console.error("❌ Error:", err.message || err);
    process.exit(1);
  }
}

main();
