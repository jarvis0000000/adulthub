// script.js
// Dareloom Hub - FINAL V24 PRO (Updated, performance & search improvements)

// -----------------------------------------------------
// 🛠️ IMPORTANT: Configuration with Corrected Sheet ID
// -----------------------------------------------------
const CORRECT_SHEET_ID = "1A2I6jODnR99Hwy9ZJXPkGDtAFKfpYwrm3taCWZWoZ7o";
const API_KEY = "AIzaSyBFnyqCW37BUL3qrpGva0hitYUhxE_x5nw";

const SHEET_API = `https://sheets.googleapis.com/v4/spreadsheets/${CORRECT_SHEET_ID}/values/Sheet1?alt=json&key=${API_KEY}`;
const SHEET_API_REELS = `https://sheets.googleapis.com/v4/spreadsheets/${CORRECT_SHEET_ID}/values/Sheet3!A:B?alt=json&key=${API_KEY}`;
const PER_PAGE = 6;
const RANDOM_COUNT = 4;
const LOCAL_STORAGE_KEY = 'dareloom_items';

// ------------- STATE -------------
let items = [];
let filteredItems = [];
let currentPage = 1;
let allReelCandidates = [];
let usedReelIds = new Set();
let swipeStartY = 0;
let lastTapTime = 0;

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
  const m = url.match(/(?:v=|youtu.be\/|shorts\/|embed\/)([0-9A-Za-z_-]{11})/);
  return m ? m[1] : null;
}

/**
 * 💥 EMBED FIX: Streamwish and Mixdrop URLs को सही Embed Format में बदलता है।
 */
function getEmbedUrl(videoUrl) {
  if (!videoUrl) return null;

  // 1. Mixdrop Fix: /f/ को /e/ से बदलता है (डोमेन बदलने पर भी काम करेगा)
  if (videoUrl.includes('mixdrop') || videoUrl.includes('mixdrops')) {
      return videoUrl.replace(/\/f\//i, '/e/');
  }

  // 2. Streamwish Fix:
  if (videoUrl.includes('/file/')) {
      return videoUrl.replace('/file/', '/e/');
  }
  if (videoUrl.match(/https?:\/\/[^\/]+\/[a-zA-Z0-9]+$/)) {
      return videoUrl.replace(/\/([a-zA-Z0-9]+)$/, '/e/$1');
  }

  // 3. Streamtape या अन्य
  return videoUrl;
}

function makeThumbnail(it){
  if (it.poster && it.poster.trim()) return it.poster.trim();
  const y = extractYouTubeID(it.trailer || it.watch);
  if (y) return `https://img.youtube.com/vi/${y}/hqdefault.jpg`;
  return 'https://placehold.co/600x400?text=Dareloom+Hub';
}

// ------------- SHEET FETCH & PARSE (SEO Data Added) -------------
async function fetchSheet(url){
  try{
    const res = await fetch(url);
    if (!res.ok) throw new Error('sheet fetch failed ' + res.status);
    const j = await res.json();
    if (j && j.values) return j.values;
    if (Array.isArray(j)) return j;
    return [];
  }catch(e){
    console.error("Sheet fetch error:", e);
    return [];
  }
}

/**
 * 💡 SEO IMPROVEMENT: Added more fields to parse from Google Sheet
 */
function parseRows(values){
  if (!values || values.length < 2) return [];
  const headers = (values[0]||[]).map(h => (h||'').toString().toLowerCase().trim());
  const find = (names) => {
    for (let n of names){
      const i = headers.indexOf(n);
      if (i !== -1) return i;
    }
    return -1;
  };

  const TI = find(['title','name']) !== -1 ? find(['title','name']) : 0;
  const TR = find(['trailer','youtube']) !== -1 ? find(['trailer','youtube']) : 2;
  const WA = find(['watch','watch link']) !== -1 ? find(['watch','watch link']) : 6;
  const TH = find(['poster','thumbnail']) !== -1 ? find(['poster','thumbnail']) : -1;
  const DT = find(['date','upload date']) !== -1 ? find(['date','upload date']) : -1;
  const CA = find(['category','tags']) !== -1 ? find(['category','tags']) : 20;
  const DE = find(['description','desc']) !== -1 ? find(['description','desc']) : -1;

  // 🆕 NEW SEO Data Indexes
  const ST = find(['studio','studio name']) !== -1 ? find(['studio','studio name']) : -1;
  const YE = find(['year','release year']) !== -1 ? find(['year','release year']) : -1;
  const CAST = find(['cast','actor','actress']) !== -1 ? find(['cast','actor','actress']) : -1;

  const rows = values.slice(1);
  const out = [];
  for (let r of rows){
    r = Array.isArray(r) ? r : [];
    const title = (r[TI] || '').toString().trim();
    const trailer = (r[TR] || '').toString().trim();
    const rawWatch = (r[WA] || '').toString().trim();
    const poster = (TH !== -1 && r[TH]) ? r[TH].toString().trim() : '';
    const date = (DT !== -1 && r[DT]) ? r[DT].toString().trim() : '';
    const category = (CA !== -1 && r[CA]) ? r[CA].toString().trim() : '';
    const description = (DE !== -1 && r[DE]) ? r[DE].toString().trim() : '';
    
    // 🆕 NEW SEO Data Extraction
    const studio = (ST !== -1 && r[ST]) ? r[ST].toString().trim() : '';
    const year = (YE !== -1 && r[YE]) ? r[YE].toString().trim() : '';
    const cast = (CAST !== -1 && r[CAST]) ? r[CAST].toString().trim() : '';

    let telegramLink = '';
    const links = rawWatch.split(',').map(l => l.trim()).filter(Boolean);

    links.forEach(link => {
      if (link.includes('t.me') || link.includes('telegram')) {
        telegramLink = link;
      }
    });

    if ((!title && !trailer && !rawWatch) || (!title && !trailer && !rawWatch.length === 0)) continue;

    const id = slugify(title); 
    const finalId = id || `untitled|${Math.random().toString(36).slice(2,8)}`;

    out.push({
      id: finalId,
      title: title || 'Untitled',
      trailer: trailer || '',
      watch: rawWatch || '',
      telegram: telegramLink || '',
      poster: poster || '',
      date: date || '',
      category: category || '',
      description: description || '',
      studio: studio || '',
      year: year || '',
      cast: cast || '',
    });
  }
  return out.reverse();
}

function parseReelRows(values){
  if (!values || values.length < 2) return [];

  const rows = values.slice(1);
  const out = [];

  for (let r of rows){
    r = Array.isArray(r) ? r : [];

    const finalTitle = (r[0] || '').toString().trim();
    const reelLink = (r[1] || '').toString().trim();

    if (!reelLink) continue;

    const id = `${slugify(finalTitle || 'reel')}|${Math.random().toString(36).slice(2,8)}`;

    out.push({
      id,
      title: finalTitle,
      reelLink: reelLink,
    });
  }
  return out;
}

// ------------- UI / RENDER / FILTER / WATCH LOGIC -------------
function renderTagsForItem(it){
  const allTags = [it.studio, it.category].filter(Boolean).join(',');

  if (!allTags.trim()) return '';
  const parts = allTags.split(',').map(p => p.trim()).filter(Boolean);
  
  const uniqueParts = [...new Set(parts)];

  return uniqueParts.map(p => `<button class="tag-btn" data-tag="${escapeHtml(p)}">#${escapeHtml(p)}</button>`).join(' ');
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
    card.innerHTML = `<img class="thumb" src="${escapeHtml(makeThumbnail(it))}" loading="lazy" alt="${escapeHtml(it.title)}"> <div class="meta"><h4>${escapeHtml(it.title)}</h4></div>`;
    card.addEventListener('click', ()=> openTrailerPage(it));
    g.appendChild(card);
  });
}

function renderLatest(page = 1){
  const list = qs('#latestList');
  if (!list) return;
  const frag = document.createDocumentFragment();
  list.innerHTML = '';

  const total = filteredItems.length;
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  if (page < 1) page = 1;
  if (page > totalPages) page = totalPages;
  currentPage = page;

  const start = (page - 1) * PER_PAGE;
  const slice = filteredItems.slice(start, start + PER_PAGE);

  if (slice.length === 0 && total > 0 && page > 1) {
    currentPage = 1;
    renderLatest(1);
    return;
  }

  if (slice.length === 0) {
    list.innerHTML = '<div style="text-align:center; padding: 20px; color: var(--muted);">No videos found matching your criteria.</div>';
    renderPagination(totalPages, currentPage);
    attachLatestListeners();
    return;
  }

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
          <button class="btn preview-btn" data-id="${escapeHtml(it.id)}">Trailer / Details</button>
          <button class="watch-btn" data-id="${escapeHtml(it.id)}">Watch Now</button>
        </div>
      </div>
    `;
    div.addEventListener('click', (e) => {
      if (!e.target.closest('.preview-btn, .watch-btn, .tag-btn')) {
        openTrailerPage(it);
      }
    });

    frag.appendChild(div);
  });

  list.appendChild(frag);
  renderPagination(totalPages, currentPage);
  attachLatestListeners();
}

function renderPagination(totalPages, page){
  const pager = qs('#pager');
  if (!pager) return;
  pager.innerHTML = '';
  if (totalPages <= 1) return;

  const windowSize = 5;
  let startPage, endPage;

  if (totalPages <= windowSize) {
    startPage = 1;
    endPage = totalPages;
  } else {
    startPage = Math.max(1, page - Math.floor(windowSize / 2));
    endPage = Math.min(totalPages, page + Math.floor(windowSize / 2));

    if (endPage - startPage < windowSize - 1) {
      if (startPage === 1) {
        endPage = Math.min(totalPages, windowSize);
      } else if (endPage === totalPages) {
        startPage = Math.max(1, totalPages - windowSize + 1);
      }
    }
  }

  if (page > 1){
    const prev = document.createElement('button');
    prev.className = 'page-btn';
    prev.textContent = '« Prev';
    prev.addEventListener('click', ()=> changePage(page - 1));
    pager.appendChild(prev);
  }

  if (startPage > 1) {
    const b = document.createElement('button');
    b.className = 'page-num page-btn';
    b.textContent = 1;
    b.addEventListener('click', ()=> changePage(1));
    pager.appendChild(b);
    if (startPage > 2) {
      const dots = document.createElement('span');
      dots.textContent = '...';
      dots.className = 'dots';
      pager.appendChild(dots);
    }
  }

  for (let i = startPage; i <= endPage; i++){
    const b = document.createElement('button');
    b.className = 'page-num page-btn' + (i === page ? ' active' : '');
    b.textContent = i;
    b.dataset.page = i;
    b.addEventListener('click', ()=> changePage(i));
    pager.appendChild(b);
  }

  if (endPage < totalPages){
    if (endPage < totalPages - 1) {
      const dots = document.createElement('span');
      dots.textContent = '...';
      dots.className = 'dots';
      pager.appendChild(dots);
    }
    const b = document.createElement('button');
    b.className = 'page-num page-btn';
    b.textContent = totalPages;
    b.addEventListener('click', ()=> changePage(totalPages));
    pager.appendChild(b);
  }

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
}

function attachLatestListeners(){
  qsa('#latestList .preview-btn').forEach(el => {
    el.removeEventListener('click', onPreviewClick);
    el.addEventListener('click', onPreviewClick);
  });
  // 💥 FIX: Now attaches to data-id on watch-btn
  qsa('#latestList .watch-btn').forEach(btn => {
    btn.removeEventListener('click', onWatchClick);
    btn.addEventListener('click', onWatchClick);
  });
  qsa('.tag-btn').forEach(tagbtn => {
    tagbtn.removeEventListener('click', onTagClick);
    tagbtn.addEventListener('click', onTagClick);
  });
}

function onPreviewClick(e){
  e.stopPropagation();
  const id = e.currentTarget.dataset.id;
  const it = items.find(x => x.id === id);
  if (!it) return;
  openTrailerPage(it);
}

// 💥 FIX: Retrieves item data before calling openWatchPage
function onWatchClick(e){
  e.stopPropagation();
  const id = e.currentTarget.dataset.id;
  const it = items.find(x => x.id === id);
  if (!it) return;
  openWatchPage(it); // Pass the whole item
}

/**
 * 💡 SEO IMPROVEMENT: Tag clicks now generate a clean URL filter (e.g., /?filter=brazzers)
 */
function onTagClick(e){
  e.stopPropagation();
  const tag = e.currentTarget.dataset.tag;
  if (!tag) return;
  window.location.href = `/?filter=${slugify(tag)}`;
}

/**
 * 💡 SEO IMPROVEMENT: openTrailerPage now uses a clean URL structure based on the video slug (ID).
 */
function openTrailerPage(it){
  const trailerURL = `/trailer.html?id=${encodeURIComponent(it.id)}`;
  try {
    window.location.href = trailerURL;
  } catch(e){
    console.error("Failed to open trailer page", e);
  }
}

// 💥 FIX: openWatchPage now accepts the item object and passes title/tags
function openWatchPage(item){
  if (!item || (!item.watch && !item.trailer)) return;
  const fullWatchLinks = item.watch || item.trailer;
  
  // Encode parameters for title and tags
  const encodedTitle = encodeURIComponent(item.title || '');
  const encodedTags = encodeURIComponent(item.category || '');

  // Final URL with .html extension and SEO parameters
  const finalDestination = `/watch.html?url=${encodeURIComponent(fullWatchLinks)}&title=${encodedTitle}&tags=${encodedTags}`;
  const redirectPage = `/go.html?target=${encodeURIComponent(finalDestination)}`;

  try {
    const w = window.open(redirectPage, '_blank');
    if (!w || w.closed || typeof w.closed === 'undefined'){
      alert("Please allow pop-ups to open the link in a new tab!");
    }
  } catch(e){
    console.error(e);
  }
}

/**
 * 💡 SEO IMPROVEMENT: Added 'studio' and 'cast' to searchable fields.
 */
function matchesQuery(it, tokens){
  if (!tokens || tokens.length === 0) return true;
  const searchable = [
    (it.title||''),
    (it.category||''),
    (it.description||''),
    (it.studio||''),
    (it.cast||''),
  ].join(' ').toLowerCase();

  for (let tk of tokens){
    if (!tk) continue;
    const t = tk.toLowerCase();
    if (searchable.includes(t)) {
      continue;
    }
    if ((slugify(it.title||'')).includes(slugify(t))) {
      continue;
    }
    return false;
  }
  return true;
}

// Debounce helper
function debounce(fn, wait){
  let t;
  return function(...args){
    clearTimeout(t);
    t = setTimeout(()=> fn.apply(this, args), wait);
  };
}

function filterVideos(query = "") {
  const q = (query || "").toString().toLowerCase().trim();
  if (!q) {
    filteredItems = items;
    renderLatest(1);
    return;
  }
  const tokens = q.split(/\s+/).map(s => s.trim()).filter(Boolean);
  filteredItems = items.filter(it => matchesQuery(it, tokens));
  renderLatest(1);
}

// ------------- REELS PLAYER LOGIC (COMPLETED) -------------

function toEmbedUrlForReels(url) {
  if (!url) return { type: "none" };
  url = url.trim();

  if (url.startsWith('<iframe') && url.includes('src=')) {
    const match = url.match(/src=['"](.*?)['"]/i);
    if (match && match[1]) {
      return toEmbedUrlForReels(match[1]);
    }
  }

  const y = extractYouTubeID(url);
  if (y) {
    return { type: "iframe", src: `https://www.youtube.com/embed/${y}?autoplay=1&mute=1&rel=0&controls=0&enablejsapi=1&playsinline=1&origin=${window.location.origin}` };
  }

  if (url.includes('redgifs.com/watch/')) {
    const parts = url.split("/watch/");
    if (parts.length > 1) {
      const slug = parts[1].split("?")[0];
      const embedUrl = `https://www.redgifs.com/ifr/${slug}`;
      return { type: "iframe", src: embedUrl };
    }
  }

  if (url.includes('redgifs.com/ifr/')) {
    let videoId = url.split('/').pop();
    videoId = videoId.split('?')[0];
    const embedUrl = `https://www.redgifs.com/ifr/${videoId}`;
    return { type: "iframe", src: embedUrl };
  }

  if (url.includes('.mp4') || url.includes('.gifv') || url.includes('.webm') || url.includes('.m3u8')) {
    return { type: "video", src: url };
  }

  if (url.startsWith('http')) {
    return { type: "iframe", src: url };
  }

  return { type: "none" };
}


async function openReelsPlayer() {
  if (allReelCandidates.length === 0) {
    const rawReels = await fetchSheet(SHEET_API_REELS);
    allReelCandidates = parseReelRows(rawReels);
    if (allReelCandidates.length === 0) {
      alert("No videos available for Reels playback. Check Sheet links.");
      return;
    }
  }

  usedReelIds.clear();

  const rc = qs('#reelsContainer');
  if (rc) rc.innerHTML = '';
  const rp = qs('#reelsPlayer');
  if (rp) rp.style.display = 'flex';
  document.body.style.overflow = 'hidden';

  loadNextReel();
}

function closeReelsPlayer() {
  const rp = qs('#reelsPlayer');
  if (rp) rp.style.display = 'none';
  document.body.style.overflow = '';
  // Cleanup container
  const rc = qs('#reelsContainer');
  if (rc) rc.innerHTML = '';
}

function handleTouchStart(e) {
  swipeStartY = e.touches[0].clientY;
}

function handleTouchMove(e) {
  // Prevent scrolling the body while inside the reel player
  e.preventDefault(); 
}

function handleTouchEnd(e) {
  const swipeEndY = e.changedTouches[0].clientY;
  const deltaY = swipeEndY - swipeStartY;
  
  // Simple tap detection
  const now = Date.now();
  if (now - lastTapTime < 300) {
    // Assuming you implement a toggleSound function
    // toggleReelSound(); 
    lastTapTime = 0;
    return;
  }
  lastTapTime = now;

  // Swipe up (deltaY is negative) -> Next reel
  if (deltaY < -50) { 
    const currentReel = qs('#reelsContainer .reel');
    if (currentReel) currentReel.remove();
    loadNextReel();
  } 
  // Swipe down (deltaY is positive) -> Close player
  else if (deltaY > 100) {
    closeReelsPlayer();
  }
}


function toggleReelSound(e) {
  if (e) e.stopPropagation();
  const reelDiv = qs('#reelsContainer .reel');
  if (!reelDiv) return;
  const mediaEl = reelDiv.querySelector('.reel-video-media');

  if (mediaEl && mediaEl.tagName === 'VIDEO') {
    mediaEl.muted = !mediaEl.muted;
  }
}

// 💥 FIX: loadNextReel was cut off, completed with logic
function loadNextReel() {
  const container = qs("#reelsContainer");
  const rp = qs('#reelsPlayer');

  if (usedReelIds.size >= allReelCandidates.length) {
    usedReelIds.clear();
    log("♻️ All reels shown once — starting new random cycle.");
  }

  let candidate = null;
  const pool = allReelCandidates.filter(r => !usedReelIds.has(r.id));
  if (pool.length > 0) {
    candidate = pool[Math.floor(Math.random() * pool.length)];
  } else if (allReelCandidates.length > 0) {
    // If pool is empty, reset and pick a random one
    usedReelIds.clear();
    candidate = allReelCandidates[Math.floor(Math.random() * allReelCandidates.length)];
  }

  if (!candidate) {
    closeReelsPlayer();
    return;
  }

  usedReelIds.add(candidate.id);
  
  const newReel = document.createElement('div');
  newReel.className = 'reel loading';
  newReel.innerHTML = `<div class="reel-content">
    <div class="loader"></div>
  </div>`;
  container.appendChild(newReel);

  const mediaContainer = newReel.querySelector('.reel-content');
  const embed = toEmbedUrlForReels(candidate.reelLink);

  if (embed.type === 'iframe') {
    // 💡 REDIRECT FIX: Added sandbox="allow-scripts allow-same-origin allow-popups"
    // This prevents top-level navigation, blocking redirects from inside the iframe.
    mediaContainer.innerHTML = `<iframe 
      class="reel-video-media" 
      src="${embed.src}" 
      frameborder="0" 
      allow="autoplay; encrypted-media; gyroscope; picture-in-picture" 
      allowfullscreen 
      sandbox="allow-scripts allow-same-origin allow-popups"
    ></iframe>`;
    newReel.classList.remove('loading');
  } else if (embed.type === 'video') {
    mediaContainer.innerHTML = `<video class="reel-video-media" src="${embed.src}" autoplay muted loop playsinline></video>`;
    const video = mediaContainer.querySelector('video');
    video.addEventListener('loadeddata', () => newReel.classList.remove('loading'));
    video.addEventListener('error', () => {
      log("Video load error, trying next reel.");
      newReel.remove();
      loadNextReel();
    });
  } else {
    log("Unsupported reel link format, trying next reel.");
    newReel.remove();
    loadNextReel();
  }

  // Update UI Title
  const titleEl = document.createElement('h2');
  titleEl.className = 'reel-title';
  titleEl.textContent = escapeHtml(candidate.title || 'Reel Video');
  mediaContainer.appendChild(titleEl);

  // Add swipe listeners for navigation
  newReel.addEventListener('touchstart', handleTouchStart);
  newReel.addEventListener('touchmove', handleTouchMove);
  newReel.addEventListener('touchend', handleTouchEnd);
}

// 💥 FIX: loadAll was cut off, completed and closed correctly
async function loadAll(){
  try {
    const cachedItems = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');
    if (cachedItems.length > 0) {
      items = cachedItems;
      filteredItems = cachedItems;
      // Render immediately from cache for speed
      renderLatest(1); 
      renderRandom();
    }
  } catch (e) {
    // ignore cache parse errors
  }

  const raw = await fetchSheet(SHEET_API);
  const parsed = parseRows(raw);
  items = parsed;
  filteredItems = parsed;

  // ------------------------------------
  // 🆕 NEW: Handle URL Filter on Load
  // ------------------------------------
  const params = new URLSearchParams(window.location.search);
  const urlFilter = params.get('filter');
  let currentTitle = "Latest Videos";

  if (urlFilter) {
      const decodedFilter = decodeURIComponent(urlFilter).toLowerCase().trim();
      // Filter items based on the 'filter' parameter (checks category, studio, cast)
      filteredItems = items.filter(it => 
          (it.category||'').toLowerCase().includes(decodedFilter) || 
          (it.studio||'').toLowerCase().includes(decodedFilter) || 
          (it.cast||'').toLowerCase().includes(decodedFilter) 
      );
      
      const titleEl = qs('#mainTitle');
      if (titleEl) {
          currentTitle = decodedFilter.charAt(0).toUpperCase() + decodedFilter.slice(1).replace(/-/g, ' ') + " Tag";
          titleEl.textContent = currentTitle;
      }
      document.title = `${currentTitle} | Dareloom Hub`;
  }
  // ------------------------------------


  if (items.length === 0) {
    console.warn("Main Sheet load failed. Check Google Sheet Access and API Key.");
  }

  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items));
  } catch(e) {
    // localStorage could fail in private modes; ignore silently
  }

  // Re-render after fresh data load (will use filteredItems if filter is active)
  renderLatest(1); 
  renderRandom();

  const s = qs('#searchInput');
  if (s){
    const debounced = debounce((e) => {
      const q = e.target.value || "";
      filterVideos(q);
    }, 250);
    s.removeEventListener('input', debounced);
    s.addEventListener('input', debounced);

    s.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') {
        filterVideos(s.value || '');
      }
    });
  }

  // Define and setup gesture listener
  function setupGestureListener(){ 
    // Logic for setting up gesture listener for non-reels player area if needed
  }
  setupGestureListener();
}

loadAll();
