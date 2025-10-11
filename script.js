// script.js
// Dareloom Hub v2 — Full Player + Sheet + Pagination + Preview + Watch + Tags + Random
// 2025-10-11 (Enhanced)

const SHEET_API = "https://sheets.googleapis.com/v4/spreadsheets/1A2I6jODnR99Hwy9ZJXPkGDtAFKfpYwrm3taCWZWoZ7o/values/Sheet1?alt=json&key=AIzaSyBFnyqCW37BUL3qrpGva0hitYUhxE_x5nw";
const PER_PAGE = 5;
const RANDOM_COUNT = 4;

const AD_POP = "//bulletinsituatedelectronics.com/24/e4/33/24e43300238cf9b86a05c918e6b00561.js";
const POP_COOLDOWN_MS = 7000;
const POP_DELAY_MS = 2000;
const INITIAL_AUTO_POP_DELAY = 10000;
let lastPop = 0;

let items = [];
let filteredItems = [];
let currentPage = 1;

const qs = s => document.querySelector(s);
const qsa = s => Array.from(document.querySelectorAll(s));

function log(...a){ console.log("[dareloom]", ...a); }
function slugify(t){ return (t||'').toLowerCase().replace(/[^a-z0-9]+/g,'-'); }

function extractYouTubeID(url){
  if(!url) return null;
  const m = url.match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([0-9A-Za-z_-]{11})/);
  return m ? m[1] : null;
}

function makeThumbnail(it){
  if(it.poster) return it.poster;
  const y = extractYouTubeID(it.trailer || it.watch);
  if(y) return `https://img.youtube.com/vi/${y}/hqdefault.jpg`;
  return 'https://placehold.co/600x400?text=Dareloom+Hub';
}

function openAdsterraPop(){
  const now = Date.now();
  if(now - lastPop < POP_COOLDOWN_MS) return;
  lastPop = now;
  setTimeout(()=>{
    const s=document.createElement('script');
    s.src=AD_POP;
    s.async=true;
    document.body.appendChild(s);
    setTimeout(()=>s.remove(),3500);
  },POP_DELAY_MS);
}

async function fetchSheet(){
  try{
    const res=await fetch(SHEET_API);
    if(!res.ok) throw new Error(res.status);
    const j=await res.json();
    return j.values||[];
  }catch(e){ console.error(e); return []; }
}

function parseRows(values){
  if(!values||values.length<2) return [];
  const headers=(values[0]||[]).map(h=>h.toLowerCase().trim());
  const find=(names)=>names.map(n=>headers.indexOf(n)).find(i=>i!==-1);

  const TI=find(['title','name','video title'])??0;
  const TR=find(['trailer','youtube','trailer url','trailer link'])??2;
  const WA=find(['watch','link','video url'])??3;
  const TH=find(['poster','thumbnail','thumb'])??-1;
  const DT=find(['date','upload date'])??-1;
  const CA=find(['category','tags','genre'])??-1;
  const DE=find(['description','desc'])??-1;

  return values.slice(1).map(r=>{
    const title=r[TI]||'';
    const trailer=r[TR]||'';
    const watch=r[WA]||'';
    const poster=TH!=-1?r[TH]||'':'';
    const date=DT!=-1?r[DT]||'':'';
    const category=CA!=-1?r[CA]||'':'';
    const desc=DE!=-1?r[DE]||'':'';
    if(!title&&(!trailer||!watch)) return null;
    return { id:slugify(title)+Math.random().toString(36).slice(2,6), title, trailer, watch, poster, date, category, description:desc };
  }).filter(Boolean);
}

function renderRandom(){
  const g=qs('#randomGrid');
  if(!g) return;
  g.innerHTML='';
  const pool=[...items];
  for(let i=0;i<RANDOM_COUNT && pool.length;i++){
    const it=pool.splice(Math.floor(Math.random()*pool.length),1)[0];
    const c=document.createElement('div');
    c.className='card';
    c.innerHTML=`<img src="${makeThumbnail(it)}" class="thumb"><h4>${it.title}</h4>`;
    c.onclick=()=>triggerAdThenOpenModal(it);
    g.appendChild(c);
  }
}

function renderLatest(page=1){
  const list=qs('#latestList');
  list.innerHTML='';
  const total=filteredItems.length;
  const totalPages=Math.ceil(total/PER_PAGE);
  currentPage=Math.min(Math.max(page,1),totalPages);

  const slice=filteredItems.slice((currentPage-1)*PER_PAGE,(currentPage)*PER_PAGE);
  slice.forEach(it=>{
    list.innerHTML+=`
    <div class="latest-item">
      <img src="${makeThumbnail(it)}" class="latest-thumb">
      <div class="latest-info">
        <div class="latest-title">${it.title}</div>
        <div class="latest-date">${it.date||''}</div>
        <div class="tag-container">${renderTags(it)}</div>
        <div class="btns">
          <button class="preview-btn" data-id="${it.id}">Preview</button>
          <button class="watch-btn" data-url="${it.watch||it.trailer}">Watch</button>
        </div>
      </div>
    </div>`;
  });

  renderPagination(totalPages,page);
}

function renderTags(it){
  if(!it.category) return '';
  return it.category.split(',').map(t=>`<button class="tag-btn" data-tag="${t.trim()}">#${t.trim()}</button>`).join(' ');
}

function renderPagination(totalPages,page){
  const p=qs('#pager');
  p.innerHTML='';
  if(page>1){
    const prev=document.createElement('button');
    prev.textContent='« Prev';
    prev.onclick=()=>changePage(page-1);
    p.appendChild(prev);
  }
  for(let i=1;i<=totalPages;i++){
    const b=document.createElement('button');
    b.textContent=i;
    if(i===page) b.classList.add('active');
    b.onclick=()=>changePage(i);
    p.appendChild(b);
  }
  if(page<totalPages){
    const next=document.createElement('button');
    next.textContent='Next »';
    next.onclick=()=>changePage(page+1);
    p.appendChild(next);
  }
}

function changePage(page){
  renderLatest(page);
  openAdsterraPop();
  window.scrollTo({top:qs('#latestSection').offsetTop-10,behavior:'smooth'});
}

function triggerAdThenOpenModal(it){ openAdsterraPop(); setTimeout(()=>openPlayerModal(it),150); }

function openPlayerModal(it){
  const modal=qs('#videoModal');
  qs('#modalVideoTitle').textContent=it.title;
  qs('#modalVideoDescription').textContent=it.description||'';
  const wrap=qs('#modalPlayerWrap');
  wrap.innerHTML='';
  const embed=toEmbedUrl(it.trailer||it.watch);
  if(embed){
    const f=document.createElement('iframe');
    f.src=embed; f.allow='autoplay; fullscreen'; f.style='width:100%;height:420px;border:none';
    wrap.appendChild(f);
  }else wrap.textContent='No preview available.';
  modal.style.display='flex';
}

function toEmbedUrl(url){
  const y=extractYouTubeID(url);
  if(y) return `https://www.youtube.com/embed/${y}?autoplay=1`;
  if(url.includes('/v/')){
    const id=url.split('/v/')[1].split('/')[0];
    return `https://streamtape.com/e/${id}/`;
  }
  if(url.match(/\.mp4($|\?)/)) return url;
  return '';
}

function openWatchPage(u){
  openAdsterraPop();
  setTimeout(()=>{
    window.open(`watch.html?url=${encodeURIComponent(u)}`,'_blank');
  },200);
}

function applyTagFilter(tag){
  filteredItems=items.filter(it=>(it.category||'').toLowerCase().includes(tag.toLowerCase()));
  renderLatest(1);
}

function doSearch(q){
  q=q.toLowerCase();
  filteredItems=items.filter(it=>(it.title||'').toLowerCase().includes(q)||(it.category||'').toLowerCase().includes(q));
  renderLatest(1);
}

async function loadAll(){
  const raw=await fetchSheet();
  const parsed=parseRows(raw);
  parsed.forEach(p=>p._sort=Date.parse(p.date)||0);
  parsed.sort((a,b)=>b._sort-a._sort);
  items=parsed;
  filteredItems=[...items];
  renderRandom();
  renderLatest(1);
  qs('#searchInput')?.addEventListener('input',e=>doSearch(e.target.value));
  document.body.addEventListener('click',e=>{
    if(e.target.classList.contains('preview-btn')) triggerAdThenOpenModal(items.find(x=>x.id===e.target.dataset.id));
    if(e.target.classList.contains('watch-btn')) openWatchPage(e.target.dataset.url);
    if(e.target.classList.contains('tag-btn')) applyTagFilter(e.target.dataset.tag);
  });
  setTimeout(()=>openAdsterraPop(),INITIAL_AUTO_POP_DELAY);
}

loadAll();
