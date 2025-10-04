// FINAL DARELOOM HUB SCRIPT v20 - REMOVED TOP CATEGORIES DROPDOWN
// Tags/Categories sirf video ke niche se hi load honge.

const SHEET_API = "https://sheets.googleapis.com/v4/spreadsheets/1A2I6jODnR99Hwy9ZJXPkGDtAFKfpYwrm3taCWZWoZ7o/values/Sheet1?alt=json&key=AIzaSyBFnyqCW37BUL3qrpGva0hitYUhxE_x5nw";
const AD_POP = "//pl27626803.revenuecpmgate.com/24/e4/33/24e43300238cf9b86a05c918e6b00561.js";
const PER_PAGE = 5;
let items = [], current = null, currentPage = 1;

// --- Fetch Google Sheet (No change) ---
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

// --- Parse Rows (FIXED INDEXES) ---
function norm(s){ return (s||'').toString().trim().toLowerCase(); }

function parseRows(values){
  if(!values || values.length < 2) return [];
  
  // Column to Index Mapping: A=0, C=2, G=6, R=17, S=18, T=19, U=20
  const TI = 0;   // Title (A)
  const TR = 2;   // Trailer (C)
  const WA = 6;   // Watch (G)
  const TH = 17;  // Thumbnail (R)
  const DT = 19;  // Date (T)
  const CA = 20;  // Category (U)
  
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

// --- Utilities (No change) ---
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

  if(url.includes("t.me/") || url.includes("telegram.me/")) return '';

  if(url.match(/\.mp4($|\?)/i)) return url;

  return '';
}

function escapeHtml(s){ return (s||'').toString().replace(/[&<>]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }

// --- Schema Injection (No change) ---
function injectSchema(it) {
  const oldSchema = document.getElementById('video-schema');
  if (oldSchema) oldSchema.remove();

  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.id = 'video-schema';
  const thumb = makeThumbnail(it);

  script.text = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "VideoObject",
    "name": it.title,
    "description": it.description && it.description.trim() ?
      it.description : it.title,
    "thumbnailUrl": thumb,
    "uploadDate": it.date || new Date().toISOString().split('T')[0],
    "publisher": {
      "@type": "Organization",
      "name": "Dareloom Hub",
      "url": "https://dareloom.fun"
    },
    "contentUrl": it.watch,
    "embedUrl": toEmbedUrl(it.trailer), 
  });

  document.head.appendChild(script);
}

// --- Ad Trigger Functions (OPTIMIZED: triggerAdRedirect REMOVED) ---

// NOTE: triggerAdRedirect function has been removed to prevent aggressive browser blocking.
// We only trigger ads on Watch/Link opens (openWatchWithAd) and Pagination (openAdAndChangePage).

function triggerAdThenShowItem(item) {
  if(!item) return;

  // triggerAdRedirect() call removed to prevent aggressive browser blocking
  
  setTimeout(() => {  
      showItem(item);  
  }, 150);

}

function triggerAdThenShowItemById(id){
  const it = items.find(x=>x.id===id);
  if(it) triggerAdThenShowItem(it);
}
window.triggerAdThenShowItemById = triggerAdThenShowItemById; 

// --- AD BLOCKER DETECTION ---

function showAdBlockerModal() {
  const mainWrap = document.getElementById('mainWrap');
  const modal = document.getElementById('adBlockerModal');

  if (mainWrap) {  
      mainWrap.style.display = 'none';  
  }  
  if (modal) {  
      modal.style.display = 'flex';   
  }  
  document.body.style.overflow = 'hidden';

}

function checkAdBlocker() {
  if (localStorage.getItem('adblock_bypassed') === 'true') {
      const mainWrap = document.getElementById('mainWrap');
      const modal = document.getElementById('adBlockerModal');
      if (mainWrap) mainWrap.style.display = 'block';
      if (modal) modal.style.display = 'none';
      document.body.style.overflow = '';
      return; 
  }
    
  const testAd = document.createElement('div');
  testAd.className = 'pub_300x250 pub_ad pub_ad_300x250';
  testAd.style.width = '1px';
  testAd.style.height = '1px';
  testAd.style.position = 'absolute';
  testAd.style.left = '-10000px';

  document.body.appendChild(testAd);  

  setTimeout(() => {  
      const isBlocked = testAd.offsetHeight === 0 ||   
                       testAd.clientHeight === 0 ||   
                       getComputedStyle(testAd).display === 'none' ||  
                       getComputedStyle(testAd).visibility === 'hidden';  

      testAd.remove();  

      if (isBlocked) {  
          console.warn("Ad Blocker Detected! Restricting content.");  
          showAdBlockerModal();  
      } else {  
          const mainWrap = document.getElementById('mainWrap');  
          const modal = document.getElementById('adBlockerModal');  
          if (mainWrap && mainWrap.style.display === 'none') {  
              mainWrap.style.display = 'block';  
              if(modal) modal.style.display = 'none';  
              document.body.style.overflow = '';  
          }  
      }  
  }, 100);
}

// --- Render Functions (Tags and Category View) ---
function renderRandom(){
  const g = document.getElementById('randomGrid'); if(!g) return; g.innerHTML='';
  const pool = items.slice(); const picks = [];
  while(picks.length < 4 && pool.length) picks.push(pool.splice(Math.floor(Math.random()*pool.length),1)[0]);
  picks.forEach(it => {
    const card = document.createElement('div'); card.className='card';
    const t = makeThumbnail(it);
    card.innerHTML = `<img class="thumb" src="${escapeHtml(t)}" loading="lazy"><div class="meta"><h4>${escapeHtml(it.title)}</h4></div>`;
    card.addEventListener('click', ()=> triggerAdThenShowItem(it));
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

  slice.forEach(it => {
    const div = document.createElement('div'); div.className='latest-item';
    const t = makeThumbnail(it);
    
    // --- Generate Tags (Hashtags) HTML ---
    let tagsHtml = '';
    if (it.category && it.category.trim()) {
        const categories = it.category.split(',').map(c => c.trim()).filter(c => c.length > 0);
        tagsHtml = categories.map(tag => {
            const cleanTag = escapeHtml(tag);
            // Tags par click karne par naye Category View mein videos load honge
            return `<button class="tag-btn" onclick="showCategoryView('${cleanTag.charAt(0).toUpperCase() + cleanTag.slice(1)}', items.filter(i => (i.category || '').toLowerCase().includes('${cleanTag.toLowerCase()}')))">#${cleanTag}</button>`;
        }).join('');
    }
    // -------------------------------------
    
    div.innerHTML = `
        <img class="latest-thumb" src="${escapeHtml(t)}" loading="lazy">
        <div class="latest-info">
            <div style="font-weight:700">${escapeHtml(it.title)}</div>
            <div style="color:var(--muted);font-size:13px;margin-top:6px">${escapeHtml(it.date||'')}</div>
            <div class="tag-container" style="margin-top:5px;">${tagsHtml}</div>
            <div style="margin-top:8px">
                <button class="btn" onclick="triggerAdThenShowItemById('${escapeHtml(it.id)}')">Preview</button> 
                <button class="watch-btn" onclick="triggerAdThenShowItemById('${escapeHtml(it.id)}')">Watch</button>
            </div>
        </div>
    `;
    list.appendChild(div);
  });

  displayPagination(totalPages, currentPage);
}

// NOTE: renderCategoryDropdown function has been REMOVED as requested.

function showCategoryView(title, filteredVideos = items){
  const randomSection = document.getElementById('randomSection');
  const latestSection = document.getElementById('latestSection');
  const categorySection = document.getElementById('categorySection');

  if(title === 'All Videos' || title.startsWith('Search Results')){
    if(randomSection) randomSection.style.display = 'block';
    if(latestSection) latestSection.style.display = 'block';
    if(categorySection) categorySection.style.display = 'none';
  } else {
    if(randomSection) randomSection.style.display = 'none';
    if(latestSection) latestSection.style.display = 'none';
    if(categorySection) categorySection.style.display = 'block';
    renderCategoryGrid(filteredVideos, title);
  }

  window.scrollTo({top: 0, behavior: 'smooth'});
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
      card.addEventListener('click', ()=> triggerAdThenShowItem(it));
      container.appendChild(card);  
  });
}

// --- Pagination Logic (No change) ---
function displayPagination(totalPages, currentPage) {
  const pager = document.getElementById('pager');
  pager.innerHTML = '';

  if (totalPages <= 1) return;   

  let startPage, endPage;  
    
  if (totalPages <= 5) {  
      startPage = 1;  
      endPage = totalPages;  
  } else {  
      if (currentPage <= 3) {  
          startPage = 1;  
          endPage = 5;  
      } else if (currentPage + 1 >= totalPages) {  
          startPage = totalPages - 4;  
          endPage = totalPages;  
      } else {  
          startPage = currentPage - 2;  
          endPage = currentPage + 2;  
      }  
  }  

  if (currentPage > 1) {  
      pager.appendChild(createPageButton('« Prev', currentPage - 1));  
  }  

  for (let i = startPage; i <= endPage; i++) {  
      const btn = createPageButton(i, i);  
      if (i === currentPage) {  
          btn.classList.add('active');   
      }  
      pager.appendChild(btn);  
  }  
    
  if (currentPage < totalPages) {  
      pager.appendChild(createPageButton('Next »', currentPage + 1));  
  }
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

  const s = document.createElement('script'); s.src = AD_POP; s.async = true; document.body.appendChild(s);
}

// --- Search Functionality ('n' bypass ke saath) ---
window.filterVideos = function(query) {
  query = (query || '').trim(); 

  // --- N BYPASS LOGIC ---
  if (query.toLowerCase() === 'n') {
      const mainWrap = document.getElementById('mainWrap');
      const modal = document.getElementById('adBlockerModal');
      
      localStorage.setItem('adblock_bypassed', 'true'); 
      
      if (mainWrap) mainWrap.style.display = 'block';
      if (modal) modal.style.display = 'none';
      document.body.style.overflow = '';
      
      document.getElementById('searchInput').value = '';
      showCategoryView('All Videos'); 
      
      return; 
  }
  // ----------------------
  
  query = query.toLowerCase(); 

  if (query.length > 0) {  
      const filtered = items.filter(item =>   
          (item.title && item.title.toLowerCase().includes(query)) ||  
          (item.category && item.category.toLowerCase().includes(query))
      );  
        
      showCategoryView('Search Results (' + filtered.length + ')', filtered);  
        
  } else {  
      showCategoryView('All Videos');  
  }
}

// --- Share Functionality (No change) ---
function shareItem(it) {
  if (!it || !it.title) {
    alert("Pehle koi video select karo!");
    return;
  }

  const shareUrl = window.location.origin + window.location.pathname + '#v=' + encodeURIComponent(it.id);  
  const shareText = `🔥 MUST WATCH: ${it.title}\n${it.description && it.description.trim() ? it.description + '\n' : ''}\n🔗 Watch here FREE: ${shareUrl}`;  

  if (navigator.share) {  
      navigator.share({  
          title: it.title,  
          text: shareText,  
          url: shareUrl,  
      }).catch((error) => console.log('Sharing failed', error));  
  } else {  
      navigator.clipboard.writeText(shareText).then(() => {  
          alert("Share link copy ho gaya hai! Ab WhatsApp/Telegram par paste kar do.");  
      }).catch(err => {  
          console.error('Copy karne mein error:', err);  
          prompt("Share karne ke liye yeh link copy karein:", shareUrl);  
      });  
  }
}

// --- Show Video (No change) ---
function showItemById(id){ const it = items.find(x=>x.id===id); if(it) showItem(it); }

function showRandomPick() {
    if (items.length === 0) return;
    const randomItem = items[Math.floor(Math.random() * items.length)];
    triggerAdThenShowItem(randomItem);
}
window.showRandomPick = showRandomPick; 

function showItem(it){
  current = it;
  const embed = toEmbedUrl(it.trailer);

  const p = document.getElementById('playerWrap');
  const controlsContainer = document.getElementById('controlsContainer');
  if(!p || !controlsContainer) return;

  // --- Player Setup ---
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

  document.getElementById('nowTitle').textContent = it.title || '';

  // --- Dynamic Watch Options Button Rendering ---
  const watchUrls = (it.watch || '').split(',').map(url => url.trim()).filter(url => url.length > 0);
  let buttonHTML = '';

  // 1. Static items
  buttonHTML += `<div class="pill" id="count">${items.length} items</div>`;
  buttonHTML += `<button class="btn" onclick="showRandomPick()">🎲 Shuffle</button>`;

  // 2. Watch Buttons
  watchUrls.forEach(url => {
    let btnText = 'Watch Now';
    let btnClass = 'watch-btn';

    if(url.includes('streamtape.com') || url.includes('stape.fun')) {  
          btnText = 'Streamtape Watch';  
      } else if (url.includes('t.me') || url.includes('telegram')) {  
          btnText = 'Telegram Download';  
          btnClass = 'btn primary';   
      }  
        
      buttonHTML += `<button class="${btnClass}" onclick="openWatchWithAd('${escapeHtml(url)}')">${btnText}</button>`;

  });

  // 3. Share Button
  buttonHTML += `<button class="btn" style="background-color: #28a745;" onclick="shareItem(current)">🔗 Share</button>`;

  controlsContainer.innerHTML = buttonHTML;
  
  renderRandom();
  injectSchema(it);

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// --- FINAL: Open Watch with SINGLE Ad Logic (OPTIMIZED FOR ADSTERRA) ---
function openWatchWithAd(targetUrl){
  if(!targetUrl || targetUrl === '#') return;
  const target = targetUrl;
  const watchAdCode = 'pl27626803.revenuecpmgate.com/24/e4/33/24e43300238cf9b86a05c918e6b00561.js';
  const AD_POP_URL = `//${watchAdCode}`;

  // 1. Single Ad Script Load: Browser blocking kam karne ke liye.
  const s1 = document.createElement('script'); 
  s1.src = AD_POP_URL; 
  document.body.appendChild(s1);

  setTimeout(() => {
    try {
      let newWindow = window.open(target,'_blank');

          if(!newWindow || newWindow.closed || typeof newWindow.closed=='undefined') {  
              alert("Please allow pop-ups to open the link in a new tab!");  
          }  
    } catch(e){  
    }
  }, 100);

  // NOTE: Second ad script HATA DIYA GAYA HAI.

  const watchAd = document.getElementById('watchAd');
  if(watchAd) watchAd.textContent = 'Opening link... (Allow Pop-ups)';
}

// --- FINAL Initialization (ROBUST SORTING ADDED) ---
async function loadAll() {
  const vals = await fetchSheet();
  const parsed = parseRows(vals);

  // ** NEW ROBUST SORTING LOGIC: Newest videos first, Invalid dates last **
  parsed.sort((a, b) => {
    const timeA = new Date(a.date).getTime();
    const timeB = new Date(b.date).getTime();
    
    // Treat NaN (invalid date) as 0, which pushes it to the end in a descending sort (b-a).
    const valA = isNaN(timeA) ? 0 : timeA;
    const valB = isNaN(timeB) ? 0 : timeB;
    
    // Descending sort: Newest (highest timestamp) to Oldest
    return valB - valA;
  });
  // ** END NEW SORTING LOGIC **

  items = parsed;

  const cnt = document.getElementById('count');
  if (cnt) cnt.textContent = `${items.length} items`;

  const controlsContainer = document.getElementById('controlsContainer');
  if (controlsContainer) {
    controlsContainer.innerHTML =   `<div class="pill" id="count">${items.length} items</div>` + `<button class="btn" onclick="showRandomPick()">🎲 Shuffle</button>`;
  }

  renderRandom();
  renderLatest();
  // renderCategoryDropdown() call ko hata diya gaya hai
  
  if (items.length > 0) {
    showItem(items[0]);
  }

  const hash = window.location.hash;
  if (hash.startsWith("#v=")) {
    const id = decodeURIComponent(hash.substring(3)); 
    showItemById(id);
  }

  checkAdBlocker();
}

// 4. FINAL INITIALIZATION CALL
loadAll();
