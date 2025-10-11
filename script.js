// ✅ FINAL DARELOOM HUB SCRIPT (V6 – ROBUST DYNAMIC INDEXING)

const SHEET_API = "https://sheets.googleapis.com/v4/spreadsheets/1A2I6jODnR99Hwy9ZJXPkGDtAFKfpYwrm3taCW2WoZ7o/values/Sheet1?alt=json&key=AIzaSyBFnyqCW37BUL3qrpGva0hitYUhxE_x5nw";
const AD_POP = "//bulletinsituatedelectronics.com/24/e4/33/24e43300238cf9b86a05c918e6b00561.js";
const PER_PAGE = 5;
let items = [], current = null, currentPage = 1;

// ====== POPUNDER CONTROL CONSTANTS & STATE ======
const POP_COOLDOWN_MS = 7000;
const POP_DELAY_MS = 2000;
const INITIAL_AUTO_POP_DELAY = 10000;

let lastPop = 0; 
const ADSTERRA_NATIVE_BANNER_SCRIPT = '<script type="text/javascript" src="//www.highperformanceformat.com/d1be46ed95d3e2db572824c531da5082/invoke.js"></script>';
const ADSTERRA_SOCIAL_BAR_SCRIPT = '<script type="text/javascript" src="//pl27654958.revenuecpmgate.com/cb/63/19/cb6319838ced4608354b54fc6faddb8a.js"></script>';
// ====================================================

// ==== AUTO POP LOGIC & POP FUNCTION (Kept unchanged) ====
const AUTO_POP_INTERVAL_MS = 30000;
let autoPopTimer = null;
let autoPopEnabled = (localStorage.getItem('auto_pop_enabled') !== 'false');

function startAutoPop() {
  stopAutoPop();
  if (!autoPopEnabled || document.hidden) return;
  autoPopTimer = setInterval(openAdsterraPop, AUTO_POP_INTERVAL_MS);
}
function stopAutoPop() {
  if (autoPopTimer) { clearInterval(autoPopTimer); autoPopTimer = null; }
}
document.addEventListener('visibilitychange', () => (document.hidden ? stopAutoPop() : startAutoPop()));
window.addEventListener('beforeunload', stopAutoPop);
window.toggleAutoPop = function(val) {
  autoPopEnabled = typeof val === 'boolean' ? val : !autoPopEnabled;
  localStorage.setItem('auto_pop_enabled', autoPopEnabled ? 'true' : 'false');
  autoPopEnabled ? startAutoPop() : stopAutoPop();
};

function openAdsterraPop() {
  const now = Date.now();
  if (now - lastPop < POP_COOLDOWN_MS) return;
  lastPop = now;

  setTimeout(() => {
    try {
      const s = document.createElement('script');
      s.src = AD_POP;
      s.async = true;
      document.body.appendChild(s);
      setTimeout(() => { try { s.remove(); } catch(e){} }, 4000);
    } catch(e) { console.warn("Ad pop failed:", e); }
  }, POP_DELAY_MS);
}

document.addEventListener("click", (e) => {
  const t = e.target.closest(".watch-btn, .btn, .preview-btn, .page-btn, .card");
  if (t) openAdsterraPop();
}, { passive: true });


// ==== HELPERS (Kept unchanged) ====
function slugify(text) {
  return text.toString().toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
function escapeHtml(s) {
  return (s||'').toString()
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}
function getLinkName(url) {
  if(!url) return 'Watch Link';
  try {
    if (url.includes('streamtape.com') || url.includes('stape.fun')) return 'Streamtape';
    if (url.includes('t.me') || url.includes('telegram')) return 'Telegram';
    if (url.includes('gofile.io')) return 'GoFile';
    if (url.includes('drive.google.com')) return 'Drive';
    if (url.includes('mp4upload.com')) return 'Mp4Upload';
    const d = new URL(url).hostname.replace(/^www./,'');
    return d.split('.')[0].charAt(0).toUpperCase() + d.split('.')[0].slice(1);
  } catch(e) {
    return 'External';
  }
}
function extractYouTubeID(url) {
  if(!url) return null;
  const m = url.match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([0-9A-Za-z_-]{11})/);
  return m ? m[1] : null;
}
function makeThumbnail(item) {
  if (item.poster && item.poster.trim()) return item.poster;
  const y = extractYouTubeID(item.trailer) || extractYouTubeID(item.watch);
  if (y) return `https://img.youtube.com/vi/${y}/hqdefault.jpg`;
  return 'https://placehold.co/600x400?text=Dareloom+Hub';
}
function toEmbedUrl(url) {
  if(!url) return '';
  url = url.trim();
  const y = extractYouTubeID(url);
  if (y) return 'https://www.youtube.com/embed/' + y + '?autoplay=1&rel=0';
  if (url.includes('youtube.com/embed')) return url;
  if (url.match(/drive.google.com/)) {
    const m = url.match(/[-\w]{25,}/);
    if (m) return 'https://drive.google.com/file/d/' + m[0] + '/preview';
  }
  if (url.includes('streamtape.com')) {
    if (url.includes('/v/')) {
      const id = url.split('/v/')[1].split('/')[0];
      return 'https://streamtape.com/e/' + id + '/';
    }
    if (url.includes('/e/')) return url;
  }
  if (url.match(/.mp4($|?)/i)) return url;
  return '';
}

// ==== FETCH & PARSE SHEET (Dynamic & Robust) ====
async function fetchSheet() {
  try {
    const res = await fetch(SHEET_API);
    if (!res.ok) throw new Error('sheet fetch failed ' + res.status);
    const j = await res.json();
    return j.values || [];
  } catch (e) {
    console.error("Fetch error:", e);
    return [];
  }
}

function parseRows(values) {
  if (!values || values.length < 2) return [];
  
  // 🛠️ FINAL FIX: Dynamic indexing based on header names from the screenshot.
  const headers = values[0].map(h => (h||'').toString().toLowerCase().trim());
  
  const idx = {
    // 💡 Priority 1: Match headers by name (most robust)
    title: headers.indexOf("title"),
    trailer: headers.indexOf("trailer"),
    watch: headers.indexOf("watch"),
    date: headers.indexOf("date"),
    category: headers.indexOf("category"),
    description: headers.indexOf("description") !== -1 ? headers.indexOf("description") : headers.indexOf("desc"),
    poster: headers.indexOf("poster") // Assuming "Poster" is the header for thumbnail link
  };
  
  // 💡 Priority 2: Fallback to exact column indexes from the screenshot if header not found
  if(idx.title === -1) idx.title = 0;
  if(idx.trailer === -1) idx.trailer = 2; 
  if(idx.watch === -1) idx.watch = 6;
  if(idx.poster === -1) idx.poster = 17; // Column R
  if(idx.date === -1) idx.date = 19;     // Column T
  if(idx.category === -1) idx.category = 20; // Column U
  
  // Fallback for Description if it's not found by name and we need a guess.
  if(idx.description === -1) {
    // Description is often near the watch links, but we'll stick to dynamic for this.
    console.warn("Description column header not found. Description will be empty.");
  }

  const rows = values.slice(1);
  const out = [];

  rows.forEach(r => {
    // Ensure the index exists before trying to access the array r[]
    const title = idx.title !== -1 ? r[idx.title] || "" : "";
    const trailer = idx.trailer !== -1 ? r[idx.trailer] || "" : "";
    const watch = idx.watch !== -1 ? r[idx.watch] || "" : "";
    const poster = idx.poster !== -1 ? r[idx.poster] || "" : "";
    const date = idx.date !== -1 ? r[idx.date] || "" : "";
    const cat = idx.category !== -1 ? r[idx.category] || "" : "";
    const desc = idx.description !== -1 ? r[idx.description] || "" : "";

    // Only include if a watch link or trailer exists
    if ((trailer && trailer.trim()) || (watch && watch.trim())) {
      out.push({
        id: (title||'') + '|' + (watch||''),
        title: title || 'Untitled',
        trailer, watch, poster, date,
        category: cat,
        description: desc,
      });
    }
  });
  
  console.log("✅ Parsed Rows (Robust Indexing):", out.length);
  return out;
}

// JSON-LD injection (Kept unchanged)
function injectSchema(it) {
  const old = document.getElementById('video-schema'); if (old) old.remove();
  const s = document.createElement('script'); s.type = 'application/ld+json'; s.id = 'video-schema';
  const schema = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    "name": it.title,
    "description": (it.description && it.description.trim()) ? it.description : it.title,
    "thumbnailUrl": makeThumbnail(it),
    "uploadDate": it.date || new Date().toISOString().split('T')[0],
    "publisher": { "@type": "Organization", "name": "Dareloom Hub", "url": "https://dareloom.fun" },
    "contentUrl": it.watch,
    "embedUrl": toEmbedUrl(it.trailer || it.watch)
  };
  s.text = JSON.stringify(schema);
  document.head.appendChild(s);
}


// ==== UI & Action Functions (Kept unchanged) ====
function triggerAdThenOpenModal(item) {
  if (!item) return;
  openAdsterraPop();
  setTimeout(() => openPlayerModal(item), 150);
}
window.triggerAdThenOpenModalById = function(id) {
  const it = items.find(x => x.id === id);
  if (it) triggerAdThenOpenModal(it);
};
window.showRandomPick = function() {
  openAdsterraPop();
  setTimeout(() => {
    if (items.length === 0) return;
    const i = Math.floor(Math.random()*items.length);
    openPlayerModal(items[i]);
    const mainWrap = document.getElementById('mainWrap');
    if (mainWrap) window.scrollTo({ top: mainWrap.offsetTop, behavior: 'smooth' });
  }, 150);
};
window.filterVideos = function(query) {
  query = (query||'').trim().toLowerCase();
  if (query.toLowerCase() === 'n') {
    localStorage.setItem('adblock_bypassed','true');
    const s = document.getElementById('searchInput'); if (s) s.value = '';
    const modal = document.getElementById('adBlockerModal'); if (modal) modal.style.display = 'none';
    document.body.style.overflow = '';
    showCategoryView('All Videos', items);
    return;
  }
  if (!query) {
    showHomeView();
    return;
  }
  const filtered = items.filter(it =>
    (it.title && it.title.toLowerCase().includes(query)) ||
    (it.category && it.category.toLowerCase().includes(query))
  );
  showCategoryView('Search Results ('+filtered.length+')', filtered);
};
function showHomeView() {
  const latestSection = document.getElementById('latestSection');
  const randomSection = document.getElementById('randomSection');
  const categorySection = document.getElementById('categorySection');
  if (categorySection) categorySection.style.display = 'none';
  if (latestSection) latestSection.style.display = 'block';
  if (randomSection) randomSection.style.display = 'block';
  renderLatest(currentPage);
  renderRandom();
}
function showCategoryView(title, videoList) {
  const latestSection = document.getElementById('latestSection');
  const randomSection = document.getElementById('randomSection');
  const categorySection = document.getElementById('categorySection');
  if (latestSection) latestSection.style.display = 'none';
  if (randomSection) randomSection.style.display = 'none';
  if (categorySection) categorySection.style.display = 'block';
  renderCategoryGrid(videoList, title);
}
function renderRandom() {
  const g = document.getElementById('randomGrid'); if (!g) return; g.innerHTML = '';
  const pool = items.slice();
  const picks = [];
  while(picks.length < 4 && pool.length) picks.push(pool.splice(Math.floor(Math.random()*pool.length),1)[0]);
  picks.forEach(it => {
    const card = document.createElement('div'); card.className = 'card';
    card.innerHTML = `<img class="thumb" src="${escapeHtml(makeThumbnail(it))}" loading="lazy"><div class="meta"><h4>${escapeHtml(it.title)}</h4></div>`;
    card.addEventListener('click', ()=> triggerAdThenOpenModal(it));
    g.appendChild(card);
  });
}
function renderLatest(page = currentPage) {
  const list = document.getElementById('latestList'); if (!list) return; list.innerHTML = '';
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PER_PAGE));
  currentPage = page;
  const start = (currentPage-1)*PER_PAGE;
  const slice = items.slice(start, start+PER_PAGE);
  slice.forEach(it => {
    const div = document.createElement('div'); div.className = 'latest-item';
    const t = makeThumbnail(it);
    let tagsHtml = '';
    if (it.category && it.category.trim()) {
      const cats = it.category.split(',').map(c => c.trim()).filter(c => c);
      tagsHtml = cats.map(tag => `<button class="tag-btn" onclick="filterVideos('${escapeHtml(tag)}')">#${escapeHtml(tag)}</button>`).join('');
    }
    div.innerHTML = `<img class="latest-thumb" src="${escapeHtml(t)}" loading="lazy">
      <div class="latest-info">
      <div style="font-weight:700">${escapeHtml(it.title)}</div>
      <div style="color:var(--muted);font-size:13px;margin-top:6px">${escapeHtml(it.date||'')}</div>
      <div class="tag-container" style="margin-top:5px;">${tagsHtml}</div>
      <div style="margin-top:8px">
      <button class="btn" onclick="triggerAdThenOpenModalById('${escapeHtml(it.id)}')">Preview</button>
      <button class="watch-btn" onclick="triggerAdThenOpenModalById('${escapeHtml(it.id)}')">Watch</button>
      </div>
      </div>`;
    list.appendChild(div);
  });
  displayPagination(Math.max(1, Math.ceil(items.length / PER_PAGE)), currentPage);
}
function renderCategoryGrid(videoList, title) {
  const container = document.getElementById('categoryGrid');
  const titleEl = document.getElementById('categoryTitle');
  if (!container || !titleEl) return;
  container.innerHTML = '';
  titleEl.textContent = title;
  videoList.forEach(it => {
    const card = document.createElement('div'); card.className = 'card';
    card.innerHTML = `<img class="thumb" src="${escapeHtml(makeThumbnail(it))}" loading="lazy"><div class="meta"><h4>${escapeHtml(it.title)}</h4></div>`;
    card.addEventListener('click', ()=> triggerAdThenOpenModal(it));
    container.appendChild(card);
  });
}
function displayPagination(totalPages, currentPage) {
  const pager = document.getElementById('pager'); if (!pager) return;
  pager.innerHTML = '';
  if (totalPages <= 1) return;
  let startPage, endPage;
  if (totalPages <= 5) { startPage = 1; endPage = totalPages; }
  else {
    if (currentPage <= 3) { startPage = 1; endPage = 5; }
    else if (currentPage + 1 >= totalPages) { startPage = totalPages - 4; endPage = totalPages; }
    else { startPage = currentPage - 2; endPage = currentPage + 2; }
  }
  if (currentPage > 1) pager.appendChild(createPageButton('« Prev', currentPage - 1));
  for (let i = startPage; i <= endPage; i++) {
    const btn = createPageButton(i, i);
    if (i === currentPage) btn.classList.add('active');
    pager.appendChild(btn);
  }
  if (currentPage < totalPages) pager.appendChild(createPageButton('Next »', currentPage + 1));
}
function createPageButton(text, pageNum) {
  const btn = document.createElement('button'); btn.className = 'page-btn';
  btn.textContent = text; btn.setAttribute('data-page', pageNum);
  btn.onclick = function() { openAdAndChangePage(pageNum); };
  return btn;
}
function openAdAndChangePage(page) {
  currentPage = page; renderLatest(page);
  const latestSection = document.getElementById('latestSection');
  if (latestSection) window.scrollTo({ top: latestSection.offsetTop - 20, behavior: 'smooth' });
  openAdsterraPop();
}
function openPlayerModal(it) {
  current = it;
  const embed = toEmbedUrl(it.trailer || it.watch || '');
  const p = document.getElementById('modalPlayerWrap');
  const controlsContainer = document.getElementById('modalControlsContainer');
  const modalTitle = document.getElementById('modalVideoTitle');
  const modalDesc = document.getElementById('modalVideoDescription');
  const modal = document.getElementById('videoModal');
  if (!p || !controlsContainer || !modalTitle || !modal) return;

  p.innerHTML = '';
  if (embed) {
    if (embed.match(/.mp4($|?)/i)) {
      const v = document.createElement('video');
      v.controls = true; v.autoplay = true; v.muted = true; v.playsInline = true;
      v.src = embed;
      v.style.width = '100%'; v.style.height = '420px';
      p.appendChild(v);
    } else {
      const iframe = document.createElement('iframe');
      iframe.src = embed;
      iframe.setAttribute('allow', 'autoplay; fullscreen; encrypted-media; picture-in-picture');
      iframe.setAttribute('allowfullscreen','true');
      iframe.style.width = '100%'; iframe.style.height = '420px'; iframe.style.border = 'none';
      p.appendChild(iframe);
    }
  } else {
    const msg = document.createElement('div');
    msg.style.textAlign = 'center';
    msg.style.padding = '100px 20px';
    msg.innerHTML = `<div style="font-size:18px;color:var(--muted)">Trailer not available for embed.</div>`;
    p.appendChild(msg);
  }

  modalTitle.textContent = it.title || 'Video Player';
  modalDesc.textContent = it.description || '';

  const bannerAd = modal.querySelector('.adsterra-banner-placement');
  const socialBarAd = modal.querySelector('.adsterra-socialbar-placement');
  const persistentAd = document.getElementById('modalPersistentAd');
  if (bannerAd) bannerAd.innerHTML = ADSTERRA_NATIVE_BANNER_SCRIPT;
  if (socialBarAd) socialBarAd.innerHTML = ADSTERRA_SOCIAL_BAR_SCRIPT;
  if (persistentAd) persistentAd.innerHTML = `<span class="ad-label">Sponsored</span>${ADSTERRA_NATIVE_BANNER_SCRIPT}`;

  const watchUrls = (it.watch || '').split(',').map(u => u.trim()).filter(u => u.length > 0);
  let buttonHTML = '';
  watchUrls.forEach(url => {
    const btnText = escapeHtml(getLinkName(url));
    const btnClass = (url.includes('t.me') || url.includes('telegram')) ? 'btn primary' : 'watch-btn';
    buttonHTML += `<button class="${btnClass}" onclick="openAdsterraThenWatch('${escapeHtml(url)}')">${btnText}</button>`;
  });
  buttonHTML += `<button class="btn" onclick="shareItem(current)">🔗 Share</button>`;
  controlsContainer.innerHTML = buttonHTML;

  injectSchema(it);
  document.title = `${it.title} - Dareloom Hub`;
  let metaDesc = document.querySelector('meta[name="description"]');
  if (!metaDesc) { metaDesc = document.createElement('meta'); metaDesc.name = 'description'; document.head.appendChild(metaDesc); }
  metaDesc.content = it.description ? it.description.substring(0,160) : `Watch ${it.title} on Dareloom Hub — free HD streaming of adult full series and movies.`;
  let canonical = document.querySelector('link[rel="canonical"]');
  if (!canonical) { canonical = document.createElement('link'); canonical.rel = 'canonical'; document.head.appendChild(canonical); }
  canonical.href = window.location.origin + window.location.pathname;

  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}
window.closePlayerModal = function() {
  const modal = document.getElementById('videoModal'); if (modal) modal.style.display = 'none';
  document.body.style.overflow = '';
  const p = document.getElementById('modalPlayerWrap'); if (p) p.innerHTML = '';
  const persistentAd = document.getElementById('modalPersistentAd'); if (persistentAd) persistentAd.innerHTML = '';
  const modalEl = document.getElementById('videoModal');
  if (modalEl) {
    const bannerAd = modalEl.querySelector('.adsterra-banner-placement'); if (bannerAd) bannerAd.innerHTML = '';
    const socialBarAd = modalEl.querySelector('.adsterra-socialbar-placement'); if (socialBarAd) socialBarAd.innerHTML = '';
  }
};
function openAdsterraThenWatch(targetUrl) {
  if (!targetUrl || targetUrl === '#') return;
  openAdsterraPop();
  setTimeout(() => {
    try {
      let finalWatchUrl = targetUrl;
      if (targetUrl.includes("/v/")) {
        const m = targetUrl.match(/\/v\/([0-9A-Za-z_-]+)/);
        if (m && m[1]) finalWatchUrl = `https://streamtape.com/e/${m[1]}/`;
      }
      const watchPageUrl = `watch.html?url=${encodeURIComponent(finalWatchUrl)}`;
      const w = window.open(watchPageUrl, '_blank');
      if (!w || w.closed || typeof w.closed === 'undefined') {
        alert("Please allow pop-ups to open the link in a new tab!");
      }
      closePlayerModal();
    } catch (e) { console.error(e); }
  }, 100);
}
function shareItem(it) {
  if (!it) return;
  const shareUrl = `https://dareloom.fun/#v=${encodeURIComponent(it.id)}`;
  const shareText = `🔥 Watch "${it.title}" now on Dareloom Hub!\n${shareUrl}`;
  if (navigator.share) {
    navigator.share({ title: it.title, text: it.description || "Watch this exclusive video!", url: shareUrl }).catch(()=>{});
  } else {
    navigator.clipboard.writeText(shareText).then(()=>{ alert("🔗 Link copied to clipboard"); }).catch(()=>{ prompt("Copy this link:", shareUrl); });
  }
}


// ==== INITIALIZATION (Kept unchanged) ====
async function loadAll() {
  console.log("1. Starting loadAll function and fetching data...");
  const vals = await fetchSheet();
  const parsed = parseRows(vals);
  parsed.reverse();
  items = parsed;

  console.log("2. Total items parsed (if > 0, fetch worked):", items.length);

  const cnt = document.getElementById('count'); 
  if (cnt) cnt.textContent = `${items.length} items`;

  const latestSection = document.getElementById('latestSection');
  if (items.length === 0 && latestSection) {
    latestSection.innerHTML = `<div style="text-align:center; padding: 50px; color: #ff5555;">❌ Data Not Loaded. Check Google Sheet/API Key (F12 Console).</div>`;
    return;
  }

  renderRandom();
  renderLatest(1);
  
  console.log("3. Rendering complete. Checking for URL routes...");

  const path = window.location.pathname || '';
  if (path.startsWith('/video/')) {
    const slug = path.split('/video/')[1] || '';
    if (slug) {
      const slugParts = slug.split('-');
      slugParts.pop(); 
      const slugTitlePart = slugParts.join('-'); 

      const cand = items.find(r => {    
          const ts = slugify(r.title);    
          return ts === slugTitlePart;    
      });    
          
      const mainWrap = document.getElementById('mainWrap');    

      if (cand && mainWrap) {    
          document.title = `${cand.title} - Dareloom Hub`;    
          injectSchema(cand);    
              
          mainWrap.innerHTML = `<div style="padding:20px;">    
              <h2 style="color:white;">${escapeHtml(cand.title)}</h2>    
              <iframe src="${toEmbedUrl(cand.watch || cand.trailer)}" allowfullscreen style="width:100%;height:70vh;border:none;"></iframe>    
              <div style="margin-top:12px;">    
                  <a href="watch.html?url=${encodeURIComponent(cand.watch || cand.trailer)}" target="_blank" class="btn">Open in Player</a>    
                  <a href="${escapeHtml(cand.watch || cand.trailer)}" target="_blank" class="btn" style="margin-left:8px">Original Link / Download</a>    
              </div>    
          </div>`;    
          return;
      }    
    }
  }

  const hash = window.location.hash || '';
  if (hash.startsWith('#v=')) {
    const id = decodeURIComponent(hash.substring(3));
    const it = items.find(x => x.id.includes(id));
    if (it) openPlayerModal(it);
  }

  window.addEventListener("load", () => {
    setTimeout(() => openAdsterraPop(), INITIAL_AUTO_POP_DELAY);
  }, { once: true });

  startAutoPop();
}

// Start
loadAll();
