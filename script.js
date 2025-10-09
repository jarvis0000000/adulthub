// ✅ DARELOOM HUB FINAL SCRIPT (v5 Stable)
// All main features + SEO + Streamtape Embed fixed

const SHEET_API = "https://sheets.googleapis.com/v4/spreadsheets/1A2I6jODnR99Hwy9ZJXPkGDtAFKfpYwrm3taCWZWoZ7o/values/Sheet1?alt=json&key=AIzaSyBFnyqCW37BUL3qrpGva0hitYUhxE_x5nw";
const AD_POP = "//pl27626803.revenuecpmgate.com/24/e4/33/24e43300238cf9b86a05c918e6b00561.js";
const PER_PAGE = 5;
let items = [], current = null, currentPage = 1;

// --- Ad Scripts ---
const ADSTERRA_NATIVE_BANNER_SCRIPT = '<script type="text/javascript" src="//www.highperformanceformat.com/d1be46ed95d3e2db572824c531da5082/invoke.js"></script>';
const ADSTERRA_SOCIAL_BAR_SCRIPT = '<script type="text/javascript" src="//pl27654958.revenuecpmgate.com/cb/63/19/cb6319838ced4608354b54fc6faddb8a.js"></script>';

const AUTO_POP_INTERVAL_MS = 30000;
let autoPopTimer = null;
let autoPopEnabled = (localStorage.getItem('auto_pop_enabled') !== 'false');

function startAutoPop() {
  stopAutoPop();
  if (!autoPopEnabled || document.hidden) return;
  autoPopTimer = setInterval(openAdsterraPop, AUTO_POP_INTERVAL_MS);
}
function stopAutoPop() {
  if (autoPopTimer) clearInterval(autoPopTimer);
  autoPopTimer = null;
}
document.addEventListener('visibilitychange', () => (document.hidden ? stopAutoPop() : startAutoPop()));
window.addEventListener('beforeunload', stopAutoPop);

function openAdsterraPop() {
  const s = document.createElement('script');
  s.src = AD_POP; s.async = true;
  document.body.appendChild(s);
  setTimeout(() => { try { s.remove(); } catch(e){} }, 2000);
}

// --- UTIL ---
function getLinkName(url) {
  if (!url) return 'Watch Link';
  try {
    if (url.includes('streamtape.com')) return 'Streamtape Watch';
    if (url.includes('t.me')) return 'Telegram Download';
    if (url.includes('gofile.io')) return 'GoFile Watch';
    if (url.includes('drive.google.com')) return 'Google Drive Watch';
    const domain = new URL(url).hostname.replace(/^www\./,'');
    return domain.split('.')[0].toUpperCase() + ' Link';
  } catch { return 'External Link'; }
}

async function fetchSheet() {
  try {
    const r = await fetch(SHEET_API);
    const j = await r.json();
    return j.values || [];
  } catch { return []; }
}

function extractYouTubeID(u) {
  const m = u.match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([0-9A-Za-z_-]{11})/);
  return m ? m[1] : null;
}

function toEmbedUrl(u) {
  if (!u) return '';
  u = u.trim();
  const y = extractYouTubeID(u);
  if (y) return `https://www.youtube.com/embed/${y}?autoplay=1`;
  if (u.includes("streamtape.com/v/")) return u.replace("/v/","/e/");
  if (u.match(/drive\.google\.com/)) {
    const id = u.match(/[-\w]{25,}/);
    return id ? `https://drive.google.com/file/d/${id[0]}/preview` : u;
  }
  if (u.match(/\.mp4/i)) return u;
  return u;
}

function makeThumbnail(it) {
  if (it.poster) return it.poster;
  const y = extractYouTubeID(it.trailer || it.watch);
  return y ? `https://img.youtube.com/vi/${y}/hqdefault.jpg` : 'https://placehold.co/600x400?text=Dareloom+Hub';
}

// --- WATCH ---
function openAdsterraThenWatch(url) {
  if (!url) return;
  openAdsterraPop();
  setTimeout(() => {
    if (url.includes("/v/")) url = url.replace("/v/", "/e/");
    const watchPage = `watch.html?url=${encodeURIComponent(url)}`;
    window.open(watchPage, "_blank");
  }, 200);
}

// --- MODAL PLAYER ---
function openPlayerModal(it) {
  current = it;
  const modal = document.getElementById("videoModal");
  const wrap = document.getElementById("modalPlayerWrap");
  const controls = document.getElementById("modalControlsContainer");
  wrap.innerHTML = '';
  const embed = toEmbedUrl(it.trailer || it.watch);
  if (embed.includes(".mp4"))
    wrap.innerHTML = `<video src="${embed}" controls autoplay style="width:100%;height:420px"></video>`;
  else
    wrap.innerHTML = `<iframe src="${embed}" allowfullscreen style="width:100%;height:420px;border:none"></iframe>`;
  document.getElementById("modalVideoTitle").textContent = it.title;
  controls.innerHTML = `<button class='watch-btn' onclick="openAdsterraThenWatch('${it.watch}')">${getLinkName(it.watch)}</button>`;
  modal.style.display = "flex";
  injectSchema(it);
}
window.closePlayerModal = ()=>document.getElementById("videoModal").style.display='none';

// --- SCHEMA ---
function injectSchema(it) {
  const old = document.getElementById("video-schema");
  if (old) old.remove();
  const s = document.createElement("script");
  s.type="application/ld+json"; s.id="video-schema";
  s.text = JSON.stringify({
    "@context":"https://schema.org",
    "@type":"VideoObject",
    "name": it.title,
    "thumbnailUrl": makeThumbnail(it),
    "description": it.description || it.title,
    "uploadDate": it.date || new Date().toISOString(),
    "embedUrl": toEmbedUrl(it.watch),
    "contentUrl": it.watch,
    "publisher": { "@type":"Organization", "name":"Dareloom Hub", "url":"https://dareloom.fun" }
  });
  document.head.appendChild(s);
}

// --- INIT ---
async function loadAll() {
  const vals = await fetchSheet();
  const rows = vals.slice(1);
  items = rows.map(r=>({title:r[0],watch:r[6],trailer:r[2],poster:r[17],date:r[19],description:r[18]||''})).reverse();

  // if direct /video/slug
  if (window.location.pathname.startsWith("/video/")) {
    const slug = decodeURIComponent(window.location.pathname.split("/video/")[1]);
    const candidate = items.find(x=>slug && x.title && slug.toLowerCase().includes(x.title.toLowerCase().split(' ')[0]));
    if (candidate) {
      document.title = `${candidate.title} - Dareloom Hub`;
      const main = document.getElementById("mainWrap");
      main.innerHTML = `
        <div style="padding:20px;text-align:center;color:white;">
          <h2>${candidate.title}</h2>
          <iframe src="${toEmbedUrl(candidate.watch)}" allowfullscreen style="width:100%;height:70vh;border:none;"></iframe>
          <div style="margin-top:10px;"><a href="${candidate.watch}" target="_blank" class="btn">Open in Streamtape</a></div>
        </div>`;
      injectSchema(candidate);
      return;
    }
  }
}
loadAll();
