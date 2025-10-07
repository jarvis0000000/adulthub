// FINAL DARELOOM HUB SCRIPT v25 - MODAL PLAYER, POP-UNDER, AUTO-POP & PERSISTENT MODAL AD

const SHEET_API = "https://sheets.googleapis.com/v4/spreadsheets/1A2I6jODnR99Hwy9ZJXPkGDtAFKfpYwrm3taCWZWoZ7o/values/Sheet1?alt=json&key=AIzaSyBFnyqCW37BUL3qrpGva0hitYUhxE_x5nw";
// Adsterra Pop-under Code (Common for all ad triggers)
const AD_POP = "//pl27626803.revenuecpmgate.com/24/e4/33/24e43300238cf9b86a05c918e6b00561.js";
const PER_PAGE = 5;
let items = [], current = null, currentPage = 1;

// --- Adsterra Ad Codes (Injecting inside modal) ---
const ADSTERRA_NATIVE_BANNER_SCRIPT = `
    <script type="text/javascript" src="//www.highperformanceformat.com/d1be46ed95d3e2db572824c531da5082/invoke.js"></script>
`;
const ADSTERRA_SOCIAL_BAR_SCRIPT = `
    <script type='text/javascript' src='//pl27654958.revenuecpmgate.com/cb/63/19/cb6319838ced4608354b54fc6faddb8a.js'></script>
`;

// ----------------- AUTO POP SETTINGS -----------------
const AUTO_POP_INTERVAL_MS = 30000; // 30 seconds
let autoPopTimer = null;
let autoPopEnabled = (localStorage.getItem('auto_pop_enabled') !== 'false'); // default true

function startAutoPop() {
  stopAutoPop();
  if (!autoPopEnabled) return;
  if (document.hidden) return;
  autoPopTimer = setInterval(() => {
    openAdsterraPop();
  }, AUTO_POP_INTERVAL_MS);
}
function stopAutoPop() {
  if (autoPopTimer) { clearInterval(autoPopTimer); autoPopTimer = null; }
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopAutoPop(); else startAutoPop();
});
window.addEventListener('beforeunload', () => stopAutoPop());
window.toggleAutoPop = function(val) {
  if (typeof val === 'boolean') {
    autoPopEnabled = val;
    localStorage.setItem('auto_pop_enabled', val ? 'true' : 'false');
  } else {
    autoPopEnabled = !autoPopEnabled;
    localStorage.setItem('auto_pop_enabled', autoPopEnabled ? 'true' : 'false');
  }
  if (autoPopEnabled) startAutoPop(); else stopAutoPop();
};

// --- Pop-under Ad Trigger Function (New) ---
function openAdsterraPop() {
    try {
      const s = document.createElement('script');
      s.src = AD_POP;
      s.async = true;
      document.body.appendChild(s);
      // small cleanup
      setTimeout(() => { try { s.remove(); } catch(e){} }, 2000);
    } catch(e) {
      console.warn("Ad pop failed:", e);
    }
}

// --- Dynamic Link Name Detection ---
function getLinkName(url) {
    if (!url) return 'Watch Link';
    if (url.includes('streamtape.com') || url.includes('stape.fun')) return 'Streamtape Watch';
    if (url.includes('t.me') || url.includes('telegram')) return 'Telegram Download';
    if (url.includes('gofile.io')) return 'GoFile Watch';
    if (url.includes('drive.google.com')) return 'Google Drive Watch';
    if (url.includes('mp4upload.com')) return 'Mp4Upload Watch';
    try {
        const domain = new URL(url).hostname.replace('www.', '');
        const namePart = domain.split('.')[0];
        return namePart.charAt(0).toUpperCase() + namePart.slice(1) + ' Link';
    } catch (e) {
        return 'External Watch Link';
    }
}

// --- Fetch, Parse, Utilities ---
async function fetchSheet() {
  try {
    const res = await fetch(SHEET_API);
    if(!res.ok) throw new Error('sheet fetch failed ' + res.status);
    const j = await res.json();
    return j.values || [];
  } catch(e) {
    console.error("Fetch error:", e);
    return [];
  }
}
function norm(s){ return (s||'').toString().trim().toLowerCase(); }
function parseRows(values){
  if(!values || values.length < 2) return [];
  const TI = 0, TR = 2, WA = 6, TH = 17, DT = 19, CA = 20;
  const headers = (values[0]||[]).map(h=> (h||'').toString());
  const DE = headers.findIndex(h => norm(h) === 'description' || norm(h) === 'desc');
  const rows = values.slice(1);
  const out = [];
  for(let r of rows){
    const title = r[TI]||'';
    const trailer = r[TR]||'';
    const watch = r[WA]||'';
    const poster = r[TH]||'';
    const date = r[DT]||'';
    const category = r[CA]||'';
    const description = DE !== -1 ? (r[DE]||'') : ''; 
    if((trailer && trailer.trim()) || (watch && watch.trim())){  
      out.push({   
        id: (title||'') + '|' + (watch||''),   
        title: title||'Untitled',   
        trailer: trailer||'',   
        watch: watch||'',   
        poster: poster||'',   
        date: date||'',   
        description: description,  
        category: category           
      });  
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
function toEmbedUrl(url){
  if(!url) return '';
  url = url.trim();
  const y = extractYouTubeID(url);
  if(y) return 'https://www.youtube.com/embed/' + y + '?autoplay=1&rel=0';
  if(url.includes('youtube.com/embed')) return url;
  if(url.match(/drive\.google\.com/)){
    const m = url.match(/[-\w]{25,}/);
    if(m) return 'https://drive.google.com/file/d/' + m[0] + '/preview';
  }
  if(url.includes("streamtape.com")) {
    let id;
    if(url.includes("/v/")) {
      id = url.split("/v/")[1].split("/")[0];
      return "https://streamtape.com/e/" + id + "/";
    }
    if(url.includes("/e/")) return url;
  }
  if(url.includes('t.me/') || url.includes('telegram.me/')) return '';
  if(url.match(/\.mp4($|\?)/i)) return url;
  return '';
}
function escapeHtml(s){ return (s||'').toString().replace(/[&<>]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }
function injectSchema(it) {
  const oldSchema = document.getElementById('video-schema'); if (oldSchema) oldSchema.remove();
  const script = document.createElement('script'); script.type = 'application/ld+json'; script.id = 'video-schema';
  const thumb = makeThumbnail(it);
  script.text = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "VideoObject",
    "name": it.title,
    "description": it.description && it.description.trim() ? it.description : it.title,
    "thumbnailUrl": thumb,
    "uploadDate": it.date || new Date().toISOString().split('T')[0],
    "publisher": { "@type": "Organization", "name": "Dareloom Hub", "url": "https://dareloom.fun" },
    "contentUrl": it.watch,
    "embedUrl": toEmbedUrl(it.trailer), 
  });
  document.head.appendChild(script);
}

// --- Item Click Logic (New Page Simulation) ---
function triggerAdThenOpenModal(item) {
  if(!item) return;
  openAdsterraPop(); 
  setTimeout(() => { openPlayerModal(item); }, 150);
}
function triggerAdThenOpenModalById(id){
  const it = items.find(x=>x.id===id);
  if(it) triggerAdThenOpenModal(it);
}
window.triggerAdThenOpenModalById = triggerAdThenOpenModalById; 

// --- Random Pick Function (Now opens modal) ---
window.showRandomPick = function() {
    openAdsterraPop();
    setTimeout(() => {
        if (items.length === 0) return;
        const randomIndex = Math.floor(Math.random() * items.length);
        const randomItem = items[randomIndex];
        openPlayerModal(randomItem);
        const mainWrap = document.getElementById('mainWrap');
        if (mainWrap) window.scrollTo({ top: mainWrap.offsetTop, behavior: 'smooth' });
    }, 150);
}

// --- VIEW MANAGEMENT HELPERS ---
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

// --- Ad Blocker / N Bypass (uses view helpers) ---
window.filterVideos = function(query) {
  query = (query || '').trim(); 
  if (query.toLowerCase() === 'n') {
      localStorage.setItem('adblock_bypassed', 'true'); 
      document.getElementById('searchInput').value = '';
      const modal = document.getElementById('adBlockerModal');
      const mainWrap = document.getElementById('mainWrap');
      if (mainWrap) mainWrap.style.display = 'block';
      if(modal) modal.style.display = 'none';
      document.body.style.overflow = '';
      showCategoryView('All Videos', items); 
      return; 
  }
  query = query.toLowerCase(); 
  if (query.length > 0) {  
      const filtered = items.filter(item =>   
          (item.title && item.title.toLowerCase().includes(query)) ||  
          (item.category && item.category.toLowerCase().includes(query))
      );  
      showCategoryView('Search Results (' + filtered.length + ')', filtered);  
  } else {  
      showHomeView();  
  }
}

// --- Render Functions (Modified to use triggerAdThenOpenModal) ---
function renderRandom(){
  const g = document.getElementById('randomGrid'); if(!g) return; g.innerHTML='';
  const pool = items.slice(); const picks = [];
  while(picks.length < 4 && pool.length) picks.push(pool.splice(Math.floor(Math.random()*pool.length),1)[0]);
  picks.forEach(it => {
    const card = document.createElement('div'); card.className='card';
    const t = makeThumbnail(it);
    card.innerHTML = `<img class="thumb" src="${escapeHtml(t)}" loading="lazy"><div class="meta"><h4>${escapeHtml(it.title)}</h4></div>`;
    card.addEventListener('click', ()=> triggerAdThenOpenModal(it));
    g.appendChild(card);
  });
}

function renderLatest(page = currentPage){
  const list = document.getElementById('latestList'); if(!list) return; list.innerHTML='';
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PER_PAGE));
  currentPage = page;
  const start = (currentPage-1)*PER_PAGE;
  const slice = items.slice(start, start+PER_PAGE);
  slice.forEach((it) => { 
    const div = document.createElement('div'); div.className='latest-item';
    const t = makeThumbnail(it);
    let tagsHtml = '';
    if (it.category && it.category.trim()) {
        const categories = it.category.split(',').map(c => c.trim()).filter(c => c.length > 0);
        tagsHtml = categories.map(tag => {
            const cleanTag = escapeHtml(tag);
            return `<button class="tag-btn" onclick="triggerAdThenOpenModalById('${escapeHtml(it.id)}')">#${cleanTag}</button>`; 
        }).join('');
    }
    div.innerHTML = `
        <img class="latest-thumb" src="${escapeHtml(t)}" loading="lazy">
        <div class="latest-info">
            <div style="font-weight:700">${escapeHtml(it.title)}</div>
            <div style="color:var(--muted);font-size:13px;margin-top:6px">${escapeHtml(it.date||'')}</div>
            <div class="tag-container" style="margin-top:5px;">${tagsHtml}</div>
            <div style="margin-top:8px">
                <button class="btn" onclick="triggerAdThenOpenModalById('${escapeHtml(it.id)}')">Preview</button> 
                <button class="watch-btn" onclick="triggerAdThenOpenModalById('${escapeHtml(it.id)}')">Watch</button>
            </div>
        </div>
    `;
    list.appendChild(div);
  });
  displayPagination(totalPages, currentPage);
}

function renderCategoryGrid(videoList, title){
  const container = document.getElementById('categoryGrid');
  const titleEl = document.getElementById('categoryTitle');
  if(!container || !titleEl) return;
  container.innerHTML = '';  
  titleEl.textContent = title;  
  videoList.forEach(it => {  
      const card = document.createElement('div');   
      card.className='card';  
      const t = makeThumbnail(it);  
      card.innerHTML = `<img class="thumb" src="${escapeHtml(t)}" loading="lazy"><div class="meta"><h4>${escapeHtml(it.title)}</h4></div>`;  
      card.addEventListener('click', ()=> triggerAdThenOpenModal(it));
      container.appendChild(card);  
  });
}

// --- Pagination Logic (Pop-under) ---
function displayPagination(totalPages, currentPage) {
  const pager = document.getElementById('pager');
  pager.innerHTML = '';
  if (totalPages <= 1) return;   
  let startPage, endPage;  
  if (totalPages <= 5) { startPage = 1; endPage = totalPages; } 
  else {  
      if (currentPage <= 3) { startPage = 1; endPage = 5; } 
      else if (currentPage + 1 >= totalPages) { startPage = totalPages - 4; endPage = totalPages; } 
      else { startPage = currentPage - 2; endPage = currentPage + 2; }  
  }  
  if (currentPage > 1) { pager.appendChild(createPageButton('« Prev', currentPage - 1)); }  
  for (let i = startPage; i <= endPage; i++) {  
      const btn = createPageButton(i, i);  
      if (i === currentPage) { btn.classList.add('active'); }  
      pager.appendChild(btn);  
  }  
  if (currentPage < totalPages) { pager.appendChild(createPageButton('Next »', currentPage + 1)); }
}
function createPageButton(text, pageNum) {
  const btn = document.createElement('button');
  btn.className = 'page-btn';
  btn.textContent = text;
  btn.setAttribute('data-page', pageNum);
  btn.onclick = function() {
    openAdAndChangePage(pageNum);
  };
  return btn;
}
function openAdAndChangePage(page){
  currentPage = page;
  renderLatest(page);
  const latestSection = document.getElementById('latestSection');
  if(latestSection) window.scrollTo({ top: latestSection.offsetTop - 20, behavior: 'smooth' });
  openAdsterraPop();
}

// --- Modal Player Functions (The new "page" function) ---
function openPlayerModal(it){
    current = it;
    const embed = toEmbedUrl(it.trailer);
    const p = document.getElementById('modalPlayerWrap');
    const controlsContainer = document.getElementById('modalControlsContainer');
    const modalTitle = document.getElementById('modalVideoTitle');
    const modalDesc = document.getElementById('modalVideoDescription');
    const modal = document.getElementById('videoModal');
    const bannerAd = modal.querySelector('.adsterra-banner-placement');
    const socialBarAd = modal.querySelector('.adsterra-socialbar-placement');
    const persistentAd = document.getElementById('modalPersistentAd');

    if(!p || !controlsContainer || !modalTitle || !modal) return;
    
    // Player Setup
    p.innerHTML='';
    if(embed){
      if(embed.match(/\.mp4($|\?)/i)){
        const v = document.createElement('video');
        v.controls=true; v.autoplay=true; v.muted=true; v.playsInline=true;
        v.src = embed;
        p.appendChild(v);
      } else {
        const iframe = document.createElement('iframe');
        iframe.src = embed;
        iframe.setAttribute('allow', 'autoplay; fullscreen; encrypted-media; picture-in-picture');
        iframe.setAttribute('allowfullscreen', 'true');
        iframe.setAttribute('webkitallowfullscreen', 'true');
        iframe.setAttribute('mozallowfullscreen', 'true');
        iframe.setAttribute('scrolling', 'no');
        iframe.style.width='100%';
        iframe.style.height='420px';
        iframe.style.border = 'none'; 
        p.appendChild(iframe);
      }
    } else {
      const msg = document.createElement('div');
      msg.style.textAlign='center';
      msg.style.padding='100px 20px';
      msg.innerHTML = `<div style="font-size:18px;color:var(--muted)">Trailer not available for embed.</div>`;
      p.appendChild(msg);
    }

    modalTitle.textContent = it.title || 'Video Player';
    modalDesc.textContent = it.description || '';

    // Ad Setup: inject native banner + social bar
    if (bannerAd) bannerAd.innerHTML = ADSTERRA_NATIVE_BANNER_SCRIPT;
    if (socialBarAd) socialBarAd.innerHTML = ADSTERRA_SOCIAL_BAR_SCRIPT;

    // PERSISTENT MODAL BANNER (new): keep a visible banner at bottom of modal
    if (persistentAd) {
        persistentAd.innerHTML = `
          <span class="ad-label">Sponsored</span>
          ${ADSTERRA_NATIVE_BANNER_SCRIPT}
        `;
    }

    // Controls Setup (Watch Buttons + Share)
    const watchUrls = (it.watch || '').split(',').map(url => url.trim()).filter(url => url.length > 0);
    let buttonHTML = '';
    watchUrls.forEach(url => {
        const btnText = getLinkName(url);
        let btnClass = 'watch-btn';
        if(url.includes('t.me') || url.includes('telegram')) { btnClass = 'btn primary'; }
        buttonHTML += `<button class="${btnClass}" onclick="openAdsterraThenWatch('${escapeHtml(url)}')">${btnText}</button>`;
    });
    buttonHTML += `<button class="btn" style="background-color: var(--secondary-color);" onclick="shareItem(current)">🔗 Share</button>`;
    controlsContainer.innerHTML = buttonHTML;
    
    injectSchema(it);
    
    // Open modal + disable page scroll
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

// Remove modal, stop video, cleanup ads
window.closePlayerModal = function() {
    const modal = document.getElementById('videoModal');
    if(modal) modal.style.display = 'none';
    document.body.style.overflow = ''; 
    const p = document.getElementById('modalPlayerWrap');
    if(p) p.innerHTML = ''; // Stop audio/video

    // Cleanup persistent ad and banner to allow re-injection next time
    const persistentAd = document.getElementById('modalPersistentAd');
    if (persistentAd) persistentAd.innerHTML = '';

    const bannerAd = modal.querySelector('.adsterra-banner-placement');
    if (bannerAd) bannerAd.innerHTML = `
        <script type="text/javascript">
            atOptions = {
                'key' : 'd1be46ed95d3e2db572824c531da5082',
                'format' : 'iframe',
                'height' : 90,
                'width' : 728,
                'params' : {}
            };
        </script>
        `;
    const socialBarAd = modal.querySelector('.adsterra-socialbar-placement');
    if (socialBarAd) socialBarAd.innerHTML = '';
}

// --- Open Watch link with Adsterra Logic (UPDATED for watch.html) ---
function openAdsterraThenWatch(targetUrl){
  if(!targetUrl || targetUrl === '#') return;
  openAdsterraPop();
  
  setTimeout(() => {
    try {
      let newWindow;
      
      if (targetUrl.includes("streamtape.com") || targetUrl.includes("stape.fun")) {
          // If Streamtape, redirect to the full-screen player page
          const watchPageUrl = `watch.html?url=${encodeURIComponent(targetUrl)}`;
          newWindow = window.open(watchPageUrl, '_blank');
      } else {
          // For all other links (Telegram, Drive, etc.), open directly
          newWindow = window.open(targetUrl, '_blank');
      }

      if(!newWindow || newWindow.closed || typeof newWindow.closed=='undefined') {  
          alert("Please allow pop-ups to open the link in a new tab!");  
      }  
      closePlayerModal(); 
    } catch(e){ console.error(e); }
  }, 100);
}

// --- SHARE ITEM ---
function shareItem(it){
  if(!it) return;
  const shareUrl = `https://dareloom.fun/#v=${encodeURIComponent(it.id)}`;
  const shareText = `🔥 Watch "${it.title}" now on Dareloom Hub!\n${shareUrl}`;
  if (navigator.share) {
    navigator.share({ title: it.title, text: it.description || "Watch this exclusive video!", url: shareUrl })
      .catch(err => console.warn('Share canceled:', err));
  } else {
    navigator.clipboard.writeText(shareText).then(()=>{ alert("🔗 Link copied! You can share it anywhere."); })
    .catch(()=> { prompt("Copy this link manually:", shareUrl); });
  }
}

// --- INITIALIZATION & RENDERING (MOST RELIABLE FIX) ---
async function loadAll() {
  const vals = await fetchSheet();
  const parsed = parseRows(vals);
  parsed.reverse();
  items = parsed;
  const cnt = document.getElementById('count');
  if (cnt) cnt.textContent = `${items.length} items`;
  
  // 2. SEO या Hash URL से ID निकालें
  let uniqueVideoId = null;
  const path = window.location.pathname;
  
  if (path.startsWith('/video/') && path.split('/').length > 2) {
    // URL के अंतिम सेगमेंट से ID निकालें
    const fullSlug = path.substring(path.lastIndexOf('/') + 1); 
    // ID slug के अंतिम डैश के बाद का हिस्सा है
    const parts = fullSlug.split('-');
    if (parts.length > 1) {
        uniqueVideoId = parts[parts.length - 1]; 
    }
  }

  const hash = window.location.hash;
  if (hash.startsWith("#v=")) {
    uniqueVideoId = decodeURIComponent(hash.substring(3)); 
  }
  
  // 3. लिस्टिंग हमेशा लोड करें
  renderRandom();
  renderLatest(1); 
  
  // 4. अगर ID मिली है, तो मोडल खोलें
  if (uniqueVideoId) {
    // यहाँ हम ID को पूरी स्ट्रिंग में खोज रहे हैं, जो सुरक्षित है
    const it = items.find(x => x.id.includes(uniqueVideoId));
    if (it) {
      openPlayerModal(it);
    }
  }
  
  // 5. ऑटो पॉप शुरू करें
  startAutoPop();
}
loadAll();
