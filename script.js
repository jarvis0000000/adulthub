// script.js
// Dareloom Hub - FINAL V21: Pop-up Logic Removed (Smart Link is now in index.html)

// ------------- CONFIG -------------
// ✅ FIXED SHEET ID: 1A2I6jODnR99Hwy9ZJXPkGDtAFKfpYwrm3taCWZWoZ7o
const SHEET_API = "https://sheets.googleapis.com/v4/spreadsheets/1A2I6jODnR99Hwy9ZJXPkGDtAFKfpYwrm3taCWZWoZ7o/values/Sheet1?alt=json&key=AIzaSyBFnyqCW37BUL3qrpGva0hitYUhxE_x5nw";
const SHEET_API_REELS = "https://sheets.googleapis.com/v4/spreadsheets/1A2I6jODnR99Hwy9ZJXPkGDtAFKfpYwrm3taCWZWoZ7o/values/Sheet3!A:B?alt=json&key=AIzaSyBFnyqCW37BUL3qrpGva0hitYUhxE_x5nw"; 
const PER_PAGE = 5;
const RANDOM_COUNT = 4;

// 🛑 Adsterra Pop-up/Smart Link Config: REMOVED (Handled by index.html)
// Old variables like POP_COOLDOWN_MS, lastPop, userInteracted have been removed.


// ------------- STATE -------------
let items = [];
let filteredItems = [];
let currentPage = 1;

// ✅ Reels State
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

function makeThumbnail(it){
if (it.poster && it.poster.trim()) return it.poster.trim();
const y = extractYouTubeID(it.trailer || it.watch);
if (y) return `https://img.youtube.com/vi/${y}/hqdefault.jpg`;
return 'https://placehold.co/600x400?text=Dareloom+Hub';
}

// 🛑 openAdsterraPop() function REMOVED.
// User interaction tracking (markUserGesture) is now only for play/UI logic if needed.


// NOTE: getRedgifsDirect is no longer used for Reels but kept for legacy/testing
function getRedgifsDirect(link) {
  if (link.includes("redgifs.com/watch/")) {
    const slug = link.split("/watch/")[1];
    return `https://thumbs2.redgifs.com/${slug}-mobile.mp4`;
  }
  return link;
}


// ------------- SHEET FETCH & PARSE -------------
async function fetchSheet(url){
try{
const res = await fetch(url);
if (!res.ok) throw new Error('sheet fetch failed ' + res.status);
const j = await res.json();
return j.values || [];
}catch(e){
console.error("Sheet fetch error:", e);
return [];
}
}

// Main Content (Sheet1) Parser
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

    let telegramLink = '';  
    const links = rawWatch.split(',').map(l => l.trim()).filter(Boolean);  

    links.forEach(link => {  
        if (link.includes('t.me') || link.includes('telegram')) {  
            telegramLink = link;  
        }  
    });  

    if ((!trailer || trailer.length === 0) && (!rawWatch || rawWatch.length === 0)) continue;  

    const id = `${slugify(title)}|${Math.random().toString(36).slice(2,8)}`;  

    out.push({  
        id,  
        title: title || 'Untitled',  
        trailer: trailer || '',  
        watch: rawWatch || '',  
        telegram: telegramLink || '', 
        poster: poster || '',  
        date: date || '',  
        category: category || '',  
        description: description || ''  
    });  
}  
return out.reverse(); 
}

// Reels Sheet (Sheet3) parsing for Title (A) and Link (B)
function parseReelRows(values){
    if (!values || values.length < 2) return [];
    
    const rows = values.slice(1);  
    const out = [];  
    let untitledCounter = 1;

    for (let r of rows){  
        r = Array.isArray(r) ? r : [];  
        
        const titleCandidate = (r[0] || '').toString().trim();  
        const reelLink = (r[1] || '').toString().trim(); 

        if (!reelLink) continue;  

        const finalTitle = titleCandidate || (`Untitled Reel ${untitledCounter}`);
        const id = `${slugify(finalTitle)}|${Math.random().toString(36).slice(2,8)}`;  
        untitledCounter++;

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
if (!it.category || !it.category.trim()) return '';
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
card.innerHTML = `<img class="thumb" src="${escapeHtml(makeThumbnail(it))}" loading="lazy" alt="${escapeHtml(it.title)}"> <div class="meta"><h4>${escapeHtml(it.title)}</h4></div>`;
card.addEventListener('click', ()=> openTrailerPage(it));
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

if (slice.length === 0 && total > 0 && page > 1) {  
    currentPage = 1;  
    renderLatest(1);  
    return;  
}  
  
if (slice.length === 0) {  
    list.innerHTML = '<div style="text-align:center; padding: 20px; color: var(--muted);">No videos found matching your criteria.</div>';  
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
                <button class="watch-btn" data-url="${escapeHtml(it.watch || it.trailer)}">Watch Now</button>   
            </div>   
        </div>  
    `;  
    div.addEventListener('click', (e) => {
        if (!e.target.closest('.preview-btn, .watch-btn, .tag-btn')) {
            openTrailerPage(it);
        }
    });

    list.appendChild(div);  
});  

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
// openAdsterraPop() call removed
}

function attachLatestListeners(){
qsa('#latestList .preview-btn').forEach(el => {
el.removeEventListener('click', onPreviewClick);
el.addEventListener('click', onPreviewClick);
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
// markUserGesture() call removed
e.stopPropagation(); 
const id = e.currentTarget.dataset.id;
const it = items.find(x => x.id === id); 
if (!it) return;
openTrailerPage(it);
}

function onWatchClick(e){
// markUserGesture() call removed
e.stopPropagation(); 
const url = e.currentTarget.dataset.url; 
if (!url) return;
openWatchPage(url);
}

function onTagClick(e){
// markUserGesture() call removed
e.stopPropagation(); 
const tag = e.currentTarget.dataset.tag;
if (!tag) return;
applyTagFilter(tag);
// openAdsterraPop() call removed
}

function openTrailerPage(it){
// markUserGesture() call removed
// openAdsterraPop() call removed
const trailerURL = `/trailer.html?id=${encodeURIComponent(it.id)}`; 
setTimeout(()=> {
try {
window.location.href = trailerURL;
} catch(e){
console.error("Failed to open trailer page", e);
}
}, 120);
}

function openWatchPage(fullWatchLinks){
    if (!fullWatchLinks) return;
    // markUserGesture() call removed
    // openAdsterraPop() call removed

    const finalDestination = `/watch?url=${encodeURIComponent(fullWatchLinks)}`;
    const redirectPage = `/go.html?target=${encodeURIComponent(finalDestination)}`;    

    setTimeout(()=> {  
        try {  
            const w = window.open(redirectPage, '_blank');    
            if (!w || w.closed || typeof w.closed === 'undefined'){    
                alert("Please allow pop-ups to open the link in a new tab!");    
            }    
        } catch(e){    
            console.error(e);    
        }  
    }, 120);
}

function filterVideos(query = "") {
    const q = query.toLowerCase().trim();
    if (!q) {
        filteredItems = items;
    } else {
        filteredItems = items.filter(it => 
            it.title.toLowerCase().includes(q) || 
            it.category.toLowerCase().includes(q) ||
            it.description.toLowerCase().includes(q)
        );
    }
    renderLatest(1);
}

function applyTagFilter(tag) {
    const q = tag.toLowerCase().trim();
    filteredItems = items.filter(it => it.category.toLowerCase().includes(q));
    renderLatest(1);
    const s = qs('#searchInput');
    if(s) s.value = ''; // Clear search input
}

// ------------- REELS PLAYER LOGIC -------------

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
        // Reduced iframe controls for a cleaner look
        return { type: "iframe", src: `https://www.youtube.com/embed/${y}?autoplay=1&mute=1&rel=0&controls=0&enablejsapi=1&playsinline=1&origin=${window.location.origin}` }; 
    }
    
    // RedGifs watch links now load as iframes to bypass the MP4 hotlinking block
    if (url.includes('redgifs.com/watch/')) {
        const parts = url.split("/watch/");
        if (parts.length > 1) {
             const slug = parts[1].split("?")[0];
             // Converts watch link to ifr embed format
             const embedUrl = `https://www.redgifs.com/ifr/${slug}`; 
             return { type: "iframe", src: embedUrl };
        }
    }
    
    // Keep RedGifs IFRAME handling for existing ifr/ links
    if (url.includes('redgifs.com/ifr/')) {
        let videoId = url.split('/').pop(); 
        videoId = videoId.split('?')[0]; 
        const embedUrl = `https://www.redgifs.com/ifr/${videoId}`; 
        return { type: "iframe", src: embedUrl };
    }

    // Direct MP4/Video links will still use the <video> tag
    if (url.includes('.mp4') || url.includes('.gifv') || url.includes('.webm') || url.includes('.m3u8')) {
        return { type: "video", src: url };
    }
    
    // Fallback for general external URLs
    if (url.startsWith('http')) {
        // Use iframe for general external URLs
        return { type: "iframe", src: url };
    }

    return { type: "none" };
}


// Open player and fetch reels
async function openReelsPlayer() {
    // markUserGesture() call removed
    // openAdsterraPop() call removed

    if (allReelCandidates.length === 0) {  
        const rawReels = await fetchSheet(SHEET_API_REELS);
        allReelCandidates = parseReelRows(rawReels);
        if (allReelCandidates.length === 0) {
             alert("No videos available for Reels playback. Check Sheet links.");
             return;
        }
    }
    
    // Reset state for a new session
    usedReelIds.clear(); 
    
    qs('#reelsContainer').innerHTML = ''; 
    qs('#reelsPlayer').style.display = 'flex'; 
    document.body.style.overflow = 'hidden';   

    // Load the first random reel
    loadNextReel();
}


// Helper: toggles sound for current reel 
function toggleReelSound(e) {
    if (e) e.stopPropagation();
    const container = qs('#reelsContainer');
    if (!container) return;
    const reelDiv = container.querySelector('.reel');
    if (!reelDiv) return;

    const mediaEl = reelDiv.querySelector('.reel-video-media');

    // If it's a video element, toggle mute directly
    if (mediaEl && mediaEl.tagName === 'VIDEO') {
        mediaEl.muted = !mediaEl.muted;
        if (!mediaEl.muted) {
            mediaEl.volume = 1.0;
            mediaEl.play().catch(()=>{});
        }
        // Quick icon feedback
        const icon = document.createElement("div");
        icon.textContent = mediaEl.muted ? "🔇" : "🔊";
        Object.assign(icon.style, {
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            fontSize: "60px",
            color: "white",
            textShadow: "0 0 5px black",
            opacity: "0.95",
            transition: "opacity 0.6s ease-out",
            pointerEvents: "none",
            zIndex: "9999",
        });
        reelDiv.appendChild(icon);
        setTimeout(() => (icon.style.opacity = "0"), 100);
        setTimeout(() => icon.remove(), 600);
        return;
    }

    // If it's an iframe, try to postMessage a toggle command (for YouTube/other)
    if (mediaEl && mediaEl.tagName === 'IFRAME') {
        try {
            mediaEl.contentWindow.postMessage({ command: "toggleSound" }, "*");
            const icon = document.createElement("div");
            icon.textContent = "🔊";
            Object.assign(icon.style, {
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                fontSize: "48px",
                color: "white",
                textShadow: "0 0 5px black",
                opacity: "0.95",
                transition: "opacity 0.6s ease-out",
                pointerEvents: "none",
                zIndex: "9999",
            });
            reelDiv.appendChild(icon);
            setTimeout(() => (icon.style.opacity = "0"), 100);
            setTimeout(() => icon.remove(), 600);
        } catch (err) {
            console.warn("Iframe sound toggle postMessage failed:", err);
            const note = document.createElement("div");
            note.textContent = "Sound control not available for this embed";
            Object.assign(note.style, {
                position: "absolute",
                bottom: "16px",
                left: "50%",
                transform: "translateX(-50%)",
                fontSize: "13px",
                color: "white",
                background: "rgba(0,0,0,0.5)",
                padding: "6px 10px",
                borderRadius: "6px",
                zIndex: "9999",
                pointerEvents: "none"
            });
            reelDiv.appendChild(note);
            setTimeout(()=> note.remove(), 1400);
        }
        return;
    }

    log("No media element found to toggle sound");
}


function loadNextReel() {
  // openAdsterraPop() call removed

  const container = qs("#reelsContainer");

  if (usedReelIds.size >= allReelCandidates.length) {
    usedReelIds.clear();
    log("♻️ All reels shown once — starting new random cycle.");
  }

  let available = allReelCandidates.filter(x => !usedReelIds.has(x.id));
  if (available.length === 0) {
    container.innerHTML = `<h2 style="color:var(--primary-color);text-align:center;margin-top:40vh;">No Reels Found</h2>`;
    return;
  }

      const mediaEl = reelDiv.querySelector(".reel-video-media");
    if (mediaEl) {
      if (mediaEl.tagName === "VIDEO") {
        // FIX: Autoplay start
        mediaEl.muted = true; 
        mediaEl.volume = 1.0;
        mediaEl.play().catch(() => log("Autoplay blocked — muted"));
      }
    }

    // fade-in
    setTimeout(() => (container.style.opacity = 1), 50);

  }, 300);
}

function handleTouchStart(e){
    swipeStartY = e.touches[0].clientY;
}

function handleTouchEnd(e){
    const swipeEndY = e.changedTouches[0].clientY;
    const diffY = swipeStartY - swipeEndY;
    
    // Only proceed if it was a clear SWIPE (large movement)
    if (Math.abs(diffY) > 80) { 
        if (diffY > 0) {
            // swipe up → next reel
            loadNextReel(); 
        } else {
             // swipe down → next reel 
            loadNextReel();
        }
    } 
}


function closeReelsPlayer(){
    const player = qs('#reelsPlayer');
    if(player) player.style.display = 'none';
    document.body.style.overflow = '';

    const mediaEl = qs('#reelsContainer .reel-video-media');  
    if (mediaEl) {
        if (mediaEl.tagName === 'VIDEO') {
            mediaEl.pause();
            mediaEl.currentTime = 0;
            mediaEl.muted = true; 
        } else if (mediaEl.tagName === 'IFRAME') {
            mediaEl.src = 'about:blank'; 
        }
    }
    
    usedReelIds.clear(); 
}


// ------------- INIT / BOOT -------------

function setupGestureListener(){
    // Old Adsterra gesture listener removed.
    
    // Block Redgifs auto navigation attempts
    window.addEventListener("blur", () => {
        if (document.activeElement && document.activeElement.tagName === "IFRAME") {
            window.focus(); // Prevent external focus / redirect
            log("🛑 RedGifs blur redirect attempt blocked.");
        }
    });
}

async function loadAll(){
    const raw = await fetchSheet(SHEET_API); 
    const parsed = parseRows(raw); 
    items = parsed;
    filteredItems = parsed; 

    localStorage.setItem('dareloom_items', JSON.stringify(items)); 

    renderLatest(1);   
    renderRandom(); 

    const s = qs('#searchInput');   
    if (s){   
        s.addEventListener('input', (e) => {   
            const q = e.target.value || "";   
            filterVideos(q);   
        });   
    }  
    
    setupGestureListener();
}

loadAll();
