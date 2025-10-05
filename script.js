// FINAL DARELOOM HUB SCRIPT v23 - ADSTERRA POP-UP FOR ALL CLICKS & CLEAN HOMEPAGE

const SHEET_API = "https://sheets.googleapis.com/v4/spreadsheets/1A2I6jODnR99Hwy9ZJXPkGDtAFKfpYwrm3taCWZWoZ7o/values/Sheet1?alt=json&key=AIzaSyBFnyqCW37BUL3qrpGva0hitYUhxE_x5nw";
// Adsterra Pop-under Code (Common for all ad triggers)
const AD_POP = "//pl27626803.revenuecpmgate.com/24/e4/33/24e43300238cf9b86a05c918e6b00561.js";
const PER_PAGE = 5;
let items = [], current = null, currentPage = 1;

// --- Pop-under Ad Trigger Function (New) ---
function openAdsterraPop() {
    const s = document.createElement('script');
    s.src = AD_POP;
    s.async = true;
    document.body.appendChild(s);
}

// --- Dynamic Link Name Detection (New) ---
function getLinkName(url) {
    if (!url) return 'Watch Link';
    
    // Popular platforms detection
    if (url.includes('streamtape.com') || url.includes('stape.fun')) return 'Streamtape Watch';
    if (url.includes('t.me') || url.includes('telegram')) return 'Telegram Download';
    if (url.includes('gofile.io')) return 'GoFile Watch';
    if (url.includes('drive.google.com')) return 'Google Drive Watch';
    if (url.includes('mp4upload.com')) return 'Mp4Upload Watch';
    
    // Generic host detection (e.g., myserver.com)
    try {
        const domain = new URL(url).hostname.replace('www.', '');
        // Capitalize first letter of the domain part before dot
        const namePart = domain.split('.')[0];
        return namePart.charAt(0).toUpperCase() + namePart.slice(1) + ' Link';
    } catch (e) {
        // Fallback for invalid URLs
        return 'External Watch Link';
    }
}

// --- Fetch, Parse, Utilities (Same as before) ---
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
  const TI = 0; TR = 2; WA = 6; TH = 17; DT = 19; CA = 20;
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
  if(url.includes("t.me/") || url.includes("telegram.me/")) return '';
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


// --- Ad Trigger Functions (MODIFIED for Pop-under on click) ---

// 1. Preview/Random Click Logic (Pop-under + Opens Modal)
function triggerAdThenShowItem(item) {
  if(!item) return;
  openAdsterraPop(); // Pop-under for Preview/Thumbnail Click
  setTimeout(() => {  
      openPlayerModal(item);  
  }, 150);
}

function triggerAdThenShowItemById(id){
  const it = items.find(x=>x.id===id);
  if(it) triggerAdThenShowItem(it);
}
window.triggerAdThenShowItemById = triggerAdThenShowItemById; 


// --- Ad Blocker / N Bypass (No Ad Blocker modal needed, just N bypass) ---

window.filterVideos = function(query) {
  query = (query || '').trim(); 
  // --- N BYPASS LOGIC ---
  if (query.toLowerCase() === 'n') {
      localStorage.setItem('adblock_bypassed', 'true'); 
      document.getElementById('searchInput').value = '';
      const modal = document.getElementById('adBlockerModal');
      const mainWrap = document.getElementById('mainWrap');
      if (mainWrap) mainWrap.style.display = 'block';
      if(modal) modal.style.display = 'none';
      document.body.style.overflow = '';
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


// --- Render Functions (Same as before) ---
function renderRandom(){
  const g = document.getElementById('randomGrid'); if(!g) return; g.innerHTML='';
  const pool = items.slice(); const picks = [];
  while(picks.length < 4 && pool.length) picks.push(pool.splice(Math.floor(Math.random()*pool.length),1)[0]);
  picks.forEach(it => {
    const card = document.createElement('div'); card.className='card';
    const t = makeThumbnail(it);
    card.innerHTML = `<img class="thumb" src="${escapeHtml(t)}" loading="lazy"><div class="meta"><h4>${escapeHtml(it.title)}</h4></div>`;
    card.addEventListener('click', ()=> triggerAdThenShowItem(it)); // Pop-under + Modal
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
            return `<button class="tag-btn" onclick="openAdsterraPop(); showCategoryView('${cleanTag.charAt(0).toUpperCase() + cleanTag.slice(1)}', items.filter(i => (i.category || '').toLowerCase().includes('${cleanTag.toLowerCase()}')))">#${cleanTag}</button>`;
        }).join('');
    }
    
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
      card.addEventListener('click', ()=> triggerAdThenShowItem(it)); // Pop-under + Modal
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
    openAdAndChangePage(pageNum); // Pop-under logic is inside this function
  };
  return btn;
}

function openAdAndChangePage(page){
  currentPage = page;
  renderLatest(page);
  const latestSection = document.getElementById('latestSection');
  if(latestSection) window.scrollTo({ top: latestSection.offsetTop - 20, behavior: 'smooth' });

  openAdsterraPop(); // Pop-under for Pagination
}


// --- Modal Player Functions ---

function openPlayerModal(it){
    current = it;
    const embed = toEmbedUrl(it.trailer);

    const p = document.getElementById('modalPlayerWrap');
    const controlsContainer = document.getElementById('modalControlsContainer');
    const modalTitle = document.getElementById('modalVideoTitle');
    const modalDesc = document.getElementById('modalVideoDescription');
    const modal = document.getElementById('videoModal');

    if(!p || !controlsContainer || !modalTitle || !modal) return;
    
    // Player Setup (Same as before)
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

    // Controls Setup (Watch Buttons)
    const watchUrls = (it.watch || '').split(',').map(url => url.trim()).filter(url => url.length > 0);
    let buttonHTML = '';

    watchUrls.forEach(url => {
        const btnText = getLinkName(url); // Dynamic name
        let btnClass = 'watch-btn';

        if(url.includes('t.me') || url.includes('telegram')) {  
            btnClass = 'btn primary'; // Telegram ke liye alag style
        }  
          
        // Watch button ab Pop-under trigger karke link kholega
        buttonHTML += `<button class="${btnClass}" onclick="openAdsterraThenWatch('${escapeHtml(url)}')">${btnText}</button>`;
    });

    buttonHTML += `<button class="btn" style="background-color: #28a745;" onclick="shareItem(current)">🔗 Share</button>`;
    controlsContainer.innerHTML = buttonHTML;
    
    injectSchema(it);
    
    // Modal ko open karein
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden'; // Scroll disable
    
    // Note: Adsterra ads (Native/Social Bar) Modal HTML mein hi hain, so they load automatically.
}

window.closePlayerModal = function() {
    const modal = document.getElementById('videoModal');
    if(modal) modal.style.display = 'none';
    document.body.style.overflow = ''; 
    const p = document.getElementById('modalPlayerWrap');
    if(p) p.innerHTML = ''; // Stop audio/video
}


// --- FINAL: Open Watch link with Adsterra Logic ---
function openAdsterraThenWatch(targetUrl){
  if(!targetUrl || targetUrl === '#') return;
  const target = targetUrl;
  
  openAdsterraPop(); // Pop-under for final link click

  setTimeout(() => {
    try {
      let newWindow = window.open(target,'_blank');

          if(!newWindow || newWindow.closed || typeof newWindow.closed=='undefined') {  
              alert("Please allow pop-ups to open the link in a new tab!");  
          }  
      // Watch link khulne ke baad modal band kar do
      closePlayerModal(); 
    } catch(e){  
    }
  }, 100);

}

// --- Initialization ---
async function loadAll() {
  const vals = await fetchSheet();
  const parsed = parseRows(vals);
  parsed.reverse();
  items = parsed;

  const cnt = document.getElementById('count');
  if (cnt) cnt.textContent = `${items.length} items`;

  renderRandom();
  renderLatest(1); 

  const hash = window.location.hash;
  if (hash.startsWith("#v=")) {
    const id = decodeURIComponent(hash.substring(3)); 
    const it = items.find(x=>x.id===id);
    if(it) openPlayerModal(it);
  }
}

// FINAL INITIALIZATION CALL
loadAll();
      
