
// Dareloom Hub script - Google Sheets API + embed logic + pagination + Ad injection
const baseUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/Sheet1?key=${API_KEY}`;
let items = [];
let current = null;
let currentPage = 1;

async function fetchSheetJson(){
  try{
    const res = await fetch(baseUrl);
    if(!res.ok) throw new Error('Fetch failed ' + res.status);
    const data = await res.json();
    return data.values || [];
  }catch(e){
    console.error('fetchSheetJson error', e);
    return [];
  }
}

function parseRows(values){
  if(!values || values.length < 2) return [];
  const headers = values[0].map(h => h.trim());
  const rows = values.slice(1);
  const arr = rows.map(r => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = (r[i] || '').toString());
    return obj;
  }).filter(x => (x.Trailer && x.Trailer.trim()) || (x.Watch && x.Watch.trim()));
  return arr.map((it, i) => ({
    id: it.Title ? (it.Title + '|' + (it.Watch||'')).slice(0,140) : String(i),
    title: it.Title || it.title || 'Untitled',
    trailer: it.Trailer || it.trailer || '',
    watch: it.Watch || it.watch || '',
    poster: it.Poster || it.poster || '',
    date: it.Date || it.date || ''
  }));
}

function toEmbedUrl(url){
  if(!url) return '';
  url = url.trim();
  // YouTube (id 11 chars)
  const yt = url.match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([0-9A-Za-z_-]{11})/);
  if(yt && yt[1]) return 'https://www.youtube.com/embed/' + yt[1] + '?autoplay=1&rel=0';
  if(url.includes('youtube.com/embed')) return url;
  // Vimeo
  const vm = url.match(/vimeo\.com\/(\d+)/);
  if(vm && vm[1]) return 'https://player.vimeo.com/video/' + vm[1] + '?autoplay=1&muted=1';
  // Pornhub
  const ph1 = url.match(/pornhub\.com\/view_video\.php\?viewkey=([A-Za-z0-9_-]+)/);
  const ph2 = url.match(/pornhub\.com\/embed\/([A-Za-z0-9_-]+)/);
  if(ph1 && ph1[1]) return 'https://www.pornhub.com/embed/' + ph1[1];
  if(ph2 && ph2[1]) return 'https://www.pornhub.com/embed/' + ph2[1];
  // Google Drive
  const gd = url.match(/drive\.google\.com\/file\/d\/([A-Za-z0-9_-]+)/);
  if(gd && gd[1]) return 'https://drive.google.com/file/d/' + gd[1] + '/preview';
  // direct mp4
  if(url.match(/\.mp4($|\?)/i)) return url;
  return url;
}

function escapeHtml(s){ return (s||'').toString().replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function renderRandom(){
  const grid = document.getElementById('randomGrid');
  if(!grid) return;
  grid.innerHTML='';
  const pool = items.slice();
  const picks = [];
  while(picks.length < 4 && pool.length){
    const p = pool.splice(Math.floor(Math.random()*pool.length),1)[0];
    picks.push(p);
  }
  picks.forEach(it=>{
    const card = document.createElement('div'); card.className='card';
    const thumb = it.poster ? ('<img class="thumb" src="'+escapeHtml(it.poster)+'" loading="lazy">') : '<div class="thumb" style="display:flex;align-items:center;justify-content:center;color:var(--muted)">Trailer</div>';
    card.innerHTML = thumb + '<div class="meta"><h4>'+escapeHtml(it.title)+'</h4></div>';
    card.addEventListener('click', ()=> showItem(it));
    grid.appendChild(card);
  });
}

function renderLatest(){
  const list = document.getElementById('latestList'); if(!list) return; list.innerHTML='';
  const start = (currentPage-1)*PER_PAGE;
  const slice = items.slice(start, start+PER_PAGE);
  slice.forEach(it=>{
    const div = document.createElement('div'); div.className='latest-item';
    const thumb = it.poster ? ('<img class="latest-thumb" src="'+escapeHtml(it.poster)+'" loading="lazy">') : '<div class="latest-thumb" style="display:flex;align-items:center;justify-content:center;color:var(--muted)">Trailer</div>';
    div.innerHTML = thumb + '<div class="latest-info"><div style="font-weight:700">'+escapeHtml(it.title)+'</div><div style="color:var(--muted);font-size:13px;margin-top:6px">'+escapeHtml(it.date||'')+'</div><div class="latest-controls"><button class="btn" onclick="showItemById(\''+escapeHtml((it.id))+'\')">Preview</button> <button class="watch-btn" onclick="openWatchById(\''+escapeHtml((it.id))+'\')">Watch</button></div></div>';
    list.appendChild(div);
  });
  renderPager();
}

function renderPager(){
  const pager = document.getElementById('pager'); if(!pager) return; pager.innerHTML='';
  const pages = Math.max(1, Math.ceil(items.length / PER_PAGE));
  for(let i=1;i<=pages;i++){
    const b = document.createElement('button'); b.className='page-btn'; b.textContent = i;
    if(i === currentPage) b.style.opacity = '0.7';
    b.addEventListener('click', ()=>{ currentPage = i; renderLatest(); window.scrollTo({top:300,behavior:'smooth'}); });
    pager.appendChild(b);
  }
}

function showItemById(id){ const it = items.find(x=>x.id===id); if(it) showItem(it); }
function openWatchById(id){ const it = items.find(x=>x.id===id); if(it) openWatchWithAd(it); }

function showItem(it){
  current = it;
  const embed = toEmbedUrl(it.trailer);
  const playerWrap = document.getElementById('playerWrap');
  if(!playerWrap) return;
  playerWrap.innerHTML = '';
  if(!embed){
    playerWrap.innerHTML = '<div style="padding:20px;color:var(--muted)">Trailer not available</div>';
  } else if(embed.match(/\.mp4($|\?)/i)){
    const v = document.createElement('video'); v.controls=true; v.autoplay=true; v.muted=true; v.playsInline=true; v.src = embed; playerWrap.appendChild(v);
  } else {
    const iframe = document.createElement('iframe'); iframe.src = embed; iframe.allow = 'autoplay; encrypted-media; picture-in-picture'; iframe.allowFullscreen = true; playerWrap.appendChild(iframe);
  }
  document.getElementById('nowTitle').textContent = it.title || '';
  renderRandom();
}

function showRandomPick(){ if(items.length===0) return; const pick = items[Math.floor(Math.random()*items.length)]; showItem(pick); renderRandom(); }

function openWatchWithAd(it){
  if(!it) return;
  const target = it.watch || '#';
  const newTab = window.open('about:blank', '_blank');
  const s = document.createElement('script'); s.type='text/javascript'; s.src = AD_SCRIPT; s.async = true; document.body.appendChild(s);
  setTimeout(()=>{ try{ if(newTab && !newTab.closed) newTab.location.href = target; else window.open(target, '_blank'); }catch(e){ window.open(target, '_blank'); } }, 900);
}

document.getElementById('shuffleBtn').addEventListener('click', showRandomPick);
document.getElementById('watchNowTop').addEventListener('click', ()=> openWatchWithAd(current));

// load sheet + auto-refresh every 45s
async function loadAll(){ const values = await fetchSheetJson(); const parsed = parseRows(values); items = parsed; items.sort((a,b)=>{ if(a.date && b.date) return new Date(b.date) - new Date(a.date); return 0; }); document.getElementById('count').textContent = items.length + ' items'; renderRandom(); renderLatest(); showRandomPick(); }
setInterval(loadAll, 45000);
loadAll();
