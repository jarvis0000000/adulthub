// FINAL Dareloom v8 - YouTube + Streamtape + Drive + Telegram + Ads + Dynamic Schema
const SHEET_API = "https://sheets.googleapis.com/v4/spreadsheets/1A2I6jODnR99Hwy9ZJXPkGDtAFKfpYwrm3taCWZWoZ7o/values/Sheet1?alt=json&key=AIzaSyA2OVy5Y8UGDrhCWLQeEMcBk8DtjXuFowc";
const AD_POP = "//pl27626803.revenuecpmgate.com/24/e4/33/24e43300238cf9b86a05c918e6b00561.js";
const PER_PAGE = 5;
let items = [], current = null, currentPage = 1;

// --------- Fetch Google Sheet ---------
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

// --------- Parse Rows (Updated for Description and Category) ---------
function norm(s){ return (s||'').toString().trim().toLowerCase(); }
function findHeaderIndex(headers, candidates){
  for(let i=0;i<headers.length;i++){
    const h = norm(headers[i]);
    for(const c of candidates) if(h === c.toLowerCase()) return i;
  }
  return -1;
}

function parseRows(values){
  if(!values || values.length < 2) return [];
  const headers = (values[0]||[]).map(h=> (h||'').toString());
  const ti = findHeaderIndex(headers, ['title']);
  const tr = findHeaderIndex(headers, ['trailer','video','trailer link','trailer_url']);
  const wa = findHeaderIndex(headers, ['watch','watch ','watch link','watchlink']);
  const th = findHeaderIndex(headers, ['thumbnail','poster','poster_url']);
  const dt = findHeaderIndex(headers, ['date']);
  const de = findHeaderIndex(headers, ['description', 'desc']); // ✅ Description Column Index
  const ca = findHeaderIndex(headers, ['category', 'cat']);   // ✅ Category Column Index
  const rows = values.slice(1);
  const out = [];
  for(let r of rows){
    const title = ti !== -1 ? (r[ti]||'') : (r[0]||'');
    const trailer = tr !== -1 ? (r[tr]||'') : (r[2]||'');
    const watch = wa !== -1 ? (r[wa]||'') : (r[6]||'');
    const poster = th !== -1 ? (r[th]||'') : '';
    const date = dt !== -1 ? (r[dt]||'') : '';
    const description = de !== -1 ? (r[de]||'') : ''; // ✅ Description value
    const category = ca !== -1 ? (r[ca]||'') : ''; // ✅ Category value

    if((trailer && trailer.trim()) || (watch && watch.trim())){
      out.push({ 
        id: (title||'') + '|' + (watch||''), 
        title: title||'Untitled', 
        trailer: trailer||'', 
        watch: watch||'', 
        poster: poster||'', 
        date: date||'', 
        description: description, // ✅ Add to item object
        category: category         // ✅ Add to item object
      });
    }
  }
  return out;
}

// --------- Utilities ---------
function extractYouTubeID(url){
  if(!url) return null;
  const m = url.match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([0-9A-Za-z_-]{11})/);
  return m ? m[1] : null;
}

function makeThumbnail(item){
  if(item.poster && item.poster.trim()) return item.poster;
  const y = extractYouTubeID(item.trailer) || extractYouTubeID(item.watch);
  if(y) return 'https://img.youtube.com/vi/' + y + '/hqdefault.jpg';
  return 'https://placehold.co/600x400?text=Dareloom+Hub';
}

function toEmbedUrl(url){
  if(!url) return '';
  url = url.trim();
  const y = extractYouTubeID(url);
  if(y) return 'https://www.youtube.com/embed/' + y + '?autoplay=1&rel=0';
  if(url.includes('youtube.com/embed')) return url;
  if(url.match(/drive\.google\.com/)){
    const m = url.match(/[-\w]{25,}/);
    if(m) return 'https://drive.google.com/file/d/' + m[0] + '/preview';
  }
  if(url.includes("streamtape.com")) {
    if(url.includes("/v/")) {
      const id = url.split("/v/")[1].split("/")[0];
      return "https://streamtape.com/e/" + id + "/";
    }
    if(url.includes("/e/")) return url;
  }
  if(url.includes("t.me/") || url.includes("telegram.me/")) return '';
  if(url.match(/\.mp4($|\?)/i)) return url;
  return url;
}

function escapeHtml(s){ return (s||'').toString().replace(/[&<>]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }

// --------- Render Functions ---------
function renderRandom(){
  const g = document.getElementById('randomGrid'); if(!g) return; g.innerHTML='';
  const pool = items.slice(); const picks = [];
  while(picks.length < 4 && pool.length) picks.push(pool.splice(Math.floor(Math.random()*pool.length),1)[0]);
  picks.forEach(it => {
    const card = document.createElement('div'); card.className='card';
    const t = makeThumbnail(it);
    card.innerHTML = `<img class="thumb" src="${escapeHtml(t)}" loading="lazy"><div class="meta"><h4>${escapeHtml(it.title)}</h4></div>`;
    card.addEventListener('click', ()=> showItem(it));
    g.appendChild(card);
  });
}

function renderLatest(){
  const list = document.getElementById('latestList'); if(!list) return; list.innerHTML='';
  const start = (currentPage-1)*PER_PAGE; const slice = items.slice(start, start+PER_PAGE);
  slice.forEach(it => {
    const div = document.createElement('div'); div.className='latest-item';
    const t = makeThumbnail(it);
    div.innerHTML = `<img class="latest-thumb" src="${escapeHtml(t)}" loading="lazy"><div class="latest-info"><div style="font-weight:700">${escapeHtml(it.title)}</div><div style="color:var(--muted);font-size:13px;margin-top:6px">${escapeHtml(it.date||'')}</div><div style="margin-top:8px"><button class="btn" onclick="showItemById('${escapeHtml(it.id)}')">Preview</button> <button class="watch-btn" onclick="openWatchById('${escapeHtml(it.id)}')">Watch</button></div></div>`;
    list.appendChild(div);
  });
  renderPager();
}

function renderPager(){
  const pager = document.getElementById('pager'); if(!pager) return; pager.innerHTML='';
  const pages = Math.max(1, Math.ceil(items.length / PER_PAGE));
  for(let i=1;i<=pages;i++){
    const b = document.createElement('button'); b.className='page-btn'; b.textContent = i; if(i===currentPage) b.style.opacity='0.7';
    b.addEventListener('click', ()=>{ openAdAndChangePage(i); });
    pager.appendChild(b);
  }
}

// openAdAndChangePage function (Updated for pop-up blocker)
function openAdAndChangePage(page){
  // No delay, page is changed instantly
  currentPage = page; 
  renderLatest(); 
  window.scrollTo({top:300,behavior:'smooth'}); 

  // Ad script is loaded after the action
  const s = document.createElement('script'); s.src = AD_POP; s.async = true; document.body.appendChild(s);
}

// --------- Show Video ---------
function showItemById(id){ const it = items.find(x=>x.id===id); if(it) showItem(it); }
function openWatchById(id){ const it = items.find(x=>x.id===id); if(it) openWatchWithAd(it); }

function showItem(it){
  current = it;
  const embed = toEmbedUrl(it.trailer);
  const p = document.getElementById('playerWrap');
  if(!p) return;
  p.innerHTML='';

  if(embed){
    if(embed.match(/\.mp4($|\?)/i)){
      const v = document.createElement('video');
      v.controls=true; v.autoplay=true; v.muted=true; v.playsInline=true;
      v.src = embed;
      p.appendChild(v);
    } else {
      const iframe = document.createElement('iframe');
      iframe.src = embed;
      iframe.allow = 'autoplay; encrypted-media; picture-in-picture';
      iframe.allowFullscreen = true;
      iframe.style.width='100%'; iframe.style.height='420px';
      p.appendChild(iframe);
    }
  } else {
    const msg = document.createElement('div');
    msg.style.textAlign='center';
    msg.style.padding='20px';
    msg.innerHTML = `<button class="watch-btn" onclick="openTrailerNewTab('${escapeHtml(it.trailer)}')">Open in Telegram</button>`;
    p.appendChild(msg);
  }

  document.getElementById('nowTitle').textContent = it.title || '';
  renderRandom();
  injectSchema(it); // Dynamic schema
}

// --------- Open Watch with Ad (Updated for pop-up blocker with fallback) ---------
function openWatchWithAd(it){
  if(!it) return;
  const target = it.watch || '#';
  let newWindow = null;

  try {
    if(target.includes("t.me/") || target.includes("telegram.me/")){
      // Telegram links always use window.location.href to ensure they open
      window.location.href = target;
    } else {
      // For other links, try to open in a new window immediately
      newWindow = window.open(target,'_blank');
      // If newWindow is null (blocked by pop-up blocker), redirect current tab
      if(!newWindow || newWindow.closed || typeof newWindow.closed=='undefined') {
        window.location.href = target;
      }
    }
  } catch(e){
    console.error("Open error:", e);
    // Fallback if any error occurs during window.open
    window.location.href = target;
  }

  // Then load the ad script (after the user action)
  const s = document.createElement('script'); s.src = AD_POP; s.async = true; document.body.appendChild(s);
  
  const watchAd = document.getElementById('watchAd');
  if(watchAd) watchAd.textContent = 'Opening...'; // This message might not be seen if direct redirect
}


// --------- Schema Injection (Updated for Description) ---------
function injectSchema(it){
  const oldSchema = document.getElementById('video-schema');
  if(oldSchema) oldSchema.remove();
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.id = 'video-schema';
  const thumb = makeThumbnail(it);
  script.text = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "VideoObject",
    "name": it.title,
    "description": it.description && it.description.trim() ? it.description : it.title, // ✅ Use description if available, else title
    "thumbnailUrl": thumb,
    "uploadDate": it.date || new Date().toISOString().split("T")[0],
    "contentUrl": it.watch,
    "embedUrl": toEmbedUrl(it.trailer),
    "publisher": {
      "@type": "Organization",
      "name": "Dareloom Hub",
      "url": "https://dareloom.fun"
    }
  });
  document.head.appendChild(script);
}

// --------- Misc ---------
function openTrailerNewTab(url){ if(url) window.open(url,'_blank'); }
function showRandomPick(){ if(items.length===0) return; const pick = items[Math.floor(Math.random()*items.length)]; showItem(pick); renderRandom(); }

window.showItemById = showItemById;
window.openWatchById = openWatchById;

document.getElementById && document.getElementById('shuffleBtn').addEventListener('click', showRandomPick);
document.getElementById && document.getElementById('watchNowTop').addEventListener('click', ()=> openWatchWithAd(current));

// --------- Load All ---------
async function loadAll(){
  const vals = await fetchSheet();
  const parsed = parseRows(vals);
  const haveDates = parsed.some(i=>i.date && i.date.trim());
  if(haveDates) parsed.sort((a,b)=> new Date(b.date||0) - new Date(a.date||0));
  else parsed.reverse();
  items = parsed;
  const cnt = document.getElementById('count'); if(cnt) cnt.textContent = items.length + ' items';
  renderRandom(); renderLatest(); showRandomPick();
}

loadAll();
  
