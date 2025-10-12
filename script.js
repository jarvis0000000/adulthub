// script.js
// Dareloom Hub - Complete player + sheet + pagination + preview/watch + tags + random
// 2025-10-11

// ------------- CONFIG -------------
const SHEET_API = "https://sheets.googleapis.com/v4/spreadsheets/1A2I6jODnR99Hwy9ZJXPkGDtAFKfpYwrm3taCWZWoZ7o/values/Sheet1?alt=json&key=AIzaSyBFnyqCW37BUL3qrpGva0hitYUhxE_x5nw";
const PER_PAGE = 5;
const RANDOM_COUNT = 4;

// Pop / ads config (keeps existing behavior)
const AD_POP = "//bulletinsituatedelectronics.com/24/e4/33/24e43300238cf9b86a05c918e6b00561.js";
const POP_COOLDOWN_MS = 7000;
const POP_DELAY_MS = 2000;
const INITIAL_AUTO_POP_DELAY = 10000;
let lastPop = 0;

// ------------- STATE -------------
let items = [];        // all parsed items (newest first)
let filteredItems = []; // items after search/tag filter
let currentPage = 1;

// ------------- UTIL HELPERS -------------
const qs = sel => document.querySelector(sel);
const qsa = sel => Array.from(document.querySelectorAll(sel));

function log(...a){ console.log("[dareloom]", ...a); }

function slugify(text){
  return (text||'').toString().toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
}

function escapeHtml(s){
  return (s||'').toString()
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

function extractYouTubeID(url){
  if(!url) return null;
  const m = url.match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([0-9A-Za-z_-]{11})/);
  return m ? m[1] : null;
}

function makeThumbnail(it){
  // prefer poster/thumbnail field, otherwise youtube from trailer/watch, otherwise placeholder
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
    }catch(e){ console.warn("Ad pop failed", e); }
  }, POP_DELAY_MS);
}

// ------------- SHEET FETCH & PARSE -------------
async function fetchSheet(){
  try{
    const res = await fetch(SHEET_API);
    log("fetch status", res.status);
    if (!res.ok) throw new Error('sheet fetch failed ' + res.status);
    const j = await res.json();
    log("sheet raw rows", Array.isArray(j.values) ? j.values.length : 0);
    return j.values || [];
  }catch(e){
    console.error("Sheet fetch error:", e);
    return [];
  }
}

function parseRows(values){
  if (!values || values.length < 2) return [];
  // try to detect headers in first row (lowercased)
  const headers = (values[0]||[]).map(h => (h||'').toString().toLowerCase().trim());
  // helper finds header index of any candidate names
  const find = (names) => {
    for (let n of names){
      const i = headers.indexOf(n);
      if (i !== -1) return i;
    }
    return -1;
  };

  // common header names to check
  const idxTitle = find(['title','name','video title']) !== -1 ? find(['title','name','video title']) : 0;
  const idxTrailer = find(['trailer','youtube','trailer link','trailer url']);
  const idxWatch = find(['watch','watch link','link','url','video url']) !== -1 ? find(['watch','watch link','link','url','video url']) : (find(['watch']) || 3);
  const idxPoster = find(['poster','thumbnail','thumb','image','thumbnail url']);
  const idxDate = find(['date','upload date','published']);
  const idxCategory = find(['category','categories','tags','tag','genre']);
  const idxDesc = find(['description','desc','summary']);

  // If headers not found (or sparse), still treat row0 as header - fallback indices chosen conservatively (based on your sheet)
  // Based on earlier inspection we know Title at 0, Trailer at 2, Watch at 3 but we detect first if headers exist.
  // We'll use whichever index is sensible (if -1 use fallback)
  const TI = idxTitle !== -1 ? idxTitle : 0;
  const TR = idxTrailer !== -1 ? idxTrailer : 2;
  const WA = idxWatch !== -1 ? idxWatch : 3;
  const TH = idxPoster !== -1 ? idxPoster : -1;
  const DT = idxDate !== -1 ? idxDate : -1;
  const CA = idxCategory !== -1 ? idxCategory : -1;
  const DE = idxDesc !== -1 ? idxDesc : -1;

  const rows = values.slice(1);
  const out = [];
  for (let r of rows){
    r = Array.isArray(r) ? r : [];
    const title = (r[TI] || '').toString().trim();
    const trailer = (r[TR] || '').toString().trim();
    const watch = (r[WA] || '').toString().trim();
    const poster = (TH !== -1 && r[TH]) ? r[TH].toString().trim() : '';
    const date = (DT !== -1 && r[DT]) ? r[DT].toString().trim() : '';
    const category = (CA !== -1 && r[CA]) ? r[CA].toString().trim() : '';
    const description = (DE !== -1 && r[DE]) ? r[DE].toString().trim() : '';

    // skip rows with no playable link
    if ((!trailer || trailer.length === 0) && (!watch || watch.length === 0)) continue;

    const id = `${slugify(title)}|${encodeURIComponent(watch||trailer||Math.random().toString(36).slice(2,8))}`;

    out.push({
      id,
      title: title || 'Untitled',
      trailer: trailer || '',
      watch: watch || '',
      poster: poster || '',
      date: date || '',
      category: category || '',
      description: description || ''
    });
  }
  return out;
}

// ------------- RENDER / UI -------------
function renderTagsForItem(it){
  if (!it.category || !it.category.trim()) return '';
  // category may be comma-separated
  const parts = it.category.split(',').map(p => p.trim()).filter(Boolean);
  return parts.map(p => `<button class="tag-btn" data-tag="${escapeHtml(p)}">#${escapeHtml(p)}</button>`).join(' ');
}

function renderRandom(){
  const g = qs('#randomGrid');
  if (!g) return;
  g.innerHTML = '';
  const pool = items.slice();
  const picks = [];
  while (picks.length < RANDOM_COUNT && pool.length) {
    picks.push(pool.splice(Math.floor(Math.random()*pool.length),1)[0]);
  }
  picks.forEach(it => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <img class="thumb" src="${escapeHtml(makeThumbnail(it))}" loading="lazy" alt="${escapeHtml(it.title)}">
      <div class="meta"><h4>${escapeHtml(it.title)}</h4></div>
    `;
    card.addEventListener('click', ()=> triggerAdThenOpenModal(it));
    g.appendChild(card);
  });
}

function renderLatest(page = 1){
  const list = qs('#latestList');
  if (!list) return;
  list.innerHTML = '';

  const total = filteredItems.length;
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  if (page < 1) page = 1;
  if (page > totalPages) page = totalPages;
  currentPage = page;

  const start = (page - 1) * PER_PAGE;
  const slice = filteredItems.slice(start, start + PER_PAGE);

  slice.forEach(it => {
    const div = document.createElement('div');
    div.className = 'latest-item';
    const thumb = makeThumbnail(it);
    div.innerHTML = `
      <img class="latest-thumb" src="${escapeHtml(thumb)}" loading="lazy" alt="${escapeHtml(it.title)}">
      <div class="latest-info">
        <div style="font-weight:700">${escapeHtml(it.title)}</div>
        <div style="color:var(--muted);font-size:13px;margin-top:6px">${escapeHtml(it.date || '')}</div>
        <div class="tag-container" style="margin-top:6px">${renderTagsForItem(it)}</div>
        <div style="margin-top:8px">
          <button class="btn preview-btn" data-id="${escapeHtml(it.id)}">Preview</button>
          <button class="watch-btn" data-url="${escapeHtml(it.watch || it.trailer)}">Watch</button>
        </div>
      </div>
    `;
    list.appendChild(div);
  });

  renderPagination(totalPages, page);
  attachLatestListeners();
}

function renderPagination(totalPages, page){
  const pager = qs('#pager');
  if (!pager) return;
  pager.innerHTML = '';
  if (totalPages <= 1) return;

  const windowSize = 5; // ek bar me 5 page numbers
  const currentWindow = Math.floor((page - 1) / windowSize);
  const start = currentWindow * windowSize + 1;
  const end = Math.min(start + windowSize - 1, totalPages);

  // Prev button (previous window)
  if (page > 1){
    const prev = document.createElement('button');
    prev.className = 'page-btn';
    prev.textContent = '« Prev';
    prev.addEventListener('click', ()=> changePage(page - 1));
    pager.appendChild(prev);
  }

  // Page numbers for current window
  for (let i = start; i <= end; i++){
    const b = document.createElement('button');
    b.className = 'page-num page-btn' + (i === page ? ' active' : '');
    b.textContent = i;
    b.dataset.page = i;
    b.addEventListener('click', ()=> changePage(i));
    pager.appendChild(b);
  }

  // Ellipsis and Next if there are more pages ahead
  if (end < totalPages){
    const dots = document.createElement('span');
    dots.textContent = '...';
    dots.className = 'dots';
    pager.appendChild(dots);
  }

  // Next button (next page)
  if (page < totalPages){
    const next = document.createElement('button');
    next.className = 'page-btn';
    next.textContent = 'Next »';
    next.addEventListener('click', ()=> changePage(page + 1));
    pager.appendChild(next);
  }
}

function changePage(page){
  renderLatest(page);
  const latestSection = qs('#latestSection');
  if (latestSection) window.scrollTo({ top: latestSection.offsetTop - 20, behavior: 'smooth' });
  openAdsterraPop();
}

function attachLatestListeners(){
  // Preview buttons
  qsa('#latestList .preview-btn').forEach(btn => {
    btn.removeEventListener('click', onPreviewClick);
    btn.addEventListener('click', onPreviewClick);
  });
  // Watch buttons
  qsa('#latestList .watch-btn').forEach(btn => {
    btn.removeEventListener('click', onWatchClick);
    btn.addEventListener('click', onWatchClick);
  });
  // Tag buttons
  qsa('.tag-btn').forEach(tagbtn => {
    tagbtn.removeEventListener('click', onTagClick);
    tagbtn.addEventListener('click', onTagClick);
  });
}

function onPreviewClick(e){
  const id = e.currentTarget.dataset.id;
  const it = items.find(x => x.id === id) || filteredItems.find(x => x.id === id);
  if (!it) return;
  triggerAdThenOpenModal(it);
}

function onWatchClick(e){
  const url = e.currentTarget.dataset.url;
  if (!url) return;
  openWatchPage(url);
}

function onTagClick(e){
  const tag = e.currentTarget.dataset.tag;
  if (!tag) return;
  applyTagFilter(tag);
}

// ------------- SEARCH & FILTER -------------
function applyTagFilter(tag){
  if (!tag) return;
  filteredItems = items.filter(it => (it.category||'').toLowerCase().split(',').map(s=>s.trim()).includes(tag.toLowerCase()));
  currentPage = 1;
  renderLatest(1);
  updateCount(filteredItems.length);
}

function doSearch(q){
  q = (q||'').toString().trim().toLowerCase();
  if (!q){
    filteredItems = items.slice();
    renderLatest(1);
    updateCount(filteredItems.length);
    return;
  }
  // if user types 'n' special bypass (old logic) — keep compatibility
  if (q === 'n'){
    localStorage.setItem('adblock_bypassed','true');
    filteredItems = items.slice();
    renderLatest(1);
    updateCount(filteredItems.length);
    return;
  }

  filteredItems = items.filter(it => {
    const t = (it.title||'').toLowerCase();
    const c = (it.category||'').toLowerCase();
    return t.includes(q) || c.includes(q);
  });
  currentPage = 1;
  renderLatest(1);
  updateCount(filteredItems.length);
}

// ------------- MODAL PREVIEW & WATCH -------------
function triggerAdThenOpenModal(it){
  openAdsterraPop();
  setTimeout(()=> openPlayerModal(it), 150);
}

function openPlayerModal(it){
  const modal = qs('#videoModal');
  const pWrap = qs('#modalPlayerWrap');
  const controls = qs('#modalControlsContainer');
  const titleEl = qs('#modalVideoTitle');
  const descEl = qs('#modalVideoDescription');

  if (!modal || !pWrap || !controls || !titleEl) {
    // fallback simple popup
    alert(it.title);
    return;
  }

  // set title/desc
  titleEl.textContent = it.title || 'Video';
  descEl.textContent = it.description || '';

  // build embed (prefer trailer youtube)
  const embedUrl = toEmbedUrlForModal(it.trailer || it.watch);
  pWrap.innerHTML = '';
  if (embedUrl){
    if (embedUrl.match(/\.mp4($|\?)/i)){
      const v = document.createElement('video');
      v.controls = true; v.autoplay = true; v.muted = false; v.playsInline = true;
      v.src = embedUrl;
      v.style.width = '100%'; v.style.height = '420px';
      pWrap.appendChild(v);
    } else {
      const iframe = document.createElement('iframe');
      iframe.src = embedUrl;
      iframe.setAttribute('allow','autoplay; fullscreen; encrypted-media; picture-in-picture');
      iframe.setAttribute('allowfullscreen','true');
      iframe.style.width = '100%'; iframe.style.height = '420px'; iframe.style.border = 'none';
      pWrap.appendChild(iframe);
    }
  } else {
    pWrap.innerHTML = `<div style="padding:80px 20px;text-align:center;color:var(--muted)">Trailer not available for embed.</div>`;
  }

  // controls: Watch (open watch.html) + Telegram/Stream buttons if link types detected
  // Applying button separation (flex container and spacing)
  let html = '<div style="display: flex; flex-wrap: wrap; gap: 10px; justify-content: center;">';
  const watchUrl = it.watch || it.trailer || '';
  
  // Open in Player button (main action)
  html += `<button class="btn watch-btn-modal" data-url="${escapeHtml(watchUrl)}" style="min-width: 150px;">Open in Player</button>`;

  // If Streamtape link present, add a direct streamtape button
  if ((watchUrl||'').includes('streamtape.com') || (watchUrl||'').includes('/v/')){
    html += `<button class="btn" onclick="(function(){window.open('${escapeHtml(watchUrl)}','_blank')})()" style="min-width: 150px;">Open Streamtape</button>`;
  }
  
  // If telegram link
  if ((watchUrl||'').includes('t.me') || (watchUrl||'').includes('telegram')){
    html += `<button class="btn" onclick="(function(){window.open('${escapeHtml(watchUrl)}','_blank')})()" style="min-width: 150px;">Open Telegram</button>`;
  }

  // share button
  html += `<button class="btn" id="modalShareBtn" style="min-width: 150px;">🔗 Share</button>`;
  
  html += '</div>'; // Close the flex container
  controls.innerHTML = html;

  // show modal
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';

  // bind modal control events
  qs('#modalShareBtn')?.addEventListener('click', ()=> {
    const shareUrl = `${window.location.origin}${window.location.pathname}#v=${encodeURIComponent(it.id)}`;
    const text = `🔥 Watch "${it.title}" on Dareloom Hub\n${shareUrl}`;
    if (navigator.share) navigator.share({ title: it.title, text, url: shareUrl }).catch(()=>{});
    else navigator.clipboard.writeText(text).then(()=> alert("Link copied to clipboard")).catch(()=> prompt("Copy link:", shareUrl));
  });

  qs('.watch-btn-modal')?.addEventListener('click', (e) => {
    const url = e.currentTarget.dataset.url;
    openWatchPage(url);
  });
}

function closePlayerModal(){
  const modal = qs('#videoModal');
  if (!modal) return;
  modal.style.display = 'none';
  document.body.style.overflow = '';
  const pWrap = qs('#modalPlayerWrap');
  if (pWrap) pWrap.innerHTML = '';
  const controls = qs('#modalControlsContainer');
  if (controls) controls.innerHTML = '';
}

// helper to create embed link for modal (youtube/streamtape/drive/mp4)
function toEmbedUrlForModal(url){
  if (!url) return '';
  const y = extractYouTubeID(url);
  if (y) return `https://www.youtube.com/embed/${y}?autoplay=1&rel=0`;
  if (url.includes('youtube.com/embed')) return url;
  if (url.match(/drive\.google\.com/)){
    const m = url.match(/[-\w]{25,}/);
    if (m) return `https://drive.google.com/file/d/${m[0]}/preview`;
  }
  if (url.includes('streamtape.com')){
    if (url.includes('/v/')){
      const id = url.split('/v/')[1]?.split('/')[0];
      if (id) return `https://streamtape.com/e/${id}/`;
    }
    if (url.includes('/e/')) return url;
  }
  if (url.match(/\.mp4($|\?)/i)) return url;
  return '';
}

// open watch.html (existing file) in new tab with encoded URL param
function openWatchPage(targetUrl){
  if (!targetUrl) return;
  openAdsterraPop();
  setTimeout(()=> {
    try{
      let final = targetUrl;
      // convert streamtape /v/ to /e/ for better embedding in watch page
      if (final.includes('/v/')){
        const m = final.match(/\/v\/([0-9A-Za-z_-]+)/);
        if (m && m[1]) final = `https://streamtape.com/e/${m[1]}/`;
      }
      const watchPage = `watch.html?url=${encodeURIComponent(final)}`;
      const w = window.open(watchPage,'_blank');
      if (!w || w.closed || typeof w.closed === 'undefined'){
        alert("Please allow pop-ups to open the link in a new tab!");
      }
      closePlayerModal();
    }catch(e){ console.error(e); }
  }, 120);
}

// ------------- INIT / BOOT -------------
async function loadAll(){
  log("loading sheet...");
  const raw = await fetchSheet();
  const parsed = parseRows(raw);
  // Sort new -> old. If date exists and parseable, attempt to sort by date desc; otherwise keep sheet order reversed
  parsed.forEach(p => p._sortDate = (p.date ? Date.parse(p.date) || 0 : 0));
  parsed.sort((a,b) => (b._sortDate || 0) - (a._sortDate || 0));
  // if all _sortDate === 0 (no usable dates), reverse the parsed order to show newest-first based on sheet order
  const allZero = parsed.every(p => !p._sortDate);
  items = allZero ? parsed.reverse() : parsed;

  filteredItems = items.slice(); // start unfiltered

  log("items loaded", items.length);
  // update count
  updateCount(items.length);

  // initial renders
  renderRandom();
  renderLatest(1);

  // wire search input
  const s = qs('#searchInput');
  if (s){
    s.addEventListener('input', (e) => {
      const q = e.target.value || '';
      doSearch(q);
    });
  }

  // modal close wiring (if modal close button exists in DOM)
  const closeBtn = qs('#videoModal .close-btn');
  if (closeBtn){
    closeBtn.addEventListener('click', closePlayerModal);
  }
  // click outside modal to close (optional)
  const modal = qs('#videoModal');
  if (modal){
    modal.addEventListener('click', (ev) => {
      if (ev.target === modal) closePlayerModal();
    });
  }

  // auto pop once after delay (keeps existing ad behavior)
  window.addEventListener('load', ()=> setTimeout(()=> openAdsterraPop(), INITIAL_AUTO_POP_DELAY), { once:true });
}

// update item count display
function updateCount(n){
  const c = qs('#count');
  if (c) c.textContent = `${n} items`;
}

// search wrapper calls doSearch (keeps names consistent)
function doSearch(q){
  // reuse doSearch logic above
  q = (q||'').toString().trim().toLowerCase();
  if (!q){
    filteredItems = items.slice();
    currentPage = 1;
    renderLatest(1);
    updateCount(filteredItems.length);
    return;
  }
  if (q === 'n'){
    localStorage.setItem('adblock_bypassed','true');
    filteredItems = items.slice();
    currentPage = 1;
    renderLatest(1);
    updateCount(filteredItems.length);
    return;
  }
  filteredItems = items.filter(it => {
    const t = (it.title||'').toLowerCase();
    const c = (it.category||'').toLowerCase();
    return t.includes(q) || c.includes(q);
  });
  currentPage = 1;
  renderLatest(1);
  updateCount(filteredItems.length);
}

// attach global click to handle preview/watch buttons added dynamically (delegation fallback)
document.addEventListener('click', (e) => {
  const preview = e.target.closest('.preview-btn');
  if (preview){
    const id = preview.dataset.id || preview.getAttribute('data-id');
    if (id){
      const it = items.find(x => x.id === id) || filteredItems.find(x => x.id === id);
      if (it) triggerAdThenOpenModal(it);
    }
  }
  const watch = e.target.closest('.watch-btn');
  if (watch && watch.dataset.url){
    openWatchPage(watch.dataset.url);
  }
});

// ensure preview/watch triggers open popunder (global)
document.addEventListener('click', (e) => {
  const target = e.target.closest('.watch-btn, .preview-btn, .card, .btn, .page-btn');
  if (target) openAdsterraPop();
}, { passive:true });

// start
loadAll();
