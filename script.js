// script.js — Dareloom Hub (Final SEO + Sheet Optimized)
// Updated: 2025-10-13

// ---------------- CONFIG ----------------
const SHEET_API = "https://sheets.googleapis.com/v4/spreadsheets/1A2I6jODnR99Hwy9ZJXPkGDtAFKfpYwrm3taCWZWoZ7o/values/Sheet1?alt=json&key=AIzaSyBFnyqCW37BUL3qrpGva0hitYUhxE_x5nw";
const PER_PAGE = 5;
const RANDOM_COUNT = 4;
const CACHE_KEY = "dareloom_cache_v1";
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 min

// Ads Config
const AD_POP = "//bulletinsituatedelectronics.com/24/e4/33/24e43300238cf9b86a05c918e6b00561.js";
const POP_COOLDOWN_MS = 7000;
const POP_DELAY_MS = 2000;
const INITIAL_AUTO_POP_DELAY = 10000;

let items = [];
let filteredItems = [];
let currentPage = 1;
let lastPop = 0;

// ---------------- HELPERS ----------------
const qs = s => document.querySelector(s);
const qsa = s => Array.from(document.querySelectorAll(s));
function log(...a){ console.log("[dareloom]", ...a); }

function slugify(text){
  return (text||'').toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
}

function extractYouTubeID(url){
  if(!url) return null;
  const m = url.match(/(?:v=|youtu.be\/|shorts\/|embed\/)([0-9A-Za-z_-]{11})/);
  return m ? m[1] : null;
}

function makeThumbnail(it){
  if (it.poster && it.poster.trim()) return it.poster.trim();
  const y = extractYouTubeID(it.trailer || it.watch);
  if (y) return `https://img.youtube.com/vi/${y}/hqdefault.jpg`;
  return 'https://placehold.co/600x400?text=Dareloom+Hub';
}

function openAdsterraPop(){
  const now = Date.now();
  if (now - lastPop < POP_COOLDOWN_MS) return;
  lastPop = now;
  setTimeout(() => {
    try{
      const s = document.createElement('script');
      s.src = AD_POP;
      s.async = true;
      document.body.appendChild(s);
      setTimeout(()=>{ try{s.remove();}catch(e){} }, 3500);
    }catch(e){}
  }, POP_DELAY_MS);
}

// ---------------- FETCH SHEET ----------------
async function fetchSheetData(){
  try{
    const res = await fetch(SHEET_API, { cache: "no-store" });
    if(!res.ok) throw new Error("HTTP " + res.status);
    const j = await res.json();
    return j.values || [];
  }catch(e){
    console.warn("Sheet fetch failed once, retrying...", e);
    await new Promise(r => setTimeout(r, 1500));
    try{
      const res2 = await fetch(SHEET_API, { cache: "no-store" });
      if(!res2.ok) throw new Error("HTTP " + res2.status);
      const j2 = await res2.json();
      return j2.values || [];
    }catch(e2){
      console.error("Sheet fetch failed twice", e2);
      return [];
    }
  }
}

function parseRows(values){
  if (!values || values.length < 2) return [];
  const headers = (values[0]||[]).map(h => (h||'').toLowerCase().trim());
  const find = names => names.map(n=>headers.indexOf(n)).find(i=>i!==-1);

  const TI = find(['title']) ?? 0;
  const TR = find(['trailer']) ?? 2;
  const WA = find(['watch']) ?? 6;
  const CA = find(['category']) ?? 20;
  const TH = find(['poster','thumb']) ?? -1;
  const DE = find(['description']) ?? -1;
  const DT = find(['date']) ?? -1;

  return values.slice(1).map(r=>{
    const title = r[TI]||'';
    const trailer = r[TR]||'';
    const watch = r[WA]||'';
    const category = r[CA]||'';
    const poster = TH>-1?(r[TH]||''):'';
    const date = DT>-1?(r[DT]||''):'';
    const description = DE>-1?(r[DE]||''):'';
    if(!trailer && !watch) return null;
    return {
      id: `${slugify(title)}|${encodeURIComponent(watch||trailer)}`,
      title, trailer, watch, poster, category, date, description
    };
  }).filter(Boolean);
}

// ---------------- UI RENDER ----------------
function renderRandom(){
  const g = qs('#randomGrid');
  if(!g) return;
  g.innerHTML = '';
  const pool = [...items];
  const picks = [];
  while(picks.length<RANDOM_COUNT && pool.length)
    picks.push(pool.splice(Math.floor(Math.random()*pool.length),1)[0]);
  picks.forEach(it=>{
    const d = document.createElement('div');
    d.className = 'card';
    d.innerHTML = `<img src="${makeThumbnail(it)}" alt="${it.title}" loading="lazy"><div class="meta"><h4>${it.title}</h4></div>`;
    d.onclick = ()=> triggerAdThenOpenModal(it);
    g.appendChild(d);
  });
}

function renderLatest(page=1){
  const list = qs('#latestList');
  if(!list) return;
  const total = filteredItems.length;
  const totalPages = Math.max(1, Math.ceil(total/PER_PAGE));
  if(page<1) page=1;
  if(page>totalPages) page=totalPages;
  currentPage = page;

  const start = (page-1)*PER_PAGE;
  const slice = filteredItems.slice(start,start+PER_PAGE);
  list.innerHTML = slice.map(it=>{
    const thumb = makeThumbnail(it);
    return `
    <div class="latest-item">
      <img class="latest-thumb" src="${thumb}" alt="${it.title}" loading="lazy">
      <div class="latest-info">
        <div class="title">${it.title}</div>
        <div class="tag-container">${renderTags(it)}</div>
        <div class="actions">
          <button class="btn preview-btn" data-id="${it.id}">Preview</button>
          <button class="btn watch-btn" data-url="${it.watch||it.trailer}">Watch</button>
        </div>
      </div>
    </div>`;
  }).join('');

  renderPagination(totalPages, page);
}

function renderTags(it){
  if(!it.category) return '';
  return it.category.split(',').map(t=>t.trim()).filter(Boolean)
    .map(t=>`<button class="tag-btn" data-tag="${t}">#${t}</button>`).join(' ');
}

function renderPagination(totalPages, page){
  const pager = qs('#pager');
  if(!pager) return;
  pager.innerHTML = '';
  if(totalPages<=1) return;
  for(let i=1;i<=totalPages;i++){
    const b=document.createElement('button');
    b.textContent=i;
    b.className='page-btn'+(i===page?' active':'');
    b.onclick=()=>changePage(i);
    pager.appendChild(b);
  }
}

function changePage(p){
  renderLatest(p);
  openAdsterraPop();
  window.scrollTo({top: qs('#latestSection')?.offsetTop||0, behavior:'smooth'});
}

// ---------------- SEARCH ----------------
function doSearch(q){
  q=(q||'').toLowerCase().trim();
  if(!q){ filteredItems=items.slice(); renderLatest(1); return; }
  filteredItems = items.filter(it =>
    it.title.toLowerCase().includes(q) ||
    it.category.toLowerCase().includes(q)
  );
  renderLatest(1);
}

document.addEventListener('input', e=>{
  if(e.target.id==='searchInput') doSearch(e.target.value);
});

// ---------------- MODAL / PLAYER ----------------
function triggerAdThenOpenModal(it){ openAdsterraPop(); setTimeout(()=>openPlayerModal(it),150); }

function openPlayerModal(it){
  const m = qs('#videoModal');
  const wrap = qs('#modalPlayerWrap');
  const controls = qs('#modalControlsContainer');
  const titleEl = qs('#modalVideoTitle');
  if(!m || !wrap) return;
  titleEl.textContent = it.title;
  wrap.innerHTML = '';
  const url = toEmbedUrl(it.trailer||it.watch);
  wrap.innerHTML = url ? `<iframe src="${url}" allowfullscreen></iframe>` : 'Video unavailable';
  controls.innerHTML = `<button class="btn watch-btn-modal" data-url="${it.watch||it.trailer}">Open in Player</button>
                        <button class="btn" id="shareBtn">Share</button>`;
  m.style.display='flex';
  document.body.style.overflow='hidden';
  qs('#shareBtn').onclick=()=>{
    const link=`${location.origin}${location.pathname}#v=${encodeURIComponent(it.id)}`;
    navigator.clipboard.writeText(link).then(()=>alert("Link copied!"));
  };
  qs('.watch-btn-modal').onclick=(e)=>openWatchPage(e.target.dataset.url);
}

function closePlayerModal(){
  const m = qs('#videoModal');
  if(!m) return;
  m.style.display='none';
  document.body.style.overflow='';
  qs('#modalPlayerWrap').innerHTML='';
}

function toEmbedUrl(url){
  if(!url) return '';
  const y=extractYouTubeID(url);
  if(y) return `https://www.youtube.com/embed/${y}?autoplay=1`;
  if(url.includes('streamtape.com/v/')){
    const id=url.split('/v/')[1]?.split('/')[0];
    return id?`https://streamtape.com/e/${id}/`:'';
  }
  if(url.match(/drive.google.com/)){
    const m=url.match(/[-\w]{25,}/);
    if(m) return `https://drive.google.com/file/d/${m[0]}/preview`;
  }
  return url.match(/.mp4($|\?)/i)?url:'';
}

function openWatchPage(url){
  if(!url) return;
  openAdsterraPop();
  setTimeout(()=>{
    window.open(`watch.html?url=${encodeURIComponent(url)}`,'_blank');
    closePlayerModal();
  },120);
}

// ---------------- INIT ----------------
async function loadAll(){
  log("Loading Dareloom Hub...");
  let cached = sessionStorage.getItem(CACHE_KEY);
  let parsed = [];
  if(cached){
    const c=JSON.parse(cached);
    if(Date.now()-c.time<CACHE_TTL_MS){ parsed=c.data; log("Loaded from cache", parsed.length); }
  }
  if(!parsed.length){
    const raw = await fetchSheetData();
    parsed = parseRows(raw);
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({time:Date.now(), data:parsed}));
  }

  items = parsed.reverse();
  filteredItems = items.slice();
  renderRandom();
  renderLatest(1);

  // open modal if shared via hash
  const hash = location.hash.match(/#v=(.+)$/);
  if(hash){
    const id = decodeURIComponent(hash[1]);
    const it = items.find(x=>x.id===id);
    if(it) setTimeout(()=>openPlayerModal(it),800);
  }

  window.addEventListener('load', ()=>setTimeout(openAdsterraPop, INITIAL_AUTO_POP_DELAY));
}

document.addEventListener('DOMContentLoaded', loadAll);
