// ✅ FINAL DARELOOM HUB SCRIPT (V3 – AUTO THUMBNAIL + DATE SAFE + DEBUG ENABLED)

const SHEET_API = "https://sheets.googleapis.com/v4/spreadsheets/1A2I6jODnR99Hwy9ZJXPkGDtAFKfpYwrm3taCWZWoZ7o/values/Sheet1?alt=json&key=AIzaSyBFnyqCW37BUL3qrpGva0hitYUhxE_x5nw";
const AD_POP = "//bulletinsituatedelectronics.com/24/e4/33/24e43300238cf9b86a05c918e6b00561.js";
const PER_PAGE = 5;
let items = [], current = null, currentPage = 1;

// ==== POP SETTINGS ====
const POP_COOLDOWN_MS = 7000;
const POP_DELAY_MS = 2000;
const INITIAL_AUTO_POP_DELAY = 10000;
let lastPop = 0;

// ==== AUTO POP ====
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
document.addEventListener("visibilitychange", () => (document.hidden ? stopAutoPop() : startAutoPop()));
window.addEventListener("beforeunload", stopAutoPop);
window.toggleAutoPop = val => {
  autoPopEnabled = typeof val === "boolean" ? val : !autoPopEnabled;
  localStorage.setItem("auto_pop_enabled", autoPopEnabled);
  autoPopEnabled ? startAutoPop() : stopAutoPop();
};

// ==== POP FUNCTION ====
function openAdsterraPop() {
  const now = Date.now();
  if (now - lastPop < POP_COOLDOWN_MS) return;
  lastPop = now;
  setTimeout(() => {
    try {
      const s = document.createElement("script");
      s.src = AD_POP;
      s.async = true;
      document.body.appendChild(s);
      setTimeout(() => s.remove(), 4000);
    } catch (e) {
      console.warn("Ad pop failed:", e);
    }
  }, POP_DELAY_MS);
}

// ==== HELPERS ====
function slugify(t) {
  return t.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
function escapeHtml(s) {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
function extractYouTubeID(url) {
  if (!url) return null;
  const m = url.match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([0-9A-Za-z_-]{11})/);
  return m ? m[1] : null;
}
function makeThumbnail(item) {
  if (item.poster && item.poster.trim()) return item.poster;
  const y = extractYouTubeID(item.trailer) || extractYouTubeID(item.watch);
  if (y) return `https://img.youtube.com/vi/${y}/hqdefault.jpg`;
  return "https://placehold.co/600x400?text=Dareloom+Hub";
}
function toEmbedUrl(url) {
  if (!url) return "";
  url = url.trim();
  const y = extractYouTubeID(url);
  if (y) return `https://www.youtube.com/embed/${y}?autoplay=1&rel=0`;
  if (url.includes("drive.google.com")) {
    const m = url.match(/[-\w]{25,}/);
    if (m) return `https://drive.google.com/file/d/${m[0]}/preview`;
  }
  if (url.includes("streamtape.com") && url.includes("/v/")) {
    const id = url.split("/v/")[1]?.split("/")[0];
    return `https://streamtape.com/e/${id}/`;
  }
  return url;
}

// ==== FETCH & PARSE SHEET ====
async function fetchSheet() {
  try {
    const res = await fetch(SHEET_API);
    if (!res.ok) throw new Error("fetch fail " + res.status);
    const j = await res.json();
    return j.values || [];
  } catch (e) {
    console.error("❌ Sheet Fetch Error:", e);
    return [];
  }
}

function parseRows(values) {
  if (!values || values.length < 2) return [];
  const headers = values[0].map(h => h.toLowerCase().trim());
  const rows = values.slice(1);
  const out = [];

  const idx = {
    title: headers.indexOf("title"),
    trailer: headers.indexOf("trailer"),
    watch: headers.indexOf("watch"),
    poster: headers.indexOf("poster"),
    date: headers.indexOf("date"),
    category: headers.indexOf("category"),
    description: headers.indexOf("description")
  };

  rows.forEach(r => {
    const title = r[idx.title] || "";
    const trailer = r[idx.trailer] || "";
    const watch = r[idx.watch] || "";
    const poster = r[idx.poster] || "";
    const date = r[idx.date] || "";
    const cat = r[idx.category] || "";
    const desc = r[idx.description] || "";

    if (trailer || watch) {
      out.push({
        id: title + "|" + watch,
        title, trailer, watch,
        poster, date, category: cat, description: desc
      });
    }
  });

  console.log("✅ Parsed Rows:", out.length);
  return out;
}

// ==== UI & LOAD ====
async function loadAll() {
  console.log("📡 Loading Google Sheet...");
  const vals = await fetchSheet();
  const parsed = parseRows(vals);
  items = parsed.reverse();

  const cnt = document.getElementById("count");
  if (cnt) cnt.textContent = `${items.length} items`;

  if (!items.length) {
    const latest = document.getElementById("latestSection");
    if (latest) latest.innerHTML = `<div style="padding:40px;color:#f55;text-align:center">❌ No data loaded (check sheet or API)</div>`;
    return;
  }

  renderLatest(1);
  renderRandom();
  setTimeout(openAdsterraPop, INITIAL_AUTO_POP_DELAY);
  startAutoPop();
}

function renderLatest(page = 1) {
  const list = document.getElementById("latestList");
  if (!list) return;
  list.innerHTML = "";
  const start = (page - 1) * PER_PAGE;
  const slice = items.slice(start, start + PER_PAGE);
  slice.forEach(it => {
    const t = makeThumbnail(it);
    const div = document.createElement("div");
    div.className = "latest-item";
    div.innerHTML = `
      <img class="latest-thumb" src="${escapeHtml(t)}" loading="lazy">
      <div class="latest-info">
        <b>${escapeHtml(it.title)}</b><br>
        <small style="color:#aaa">${escapeHtml(it.date || "")}</small><br>
        <button class="btn" onclick="triggerAdThenOpenModalById('${escapeHtml(it.id)}')">Watch</button>
      </div>`;
    list.appendChild(div);
  });
}

// Random Section
function renderRandom() {
  const g = document.getElementById("randomGrid");
  if (!g) return;
  g.innerHTML = "";
  const pool = [...items];
  const picks = [];
  while (picks.length < 4 && pool.length) picks.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  picks.forEach(it => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `<img class="thumb" src="${escapeHtml(makeThumbnail(it))}" loading="lazy">
    <div class="meta"><h4>${escapeHtml(it.title)}</h4></div>`;
    card.onclick = () => triggerAdThenOpenModal(it);
    g.appendChild(card);
  });
}

// Modal openers (kept same)
function triggerAdThenOpenModal(it) {
  openAdsterraPop();
  setTimeout(() => openPlayerModal(it), 150);
}
window.triggerAdThenOpenModalById = id => {
  const it = items.find(x => x.id === id);
  if (it) triggerAdThenOpenModal(it);
};

// Minimal modal function placeholder (if not in DOM)
function openPlayerModal(it) {
  alert(`🎬 Now playing: ${it.title}`);
}

loadAll();
