// script.js — Dareloom Hub (Complete, auto-thumbnail enabled)
// 2025-10-13 (final ready-to-use)
// Features:
// - Flexible Google Sheets parsing (any column order)
// - Auto-detect video links (Streamtape /v/ , YouTube, Drive, MP4)
// - Auto-thumbnail generation (YouTube & Streamtape get priority)
// - Caching (localStorage) with TTL
// - Pagination (new -> old), search, tags, category filter
// - Modal preview & watch page handling
// - Injects VideoObject JSON-LD for each open video
// - Non-blocking ad popunder with cooldown
// - Lazy image loading (IntersectionObserver)
// - Debug hooks & reload

(() => {
  'use strict';

  // ---------------- CONFIG ----------------
  // FIX 1: Sheet tab name 'Sheet1' ko 'Full%20Series' se badla gaya hai.
  const SHEET_API = "https://sheets.googleapis.com/v4/spreadsheets/1A2I6jODnR99Hwy9ZJXPkGDtAFKfpYwrm3taCWZWoZ7o/values/Full%20Series?alt=json&key=AIzaSyBFnyqCW37BUL3qrpGva0hitYUhxE_x5nw";
  const PER_PAGE = 6;
  const RANDOM_COUNT = 4;

  // Pop / ad script (swap if needed)
  let AD_POP = "//bulletinsituatedelectronics.com/24/e4/33/24e43300238cf9b86a05c918e6b00561.js";
  const POP_COOLDOWN_MS = 9000;
  const POP_DELAY_MS = 1200;
  const INITIAL_AUTO_POP_DELAY = 11000;

  // Cache
  const CACHE_KEY = 'dareloom_sheet_cache_v3';
  const CACHE_TTL = 1000 * 60 * 60; // 1 hour

  // ---------------- STATE ----------------
  let items = [];         // normalized items
  let filteredItems = []; // after search / tag
  let currentPage = 1;
  let lastPop = 0;
  let _lazyObserver = null;

  // ---------------- HELPERS ----------------
  const qs = sel => document.querySelector(sel);
  const qsa = sel => Array.from(document.querySelectorAll(sel));
  const log = (...a) => { if (location.search.indexOf('debug') !== -1) console.log('[dareloom]', ...a); };

  function now(){ return Date.now(); }
  function setCache(data){ try{ localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: now(), data })); } catch(e){} }
  function getCache(){ try{ const raw = localStorage.getItem(CACHE_KEY); if (!raw) return null; const p = JSON.parse(raw); if (!p.ts || (now() - p.ts) > CACHE_TTL) return null; return p.data; } catch(e){ return null; } }

  function slugify(text){ return (text||'').toString().toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,''); }
  function escapeHtml(s){ return (s||'').toString().replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
  function debounce(fn, ms=250){ let t; return (...a)=>{ clearTimeout(t); t = setTimeout(()=>fn(...a), ms); }; }

  // ---------------- URL / ID helpers ----------------
  function extractYouTubeID(url){
    if(!url) return null;
    const m = url.match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([0-9A-Za-z_-]{11})/);
    return m ? m[1] : null;
  }

  function normalizeLinkList(maybe){
    if(!maybe) return [];
    if (Array.isArray(maybe)) return maybe.map(s => s.toString().trim()).filter(Boolean);
    return maybe.toString().split(/\s*,\s*|\n+/).map(s => s.trim()).filter(Boolean);
  }

  function isPlayableLink(url){
    if(!url) return false;
    // Note: Streamtape '/v/' is not directly playable in modal, but we include it to prioritize YouTube/MP4
    return /(streamtape\.com|filemoon|dood\.|mixdrop|vidhide|youtube\.com|youtu\.be|drive\.google\.com|\.mp4)/i.test(url);
  }

  // ---------------- AUTO THUMBNAIL (YouTube + Streamtape /v/) ----------------
  // Streamtape: source format used: https://streamtape.com/v/ABCDEF1234/...
  // For streamtape thumbnail we attempt a public-ish pattern. Some hosts block hotlinking; fallback used.
  function makeThumbnail(item){
    // 1) explicit poster / thumbnail column (user-provided)
    if (item.poster && item.poster.toString().trim()) return item.poster.toString().trim();

    // 2) look through links for YouTube first, then Streamtape
    const links = item.links || [];
    for (const l of links){
      const y = extractYouTubeID(l);
      if (y) return `https://img.youtube.com/vi/${y}/hqdefault.jpg`;
    }

    for (const l of links){
      const m = l.match(/streamtape\.com\/[ve]\/([^/?#]+)/i);
      if (m && m[1]){
        const id = m[1];
        // streamtape thumbnail approach: try known endpoints
        return `https://i.streamtape.to/vi/${id}.jpg`;
      }
    }

    // 3) fallback - site default
    return item.fallbackThumb || 'https://i.ibb.co/p3RfpQz/default-thumb.jpg';
  }

  // ---------------- EMBED URL builder ----------------
  function toEmbedUrlForModal(url){
    if (!url) return '';
    const y = extractYouTubeID(url);
    if (y) return `https://www.youtube.com/embed/${y}?autoplay=1&rel=0`;
    if (url.includes('youtube.com/embed')) return url;
    // google drive
    if (/drive\.google\.com/.test(url)){
      const match = url.match(/[-\w]{25,}/);
      if (match) return `https://drive.google.com/file/d/${match[0]}/preview`;
    }
    // streamtape convert /v/ -> /e/
    if (url.includes('streamtape.com')){
      if (url.includes('/v/')){
        const id = url.split('/v/')[1]?.split('/')[0];
        if (id) return `https://streamtape.com/e/${id}/`;
      }
      if (url.includes('/e/')) return url;
    }
    // direct mp4
    if (url.match(/\.mp4($|\?)/i)) return url;
    // otherwise return original (some hosts provide embed urls)
    return url;
  }

  // ---------------- AD / POP HANDLING ----------------
  function openPopUnder(){
    const nowTs = now();
    if (nowTs - lastPop < POP_COOLDOWN_MS) return;
    lastPop = nowTs;
    setTimeout(()=> {
      try{
        const s = document.createElement('script');
        s.src = AD_POP;
        s.async = true;
        s.setAttribute('data-dareloom-pop','1');
        document.body.appendChild(s);
        setTimeout(()=> { try{ s.remove(); } catch(e){} }, 3800);
      }catch(e){ log('pop error', e); }
    }, POP_DELAY_MS);
  }

  // ---------------- FETCH & PARSE SHEET ----------------
  async function fetchSheet(noCache=false){
    try{
      if (!noCache){
        const cached = getCache();
        if (cached && Array.isArray(cached)) {
          log('using cached sheet rows', cached.length);
          return cached;
        }
      }
      const res = await fetch(SHEET_API, { cache: 'no-store' });
      if (!res.ok) throw new Error('sheet fetch failed ' + res.status);
      const j = await res.json();
      const rows = j.values || [];
      setCache(rows);
      return rows;
    }catch(e){
      console.error('Sheet fetch failed:', e);
      const cached = getCache();
      if (cached) return cached;
      return [];
    }
  }

  function parseRows(values){
    if (!values || values.length < 2) return [];
    const headers = (values[0]||[]).map(h => (h||'').toString().toLowerCase().trim());
    const findIndex = (cands) => {
      for (const c of cands){
        const i = headers.indexOf(c);
        if (i !== -1) return i;
      }
      return -1;
    };

    // detect common columns (flexible)
    let idxTitle = findIndex(['title','name','video title','series','movie']); // if -1 we'll fallback to first textual
    let idxTrailer = findIndex(['trailer','youtube','trailer link','trailer url']);
    let idxWatch = findIndex(['watch','watch link','link','url','video url']);
    const idxPoster = findIndex(['poster','thumbnail','thumb','image','thumbnail url','poster url']);
    const idxDate = findIndex(['date','upload date','published','uploaded']);
    let idxTags = findIndex(['tags','tag','category','categories','genre']);
    const idxDesc = findIndex(['description','desc','summary','details']);
    
    // --- FIX 2: Strong Fallback for user's Sheet Structure (A=0, C=2, G=6, U=20) ---
    // Agar header row mostly khaali hai (jaisa ki screenshot mein dikha tha), toh hardcoded indices use karo.
    const hasHeaders = headers.some(h => h.length > 1 && !/^\d+$/.test(h)); // Check if any header is meaningful
    if (!hasHeaders) {
        if (idxTitle === -1) idxTitle = 0;   // Column A -> Title
        if (idxTrailer === -1) idxTrailer = 2; // Column C -> Trailer
        if (idxWatch === -1) idxWatch = 6;   // Column G -> Watch Link
        if (idxTags === -1) idxTags = 20;    // Column U -> Tags
    }
    // --- End FIX 2 ---


    const rows = values.slice(1);
    const out = [];
    for (let r of rows){
      r = Array.isArray(r) ? r : [];
      // find title
      let title = '';
      if (idxTitle !== -1) title = (r[idxTitle]||'').toString().trim();
      if (!title) {
        // fallback: first non-url long text cell
        for (let i=0;i<r.length;i++){
          const cell = (r[i]||'').toString().trim();
          if (cell && cell.length > 2 && !/https?:\/\//i.test(cell)) { title = cell; break; }
        }
      }
      // links: prefer trailer/watch combined columns
      let combinedLinks = [];
      if (idxTrailer !== -1 && r[idxTrailer]) combinedLinks = combinedLinks.concat(normalizeLinkList(r[idxTrailer]));
      if (idxWatch !== -1 && r[idxWatch]) combinedLinks = combinedLinks.concat(normalizeLinkList(r[idxWatch]));
      // else scan entire row for any URLs
      if (!combinedLinks.length){
        for (const cell of r){
          if (typeof cell === 'string' && /https?:\/\//i.test(cell)){
            normalizeLinkList(cell).forEach(l => { if (isPlayableLink(l)) combinedLinks.push(l); });
          }
        }
      }
      // dedupe
      combinedLinks = Array.from(new Set(combinedLinks));

      // poster (manual)
      const poster = (idxPoster !== -1 && r[idxPoster]) ? r[idxPoster].toString().trim() : '';
      const date = (idxDate !== -1 && r[idxDate]) ? r[idxDate].toString().trim() : '';
      const tags = (idxTags !== -1 && r[idxTags]) ? r[idxTags].toString().trim() : '';
      const desc = (idxDesc !== -1 && r[idxDesc]) ? r[idxDesc].toString().trim() : '';

      if (!combinedLinks.length) continue; // skip rows without playable link

      const id = `${slugify(title || 'untitled')}-${encodeURIComponent(combinedLinks[0]||Math.random().toString(36).slice(2,8))}`;
      out.push({
        id,
        title: title || 'Untitled',
        links: combinedLinks,
        poster: poster || '',
        date,
        tags,
        description: desc || ''
      });
    }
    return out;
  }

  // ---------------- RENDER / UI ----------------
  function renderRandom(){
    const g = qs('#randomGrid');
    if (!g) return;
    g.innerHTML = '';
    const pool = items.slice();
    const picks = [];
    while (picks.length < RANDOM_COUNT && pool.length) picks.push(pool.splice(Math.floor(Math.random()*pool.length),1)[0]);
    picks.forEach(it => {
      const thumb = makeThumbnail(it);
      const a = document.createElement('a');
      a.href = `watch.html?url=${encodeURIComponent(it.links.join(','))}`;
      a.rel = 'noopener';
      a.className = 'card card-random';
      a.innerHTML = `
        <img class="thumb loading-lazy" data-src="${escapeHtml(thumb)}" alt="${escapeHtml(it.title)}">
        <div class="meta"><div class="video-title">${escapeHtml(it.title)}</div></div>
      `;
      a.addEventListener('click', (e)=>{
        if (!e.ctrlKey && !e.metaKey && !e.shiftKey){ e.preventDefault(); triggerAdThenOpenModal(it); }
      });
      g.appendChild(a);
    });
    lazyInit();
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
      const thumb = makeThumbnail(it);
      const allLinks = it.links.join(','); // <--- FIX 2: Saari links yahan define ki
      const div = document.createElement('div');
      div.className = 'card latest-card';
      div.dataset.id = it.id;
      div.dataset.watch = allLinks; // <--- FIX 2: data-watch mein saari links
      div.dataset.title = it.title || '';
      div.innerHTML = `
        <a class="card-link" href="watch.html?url=${encodeURIComponent(allLinks)}" rel="noopener">
          <img class="thumb loading-lazy" data-src="${escapeHtml(thumb)}" alt="${escapeHtml(it.title)}">
          <div class="meta">
            <div class="video-title">${escapeHtml(it.title)}</div>
            <div class="sub">${escapeHtml(it.date || '')}</div>
            <div class="tag-container" style="margin-top:6px">${renderTagsForItem(it)}</div>
            <div style="margin-top:8px">
              <button class="btn preview-btn" data-id="${escapeHtml(it.id)}">Preview</button>
              <button class="btn watch-btn" data-url="${escapeHtml(allLinks)}">Watch</button> </div>
          </div>
        </a>
      `;
      list.appendChild(div);
    });

    renderPagination(totalPages, page);
    lazyInit();
    attachLatestListeners();
    updateCount(total);
  }

  function renderTagsForItem(it){
    if (!it.tags) return '';
    return it.tags.split(',').map(s => s.trim()).filter(Boolean)
      .map(p => `<button class="tag-btn" data-tag="${escapeHtml(p)}">#${escapeHtml(p)}</button>`).join(' ');
  }

  function renderPagination(totalPages, page){
    const pager = qs('#pager');
    if (!pager) return;
    pager.innerHTML = '';
    if (totalPages <= 1) return;

    const createBtn = (txt, cb, cls='page-btn') => {
      const b = document.createElement('button');
      b.className = cls;
      b.textContent = txt;
      b.addEventListener('click', cb);
      return b;
    };

    if (page > 1) pager.appendChild(createBtn('« Prev', () => changePage(page - 1)));
    const windowSize = 5;
    const half = Math.floor(windowSize/2);
    let start = Math.max(1, page - half);
    let end = Math.min(totalPages, start + windowSize - 1);
    if (end - start + 1 < windowSize) start = Math.max(1, end - windowSize + 1);
    for (let i = start; i <= end; i++){
      const cls = 'page-num page-btn' + (i === page ? ' active' : '');
      pager.appendChild(createBtn(i, () => changePage(i), cls));
    }
    if (page < totalPages) pager.appendChild(createBtn('Next »', () => changePage(page + 1)));
  }

  function changePage(page){
    renderLatest(page);
    const latestSection = qs('#latestSection');
    if (latestSection) window.scrollTo({ top: latestSection.offsetTop - 20, behavior: 'smooth' });
    openPopUnder();
  }

  function attachLatestListeners(){
    qsa('#latestList .preview-btn').forEach(btn => {
      btn.removeEventListener('click', onPreviewClick);
      btn.addEventListener('click', onPreviewClick);
    });
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
    const id = e.currentTarget.dataset.id;
    const it = items.find(x => x.id === id) || filteredItems.find(x => x.id === id);
    if (it) { e.stopPropagation(); e.preventDefault(); triggerAdThenOpenModal(it); }
  }

  function onWatchClick(e){
    const url = e.currentTarget.dataset.url;
    // FIX 2: Watch button ab saari links (comma separated) bhej raha hai
    if (url){ e.stopPropagation(); e.preventDefault(); openWatchPage(url); }
  }

  function onTagClick(e){
    const tag = e.currentTarget.dataset.tag;
    if (tag){ e.stopPropagation(); e.preventDefault(); applyTagFilter(tag); }
  }

  // ---------------- SEARCH & FILTER ----------------
  function applyTagFilter(tag){
    if (!tag) return;
    filteredItems = items.filter(it => (it.tags||'').toLowerCase().split(',').map(s=>s.trim()).includes(tag.toLowerCase()));
    currentPage = 1;
    renderLatest(1);
  }

  const debouncedSearch = debounce(function(q){
    q = (q||'').toString().trim().toLowerCase();
    if (!q){ filteredItems = items.slice(); renderLatest(1); return; }
    if (q === 'n'){ localStorage.setItem('adblock_bypassed','true'); filteredItems = items.slice(); renderLatest(1); return; }
    filteredItems = items.filter(it => {
      const t = (it.title||'').toLowerCase();
      const c = (it.tags||'').toLowerCase();
      return t.includes(q) || c.includes(q);
    });
    currentPage = 1;
    renderLatest(1);
  }, 220);

  // ---------------- MODAL PREVIEW & WATCH ----------------
  function triggerAdThenOpenModal(it){
    openPopUnder();
    setTimeout(()=> openPlayerModal(it), 150);
  }

  function openPlayerModal(it){
    const modal = qs('#videoModal');
    const pWrap = qs('#modalPlayerWrap');
    const titleEl = qs('#modalVideoTitle');
    const descEl = qs('#modalVideoDescription');
    const controls = qs('#modalControlsContainer');

    if (!modal || !pWrap || !titleEl) {
      openWatchPage(it.links[0] || '');
      return;
    }

    titleEl.textContent = it.title || 'Video';
    if (descEl) descEl.textContent = it.description || '';

    injectVideoSchema(it);

    // Trailer/Preview ke liye YouTube link ko prioritize karo (if available)
    const isYoutube = (l) => /(youtube\.com|youtu\.be)/i.test(l);
    const trailerLink = it.links.find(isYoutube);
    const playable = trailerLink || it.links.find(l => isPlayableLink(l)); // Agar YouTube nahi hai, toh first playable link use karo
    
    const embedUrl = toEmbedUrlForModal(playable || '');
    pWrap.innerHTML = '';
    if (embedUrl){
      if (embedUrl.match(/\.mp4($|\?)/i)){
        const v = document.createElement('video');
        v.controls = true; v.autoplay = true; v.playsInline = true; v.src = embedUrl;
        v.style.width = '100%'; v.style.maxHeight = '520px';
        pWrap.appendChild(v);
      } else {
        const iframe = document.createElement('iframe');
        iframe.src = embedUrl;
        iframe.setAttribute('allow','autoplay; fullscreen; encrypted-media; picture-in-picture');
        iframe.setAttribute('allowfullscreen','true');
        iframe.style.width = '100%'; iframe.style.height = '420px'; iframe.style.border = '0';
        pWrap.appendChild(iframe);
      }
    } else {
      pWrap.innerHTML = `<div style="padding:60px 20px;text-align:center;color:#9aa4b2">Player not available for this source.</div>`;
    }

    // controls
    const watchUrl = it.links.join(',');
    if (controls){
      controls.innerHTML = `
        <div style="display:flex;flex-wrap:wrap;gap:10px;justify-content:center">
          <button class="btn watch-btn-modal" data-url="${escapeHtml(encodeURIComponent(watchUrl))}" style="min-width:150px">Open in Player</button>
          <button class="btn" id="modalShareBtn" style="min-width:150px">🔗 Share</button>
        </div>
      `;
      qs('.watch-btn-modal')?.addEventListener('click', (e) => {
        const url = decodeURIComponent(e.currentTarget.dataset.url || '');
        openWatchPage(url);
      });
      qs('#modalShareBtn')?.addEventListener('click', () => {
        const shareUrl = `${location.origin}${location.pathname}#v=${encodeURIComponent(it.id)}`;
        const text = `Watch "${it.title}" on Dareloom Hub\n${shareUrl}`;
        if (navigator.share) navigator.share({ title: it.title, text, url: shareUrl }).catch(()=>{});
        else navigator.clipboard?.writeText(text).then(()=> alert('Link copied to clipboard')).catch(()=> prompt('Copy link:', shareUrl));
      });
    }

    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden','false');
    document.body.style.overflow = 'hidden';
    try{ history.pushState({ dareloomModal: it.id }, '', '#'+encodeURIComponent(it.id)); } catch(e){}
  }

  function closePlayerModal(){
    const modal = qs('#videoModal');
    if (!modal) return;
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden','true');
    document.body.style.overflow = '';
    const pWrap = qs('#modalPlayerWrap');
    if (pWrap) pWrap.innerHTML = '';
    const schema = qs('script[type="application/ld+json"].dareloom-video');
    if (schema) schema.remove();
    try{ if (history.state && history.state.dareloomModal) history.back(); } catch(e){}
  }

  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') closePlayerModal(); });
window.addEventListener('popstate', () => { const modal = qs('#videoModal'); if (modal && modal.style.display === 'flex') closePlayerModal(); });

// ---------------- WATCH PAGE OPEN ----------------
function openWatchPage(target){
if (!target) return;
openPopUnder();
setTimeout(()=> {
try{
// FIX 1: Target (saari links) ko bina modify kiye watch.html ko bhej rahe hain.
const watchPage = `watch.html?url=${encodeURIComponent(target)}`;
const w = window.open(watchPage, '_blank');
if (!w || w.closed || typeof w.closed === 'undefined') alert('Please allow pop-ups to open watch page');
closePlayerModal();
}catch(e){ console.error(e); }
}, 120);
}

// ---------------- SCHEMA (VideoObject) ----------------
function injectVideoSchema(it){
try{
const json = {
"@context": "https://schema.org",
"@type": "VideoObject",
"name": it.title || 'Video',
"description": it.description || (it.title || '') + ' — Watch on Dareloom Hub',
"thumbnailUrl": [ makeThumbnail(it) ],
"uploadDate": it.date || undefined,
"contentUrl": (it.links && it.links[0]) ? it.links[0] : undefined,
"url": `${location.origin}${location.pathname}#v=${encodeURIComponent(it.id)}`
};
const old = qs('script[type="application/ld+json"].dareloom-video');
if (old) old.remove();
const s = document.createElement('script');
s.type = 'application/ld+json';
s.className = 'dareloom-video';
s.text = JSON.stringify(json);
document.head.appendChild(s);
}catch(e){ log('schema inject failed', e); }
}

// ---------------- LAZY LOADER ----------------
function lazyInit(){
const imgs = Array.from(document.querySelectorAll('img[data-src], img.loading-lazy'));
if (!imgs.length) return;
if ('IntersectionObserver' in window){
if (!_lazyObserver){
_lazyObserver = new IntersectionObserver((entries, obs) => {
entries.forEach(ent => {
if (ent.isIntersecting){
const img = ent.target;
const src = img.getAttribute('data-src') || img.getAttribute('data-original');
if (src){ img.src = src; img.removeAttribute('data-src'); }
img.classList.remove('loading-lazy');
obs.unobserve(img);
}
});
}, { rootMargin: '200px' });
}
imgs.forEach(i => _lazyObserver.observe(i));
} else {
imgs.forEach(i => { const src = i.getAttribute('data-src')||i.getAttribute('data-original'); if (src) i.src = src; i.classList.remove('loading-lazy'); });
}
}

// ---------------- UTIL ----------------
function updateCount(n){
const c = qs('#count');
if (c) c.textContent = `${n} items`;
}

// Delegated click handlers for dynamically created buttons
document.addEventListener('click', (e) => {
const preview = e.target.closest('.preview-btn');
if (preview){
const id = preview.dataset.id;
if (id){
const it = items.find(x => x.id === id) || filteredItems.find(x => x.id === id);
if (it){ triggerAdThenOpenModal(it); e.preventDefault(); }
}
}
const watch = e.target.closest('.watch-btn');
if (watch && watch.dataset.url){
openWatchPage(watch.dataset.url);
e.preventDefault();
}
});

// rate-limited pop trigger on many interactions
document.addEventListener('click', (e) => {
const t = e.target.closest('.watch-btn, .preview-btn, .card, .tag-btn, .page-btn, .page-num, .card-link');
if (t) openPopUnder();
}, { passive: true });

// ---------------- BOOT / INIT ----------------
async function loadAll(){
log('loading sheet...');
const raw = await fetchSheet();
const parsed = parseRows(raw);

// sort new -> old. If date exists try to parse it else keep sheet order reversed  
parsed.forEach(p => p._sortDate = p.date ? Date.parse(p.date) || 0 : 0);  
parsed.sort((a,b) => (b._sortDate || 0) - (a._sortDate || 0));  
const allZero = parsed.every(p => !p._sortDate);  
items = allZero ? parsed.reverse() : parsed.slice();  
filteredItems = items.slice();  

log('items loaded', items.length);  
updateCount(items.length);  
renderRandom();  
renderLatest(1);  

const s = qs('#searchInput');  
if (s) s.addEventListener('input', (ev) => { debouncedSearch(ev.target.value); });  

qs('#modalCloseBtn')?.addEventListener('click', closePlayerModal);  

const modal = qs('#videoModal');  
if (modal){  
  modal.addEventListener('click', (ev) => { if (ev.target === modal) closePlayerModal(); });  
}  

lazyInit();  
window.addEventListener('load', ()=> setTimeout(()=> openPopUnder(), INITIAL_AUTO_POP_DELAY), { once:true });  

// open modal if hash points to a video  
const hash = decodeURIComponent(location.hash.replace('#',''));  
if (hash){  
  const it = items.find(x => x.id === hash);  
  if (it) setTimeout(()=> triggerAdThenOpenModal(it), 400);  
}

}

// expose helpers for debugging & manual reload
window._dareloom = window._dareloom || {};
window._dareloom.openPlayer = (idOrObj) => {
if (!idOrObj) return;
if (typeof idOrObj === 'string'){
const it = items.find(x => x.id === idOrObj) || filteredItems.find(x => x.id === idOrObj);
if (it) triggerAdThenOpenModal(it);
} else if (typeof idOrObj === 'object' && idOrObj.links) triggerAdThenOpenModal(idOrObj);
};
window._dareloom.reloadSheet = async (noCache=false) => { try{ const rows = await fetchSheet(noCache); const p = parseRows(rows); items = p; filteredItems = items.slice(); renderRandom(); renderLatest(1); }catch(e){console.error(e);} };
window._dareloom.setAdPop = (url) => { AD_POP = url; };

// start
loadAll().catch(err => console.error('boot error', err));
