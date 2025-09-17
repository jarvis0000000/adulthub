// FINAL Dareloom v4 - embed-first behavior: try to embed trailer URL directly (best-effort).
const SHEET_API = "https://sheets.googleapis.com/v4/spreadsheets/1A2I6jODnR99Hwy9ZJXPkGDtAFKfpYwrm3taCWZWoZ7o/values/Sheet1?alt=json&key=AIzaSyA2OVy5Y8UGDrhCWLQeEMcBk8DtjXuFowc";
const AD_POP = "//pl27626803.revenuecpmgate.com/24/e4/33/24e43300238cf9b86a05c918e6b00561.js";
const PER_PAGE = 5;
let items = [], current = null, currentPage = 1;

async function fetchSheet(){
  try{
    console.log('[Dareloom] fetching', SHEET_API);
    const res = await fetch(SHEET_API);
    if(!res.ok) throw new Error('sheet fetch failed ' + res.status);
    const j = await res.json();
    return j.values || [];
  }catch(e){
    console.error('[Dareloom] fetch error', e);
    return [];
  }
}

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
  console.log('[Dareloom] headers:', headers);
  const ti = findHeaderIndex(headers, ['title']);
  const tr = findHeaderIndex(headers, ['trailer','video','trailer link','trailer_url']);
  const dl = findHeaderIndex(headers, ['download','tele', 'telegram']);
  const th = findHeaderIndex(headers, ['thumbnail','poster','poster_url']);
  const dt = findHeaderIndex(headers, ['date']);
  const rows = values.slice(1);
  const out = [];
  for(let r of rows){
    const title = ti !== -1 ? (r[ti]||'') : (r[0]||'');
    const trailer = tr !== -1 ? (r[tr]||'') : (r[2]||'');
    const download = dl !== -1 ? (r[dl]||'') : (r[6]||'');
    const watch = ''; // Set watch to an empty string to remove the 'Watch' column
    const poster = th !== -1 ? (r[th]||'') : '';
    const date = dt !== -1 ? (r[dt]||'') : '';
    if((trailer && trailer.trim()) || (download && download.trim())){
      out.push({ id: (title||'') + '|' + (download||''), title: title||'Untitled', trailer: trailer||'', download: download||'', watch: watch||'', poster: poster||'', date: date||'' });
    }
  }
  return out;
}

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

function isEmbeddable(url) {
  if (!url || !url.trim()) return false;
  url = url.trim().toLowerCase();
  if (url.includes('youtube.com') || url.includes('youtu.be')) return true;
  if (url.includes('drive.google.com')) return true;
  if (url.match(/\.mp4($|\?)/i)) return true;
  return false;
}

function toEmbedUrl(url) {
  if (!url || !isEmbeddable(url)) return '';
  url = url.trim();
  const y = extractYouTubeID(url);
  if (y) return 'https://www.youtube.com/embed/' + y + '?autoplay=1&rel=0';
  if (url.includes('youtube.com/embed')) return url;
  if (url.match(/drive\.google\.com/)) {
    const m = url.match(/file\/d\/([A-Za-z0-9_-]+)/);
    if (m) return 'https://drive.google.com/file/d/' + m[1] + '/preview';
  }
  return url;
}

function escapeHtml(s){ return (s||'').toString().replace(/[&<>]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }

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
    const watchButton = it.download ? `<button class="btn" onclick="openDownloadById('${escapeHtml(it.id)}')">Watch Online</button>` : '';
    
    div.innerHTML = `<img class="latest-thumb" src="${escapeHtml(t)}" loading="lazy"><div class="latest-info"><div style="font-weight:700">${escapeHtml(it.title)}</div><div style="color:var(--muted);font-size:13px;margin-top:6px">${escapeHtml(it.date||'')}</div><div style="margin-top:8px"><button class="btn" onclick="showItemById('${escapeHtml(it.id)}')">Preview</button> ${watchButton}</div></div>`;
    list.appendChild(div);
  });
  renderPager();
}

function renderPager(){
  const pager = document.getElementById('pager'); if(!pager) return; pager.innerHTML='';
  const pages = Math.max(1, Math.ceil(items.length / PER_PAGE));
  for(let i=1;i<=pages;i++){
    const b = document.createElement('button'); b.className='page-btn'; b.textContent = i; if(i===currentPage) b.style.opacity='0.7';
    b.addEventListener('click', ()=>{ currentPage = i; renderLatest(); window.scrollTo({top:300,behavior:'smooth'}); });
    pager.appendChild(b);
  }
}

function showItemById(id){ const it = items.find(x=>x.id===id); if(it) showItem(it); }
function openDownloadById(id) { const it = items.find(x=>x.id===id); if(it) openDownloadWithAd(it); }

function showItem(it){
  current = it;
  const embed = toEmbedUrl(it.trailer);
  const p = document.getElementById('playerWrap');
  if (!p) return;
  p.innerHTML = '';
  
  if (embed) {
    if (embed.match(/\.mp4($|\?)/i)) {
      const v = document.createElement('video');
      v.controls = true;
      v.autoplay = true;
      v.muted = true;
      v.playsInline = true;
      v.src = embed;
      p.appendChild(v);
    } else {
      const iframe = document.createElement('iframe');
      iframe.src = embed;
      iframe.allow = 'autoplay; encrypted-media; picture-in-picture';
      iframe.allowFullscreen = true;
      iframe.style.width = '100%';
      iframe.style.height = '420px';
      p.appendChild(iframe);
      const fallback = document.createElement('div');
      fallback.style.textAlign = 'center';
      fallback.style.marginTop = '8px';
      fallback.innerHTML = `<button class="watch-btn" style="margin-top:8px" onclick="openTrailerNewTab('${escapeHtml(it.trailer)}')">Open Trailer (If not playing)</button>`;
      p.appendChild(fallback);
    }
  } else {
    const t = makeThumbnail(it);
    const html = `<div style="padding:18px;text-align:center"><img src="${escapeHtml(t)}" style="max-width:100%;height:auto;border-radius:8px;display:block;margin:0 auto 12px"><div style="margin-top:8px"><button class="watch-btn" onclick="openTrailerNewTab('${escapeHtml(it.trailer)}')">Open Trailer</button></div></div>`;
    p.innerHTML = html;
  }
  document.getElementById('nowTitle').textContent = it.title || '';
  renderRandom();
}

function openTrailerNewTab(url){
  if(!url) return alert('No trailer link');
  try{ window.open(url,'_blank'); }catch(e){ window.location.href = url; }
}

function showRandomPick(){ if(items.length===0) return; const pick = items[Math.floor(Math.random()*items.length)]; showItem(pick); renderRandom(); }

function openDownloadWithAd(it){
  if(!it) return; const target = it.download || '#';
  const s = document.createElement('script'); s.type='text/javascript'; s.src = AD_POP; s.async = true; document.body.appendChild(s);
  const watchAd = document.getElementById('watchAd'); if(watchAd) watchAd.textContent = 'Opening...';
  setTimeout(()=>{ try{ window.open(target,'_blank'); }catch(e){ window.open(target,'_blank'); } }, 900);
}

window.showItemById = showItemById; window.openDownloadById = openDownloadById;
document.getElementById && document.getElementById('shuffleBtn').addEventListener('click', showRandomPick);
document.getElementById && document.getElementById('watchNowTop').addEventListener('click', ()=> openDownloadWithAd(current));

async function loadAll(){
  const vals = await fetchSheet();
  const parsed = parseRows(vals);
  const haveDates = parsed.some(i=>i.date && i.date.trim());
  if(haveDates) parsed.sort((a,b)=> new Date(b.date||0) - new Date(a.date||0));
  else parsed.reverse();
  items = parsed;
  console.log('[Dareloom] items', items.length, items.slice(0,6));
  const cnt = document.getElementById('count'); if(cnt) cnt.textContent = items.length + ' items';
  renderRandom(); renderLatest();
}
setInterval(loadAll,45000);
loadAll();
