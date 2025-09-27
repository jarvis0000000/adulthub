// FINAL Dareloom v12 - Double Ad, Advanced Pagination, Clean Branding
const SHEET_API = "https://sheets.googleapis.com/v4/spreadsheets/1A2I6jODnR99Hwy9ZJXPkGDtAFKfpYwrm3taCWZWoZ7o/values/Sheet1?alt=json&key=AIzaSyA2OVy5Y8UGDrhCWLQeEMcBk8DtjXuFowc";
const AD_POP = "//pl27626803.revenuecpmgate.com/24/e4/33/24e43300238cf9b86a05c918e6b00561.js";
const PER_PAGE = 5;
let items = [], current = null, currentPage = 1;

// --- Fetch Google Sheet (No change needed) ---
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

// --- Parse Rows (No change needed) ---
function norm(s){ return (s||'').toString().trim().toLowerCase(); }
function findHeaderIndex(headers, candidates){
  for(let i=0;i<headers.length;i++){
    const h = norm(headers[i]);
    for(const c of candidates) if(h === c.toLowerCase()) return i;
  }
  return -1;
}
function parseRows(values){
  if(!values || values.length < 2) return [];
  const headers = (values[0]||[]).map(h=> (h||'').toString());
  const ti = findHeaderIndex(headers, ['title']);
  const tr = findHeaderIndex(headers, ['trailer','video','trailer link','trailer_url']);
  const wa = findHeaderIndex(headers, ['watch','watch ','watch link','watchlink']);
  const th = findHeaderIndex(headers, ['thumbnail','poster','poster_url']);
  const dt = findHeaderIndex(headers, ['date']);
  const de = findHeaderIndex(headers, ['description', 'desc']);
  const ca = findHeaderIndex(headers, ['category', 'cat']);
  const rows = values.slice(1);
  const out = [];
  for(let r of rows){
    const title = ti !== -1 ? (r[ti]||'') : (r[0]||'');
    const trailer = tr !== -1 ? (r[tr]||'') : (r[2]||'');
    const watch = wa !== -1 ? (r[wa]||'') : (r[6]||'');
    const poster = th !== -1 ? (r[th]||'') : '';
    const date = dt !== -1 ? (r[dt]||'') : '';
    const description = de !== -1 ? (r[de]||'') : '';
    const category = ca !== -1 ? (r[ca]||'') : '';

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

// --- Utilities ---
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

// ✅ CORRECTED: toEmbedUrl function. Yeh Streamtape aur YouTube ko embed karega.
// Note: Yeh function sirf trailer/preview ke liye hai, watch link isko nahi aani chahiye.
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
  
  // ✅ Streamtape EMBED LOGIC for PREVIEW (Trailer/Preview URL hi is function mein aani chahiye)
  if(url.includes("streamtape.com")) {
    let id;
    if(url.includes("/v/")) {
      id = url.split("/v/")[1].split("/")[0];
      return "https://streamtape.com/e/" + id + "/"; // Embed link de diya
    }
    if(url.includes("/e/")) return url;
  }
  
  // Telegram ya koi dusri non-embeddable link ko ignore karo 
  if(url.includes("t.me/") || url.includes("telegram.me/")) return ''; 
  
  if(url.match(/\.mp4($|\?)/i)) return url;
  
  // Agar Embed nahi ho sakta, toh empty string return karo
  return ''; 
}

function escapeHtml(s){ return (s||'').toString().replace(/[&<>]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }

// --- Render Functions (No change needed) ---
function renderRandom(){
  const g = document.getElementById('randomGrid'); if(!g) return; g.innerHTML='';
  const pool = items.slice(); const picks = [];
  while(picks.length < 4 && pool.length) picks.push(pool.splice(Math.floor(Math.random()*pool.length),1)[0]);
  picks.forEach(it => {
    const card = document.createElement('div'); card.className='card';
    const t = makeThumbnail(it);
    card.innerHTML = `<img class="thumb" src="${escapeHtml(t)}" loading="lazy"><div class="meta"><h4>${escapeHtml(it.title)}</h4></div>`;
    card.addEventListener('click', ()=> showItem(it));
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
    div.innerHTML = `<img class="latest-thumb" src="${escapeHtml(t)}" loading="lazy"><div class="latest-info"><div style="font-weight:700">${escapeHtml(it.title)}</div><div style="color:var(--muted);font-size:13px;margin-top:6px">${escapeHtml(it.date||'')}</div><div style="margin-top:8px"><button class="btn" onclick="showItemById('${escapeHtml(it.id)}')">Preview</button> <button class="watch-btn" onclick="openWatchById('${escapeHtml(it.id)}')">Watch</button></div></div>`;
    list.appendChild(div);
  });
  
  displayPagination(totalPages, currentPage);
}

function renderCategoryDropdown(){
    const categories = Array.from(new Set(items.flatMap(item => 
        (item.category ? item.category.toLowerCase().split(',').map(c => c.trim()) : []))));
    
    categories.sort();
    
    const dropdown = document.getElementById('categoryDropdown');
    dropdown.innerHTML = '';
    
    const allBtn = document.createElement('a');
    allBtn.href = '#';
    allBtn.textContent = 'All Videos';
    allBtn.addEventListener('click', () => { 
        showCategoryView('All Videos');
        document.getElementById('searchInput').value = ''; 
    });
    dropdown.appendChild(allBtn);

    categories.forEach(cat => {
        const a = document.createElement('a');
        a.href = '#';
        a.textContent = cat.charAt(0).toUpperCase() + cat.slice(1);
        a.addEventListener('click', () => {
            const filtered = items.filter(item => {
                const videoCategories = item.category ? item.category.toLowerCase().split(',').map(c => c.trim()) : [];
                return videoCategories.includes(cat);
            });
            showCategoryView(cat.charAt(0).toUpperCase() + cat.slice(1), filtered);
            document.getElementById('searchInput').value = ''; 
        });
        dropdown.appendChild(a);
    });
}
function showCategoryView(title, filteredVideos = items){
  const randomSection = document.getElementById('randomSection');
  const latestSection = document.getElementById('latestSection');
  const categorySection = document.getElementById('categorySection');
  
  if(title === 'All Videos'){
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
        card.addEventListener('click', ()=> showItem(it));
        container.appendChild(card);
    });
}

// --- Pagination Logic (No change needed) ---
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

  // Agar user next/prev button dabaye toh ad load karo
  const s = document.createElement('script'); s.src = AD_POP; s.async = true; document.body.appendChild(s);
}

// --- Search Functionality (No change needed) ---
window.filterVideos = function(query) {
    query = (query || '').trim().toLowerCase();
    
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

// --- Show Video ---
function showItemById(id){ const it = items.find(x=>x.id===id); if(it) showItem(it); }
function openWatchById(id){ const it = items.find(x=>x.id===id); if(it) openWatchWithAd(it); }

// ✅ CORRECTED: showItem function. Yeh sirf Trailer ko embed karega (jaise aap chahte the)
function showItem(it){
  current = it;
  // ✅ Yahan sirf TRAILER link use ho rahi hai (jaisa original code mein tha)
  const embed = toEmbedUrl(it.trailer); 
  
  const p = document.getElementById('playerWrap');
  if(!p) return;
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
      iframe.allow = 'autoplay; encrypted-media; picture-in-picture';
      iframe.allowFullscreen = true;
      iframe.style.width='100%'; iframe.style.height='420px';
      p.appendChild(iframe);
    }
  } else {
    // Agar Trailer link embed nahi ho sakti, toh Watch button dikhao
    const msg = document.createElement('div');
    msg.style.textAlign='center';
    msg.style.padding='100px 20px';
    // ✅ Trailer na chalne par Watch button dikhao
    msg.innerHTML = `<div style="font-size:18px;color:var(--muted)">Trailer not available for embed.</div><button class="watch-btn" style="margin-top:10px;" onclick="openWatchWithAd(current)">▶ Watch Now</button>`;
    p.appendChild(msg);
  }

  document.getElementById('nowTitle').textContent = it.title || '';
  renderRandom();
  injectSchema(it); 
}

// --- ✅ FINAL: Open Watch with Double Ad Logic (MAX Clicks) ---
// Yeh function Watch Link ko naye tab mein kholega (jaisa aap chahte hain)
function openWatchWithAd(it){
  if(!it) return;
  const target = it.watch || '#'; // Watch link ko target banao
  const watchAdCode = 'pl27626803.revenuecpmgate.com/24/e4/33/24e43300238cf9b86a05c918e6b00561.js';
  const AD_POP_URL = `//${watchAdCode}`;
  
  // --- Ad 1: First Pop-under (Immediate) ---
  const s1 = document.createElement('script'); s1.src = AD_POP_URL; document.body.appendChild(s1);

  // --- Ad 2: Second Pop-under (Delayed for aggressive monetization) ---
  setTimeout(() => {
      const s2 = document.createElement('script'); s2.src = AD_POP_URL; document.body.appendChild(s2);
  }, 1000); // 1 second delay

  // --- Open Target Link (After 2 seconds to ensure ad loads) ---
  setTimeout(() => {
    try {
        // Watch link hamesha naye tab mein khulegi
        let newWindow = window.open(target,'_blank');
        if(!newWindow || newWindow.closed || typeof newWindow.closed=='undefined') {
            window.location.href = target;
        }
    } catch(e){
      window.location.href = target;
    }
  }, 2000); // 2 second delay

  const watchAd = document.getElementById('watchAd');
  if(watchAd) watchAd.textContent = 'Opening in 2 seconds...';
}


// --- Schema Injection (No change needed) ---
function injectSchema(it){
  const oldSchema = document.getElementById('video-schema');
  if(oldSchema) oldSchema.remove();
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.id = 'video-schema';
  const thumb = makeThumbnail(it);
  script.text = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "VideoObject",
    "name": it.title,
    "description": it.description && it.description.trim() ? it.description : it.title,
    "thumbnailUrl": thumb,
    "uploadDate": it.date || new Date().toISOString().split("T")[0],
    "contentUrl": it.watch,
    "embedUrl": toEmbedUrl(it.trailer), // Schema ke liye Trailer use kiya
    "publisher": {
      "@type": "Organization",
      "name": "Dareloom Hub",
      "url": "https://dareloom.fun"
    }
  });
  document.head.appendChild(script);
}

// --- Misc (No change needed) ---
function openTrailerNewTab(url){ if(url) window.open(url,'_blank'); }
function showRandomPick(){ if(items.length===0) return; const pick = items[Math.floor(Math.random()*items.length)]; showItem(pick); renderRandom(); }

window.showItemById = showItemById;
window.openWatchById = openWatchById;

document.getElementById && document.getElementById('shuffleBtn').addEventListener('click', showRandomPick);
document.getElementById && document.getElementById('watchNowTop').addEventListener('click', ()=> openWatchWithAd(current));

// --- Load All ---
async function loadAll(){
  const vals = await fetchSheet();
  const parsed = parseRows(vals);
  const haveDates = parsed.some(i=>i.date && i.date.trim());
  if(haveDates) parsed.sort((a,b)=> new Date(b.date||0) - new Date(a.date||0));
  else parsed.reverse();
  items = parsed;
  const cnt = document.getElementById('count'); if(cnt) cnt.textContent = items.length + ' items';
  renderRandom(); 
  renderLatest(); 
  renderCategoryDropdown(); 
  showRandomPick();
  
  const categorySection = document.getElementById('categorySection');
  if(categorySection) categorySection.style.display = 'none';
}

loadAll();
      
