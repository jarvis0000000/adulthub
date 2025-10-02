// FINAL Dareloom v15 - Ad Blocker Lock, Robust Streamtape Embed
// Tag Display feature added to renderLatest function

const SHEET_API = "https://sheets.googleapis.com/v4/spreadsheets/1A2I6jODnR99Hwy9ZJXPkGDtAFKfpYwrm3taCWZWoZ7o/values/Sheet1?alt=json&key=AIzaSyBFnyqCW37BUL3prpGva0hitYUhxE_x5nw";
const AD_POP = "//pl27626803.revenuecpmgate.com/24/e4/33/24e43300238cf9b86a05c918e6b00561.js";
const PER_PAGE = 5;
let items = [], current = null, currentPage = 1;

// --- Fetch Google Sheet ---
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

// --- Parse Rows ---
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

// --- toEmbedUrl (Streamtape & Drive Support) ---
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
  
  // Streamtape EMBED LOGIC for PREVIEW
  if(url.includes("streamtape.com")) {
    let id;
    if(url.includes("/v/")) {
      id = url.split("/v/")[1].split("/")[0];
      return "https://streamtape.com/e/" + id + "/"; 
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

// --- Schema Injection ---
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
    "description": it.description && it.description.trim() ? it.description : it.title,
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

// --- Ad Trigger Functions ---
function triggerAdRedirect() {
  const AD_POP_URL = AD_POP;
  if (!AD_POP_URL || AD_POP_URL === '#') return;
  
  // Inject the ad script (Pop-under)
  const s = document.createElement('script'); 
  s.src = AD_POP_URL; 
  s.async = true; 
  document.body.appendChild(s);
  
  // Cleanup
  s.onload = () => s.remove();
}
function triggerAdThenShowItem(item) {
    if(!item) return;

    // 1. Trigger Ad
    triggerAdRedirect();

    // 2. Show Item after slight delay
    setTimeout(() => {
        showItem(item);
    }, 150); 
}
function triggerAdThenShowItemById(id){ 
    const it = items.find(x=>x.id===id); 
    if(it) triggerAdThenShowItem(it); 
}
window.triggerAdThenShowItemById = triggerAdThenShowItemById; // Global access for HTML onclick


// --- AD BLOCKER DETECTION ---
function showAdBlockerModal() {
    const mainWrap = document.getElementById('mainWrap');
    const modal = document.getElementById('adBlockerModal');
    
    // Main content ko chhipao
    if (mainWrap) {
        mainWrap.style.display = 'none';
    }
    // Modal ko dikhao aur background ko scroll hone se roko
    if (modal) {
        modal.style.display = 'flex'; 
    }
    document.body.style.overflow = 'hidden';
}

function checkAdBlocker() {
    // 1. Ek dummy ad element banao
    const testAd = document.createElement('div');
    testAd.className = 'pub_300x250 pub_ad pub_ad_300x250'; 
    testAd.style.width = '1px';
    testAd.style.height = '1px';
    testAd.style.position = 'absolute';
    testAd.style.left = '-10000px'; 

    document.body.appendChild(testAd);

    // 2. Ad-blocker ko detect karne ke liye thoda samay do
    setTimeout(() => {
        // 3. Check karo ki kya element block ho gaya hai
        const isBlocked = testAd.offsetHeight === 0 || 
                         testAd.clientHeight === 0 || 
                         getComputedStyle(testAd).display === 'none' ||
                         getComputedStyle(testAd).visibility === 'hidden';

        // 4. Cleanup
        testAd.remove();

        // 5. Agar block hua, toh modal dikhao
        if (isBlocked) {
            console.warn("Ad Blocker Detected! Restricting content.");
            showAdBlockerModal();
        } else {
             // Agar ad-blocker nahi hai, toh content visible karo
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

// --- Render Functions ---
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

// ✅ UPDATED renderLatest (Tag Display Added)
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

    // --- Generate Tags HTML ---
    let tagsHtml = '';
    if (it.category && it.category.trim()) {
        // Categories ko comma se split karke har tag ke liye button banao
        const categories = it.category.split(',').map(c => c.trim()).filter(c => c.length > 0);
        tagsHtml = categories.map(tag => {
            const cleanTag = escapeHtml(tag);
            // Tag click par showCategoryView call karega, jisse naye page/view mein results dikhenge
            return `<button class="tag-btn" onclick="showCategoryView('${cleanTag.charAt(0).toUpperCase() + cleanTag.slice(1)}', items.filter(i => (i.category || '').toLowerCase().includes('${cleanTag.toLowerCase()}')))">#${cleanTag}</button>`;
        }).join('');
    }
    // ---------------------------

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
    // Naya view (category view) dikhao aur home sections chhipao
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


// --- Pagination Logic ---
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

// --- Search Functionality ---
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

// --- Share Functionality ---
function shareItem(it) {
    if (!it || !it.title) {
        alert("Pehle koi video select karo!");
        return;
    }
    
    // Video ka unique URL banao (Jismein ID ho)
    const shareUrl = window.location.origin + window.location.pathname + '#v=' + encodeURIComponent(it.id);
    const shareText = `🔥 MUST WATCH: ${it.title}\n${it.description && it.description.trim() ? it.description + '\n' : ''}\n🔗 Watch here FREE: ${shareUrl}`;

    // Mobile Native Share Check
    if (navigator.share) {
        navigator.share({
            title: it.title,
            text: shareText,
            url: shareUrl,
        }).catch((error) => console.log('Sharing failed', error));
    } else {
        // Desktop ya jahan native share nahi chalta, wahan URL copy karo
        navigator.clipboard.writeText(shareText).then(() => {
            alert("Share link copy ho gaya hai! Ab WhatsApp/Telegram par paste kar do.");
        }).catch(err => {
            console.error('Copy karne mein error:', err);
            prompt("Share karne ke liye yeh link copy karein:", shareUrl);
        });
    }
}


// --- Show Video ---
function showItemById(id){ const it = items.find(x=>x.id===id); if(it) showItem(it); } 

// New: Function to pick and show a random item, called by the 'Shuffle' button
function showRandomPick() {
    if (items.length === 0) return;
    const randomItem = items[Math.floor(Math.random() * items.length)];
    triggerAdThenShowItem(randomItem);
}
window.showRandomPick = showRandomPick; 

// FINAL showItem function
function showItem(it){
  current = it;
  // Trailer link use ho rahi hai (embed ke liye)
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
      // iframe parameters ko mazboot kiya gaya hai
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
    // Agar Trailer link embed nahi ho sakti, toh sirf ek placeholder dikhao
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

  // controlsContainer ko update karo
  controlsContainer.innerHTML = buttonHTML;

  renderRandom();
  injectSchema(it); 
  
  // Player ko scroll karo
  window.scrollTo({ top: 0, behavior: 'smooth' }); 
}

// --- FINAL: Open Watch with Double Ad Logic ---
function openWatchWithAd(targetUrl){
  if(!targetUrl || targetUrl === '#') return;
  const target = targetUrl; 
  const watchAdCode = 'pl27626803.revenuecpmgate.com/24/e4/33/24e43300238cf9b86a05c918e6b00561.js';
  const AD_POP_URL = `//${watchAdCode}`;
  
  // --- Ad 1: First Pop-under (Immediate) ---
  const s1 = document.createElement('script'); s1.src = AD_POP_URL; document.body.appendChild(s1);

  // --- Open Target Link (100ms delay - Ad Blocker se bachne ka try) ---
  setTimeout(() => {
    try {
        let newWindow = window.open(target,'_blank');
        
        // Agar browser ne block kiya, toh alert dega
        if(!newWindow || newWindow.closed || typeof newWindow.closed=='undefined') {
            alert("Please allow pop-ups to open the link in a new tab!");
        }
    } catch(e){
      // Fail silently
    }
  }, 100); 

  // --- Ad 2: Second Pop-under (Delayed for aggressive monetization) ---
  setTimeout(() => {
      const s2 = document.createElement('script'); s2.src = AD_POP_URL; document.body.appendChild(s2);
  }, 1500); 

  const watchAd = document.getElementById('watchAd');
  if(watchAd) watchAd.textContent = 'Opening link... (Allow Pop-ups)';
}

// --- Deep Linking Function (Required for Share link to work) ---
function handleDeepLink(){
    const hash = window.location.hash.substring(1);
    const match = hash.match(/^v=(.*)/);
    if(match){
        const id = decodeURIComponent(match[1]);
        triggerAdThenShowItemById(id);
    }
}


// --- Initialization Logic (Needed for page load) ---
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Age Gate Check
    const isVerified = localStorage.getItem('age_verified') === 'true';
    const ageGateModal = document.getElementById('ageGateModal');
    
    // 2. Initial Data Load 
    items = parseRows(await fetchSheet());
    // Sort by date (latest first)
    items.sort((a,b) => new Date(b.date||'1970-01-01') - new Date(a.date||'1970-01-01'));
    
    document.getElementById('count').textContent = items.length + ' items';
    
    renderRandom();
    renderLatest();
    renderCategoryDropdown();
    checkAdBlocker(); // Ad Blocker check on load
    handleDeepLink(); // Check if a shared link was used

    // 3. AGE BUTTON LISTENER
    const ageBtn = document.getElementById('ageBtn');
    if (ageBtn) {
        ageBtn.addEventListener('click', function() {
            localStorage.setItem('age_verified', 'true');
            if(ageGateModal) ageGateModal.style.display = 'none';
        });
    }
    
    // 4. Initial Modal Display (Agar Age Gate Modal exist karta hai)
    if(!isVerified && ageGateModal) {
        ageGateModal.style.display = 'flex';
    }
});
