// script.js
// Dareloom Hub - Complete player + sheet + pagination + preview/watch + tags + random
// 2025-10-23 (FINAL FIX: Single Reel View with Next Button)

// ------------- CONFIG -------------
// Sheet 1 for Main Content (Latest List & Random Grid)
const SHEET_API = "https://sheets.googleapis.com/v4/spreadsheets/1A2I6jODnR99Hwy9ZJXPkGDtAFKfpYwrm3taCWZWoZ7o/values/Sheet1?alt=json&key=AIzaSyBFnyqCW37BUL3qrpGva0hitYUhxE_x5nw";
// Sheet 3 (Reels) API: Assuming Link is now in column A or B
const SHEET_API_REELS = "https://sheets.googleapis.com/v4/spreadsheets/1A2I6jODnR99Hwy9ZJXPkGDtAFKfpYwrm3taCWZWoZ7o/values/Sheet3!A:B?alt=json&key=AIzaSyBFnyqCW37BUL3qrpGva0hitYUhxE_x5nw"; 
const PER_PAGE = 5;
const RANDOM_COUNT = 4;
// REELS_LOAD_COUNT is no longer needed

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
let allReelCandidates = []; // Full list of items suitable for reels
let usedReelIds = new Set(); // Track reels played in the current cycle for duplication prevention

// OLD REELS STATE REMOVED: reelsObserver, currentPlayingReel

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

function parseRows(values){
// ... (Existing Sheet1 parsing logic - no change needed here) ...
if (!values || values.length < 2) return [];
const headers = (values[0]||[]).map(h => (h||'').toString().toLowerCase().trim());
const find = (names) => {
for (let n of names){
const i = headers.indexOf(n);
if (i !== -1) return i;
}
return -1;
};

// Use your custom column indices based on your previous description  
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
    const rawWatch = (r[WA] || '').toString().trim(); // Full comma-separated links   
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
        watch: rawWatch || '',  // Full comma-separated string
        telegram: telegramLink || '', 
        poster: poster || '',  
        date: date || '',  
        category: category || '',  
        description: description || ''  
    });  
}  
return out.reverse(); 
// ... (End of existing Sheet1 parsing logic) ...
}


// 🛑 UPDATED: Reels Sheet parsing for Link column (B) only
function parseReelRows(values){
    if (!values || values.length < 2) return [];
    
    // Assuming Sheet3 has two columns: [Title/Empty, Reel Link]
    const rows = values.slice(1);  
    const out = [];  
    let untitledCounter = 1;

    for (let r of rows){  
        r = Array.isArray(r) ? r : [];  
        
        // Col 0 (A): Title/Empty
        // Col 1 (B): Reel Link
        const titleCandidate = (r[0] || '').toString().trim();  
        let reelLink = (r[1] || '').toString().trim(); 

        // If Col B is empty, check Col A as a fallback link source (in case user only left one column)
        if (!reelLink) {
             reelLink = titleCandidate;
        }

        const title = titleCandidate || ('Untitled Reel '+untitledCounter);

        if (!reelLink) continue;  

        const id = `${slugify(title)}|${Math.random().toString(36).slice(2,8)}`;  
        untitledCounter++;

        out.push({  
            id,  
            title: title,  
            reelLink: reelLink, // The primary link for embed
        });  
    }  
    return out; 
}


// ------------- UI / RENDER FUNCTIONS (Mostly Unchanged) -------------
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
// ... (Render latest logic remains the same) ...
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
    // CLICK LISTENER: Add click to item for details
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
// ... (Pagination logic remains the same) ...
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
// ... (End of Pagination logic) ...
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

// ------------- FILTER LOGIC (UNCHANGED) -------------
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

// ------------- TRAILER/WATCH PAGE LOGIC (UNCHANGED) -------------

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

// ------------- REELS PLAYER LOGIC (UPDATED FOR NEXT BUTTON) -------------

// Helper to convert raw URL/HTML to embeddable src
function toEmbedUrlForReels(url){
    if (!url) return { type: 'none', src: '' };
    url = url.trim();

    // 1. Iframe SRC Extraction
    if (url.startsWith('<iframe') && url.includes('src=')) {
        const match = url.match(/src=['"](.*?)['"]/i);
        if (match && match[1]) {
            return toEmbedUrlForReels(match[1]);
        }
    }

    // 2. YouTube Link (Added mute=1 for best autoplay chance)
    const y = extractYouTubeID(url);
    if (y) {
        return { type: 'iframe', src: `https://www.youtube.com/embed/${y}?autoplay=1&mute=1&rel=0&controls=0&enablejsapi=1&playsinline=1&origin=${window.location.origin}` }; 
    }
    
    // 3. RedGifs Iframe Link 
    if (url.includes('redgifs.com/watch/') || url.includes('redgifs.com/ifr/')) {
        let videoId = url.split('/').pop(); 
        videoId = videoId.split('?')[0]; 
        const embedUrl = `https://www.redgifs.com/ifr/${videoId}?autoplay=true&muted=true`; // Added autoplay/mute for ifr
        return { type: 'iframe', src: embedUrl };
    }

    // 4. Direct Video (MP4/WEBM/Gfycat)
    if (url.includes('.mp4') || url.includes('.gifv') || url.includes('.webm') || url.includes('.m3u8')) {
        return { type: 'video', src: url };
    }
    
    // 5. General Porn Site Link (Treat all other HTTP/HTTPS links as potential Iframe SRC)
    if (url.startsWith('http')) {
        return { type: 'iframe', src: url };
    }

    return { type: 'none', src: '' };
}


// 🛑 NEW: Open player and load the first reel
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
    
    // Setup initial queue for a full random, non-repeating cycle
    reelsQueue = shuffleArray(allReelCandidates); 
    usedReelIds.clear(); 
    
    qs('#reelsContainer').innerHTML = ''; 
    qs('#reelsPlayer').style.display = 'flex'; // Use flex to center the single reel
    document.body.style.overflow = 'hidden';   

    // Load the first reel
    loadNextReel();
}

// 🛑 NEW CORE FUNCTION: Load the next random, non-repeating reel
function loadNextReel() {
    openAdsterraPop(); // Ad pop on every click

    const container = qs('#reelsContainer');
    
    // 1. Refill queue if empty
    if (reelsQueue.length === 0) {
        if (allReelCandidates.length > 0) {
            reelsQueue = shuffleArray(allReelCandidates);
            usedReelIds.clear(); 
            log("Reels cycle complete. Refilling queue.");
        } else {
            container.innerHTML = `<div class="reel" style="display:flex; justify-content:center; align-items:center; color:var(--primary-color); text-align:center;">
                <h2>End of Reels!</h2>
                <div class="reel-buttons" style="position:absolute; bottom:0;">
                    <div class="reel-buttons-group">
                        <button onclick="closeReelsPlayer()">Close Player</button>
                    </div>
                </div>
            </div>`;
            return;
        }
    }
    
    // 2. Get next reel
    let item = null;
    while (reelsQueue.length > 0) {
        const nextItem = reelsQueue.shift();
        if (!usedReelIds.has(nextItem.id)) {
            item = nextItem;
            break;
        }
    }

    if (!item) {
        // If the loop failed to find an item (shouldn't happen after refill), try again.
        loadNextReel(); 
        return;
    }

    usedReelIds.add(item.id); 

    // 3. Prepare the embed
    const it = item;
    const embedInfo = toEmbedUrlForReels(it.reelLink);
    
    if (embedInfo.type === 'none') {
        log("Invalid embed link, skipping to next reel.");
        loadNextReel(); // Skip this item and load the next one
        return;
    }
    
    // 4. Render the single reel
    container.innerHTML = ''; // Clear previous reel
    
    const reelDiv = document.createElement('div');  
    reelDiv.className = 'reel'; 
    
    // Buttons: Watch Full Link (using the reel link) and Next Reel
    const watchButton = `<button class="watch-reel-btn" data-link="${escapeHtml(it.reelLink)}">Watch Full Video / Open Link</button>`;  
    const nextButton = `<button class="next-reel-btn">Next Reel »</button>`;  
    
    let mediaHtml;
    let mediaElType;

    if (embedInfo.type === 'video') {
        // HTML5 Video: Use autoplay/muted attributes
        mediaHtml = `
            <video class="reel-video-media" loop playsinline autoplay muted preload="auto" src="${escapeHtml(embedInfo.src)}" poster="https://placehold.co/480x800?text=Loading+Reel">
                Your browser does not support the video tag.
            </video>`;
        mediaElType = 'video';
    } else if (embedInfo.type === 'iframe') {
        // Iframe: Load src with autoplay/mute parameters
        mediaHtml = `
            <iframe class="reel-video-media" src="${escapeHtml(embedInfo.src)}" 
                    data-type="iframe" allow="autoplay; fullscreen; encrypted-media; picture-in-picture"  
                    allowfullscreen loading="eager" frameborder="0">
            </iframe>`;
        mediaElType = 'iframe';
    } else {
        return; 
    }


    reelDiv.innerHTML = `  
        <div class="reel-video-embed" data-media-type="${mediaElType}">  
            ${mediaHtml}
        </div>  
        <div class="reel-buttons">  
            <div style="padding: 0 0 10px 0; font-size: 1rem; color: var(--primary-color); font-weight: 600;">${escapeHtml(it.title)}</div>  
            <div class="reel-buttons-group">  
                ${watchButton}
                ${nextButton}
            </div>  
        </div>
    `;  
    container.appendChild(reelDiv);
    
    // 5. Attach listeners
    qs('.next-reel-btn').addEventListener('click', loadNextReel);
    qs('.watch-reel-btn').addEventListener('click', (e) => {
        const link = e.currentTarget.dataset.link;
        openWatchPage(link); 
    });
    
    // 6. Handle media play/unmute
    const mediaEl = qs('.reel-video-media');
    if (mediaEl && mediaEl.tagName === 'VIDEO') {
        mediaEl.muted = true;
        mediaEl.play().then(() => {
            // Autoplay successful, try to unmute after a small delay
            setTimeout(() => { mediaEl.muted = false; }, 500);
        }).catch(e => {
            // Autoplay blocked, keep muted and try again
            mediaEl.muted = true;
            mediaEl.play().catch(e => log("Video autoplay blocked, keeping muted.", e));
        });
    }
}

// 🛑 UPDATED: Clean up logic for static player
function closeReelsPlayer(){
    const player = qs('#reelsPlayer');
    if(player) player.style.display = 'none';
    document.body.style.overflow = '';

    // Stop playback of the single current reel
    const mediaEl = qs('#reelsContainer .reel-video-media');  
    if (mediaEl) {
        if (mediaEl.tagName === 'VIDEO') {
            mediaEl.pause();
            mediaEl.currentTime = 0;
            mediaEl.muted = true; 
        } else if (mediaEl.tagName === 'IFRAME') {
            // Clear iframes to stop them from running in the background
            mediaEl.src = 'about:blank'; 
        }
    }
    
    usedReelIds.clear(); // Clear used IDs on close
}


// OLD REEL OBSERVER FUNCTIONS REMOVED:
// - setupReelsObserver
// - controlMedia
// - setupInfiniteScrollObserver


// ------------- INIT / BOOT (UNCHANGED) -------------
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
