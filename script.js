// FINAL DARELOOM HUB SCRIPT v26 — FIXED: Direct /video/ URLs, Canonical SEO, Auto Pop, Adsterra Integration

const SHEET_API = "https://sheets.googleapis.com/v4/spreadsheets/1A2I6jODnR99Hwy9ZJXPkGDtAFKfpYwrm3taCWZWoZ7o/values/Sheet1?alt=json&key=AIzaSyBFnyqCW37BUL3qrpGva0hitYUhxE_x5nw";
const AD_POP = "//pl27626803.revenuecpmgate.com/24/e4/33/24e43300238cf9b86a05c918e6b00561.js";
const PER_PAGE = 5;
let items = [], current = null, currentPage = 1;

// --- Adsterra Ad Codes ---
const ADSTERRA_NATIVE_BANNER_SCRIPT = `<script type="text/javascript" src="//www.highperformanceformat.com/d1be46ed95d3e2db572824c531da5082/invoke.js"></script>`;
const ADSTERRA_SOCIAL_BAR_SCRIPT = `<script type='text/javascript' src='//pl27654958.revenuecpmgate.com/cb/63/19/cb6319838ced4608354b54fc6faddb8a.js'></script>`;

// --- AUTO POP SETTINGS ---
const AUTO_POP_INTERVAL_MS = 30000;
let autoPopTimer = null;
let autoPopEnabled = (localStorage.getItem('auto_pop_enabled') !== 'false');

function startAutoPop() {
  stopAutoPop();
  if (!autoPopEnabled || document.hidden) return;
  autoPopTimer = setInterval(openAdsterraPop, AUTO_POP_INTERVAL_MS);
}
function stopAutoPop() { if (autoPopTimer) clearInterval(autoPopTimer); autoPopTimer = null; }
document.addEventListener('visibilitychange', () => document.hidden ? stopAutoPop() : startAutoPop());
window.addEventListener('beforeunload', stopAutoPop);
window.toggleAutoPop = function(val) {
  autoPopEnabled = typeof val === 'boolean' ? val : !autoPopEnabled;
  localStorage.setItem('auto_pop_enabled', autoPopEnabled ? 'true' : 'false');
  autoPopEnabled ? startAutoPop() : stopAutoPop();
};

// --- Pop-under Ad Trigger ---
function openAdsterraPop() {
  try {
    const s = document.createElement('script');
    s.src = AD_POP; s.async = true; document.body.appendChild(s);
    setTimeout(() => s.remove(), 2000);
  } catch(e) { console.warn("Ad pop failed:", e); }
}

// --- Fetch & Parse Sheet ---
async function fetchSheet() {
  try {
    const res = await fetch(SHEET_API);
    if(!res.ok) throw new Error('sheet fetch failed ' + res.status);
    const j = await res.json();
    return j.values || [];
  } catch(e) {
    console.error("Fetch error:", e);
    return [];
  }
}
function norm(s){ return (s||'').toString().trim().toLowerCase(); }
function parseRows(values){
  if(!values || values.length < 2) return [];
  const TI = 0, TR = 2, WA = 6, TH = 17, DT = 19, CA = 20;
  const headers = (values[0]||[]).map(h=> (h||'').toString());
  const DE = headers.findIndex(h => norm(h) === 'description' || norm(h) === 'desc');
  const rows = values.slice(1);
  const out = [];
  for(let r of rows){
    const title = r[TI]||'';
    const trailer = r[TR]||'';
    const watch = r[WA]||'';
    const poster = r[TH]||'';
    const date = r[DT]||'';
    const category = r[CA]||'';
    const description = DE !== -1 ? (r[DE]||'') : '';
    if((trailer && trailer.trim()) || (watch && watch.trim())){
      out.push({
        id: (title||'') + '|' + (watch||''),
        title, trailer, watch, poster, date, description, category
      });
    }
  }
  return out;
}
function extractYouTubeID(url){
  if(!url) return null;
  const m = url.match(/(?:v=|youtu.be\/|shorts\/|embed\/)([0-9A-Za-z_-]{11})/);
  return m ? m[1] : null;
}
function makeThumbnail(item){
  if(item.poster && item.poster.trim()) return item.poster;
  const y = extractYouTubeID(item.trailer) || extractYouTubeID(item.watch);
  return y ? `https://img.youtube.com/vi/${y}/hqdefault.jpg` : 'https://placehold.co/600x400?text=Dareloom+Hub';
}
function toEmbedUrl(url){
  if(!url) return '';
  url = url.trim();
  const y = extractYouTubeID(url);
  if(y) return `https://www.youtube.com/embed/${y}?autoplay=1&rel=0`;
  if(url.match(/drive.google.com/)){
    const m = url.match(/[-\w]{25,}/);
    if(m) return `https://drive.google.com/file/d/${m[0]}/preview`;
  }
  if(url.includes("streamtape.com")){
    let id;
    if(url.includes("/v/")) {
      id = url.split("/v/")[1].split("/")[0];
      return "https://streamtape.com/e/" + id + "/";
    }
    if(url.includes("/e/")) return url;
  }
  if(url.match(/.mp4($|\?)/i)) return url;
  return '';
}
function escapeHtml(s){ return (s||'').toString().replace(/[&<>]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }

// --- JSON-LD Schema ---
function injectSchema(it){
  const old = document.getElementById('video-schema'); if(old) old.remove();
  const script = document.createElement('script');
  script.type='application/ld+json'; script.id='video-schema';
  const thumb = makeThumbnail(it);
  script.text = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "VideoObject",
    "name": it.title,
    "description": it.description || it.title,
    "thumbnailUrl": thumb,
    "uploadDate": it.date || new Date().toISOString().split('T')[0],
    "publisher": { "@type": "Organization", "name": "Dareloom Hub", "url": "https://dareloom.fun" },
    "contentUrl": it.watch,
    "embedUrl": toEmbedUrl(it.trailer)
  });
  document.head.appendChild(script);
}

// --- Open Modal ---
function openPlayerModal(it){
  current = it;
  const embed = toEmbedUrl(it.trailer);
  const p = document.getElementById('modalPlayerWrap');
  const modal = document.getElementById('videoModal');
  const controls = document.getElementById('modalControlsContainer');
  const title = document.getElementById('modalVideoTitle');
  const desc = document.getElementById('modalVideoDescription');
  if(!p||!modal) return;
  p.innerHTML='';
  if(embed){
    const iframe = document.createElement('iframe');
    iframe.src=embed; iframe.allow="autoplay; fullscreen";
    iframe.style.width="100%"; iframe.style.height="420px"; iframe.style.border="none";
    p.appendChild(iframe);
  }
  title.textContent = it.title;
  desc.textContent = it.description || '';
  controls.innerHTML = `<button class="watch-btn" onclick="openAdsterraThenWatch('${escapeHtml(it.watch)}')">Watch Now</button>`;
  injectSchema(it);
  modal.style.display='flex';
  document.body.style.overflow='hidden';
}

// --- Close Modal ---
window.closePlayerModal = function(){
  const m=document.getElementById('videoModal'); if(m) m.style.display='none';
  document.body.style.overflow='';
  const p=document.getElementById('modalPlayerWrap'); if(p) p.innerHTML='';
};

// --- Watch Handler ---
function openAdsterraThenWatch(targetUrl){
  if(!targetUrl) return;
  openAdsterraPop();
  setTimeout(()=>{
    let final = targetUrl;
    if(targetUrl.includes("/v/")){
      const id = targetUrl.split("/v/")[1].split("/")[0];
      final = `https://streamtape.com/e/${id}/`;
    }
    const watchUrl = `watch.html?url=${encodeURIComponent(final)}`;
    window.open(watchUrl, "_blank");
    closePlayerModal();
  },150);
}

// --- MAIN LOAD ---
async function loadAll(){
  const vals = await fetchSheet();
  items = parseRows(vals).reverse();
  const cnt = document.getElementById('count');
  if(cnt) cnt.textContent = `${items.length} items`;
  renderLatest(1);
  renderRandom();

  // --- Direct /video/ URL Handler ---
  const path = window.location.pathname;
  if(path.startsWith("/video/")){
    const slug = path.split("/video/")[1];
    if(slug){
      const match = items.find(r=>{
        const title = r.title.toLowerCase().replace(/[^a-z0-9]+/g,"-");
        const id = btoa(r.watch).slice(0,8).replace(/[^a-zA-Z0-9]/g,"");
        return `${title}-${id}`===slug;
      });
      if(match){
        document.title = `${match.title} - Dareloom Hub`;
        injectSchema(match);
        document.getElementById("mainWrap").innerHTML = `
          <div style="padding:20px;">
            <h2 style="color:white;">${escapeHtml(match.title)}</h2>
            <iframe src="${toEmbedUrl(match.watch)}" allowfullscreen style="width:100%;height:70vh;border:none;"></iframe>
          </div>`;
      }
    }
  }

  // --- Canonical Tag Fix ---
  const currentUrl = window.location.origin + window.location.pathname;
  let canonical = document.querySelector('link[rel="canonical"]');
  if(!canonical){ canonical=document.createElement('link'); canonical.rel='canonical'; document.head.appendChild(canonical); }
  canonical.href = currentUrl;

  startAutoPop();
}
loadAll();

// --- Render Helpers ---
function renderRandom(){
  const g=document.getElementById('randomGrid'); if(!g) return;
  g.innerHTML='';
  const picks = [...items].sort(()=>0.5-Math.random()).slice(0,4);
  picks.forEach(it=>{
    const card=document.createElement('div'); card.className='card';
    card.innerHTML=`<img class="thumb" src="${makeThumbnail(it)}"><div class="meta"><h4>${escapeHtml(it.title)}</h4></div>`;
    card.onclick=()=>openPlayerModal(it);
    g.appendChild(card);
  });
}
function renderLatest(page=1){
  const list=document.getElementById('latestList'); if(!list) return;
  list.innerHTML='';
  const slice = items.slice((page-1)*PER_PAGE, page*PER_PAGE);
  slice.forEach(it=>{
    const div=document.createElement('div'); div.className='latest-item';
    div.innerHTML=`
      <img class="latest-thumb" src="${makeThumbnail(it)}">
      <div class="latest-info">
        <div style="font-weight:700">${escapeHtml(it.title)}</div>
        <button class="btn" onclick="openPlayerModal(items.find(x=>x.id==='${it.id}'))">Watch</button>
      </div>`;
    list.appendChild(div);
  });
}
