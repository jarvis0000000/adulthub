// ===============================
// DARELOOM HUB - FINAL EARNING BOOST SCRIPT
// Popunder (Click + Auto after 10s) + AntiBlock
// ===============================

const SHEET_API = "https://sheets.googleapis.com/v4/spreadsheets/1A2I6jODnR99Hwy9ZJXPkGDtAFKfpYwrm3taCWZWoZ7o/values/Sheet1?alt=json&key=AIzaSyBFnyqCW37BUL3qrpGva0hitYUhxE_x5nw";
const ANTI_POP = "//bulletinsituatedelectronics.com/24/e4/33/24e43300238cf9b86a05c918e6b00561.js";

const PER_PAGE = 5;
let items = [], currentPage = 1, lastPop = 0;

// ===============================
// POPUNDER CONTROL
// ===============================
const POP_COOLDOWN_MS = 7000; // 7 sec cooldown
const POP_DELAY_MS = 2000;    // delay before open
const AUTO_POP_DELAY = 10000; // auto pop after 10 sec

function triggerPop() {
  const now = Date.now();
  if (now - lastPop < POP_COOLDOWN_MS) return; // prevent spam
  lastPop = now;

  setTimeout(() => {
    try {
      const s = document.createElement("script");
      s.src = ANTI_POP + "?r=" + Math.floor(Math.random() * 1e6);
      s.async = true;
      document.body.appendChild(s);
      setTimeout(() => s.remove(), 4000);
    } catch (e) {
      console.warn("Popunder failed:", e);
    }
  }, POP_DELAY_MS);
}

// Trigger on button clicks
document.addEventListener("click", (e) => {
  const t = e.target.closest(".watch-btn, .btn, .preview-btn, .page-btn");
  if (t) triggerPop();
}, { passive: true });

// Auto pop once after 10 seconds
window.addEventListener("load", () => {
  setTimeout(() => triggerPop(), AUTO_POP_DELAY);
});

// ===============================
// HELPERS
// ===============================
function slugify(text) {
  return text.toString().toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
function escapeHtml(s) {
  return (s || "").toString().replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function extractYouTubeID(url) {
  if (!url) return null;
  const m = url.match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([0-9A-Za-z_-]{11})/);
  return m ? m[1] : null;
}
function makeThumbnail(it) {
  if (it.poster?.trim()) return it.poster;
  const y = extractYouTubeID(it.trailer) || extractYouTubeID(it.watch);
  if (y) return `https://img.youtube.com/vi/${y}/hqdefault.jpg`;
  return "https://placehold.co/600x400?text=Dareloom+Hub";
}
function toEmbedUrl(url) {
  if (!url) return "";
  const y = extractYouTubeID(url);
  if (y) return `https://www.youtube.com/embed/${y}?autoplay=1`;
  if (url.includes("drive.google.com")) {
    const m = url.match(/[-\\w]{25,}/);
    if (m) return `https://drive.google.com/file/d/${m[0]}/preview`;
  }
  if (url.includes("streamtape.com/v/")) {
    const id = url.split("/v/")[1].split("/")[0];
    return `https://streamtape.com/e/${id}/`;
  }
  return url;
}

// ===============================
// FETCH SHEET DATA
// ===============================
async function fetchSheet() {
  try {
    const res = await fetch(SHEET_API);
    const j = await res.json();
    return j.values || [];
  } catch (e) {
    console.error("Fetch error:", e);
    return [];
  }
}

function parseRows(values) {
  if (!values || values.length < 2) return [];
  const TI = 0, TR = 2, WA = 6, TH = 17, DT = 19, CA = 20;
  const headers = (values[0] || []).map(h => (h || "").toString());
  const DE = headers.findIndex(h => h.toLowerCase().includes("desc"));
  return values.slice(1).map(r => ({
    id: (r[TI] || "") + "|" + (r[WA] || ""),
    title: r[TI] || "Untitled",
    trailer: r[TR] || "",
    watch: r[WA] || "",
    poster: r[TH] || "",
    date: r[DT] || "",
    description: DE !== -1 ? (r[DE] || "") : "",
    category: r[CA] || ""
  })).filter(it => it.watch || it.trailer);
}

// ===============================
// UI RENDERING
// ===============================
function renderLatest(page = currentPage) {
  const list = document.getElementById("latestList");
  if (!list) return;
  list.innerHTML = "";
  const total = Math.ceil(items.length / PER_PAGE);
  currentPage = page;
  const slice = items.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  slice.forEach(it => {
    const div = document.createElement("div");
    div.className = "latest-item";
    const thumb = makeThumbnail(it);
    div.innerHTML = `
      <img class="latest-thumb" src="${escapeHtml(thumb)}" loading="lazy">
      <div class="latest-info">
        <div class="title">${escapeHtml(it.title)}</div>
        <div class="date">${escapeHtml(it.date || "")}</div>
        <div class="btns">
          <button class="btn preview-btn" onclick="openModalWithPop('${escapeHtml(it.id)}')">Preview</button>
          <button class="watch-btn" onclick="openModalWithPop('${escapeHtml(it.id)}')">Watch</button>
        </div>
      </div>`;
    list.appendChild(div);
  });
  renderPagination(total, page);
}

function renderPagination(total, current) {
  const pager = document.getElementById("pager");
  if (!pager) return;
  pager.innerHTML = "";
  if (total <= 1) return;
  for (let i = 1; i <= total; i++) {
    const btn = document.createElement("button");
    btn.className = "page-btn" + (i === current ? " active" : "");
    btn.textContent = i;
    btn.onclick = () => { triggerPop(); renderLatest(i); };
    pager.appendChild(btn);
  }
}

// ===============================
// MODAL PLAYER
// ===============================
function openModalWithPop(id) {
  triggerPop();
  const it = items.find(x => x.id === id);
  if (!it) return;
  const modal = document.getElementById("videoModal");
  const wrap = document.getElementById("modalPlayerWrap");
  const title = document.getElementById("modalVideoTitle");
  const desc = document.getElementById("modalVideoDescription");
  modal.style.display = "flex";
  document.body.style.overflow = "hidden";
  wrap.innerHTML = `<iframe src="${toEmbedUrl(it.trailer || it.watch)}" allowfullscreen style="width:100%;height:420px;border:none;"></iframe>`;
  title.textContent = it.title;
  desc.textContent = it.description || "";
}

function closePlayerModal() {
  const modal = document.getElementById("videoModal");
  modal.style.display = "none";
  document.body.style.overflow = "";
}

// ===============================
// INIT
// ===============================
async function loadAll() {
  const vals = await fetchSheet();
  items = parseRows(vals).reverse();
  document.getElementById("count").textContent = `${items.length} items`;
  renderLatest(1);
}

loadAll();
