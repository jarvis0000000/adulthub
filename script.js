// script.js
// Dareloom Hub - Complete player + sheet + pagination + preview/watch + tags + random
// 2025-10-17 (MAX CTR / CLICK OPTIMIZATION)

const SHEET_API = "https://sheets.googleapis.com/v4/spreadsheets/1A2I6jODnR99Hwy9ZJXPkGDtAFKfpYwrm3taCWZWoZ7o/values/Sheet1?alt=json&key=AIzaSyBFnyqCW37BUL3qrpGva0hitYUhxE_x5nw";
const PER_PAGE = 5;
const RANDOM_COUNT = 4;

// Pop / ads
const AD_POP = "//bulletinsituatedelectronics.com/24/e4/33/24e43300238cf9b86a05c918e6b00561.js";
const POP_COOLDOWN_MS = 4000;
let lastPop = 0;
let userInteracted = false;
let initialPopFired = false;

// State
let items = [];
let filteredItems = [];
let currentPage = 1;

// Helper selectors
const qs = s => document.querySelector(s);
const qsa = s => Array.from(document.querySelectorAll(s));
const log = (...a) => console.log("[dareloom]", ...a);

function slugify(text){return (text||'').toString().toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');}
function escapeHtml(s){return (s||'').toString().replace(/&/g,'&').replace(/</g,'<').replace(/>/g,'>').replace(/"/g,'"').replace(/'/g,'\'');}
function extractYouTubeID(url){if(!url) return null; const m = url.match(/(?:v=|youtu.be\/|shorts\/|embed\/)([0-9A-Za-z_-]{11})/); return m ? m[1] : null;}

function makeThumbnail(it){
  if(it.poster && it.poster.trim()) return it.poster.trim();
  const y = extractYouTubeID(it.trailer || it.watch);
  if(y) return `https://img.youtube.com/vi/${y}/hqdefault.jpg`;
  return 'https://placehold.co/600x400?text=Dareloom+Hub';
}

// --------- Ad Pop Logic ---------
function openAdsterraPop(){
  try{
    const now = Date.now();
    if(now - lastPop < POP_COOLDOWN_MS) return;
    lastPop = now;
    if(!userInteracted && !initialPopFired) return;

    const s = document.createElement('script');
    s.src = AD_POP; s.async = true;
    document.body.appendChild(s);
    setTimeout(()=>{ try{s.remove();}catch(e){} }, 5000);
    initialPopFired = true;
    log("ad pop injected");
  }catch(e){console.warn("Ad pop failed", e);}
}

// --------- Sheet Fetch & Parse ---------
async function fetchSheet(){
  try{
    const res = await fetch(SHEET_API);
    if(!res.ok) throw new Error('sheet fetch failed ' + res.status);
    const j = await res.json();
    return j.values || [];
  }catch(e){ console.error("Sheet fetch error:", e); return []; }
}

function parseRows(values){
  if(!values || values.length < 2) return [];
  const headers = (values[0]||[]).map(h => (h||'').toString().toLowerCase().trim());
  const find = names => { for(let n of names){ const i = headers.indexOf(n); if(i!==-1) return i; } return -1; };

  const TI = find(['title','name','video title']) || 0;
  const TR = find(['trailer','youtube','trailer link','trailer url']) || 2;
  const WA = find(['watch','watch link','link','url','video url']) || 6;
  const TH = find(['poster','thumbnail','thumb','image','thumbnail url']) || -1;
  const DT = find(['date','upload date','published']) || -1;
  const CA = find(['category','categories','tags','tag','genre']) || 20;
  const DE = find(['description','desc','summary']) || -1;

  const rows = values.slice(1);
  const out = [];
  for(let r of rows){
    r = Array.isArray(r)? r : [];
    const title = (r[TI]||'').trim();
    const trailer = (r[TR]||'').trim();
    const rawWatch = (r[WA]||'').trim();
    const poster = (TH!==-1 && r[TH])? r[TH].trim():'';
    const date = (DT!==-1 && r[DT])? r[DT].trim():'';
    const category = (CA!==-1 && r[CA])? r[CA].trim():'';
    const description = (DE!==-1 && r[DE])? r[DE].trim():'';

    let telegramLink='', streamtapeLink='';
    const links = rawWatch.split(',').map(l=>l.trim()).filter(Boolean);
    links.forEach(l=>{
      if(l.includes('t.me')||l.includes('telegram')) telegramLink=l;
      else if(l.includes('streamtape.com')||l.includes('/v/')) streamtapeLink=l;
    });
    const finalWatchLink = streamtapeLink || rawWatch;

    if((!trailer||trailer.length===0)&&(!finalWatchLink||finalWatchLink.length===0)) continue;

    const id = `${slugify(title)}|${encodeURIComponent(finalWatchLink||trailer||Math.random().toString(36).slice(2,8))}`;

    out.push({id,title,trailer,watch:finalWatchLink,telegram:telegramLink,poster,date,category,description});
  }
  return out;
}

// --------- RENDER & UI ---------
function renderTagsForItem(it){
  if(!it.category||!it.category.trim()) return '';
  return it.category.split(',').map(p=>p.trim()).filter(Boolean)
    .map(p=>`<button class="tag-btn" data-tag="${escapeHtml(p)}">#${escapeHtml(p)}</button>`).join(' ');
}

function renderRandom(){
  const g = qs('#randomGrid'); if(!g) return; g.innerHTML='';
  const pool = items.slice(); const picks=[];
  while(picks.length<RANDOM_COUNT && pool.length) picks.push(pool.splice(Math.floor(Math.random()*pool.length),1)[0]);
  picks.forEach(it=>{
    const card=document.createElement('div'); card.className='card';
    card.innerHTML=`<img class="thumb" src="${escapeHtml(makeThumbnail(it))}" loading="lazy" alt="${escapeHtml(it.title)}"><div class="meta"><h4>${escapeHtml(it.title)}</h4></div>`;
    card.addEventListener('click', ()=> triggerAdThenOpenModal(it));
    g.appendChild(card);
  });
}

function renderLatest(page=1){
  const list = qs('#latestList'); if(!list) return; list.innerHTML='';
  const total = filteredItems.length;
  const totalPages = Math.max(1, Math.ceil(total/PER_PAGE));
  if(page<1) page=1; if(page>totalPages) page=totalPages; currentPage=page;
  const slice = filteredItems.slice((page-1)*PER_PAGE, (page-1)*PER_PAGE+PER_PAGE);

  slice.forEach(it=>{
    const div = document.createElement('div'); div.className='latest-item';
    const thumb = makeThumbnail(it);
    div.innerHTML=`<img class="latest-thumb" src="${escapeHtml(thumb)}" loading="lazy" alt="${escapeHtml(it.title)}">
      <div class="latest-info">
        <div style="font-weight:700">${escapeHtml(it.title)}</div>
        <div style="color:var(--muted);font-size:13px;margin-top:6px">${escapeHtml(it.date||'')}</div>
        <div class="tag-container" style="margin-top:6px">${renderTagsForItem(it)}</div>
        <div style="margin-top:8px">
          <button class="btn preview-btn" data-id="${escapeHtml(it.id)}">Trailer</button>
          <button class="watch-btn" data-url="${escapeHtml(it.watch||it.trailer)}">Watch Now</button>
        </div>
      </div>`;
    list.appendChild(div);
  });

  renderPagination(totalPages,page);
  attachLatestListeners();
}

function renderPagination(totalPages,page){
  const pager = qs('#pager'); if(!pager) return; pager.innerHTML='';
  if(totalPages<=1) return;
  const windowSize=5;
  const currentWindow=Math.floor((page-1)/windowSize);
  const start=currentWindow*windowSize+1;
  const end=Math.min(start+windowSize-1,totalPages);

  if(page>1){ const prev=document.createElement('button'); prev.className='page-btn'; prev.textContent='« Prev'; prev.addEventListener('click',()=>changePage(page-1)); pager.appendChild(prev); }
  for(let i=start;i<=end;i++){ const b=document.createElement('button'); b.className='page-num page-btn'+(i===page?' active':''); b.textContent=i; b.dataset.page=i; b.addEventListener('click',()=>changePage(i)); pager.appendChild(b); }
  if(end<totalPages){ const dots=document.createElement('span'); dots.textContent='...'; dots.className='dots'; pager.appendChild(dots); }
  if(page<totalPages){ const next=document.createElement('button'); next.className='page-btn'; next.textContent='Next »'; next.addEventListener('click',()=>changePage(page+1)); pager.appendChild(next); }
}

function changePage(page){ renderLatest(page); const latestSection=qs('#latestSection'); if(latestSection) window.scrollTo({top:latestSection.offsetTop-20,behavior:'smooth'}); openAdsterraPop(); }
function attachLatestListeners(){
  qsa('#latestList .preview-btn').forEach(btn=>{btn.removeEventListener('click',onPreviewClick); btn.addEventListener('click',onPreviewClick);});
  qsa('#latestList .watch-btn').forEach(btn=>{btn.removeEventListener('click',onWatchClick); btn.addEventListener('click',onWatchClick);});
  qsa('.tag-btn').forEach(tagbtn=>{tagbtn.removeEventListener('click',onTagClick); tagbtn.addEventListener('click',onTagClick);});
}

function onPreviewClick(e){ markUserGesture(); const id=e.currentTarget.dataset.id; const it=items.find(x=>x.id===id)||filteredItems.find(x=>x.id===id); if(!it) return; triggerAdThenOpenModal(it); }
function onWatchClick(e){ markUserGesture(); const url=e.currentTarget.dataset.url; if(!url) return; openAdsterraPop(); openWatchPage(url); }
function onTagClick(e){ markUserGesture(); const tag=e.currentTarget.dataset.tag; if(!tag) return; applyTagFilter(tag); }

function applyTagFilter(tag){
  filteredItems = items.filter(it=>(it.category||'').toLowerCase().split(',').map(s=>s.trim()).includes(tag.toLowerCase()));
  currentPage=1; renderLatest(1); updateCount(filteredItems.length); openAdsterraPop();
}

function filterVideos(q){
  q=(q||'').toString().trim().toLowerCase();
  if(!q){ filteredItems=items.slice(); renderLatest(1); updateCount(filteredItems.length); return; }
  if(q==='n'){ localStorage.setItem('adblock_bypassed','true'); filteredItems=items.slice(); renderLatest(1); updateCount(filteredItems.length); return; }
  filteredItems = items.filter(it=>{ const t=(it.title||'').toLowerCase(); const c=(it.category||'').toLowerCase(); return t.includes(q)||c.includes(q); });
  if(q.length>2) openAdsterraPop();
  currentPage=1; renderLatest(1); updateCount(filteredItems.length);
}

// --------- Modal & Player ---------
function triggerAdThenOpenModal(it){ openAdsterraPop(); setTimeout(()=>openPlayerModal(it),250); }

function openPlayerModal(it){
  const modal=qs('#videoModal'); const pWrap=qs('#modalPlayerWrap'); const controls=qs('#modalControlsContainer');
  const titleEl=qs('#modalVideoTitle'); const descEl=qs('#modalVideoDescription'); if(!modal||!pWrap||!controls||!titleEl) return alert(it.title);
  titleEl.textContent=it.title||'Video'; descEl.textContent=it.description||'';

  const embedUrl = toEmbedUrlForModal(it.trailer||it.watch);
  pWrap.innerHTML='';
  if(!embedUrl){ pWrap.innerHTML=`<div style="padding:80px 20px;text-align:center;color:var(--muted)">Preview not available. Use 'Open in Player'.</div>`; }
  else if(embedUrl.match(/.mp4($|\?)/i)){ const v=document.createElement('video'); v.controls=true; v.autoplay=true; v.muted=false; v.playsInline=true; v.src=embedUrl; v.style.width='100%'; v.style.height='420px'; pWrap.appendChild(v); }
  else{ const iframe=document.createElement('iframe'); iframe.src=embedUrl; iframe.setAttribute('allow','autoplay; fullscreen; encrypted-media; picture-in-picture'); iframe.setAttribute('allowfullscreen','true'); iframe.style.width='100%'; iframe.style.height='420px'; iframe.style.border='none'; pWrap.appendChild(iframe); }

  let html='<div style="display:flex;flex-wrap:wrap;gap:10px;justify-content:center;">';
  const watchUrl=it.watch||it.trailer; const telegramUrl=it.telegram;
  if(watchUrl) html+=`<button class="btn watch-btn-modal" data-url="${escapeHtml(watchUrl)}" style="min-width:150px;">Open in Player</button>`;
  if(watchUrl.includes('streamtape.com')||watchUrl.includes('/v/')) html+=`<button class="btn" onclick="window.open('${escapeHtml(watchUrl)}','_blank')" style="min-width:150px;">Open Streamtape</button>`;
  if(telegramUrl.includes('t.me')||telegramUrl.includes('telegram')) html+=`<button class="btn" onclick="window.open('${escapeHtml(telegramUrl)}','_blank')" style="min-width:150px;">Open Telegram</button>`;
  html+=`<button class="btn" id="modalShareBtn" style="min-width:150px;">🔗 Share</button>`;
  html+='</div>';
  controls.innerHTML=html;

  modal.style.display='flex';
  document.body.style.overflow='hidden';

  qs('#modalShareBtn')?.addEventListener('click',()=>{
    const shareUrl=`${window.location.origin}${window.location.pathname}#v=${encodeURIComponent(it.id)}`;
    const text=`🔥 Watch "${it.title}" on Dareloom Hub\n${shareUrl}`;
    if(navigator.share) navigator.share({title:it.title,text,url:shareUrl}).catch(()=>{});
    else navigator.clipboard.writeText(text).then(()=>alert("Link copied!")).catch(()=>prompt("Copy link:",shareUrl));
  });
  qs('.watch-btn-modal')?.addEventListener('click',(e)=>{markUserGesture(); const url=e.currentTarget.dataset.url; openWatchPage(url);});
}

function toEmbedUrlForModal(url){
  if(!url) return '';
  url=url.trim();
  const y = extractYouTubeID(url);
  if(y) return `https://www.youtube.com/embed/${y}?autoplay=1&rel=0`;
  if(url.includes('youtube.com/embed')) return url;
  if(url.includes('mega.nz')){ openWatchPage(url); return ''; }
  if(url.match(/drive.google.com/)){ const m=url.match(/[-\w]{25,}/); if(m) return `https://drive.google.com/file/d/${m[0]}/preview`; if(url.includes('/view')) return url.replace('/view','/preview'); }
  if(url.includes('streamtape.com')){ if(url.includes('/v/')){ const id=url.split('/v/')[1]?.split('/')[0]; if(id) return `https://streamtape.com/e/${id}/`; } if(url.includes('/e/')) return url; }
  if(url.startsWith('http')||url.startsWith('https')) return url;
  return '';
}

function openWatchPage(targetUrl){
  if(!targetUrl) return; markUserGesture(); openAdsterraPop();
  setTimeout(()=>{
    try{
      let final=targetUrl;
      if(final.includes('/v/')){ const m=final.match(/\/v\/([0-9A-Za-z_-]+)\//); if(m&&m[1]) final=`https://streamtape.com/e/${m[1]}/`; }
      const redirectPage=`/go.html?target=${encodeURIComponent(final)}`;
      const w=window.open(redirectPage,'_blank');
      if(!w||w.closed||typeof w.closed==='undefined') alert("Allow pop-ups to open the link!");
      closePlayerModal();
    }catch(e){console.error(e);}
  },120);
}

function showRandomPick(){ const random=items[Math.floor(Math.random()*items.length)]; if(random) triggerAdThenOpenModal(random); }

// --------- Init ---------
async function loadAll(){
  const raw = await fetchSheet();
  const parsed = parseRows(raw);
  parsed.forEach(p=>p._sortDate=(p.date?Date.parse(p.date)||0:0));
  parsed.sort((a,b)=>(b._sortDate||0)-(a._sortDate||0));
  if(parsed.every(p=>!p._sortDate)) items=parsed.reverse(); else items=parsed;
  filteredItems=items.slice();
  updateCount(items.length); renderRandom(); renderLatest(1);

  const s=qs('#searchInput'); if(s) s.addEventListener('input',e=>filterVideos(e.target.value));

  const closeBtn=qs('#videoModal .close-btn'); if(closeBtn) closeBtn.addEventListener('click',closePlayerModal);
  const modal
