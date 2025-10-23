// script.js
// Dareloom Hub - FINAL FIX: Single Reel View with Only Next Button, No Title, and No Repeat Randomness

// ------------- CONFIG -------------
// Sheet 1 for Main Content (Latest List & Random Grid)
const SHEET_API = "https://sheets.googleapis.com/v4/spreadsheets/1A2I6jODnR99Hwy9ZJXPkGDtAFKfpYwrm3taCWZWoZ7o/values/Sheet1?alt=json&key=AIzaSyBFnyqCW37BUL3qrpGva0hitYUhxE_x5nw";
// Sheet 3 (Reels) API: Sheet3!A:B is used to fetch Title (A) and Link (B)
const SHEET_API_REELS = "https://sheets.googleapis.com/v4/spreadsheets/1A2I6jODnR99Hwy9ZJXPkGDtAFKfpYwrm3taCWZWoZ7o/values/Sheet3!A:B?alt=json&key=AIzaSyBFnyqCW37BUL3qrpGva0hitYUhxE_x5nw"; 
const PER_PAGE = 5;
const RANDOM_COUNT = 4;

// Pop / ads config
const AD_POP = "//bulletinsituatedelectronics.com/24/e4/33/24e43300238cf9b86a05c918e6b00561.js";
const POP_COOLDOWN_MS = 4000;
let lastPop = 0;
let userInteracted = false;
let initialPopFired = false;

// ------------- STATE -------------
let items = [];
let filteredItems = [];
let currentPage = 1;
let reelsQueue = [];
let allReelCandidates = []; 
let usedReelIds = new Set(); 
// New state for swipe logic
let currentReelIndex = -1;
let swipeStartY = 0;


// ------------- UTIL HELPERS -------------
const qs = sel => document.querySelector(sel);
const qsa = sel => Array.from(document.querySelectorAll(sel));

function log(...a){ console.log("[dareloom]", ...a); }

function slugify(text){
return (text||'').toString().toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
}

function escapeHtml(s){
return (s||'').toString()
.replace(/&/g,'&')
.replace(/</g,'<')
.replace(/>/g,'>')
.replace(/"/g,'"')
.replace(/'/g,'\'');
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

function openAdsterraPop(){
try{
const now = Date.now();
if (now - lastPop < POP_COOLDOWN_MS) return;
lastPop = now;

if (!userInteracted && !initialPopFired) return;  

    const s = document.createElement('script');  
    s.src = AD_POP;  
    s.async = true;  
    document.body.appendChild(s);  
    setTimeout(()=>{ try{s.remove();}catch(e){} }, 5000);  
    initialPopFired = true;  
    log("ad pop injected");  
}catch(e){  
    console.warn("Ad pop failed", e);  
}
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

function shuffleArray(array) {
const arr = array.slice();
for (let i = arr.length - 1; i > 0; i--) {
const j = Math.floor(Math.random() * (i + 1));
[arr[i], arr[j]] = [arr[i], arr[j]];
}
return arr;
}

// (Sheet1 Parsing Logic Remains Unchanged)
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


// 🛑 Reels Sheet parsing for Title (A) and Link (B)
function parseReelRows(values){
    if (!values || values.length < 2) return [];
    
    const rows = values.slice(1);  
    const out = [];  
    let untitledCounter = 1;

    for (let r of rows){  
        r = Array.isArray(r) ? r : [];  
        
        // Col 0 (A): Title
        // Col 1 (B): Reel Link
        const titleCandidate = (r[0] || '').toString().trim();  
        const reelLink = (r[1] || '').toString().trim(); 

        if (!reelLink) continue;  

        // Use the title from Column A, or fallback to a numbered title
        // NOTE: Title is internally stored but not displayed in the player now.
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


// (UI / RENDER / FILTER / WATCH LOGIC Remains Unchanged)

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
openAdsterraPop();
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
markUserGesture();
e.stopPropagation(); 
const id = e.currentTarget.dataset.id;
const it = items.find(x => x.id === id); 
if (!it) return;
openTrailerPage(it);
}

function onWatchClick(e){
markUserGesture();
e.stopPropagation(); 
const url = e.currentTarget.dataset.url; 
if (!url) return;
openWatchPage(url);
}

function onTagClick(e){
markUserGesture();
e.stopPropagation(); 
const tag = e.currentTarget.dataset.tag;
if (!tag) return;
applyTagFilter(tag);
}

function filterVideos(queryOrTag){
const query = (queryOrTag || '').toLowerCase().trim();
if (query.length < 2 && !query.length) {
filteredItems = items.slice();
} else {
filteredItems = items.filter(it => {
const titleMatch = it.title.toLowerCase().includes(query);
const categoryMatch = it.category.toLowerCase().split(',').map(t => t.trim()).includes(query);

return titleMatch || categoryMatch;  
 });

}

updateCount(filteredItems.length);
renderLatest(1);
}

function applyTagFilter(tag){
const s = qs('#searchInput');
if (s) s.value = tag; 
filterVideos(tag);
}

function openTrailerPage(it){
markUserGesture();
openAdsterraPop();
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
    markUserGesture();
    openAdsterraPop();

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

// ------------- REELS PLAYER LOGIC (UPDATED WITH SWIPE) -------------

function toEmbedUrlForReels(url){
    if (!url) return { type: 'none', src: '' };
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
        return { type: 'iframe', src: `https://www.youtube.com/embed/${y}?autoplay=1&mute=1&rel=0&controls=0&enablejsapi=1&playsinline=1&origin=${window.location.origin}` }; 
    }
    
    if (url.includes('redgifs.com/watch/') || url.includes('redgifs.com/ifr/')) {
        let videoId = url.split('/').pop(); 
        videoId = videoId.split('?')[0]; 
        // Force muted autoplay for better performance and compliance
        const embedUrl = `https://www.redgifs.com/ifr/${videoId}?autoplay=true&muted=true`; 
        return { type: 'iframe', src: embedUrl };
    }

    if (url.includes('.mp4') || url.includes('.gifv') || url.includes('.webm') || url.includes('.m3u8')) {
        return { type: 'video', src: url };
    }
    
    if (url.startsWith('http')) {
        return { type: 'iframe', src: url };
    }

    return { type: 'none', src: '' };
}


// 🛑 REVISED: Open player and load the first (random) reel
async function openReelsPlayer() {
    markUserGesture();
    openAdsterraPop();

    if (allReelCandidates.length === 0) {  
        const rawReels = await fetchSheet(SHEET_API_REELS);
        allReelCandidates = parseReelRows(rawReels);
        if (allReelCandidates.length === 0) {
             alert("No videos available for Reels playback. Check Sheet links.");
             return;
        }
    }
    
    // Reset state for a new session
    reelsQueue = shuffleArray(allReelCandidates); 
    usedReelIds.clear(); 
    currentReelIndex = -1; // Start before the first reel
    
    qs('#reelsContainer').innerHTML = ''; 
    qs('#reelsPlayer').style.display = 'flex'; 
    document.body.style.overflow = 'hidden';   

    // Load the first random reel
    loadNextReel();
}


// ✅ 2025 Ultimate Reels System
// Random, No Repeat, Swipe Up/Down + Button Next + Smooth Transition
function loadNextReel(forcedIndex = null) {
    openAdsterraPop();

    const container = qs('#reelsContainer');

    // refill queue if empty
    if (reelsQueue.length === 0) {
        if (allReelCandidates.length > 0) {
            reelsQueue = shuffleArray(allReelCandidates);
            usedReelIds.clear();
            log("🎲 New random cycle started");
        } else {
            container.innerHTML = `
              <div class="reel" style="display:flex;justify-content:center;align-items:center;color:var(--primary-color);height:100vh;text-align:center;">
                <h2>No Reels Available</h2>
                <button onclick="closeReelsPlayer()">Close Player</button>
              </div>`;
            return;
        }
    }

    // pick reel
    let item = null;
    let isForced = false;

    if (forcedIndex !== null && reelsQueue[forcedIndex]) {
        item = reelsQueue[forcedIndex];
        isForced = true;
    } else {
        while (reelsQueue.length > 0) {
            const nextItem = reelsQueue.shift();
            // Only add to used IDs if not forcing an item already in the queue (like "previous")
            if (!usedReelIds.has(nextItem.id)) {
                item = nextItem;
                break;
            }
        }
    }

    if (!item) {
        log("Queue exhausted, restarting...");
        loadNextReel();
        return;
    }

    // Update state
    if (!isForced) {
        usedReelIds.add(item.id);
        currentReelIndex++;
    }

    const embedInfo = toEmbedUrlForReels(item.reelLink);
    if (embedInfo.type === 'none') {
        loadNextReel();
        return;
    }

    // Fade animation
    container.style.transition = 'opacity 0.3s ease';
    container.style.opacity = 0;

    setTimeout(() => {
        container.innerHTML = ''; // clear old
        const reelDiv = document.createElement('div');
        reelDiv.className = 'reel';
        reelDiv.style.height = '100vh';
        reelDiv.style.overflow = 'hidden';
        reelDiv.style.touchAction = 'none';

        let mediaHtml = '';
        if (embedInfo.type === 'video') {
            mediaHtml = `<video class="reel-video-media" loop playsinline autoplay muted preload="auto" src="${escapeHtml(embedInfo.src)}"></video>`;
        } else if (embedInfo.type === 'iframe') {
            // Apply CSS hack here for RedGifs/YouTube iframes to hide bottom controls
            mediaHtml = `<iframe class="reel-video-media" src="${escapeHtml(embedInfo.src)}" allow="autoplay; fullscreen; encrypted-media" allowfullscreen></iframe>`;
        }

        // 🛑 IMPORTANT: Removed all Title/Username display elements
        reelDiv.innerHTML = `
            <div class="reel-video-embed" style="position:relative;width:100%;height:100%;">
                ${mediaHtml}
            </div>
            <div class="reel-buttons" style="position:absolute;bottom:10px;right:10px;z-index:100;">
                 <button class="next-reel-btn" style="background:rgba(255,75,145,0.8);color:#fff;padding:8px 14px;border:none;border-radius:8px;font-size:16px;font-weight:700;">Next Reel »</button>
            </div>
        `;
        
        container.appendChild(reelDiv);

        
        // Position the buttons correctly
        const nextBtnContainer = reelDiv.querySelector('.reel-buttons');
        nextBtnContainer.style.bottom = '10px';
        nextBtnContainer.style.right = '10px';
        
        const nextBtn = reelDiv.querySelector('.next-reel-btn');
        nextBtn.addEventListener('click', loadNextReel);

        const mediaEl = reelDiv.querySelector('.reel-video-media');
        if (mediaEl) {
             if (mediaEl.tagName === 'VIDEO') {
                mediaEl.play().catch(() => log("Autoplay blocked"));
                mediaEl.muted = true;
            } else if (mediaEl.tagName === 'IFRAME') {
                 // CSS in index.html will handle the hiding of inner frame elements
                 mediaEl.style.transform = 'scale(1.05)'; 
            }
        }

        // smooth fade-in
        setTimeout(() => (container.style.opacity = 1), 50);

        // 🧠 Swipe gesture handling
        let touchTarget = reelDiv.querySelector('.reel-video-embed') || container;
        touchTarget.removeEventListener('touchstart', handleTouchStart);
        touchTarget.removeEventListener('touchend', handleTouchEnd);

        touchTarget.addEventListener('touchstart', handleTouchStart);
        touchTarget.addEventListener('touchend', handleTouchEnd);

    }, 300);
}

// 🌀 Load previous reel (optional, if user swipes down)
function loadPreviousReel() {
    // Only attempt to go back if we are not on the very first reel loaded
    if (currentReelIndex > 0) {
        // Find the ID of the reel that was shown BEFORE the current one
        const allUsedIds = Array.from(usedReelIds);
        
        // Remove the ID of the reel we just saw (at currentReelIndex)
        // Note: The new item is at allUsedIds.length - 1 if we are not careful.
        // The one we want to see is at allUsedIds[currentReelIndex - 1]
        
        const prevItemCandidate = allReelCandidates.find(x => x.id === allUsedIds[currentReelIndex - 1]);
        
        if (prevItemCandidate) {
            currentReelIndex -= 2; // loadNextReel will increment this back to -1 + 1 = 0
            usedReelIds.delete(prevItemCandidate.id); // allow it to be picked again
            reelsQueue.unshift(prevItemCandidate); // put it at the start of the queue
            
            // To properly handle the back button logic, we must re-shuffle the used set
            // The logic for tracking which reel ID corresponds to which index is tricky with pure Set/Array.
            
            // Simplified logic: If we go back, we just reload the whole history based on the index.
            // THIS SIMPLIFIED LOGIC IS NOT INCLUDED IN YOUR provided snippet, but essential for a robust 'previous' reel feature.
            
            // For now, let's keep the logic simple, only allow next, as previous is complex with the shuffling logic.
            // If you insist on 'Previous', we need to completely overhaul the state management (e.g. store history array).
            
            // For now, let's just make the "swipe down" call 'loadNextReel' again to keep the flow moving, or disable it.
            loadNextReel(); 
            log("Previous reel attempted, but continuing to next for simplified logic.");

        } else {
             log("Cannot find previous reel history.");
        }
    } else {
        log("No previous reel available (first reel loaded).");
    }
}

function handleTouchStart(e){
    swipeStartY = e.touches[0].clientY;
}

function handleTouchEnd(e){
    const swipeEndY = e.changedTouches[0].clientY;
    const diffY = swipeStartY - swipeEndY;
    if (Math.abs(diffY) > 80) { // threshold
        if (diffY > 0) {
            // swipe up → next reel
            loadNextReel();
        } else {
            // swipe down → previous reel (or just next, as "previous" is complex)
            // loadPreviousReel(); // Removed complex 'previous' logic
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
    currentReelIndex = -1; // Reset index
}


// ------------- INIT / BOOT -------------
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

function updateCount(n){
const c = qs('#count');
if (c) c.textContent = `${n} items`;
}

function markUserGesture(){
userInteracted = true;
}

function setupGestureListener(){
['click', 'touchstart', 'keydown'].forEach(e => {
document.addEventListener(e, markUserGesture, {once: true});
});
}

loadAll();
