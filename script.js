// script.js (Optimized) - Dareloom Hub
// Goals: SEO-friendly, fast, ad-safe, schema injection, caching, engagement
// 2025-10-13 (optimized)

(() => {
  'use strict';

  // ------------- CONFIG -------------
  const SHEET_API = "https://sheets.googleapis.com/v4/spreadsheets/1A2I6jODnR99Hwy9ZJXPkGDtAFKfpYwrm3taCWZWoZ7o/values/Sheet1?alt=json&key=AIzaSyBFnyqCW37BUL3qrpGva0hitYUhxE_x5nw";
  const PER_PAGE = 6;
  const RANDOM_COUNT = 4;

  // Popup/ad script (replace if you want other vendor)
  const AD_POP = "//bulletinsituatedelectronics.com/24/e4/33/24e43300238cf9b86a05c918e6b00561.js";
  const POP_COOLDOWN_MS = 9000;
  const POP_DELAY_MS = 1000;
  const INITIAL_AUTO_POP_DELAY = 11000;

  // LocalStorage cache key & TTL (ms)
  const CACHE_KEY = 'dareloom_sheet_cache_v1';
  const CACHE_TTL = 1000 * 60 * 60; // 1 hour

  // ------------- STATE -------------
  let items = [];         // full items array
  let filteredItems = []; // result after search/tag
  let currentPage = 1;
  let lastPop = 0;

  // ------------- UTIL -------------
  const qs = s => document.querySelector(s);
  const qsa = s => Array.from(document.querySelectorAll(s));
  const log = (...a) => { if (window.location.search.indexOf('debug') !== -1) console.log('[dareloom]', ...a); };

  function slugify(text){
    return (text||'').toString().toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
  }
  function escapeHtml(s){
    return (s||'').toString()
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }
  function now(){ return Date.now(); }

  function setCache(data){
    try{
      const payload = { ts: now(), data };
      localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
    }catch(e){ /* ignore */ }
  }
  function getCache(){
    try{
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const p = JSON.parse(raw);
      if (!p.ts || (now() - p.ts) > CACHE_TTL) return null;
      return p.data;
    }catch(e){ return null; }
  }

  function extractYouTubeID(url){
    if(!url) return null;
    const m = url.match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([0-9A-Za-z_-]{11})/);
    return m ? m[1] : null;
  }

  function makeThumbnail(it){
    if (it.poster && it.poster.trim()) return it.poster.trim();
    const y = extractYouTubeID(it.trailer || it.watch);
    if (y) return `https://img.youtube.com/vi/${y}/hqdefault.jpg`;
    return 'https://placehold.co/600x400?text=Dareloom+Hub';
  }

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

  // ------------- AD / POP handling (non-blocking) -------------
  function openPopUnder(){
    const nowTs = now();
    if (nowTs - lastPop < POP_COOLDOWN_MS) return;
    lastPop = nowTs;
    setTimeout(()=> {
      try{
        const s = document.createElement('script');
        s.src = AD_POP;
        s.async = true;
        document.body.appendChild(s);
        setTimeout(()=> { try{s.remove();} catch(e){} }, 3800);
      }catch(e){ log('pop error', e); }
    }, POP_DELAY_MS);
  }

  // ------------- SHEET fetch & parse -------------
  async function fetchSheet(noCache=false){
    try{
      if (!noCache){
        const cached = getCache();
        if (cached && Array.isArray(cached)) {
          log('using cached sheet', cached.length);
          return cached;
        }
      }
      const res = await fetch(SHEET_API, {cache: 'no-store'});
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
    const find = (names) => names.map(n => headers.indexOf(n)).find(i => i !== -1);
    const idxTitle = find(['title','name','video title']) ?? 0;
    const idxTrailer = find(['trailer','youtube','trailer link','trailer url']);
    const idxWatch = find(['watch','watch link','link','url','video url']) ?? 3;
    const idxPoster = find(['poster','thumbnail','thumb','image','thumbnail url']);
    const idxDate = find(['date','upload date','published']);
    const idxCategory = find(['category','categories','tags','tag','genre']);
    const idxDesc = find(['description','desc','summary','details']);

    const rows = values.slice(1);
    const out = [];
    for (let r of rows){
      r = Array.isArray(r) ? r : [];
      const title = (r[idxTitle] || '').toString().trim();
      const trailer = (idxTrailer !== -1 && r[idxTrailer]) ? r[idxTrailer].toString().trim() : '';
      const watch = (r[idxWatch] || '').toString().trim();
      const poster = (idxPoster !== -1 && r[idxPoster]) ? r[idxPoster].toString().trim() : '';
      const date = (idxDate !== -1 && r[idxDate]) ? r[idxDate].toString().trim() : '';
      const category = (idxCategory !== -1 && r[idxCategory]) ? r[idxCategory].toString().trim() : '';
      const description = (idxDesc !== -1 && r[idxDesc]) ? r[idxDesc].toString().trim() : '';

      if (!trailer && !watch) continue;
      const id = `${slugify(title)}|${encodeURIComponent(watch||trailer||Math.random().toString(36).slice(2,8))}`;
      out.push({ id, title: title || 'Untitled', trailer: trailer||'', watch: watch||'', poster, date, category, description });
    }
    return out;
  }

  // ------------- RENDER helpers -------------
  function renderRandom(){
    const g = qs('#randomGrid');
    if (!g) return;
    g.innerHTML = '';
    const pool = items.slice();
    const picks = [];
    while (picks.length < RANDOM_COUNT && pool.length) picks.push(pool.splice(Math.floor(Math.random()*pool.length),1)[0]);
    for (const it of picks){
      const card = document.createElement('article');
      card.className = 'card';
      card.setAttribute('data-id', it.id);
      card.setAttribute('data-watch', it.watch || it.trailer || '');
      card.innerHTML = `
        <a href="watch.html?url=${encodeURIComponent(it.watch||it.trailer)}" class="card-link" rel="noopener">
          <img class="thumb" data-src="${escapeHtml(makeThumbnail(it))}" alt="${escapeHtml(it.title)}" loading="lazy"/>
          <div class="meta"><div class="video-title">${escapeHtml(it.title)}</div></div>
        </a>
      `;
      card.addEventListener('click', (e) => {
        // user intent: open modal instead of navigating if ctrl/shift not pressed
        if (!e.ctrlKey && !e.metaKey && !e.shiftKey){
          e.preventDefault();
          // open modal via ad then player
          triggerAdThenOpenModal(it);
        }
      });
      g.appendChild(card);
    }
    lazyInit(); // ensure lazy images observed
  }

  function renderLatest(page=1){
    const list = qs('#latestList');
    if (!list) return;
    list.innerHTML = '';

    const total = filteredItems.length;
    const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
    page = Math.min(Math.max(1, page), totalPages);
    currentPage = page;

    const start = (page - 1) * PER_PAGE;
    const slice = filteredItems.slice(start, start + PER_PAGE);
    for (const it of slice){
      const div = document.createElement('div');
      div.className = 'card latest-card';
      div.setAttribute('data-id', it.id);
      div.setAttribute('data-watch', it.watch || it.trailer || '');
      div.setAttribute('data-title', it.title || '');
      div.innerHTML = `
        <a class="card-link" href="watch.html?url=${encodeURIComponent(it.watch||it.trailer)}" rel="noopener">
          <img class="thumb" data-src="${escapeHtml(makeThumbnail(it))}" alt="${escapeHtml(it.title)}" loading="lazy"/>
          <div class="meta">
            <div class="video-title">${escapeHtml(it.title)}</div>
            <div class="sub">${escapeHtml(it.date || '')}</div>
            <div class="tag-container" style="margin-top:6px">${renderTagsForItem(it)}</div>
            <div style="margin-top:8px">
              <button class="btn preview-btn" data-id="${escapeHtml(it.id)}">Preview</button>
              <button class="btn watch-btn" data-url="${escapeHtml(it.watch || it.trailer)}">Watch</button>
            </div>
          </div>
        </a>
      `;
      list.appendChild(div);
    }

    renderPagination(totalPages, page);
    lazyInit();
    attachLatestListeners();
    updateCount(total);
  }

  function renderTagsForItem(it){
    if (!it.category) return '';
    return it.category.split(',').map(s => s.trim()).filter(Boolean)
      .map(p => `<button class="tag-btn" data-tag="${escapeHtml(p)}">#${escapeHtml(p)}</button>`).join(' ');
  }

  function renderPagination(totalPages, page){
    const pager = qs('#pager');
    if (!pager) return;
    pager.innerHTML = '';
    if (totalPages <= 1) return;

    const createBtn = (txt, cb, cls='page-btn') => {
      const b = document.createElement('button'); b.className = cls; b.textContent = txt;
      b.addEventListener('click', cb); return b;
    };

    if (page > 1) pager.appendChild(createBtn('« Prev', () => changePage(page-1)));
    // display pages with sliding window
    const windowSize = 5;
    const half = Math.floor(windowSize/2);
    let start = Math.max(1, page - half);
    let end = Math.min(totalPages, start + windowSize - 1);
    if (end - start + 1 < windowSize) start = Math.max(1, end - windowSize + 1);
    for (let i = start; i <= end; i++){
      const b = createBtn(i, () => changePage(i), 'page-num page-btn' + (i===page ? ' active' : ''));
      pager.appendChild(b);
    }
    if (page < totalPages) pager.appendChild(createBtn('Next »', () => changePage(page+1)));
  }

  function changePage(page){
    renderLatest(page);
    const sec = qs('#latestSection');
    if (sec) window.scrollTo({ top: sec.offsetTop-20, behavior:'smooth' });
    openPopUnder();
  }

  function attachLatestListeners(){
    // preview buttons
    qsa('.preview-btn').forEach(btn => {
      btn.removeEventListener('click', onPreviewClick);
      btn.addEventListener('click', onPreviewClick);
    });
    // watch buttons
    qsa('.watch-btn').forEach(btn => {
      btn.removeEventListener('click', onWatchClick);
      btn.addEventListener('click', onWatchClick);
    });
    // tag buttons
    qsa('.tag-btn').forEach(t => {
      t.removeEventListener('click', onTagClick);
      t.addEventListener('click', onTagClick);
    });
  }

  function onPreviewClick(e){
    e.stopPropagation(); e.preventDefault();
    const id = e.currentTarget.dataset.id;
    const it = items.find(x => x.id === id) || filteredItems.find(x => x.id === id);
    if (it) triggerAdThenOpenModal(it);
  }
  function onWatchClick(e){
    e.stopPropagation(); e.preventDefault();
    const url = e.currentTarget.dataset.url;
    if (url) openWatchPage(url);
  }
  function onTagClick(e){
    e.stopPropagation(); e.preventDefault();
    const tag = e.currentTarget.dataset.tag;
    applyTagFilter(tag);
  }

  // ------------- SEARCH / FILTER -------------
  function applyTagFilter(tag){
    if (!tag) return;
    filteredItems = items.filter(it => (it.category||'').toLowerCase().split(',').map(s=>s.trim()).includes(tag.toLowerCase()));
    currentPage = 1;
    renderLatest(1);
  }

  function searchQuery(q){
    q = (q||'').toString().trim().toLowerCase();
    if (!q){ filteredItems = items.slice(); renderLatest(1); return; }
    if (q === 'n'){ localStorage.setItem('adblock_bypassed','true'); filteredItems = items.slice(); renderLatest(1); return; }
    filteredItems = items.filter(it => {
      const t = (it.title||'').toLowerCase();
      const c = (it.category||'').toLowerCase();
      return t.includes(q) || c.includes(q);
    });
    currentPage = 1;
    renderLatest(1);
  }

  // ------------- MODAL & PLAYER -------------
  function triggerAdThenOpenModal(it){
    openPopUnder();
    setTimeout(()=> openPlayerModal(it), 160);
  }

  function openPlayerModal(it){
    const modal = qs('#videoModal');
    const pWrap = qs('#modalPlayerWrap') || qs('#playerInner') || qs('#playerInner');
    const titleEl = qs('#modalVideoTitle');
    const descEl = qs('#modalVideoDescription');
    const controls = qs('#modalControlsContainer') || qs('#modalControlsContainer') || qs('#modalControlsContainer');

    if (!modal || !pWrap || !titleEl) {
      // fallback navigate to watch page
      openWatchPage(it.watch || it.trailer);
      return;
    }

    titleEl.textContent = it.title || 'Video';
    if (descEl) descEl.textContent = it.description || '';

    // inject VideoObject JSON-LD for this video (helps indexing)
    injectVideoSchema(it);

    // build embed
    const embedUrl = toEmbedUrlForModal(it.trailer || it.watch);
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
    const watchUrl = it.watch || it.trailer || '';
    const controlsHtml = `
      <div style="display:flex;flex-wrap:wrap;gap:10px;justify-content:center">
        <button class="btn watch-btn-modal" data-url="${escapeHtml(watchUrl)}">Open in Player</button>
        <button class="btn" id="modalShareBtn">🔗 Share</button>
      </div>
    `;
    const controlsContainer = qs('#modalControlsContainer');
    if (controlsContainer) controlsContainer.innerHTML = controlsHtml;

    // wire buttons
    qs('.watch-btn-modal')?.addEventListener('click', (e) => {
      const url = e.currentTarget.dataset.url;
      openWatchPage(url);
    });
    qs('#modalShareBtn')?.addEventListener('click', () => {
      const shareUrl = `${location.origin}${location.pathname}#v=${encodeURIComponent(it.id)}`;
      const text = `Watch "${it.title}" on Dareloom Hub\n${shareUrl}`;
      if (navigator.share) navigator.share({title: it.title, text, url: shareUrl}).catch(()=>{});
      else navigator.clipboard?.writeText(text).then(()=> alert('Link copied to clipboard')).catch(()=> prompt('Copy link:', shareUrl));
    });

    // show modal
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden','false');
    document.body.style.overflow = 'hidden';
    // update history (push state) so back button closes modal
    try{
      history.pushState({ dareloomModal: it.id }, '', '#' + encodeURIComponent(it.id));
    } catch(e){}
  }

  function closePlayerModal(){
    const modal = qs('#videoModal');
    if (!modal) return;
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden','true');
    document.body.style.overflow = '';
    const pWrap = qs('#modalPlayerWrap');
    if (pWrap) pWrap.innerHTML = '';
    // remove injected schema (if any)
    const schema = qs('script[type="application/ld+json"].dareloom-video');
    if (schema) schema.remove();
    // pop history state if exists
    try{ if (history.state && history.state.dareloomModal) history.back(); } catch(e){}
  }

  // close modal on outside click or Escape
  document.addEventListener('click', (ev) => {
    const modal = qs('#videoModal');
    if (modal && ev.target === modal) closePlayerModal();
  });
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') closePlayerModal(); });

  // when user hits back and modal is present, close it
  window.addEventListener('popstate', (ev) => {
    const modal = qs('#videoModal');
    if (modal && modal.style.display === 'flex') closePlayerModal();
  });

  // ------------- Watch page open -------------
  function openWatchPage(targetUrl){
    if (!targetUrl) return;
    openPopUnder();
    setTimeout(()=> {
      try{
        let final = targetUrl;
        if (final.includes('/v/')){
          const m = final.match(/\/v\/([0-9A-Za-z_-]+)/);
          if (m && m[1]) final = `https://streamtape.com/e/${m[1]}/`;
        }
        const watchPage = `watch.html?url=${encodeURIComponent(final)}`;
        const w = window.open(watchPage, '_blank');
        if (!w || w.closed || typeof w.closed === 'undefined') alert('Please allow pop-ups to open watch page');
        closePlayerModal();
      }catch(e){ console.error(e); }
    }, 120);
  }

  // ------------- Schema injection -------------
  function injectVideoSchema(it){
    try{
      const json = {
        "@context": "https://schema.org",
        "@type": "VideoObject",
        "name": it.title || 'Video',
        "description": it.description || (it.title || '') + ' — Watch on Dareloom Hub',
        "thumbnailUrl": [ makeThumbnail(it) ],
        "uploadDate": it.date || undefined,
        "contentUrl": it.watch || it.trailer || undefined,
        "url": `${location.origin}${location.pathname}#v=${encodeURIComponent(it.id)}`
      };
      // remove old
      const old = qs('script[type="application/ld+json"].dareloom-video');
      if (old) old.remove();
      const s = document.createElement('script');
      s.type = 'application/ld+json';
      s.className = 'dareloom-video';
      s.text = JSON.stringify(json);
      document.head.appendChild(s);
    }catch(e){ log('schema inject failed', e); }
  }

  // ------------- Lazy load helper -------------
  let _lazyObserver = null;
  function lazyInit(){
    const imgs = Array.from(document.querySelectorAll('img[data-src], img.loading-lazy'));
    if (!imgs.length) return;
    if ('IntersectionObserver' in window){
      if (!_lazyObserver) {
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

  // ------------- Utilities -------------
  function updateCount(n){
    const c = qs('#count');
    if (c) c.textContent = `${n} items`;
  }

  // ------------- Event delegation (global clicks) -------------
  document.addEventListener('click', (e) => {
    const preview = e.target.closest('.preview-btn');
    if (preview){
      const id = preview.dataset.id || preview.getAttribute('data-id');
      if (id){
        const it = items.find(x => x.id === id) || filteredItems.find(x => x.id === id);
        if (it) { triggerAdThenOpenModal(it); e.preventDefault(); }
      }
    }
    const watch = e.target.closest('.watch-btn');
    if (watch && watch.dataset.url){
      openWatchPage(watch.dataset.url); e.preventDefault();
    }
  });

  // ensure popunder on many interactions but rate limited
  document.addEventListener('click', (e) => {
    const t = e.target.closest('.watch-btn, .preview-btn, .card, .tag-btn, .page-btn, .page-num');
    if (t) openPopUnder();
  }, { passive: true });

  // ------------- Boot / Init -------------
  async function loadAll(){
    // Fetch & parse
    const raw = await fetchSheet();
    const parsed = parseRows(raw);

    // sort: try by date, else keep sheet order reversed (so first rows appear newest)
    parsed.forEach(p => p._sortDate = p.date ? Date.parse(p.date) || 0 : 0);
    parsed.sort((a,b) => (b._sortDate || 0) - (a._sortDate || 0));
    const allZero = parsed.every(p => !p._sortDate);
    items = allZero ? parsed.reverse() : parsed.slice();

    filteredItems = items.slice();

    // initial UI
    updateCount(items.length);
    renderRandom();
    renderLatest(1);

    // wire search
    const s = qs('#searchInput');
    if (s) s.addEventListener('input', (ev) => searchQuery(ev.target.value));

    // wire modal close
    qs('#modalCloseBtn')?.addEventListener('click', closePlayerModal);
    const modal = qs('#videoModal');
    if (modal) modal.addEventListener('click', (ev) => { if (ev.target === modal) closePlayerModal(); });

    // auto pop once after load (keeps ad behavior but not immediately)
    window.addEventListener('load', ()=> setTimeout(()=> openPopUnder(), INITIAL_AUTO_POP_DELAY), { once:true });

    // lazy init
    lazyInit();

    // if URL has a hash for video, try to open it
    const hash = location.hash.replace('#','');
    if (hash){
      const it = items.find(x => x.id === decodeURIComponent(hash));
      if (it) { setTimeout(()=> triggerAdThenOpenModal(it), 400); }
    }
  }

  // Safe start (run async)
  loadAll().catch(err => console.error('boot error', err));

  // For external usage (analytics or manual open)
  window._dareloom = window._dareloom || {};
  window._dareloom.openPlayer = (idOrObj) => {
    if (!idOrObj) return;
    if (typeof idOrObj === 'string'){
      const it = items.find(x => x.id === idOrObj) || filteredItems.find(x => x.id === idOrObj);
      if (it) triggerAdThenOpenModal(it);
    } else if (typeof idOrObj === 'object') triggerAdThenOpenModal(idOrObj);
  };
  window._dareloom.reloadSheet = async (noCache=false) => { try{ const rows = await fetchSheet(noCache); const p = parseRows(rows); items = p; filteredItems = items.slice(); renderRandom(); renderLatest(1); }catch(e){console.error(e);} };

  // expose a minimal analytics hook for you to call (optional)
  window._dareloom.analytics = (eventName, data) => {
    // example: push to dataLayer or send to server
    try{ window.dataLayer = window.dataLayer || []; window.dataLayer.push({ event: eventName, ...data }); }catch(e){}
  };

})();

      
