// script.js
// Dareloom Hub - Complete player + sheet + pagination + preview/watch + tags + random
// 2025-10-21 (FINAL FIX: Full Duration Reels, Unmute, LocalStorage Scope)

// ------------- CONFIG -------------
const SHEET_API = "https://sheets.googleapis.com/v4/spreadsheets/1A2I6jODnR99Hwy9ZJXPkGDtAFKfpYwrm3taCWZWoZWo7o/values/Sheet1?alt=json&key=AIzaSyBFnyqCW37BUL3qrpGva0hitYUhxE_x5nw";
const PER_PAGE = 5;
const RANDOM_COUNT = 4;
// Reels Config
const REELS_LOAD_COUNT = 8; // Number of reels to load initially/per batch

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
let reelsShownIndices = new Set();
let allReelCandidates = []; // Full list of items suitable for reels
let reelsObserver;

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
async function fetchSheet(){
try{
const res = await fetch(SHEET_API);
if (!res.ok) throw new Error('sheet fetch failed ' + res.status);
const j = await res.json();
return j.values || [];
}catch(e){
console.error("Sheet fetch error:", e);
return [];
}
}

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

    // 🛑 FIX 1: Removed logic that prioritizes Streamtape or filters links. 
    // We must store the full string for watch.html to use its priority logic.

    // Check for content using the raw, unfiltered watch links
    if ((!trailer || trailer.length === 0) && (!rawWatch || rawWatch.length === 0)) continue;  

    const id = `${slugify(title)}|${Math.random().toString(36).slice(2,8)}`;  

    out.push({  
        id,  
        title: title || 'Untitled',  
        trailer: trailer || '',  
        watch: rawWatch || '',  // 🛑 FIXED: Stores the full comma-separated string
        telegram: telegramLink || '', // Kept for Reels button
        poster: poster || '',  
        date: date || '',  
        category: category || '',  
        description: description || ''  
    });  
}  
// NEW TO OLD: Reversing ensures the newest data (at the bottom of the sheet) is first.
return out.reverse(); 

}

// ------------- RENDER / UI -------------
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
      
    // 🛑 Note: data-url now contains the full comma-separated list of links (it.watch)
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
e.stopPropagation(); // Stop propagation to prevent item click from firing twice
const id = e.currentTarget.dataset.id;
const it = items.find(x => x.id === id); 
if (!it) return;
openTrailerPage(it);
}

function onWatchClick(e){
markUserGesture();
e.stopPropagation(); // Stop propagation
const url = e.currentTarget.dataset.url; // This now holds the full comma-separated list
if (!url) return;
openWatchPage(url);
}

function onTagClick(e){
markUserGesture();
e.stopPropagation(); // Stop propagation
const tag = e.currentTarget.dataset.tag;
if (!tag) return;
applyTagFilter(tag);
}

// ------------- FILTER LOGIC (UPDATED) -------------
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

// ------------- TRAILER/WATCH PAGE LOGIC -------------

function openTrailerPage(it){
markUserGesture();
openAdsterraPop();
// Using full relative path to ensure navigation works
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

    // 🛑 CRITICAL FIX 2: Redirect to the watch.html page with the entire link string.
    // We keep the /go.html ad-gate logic by setting the final destination as the target.
    const finalDestination = `/watch?url=${encodeURIComponent(fullWatchLinks)}`;
    const redirectPage = `/go.html?target=${encodeURIComponent(finalDestination)}`;    

    setTimeout(()=> {  
        try {  
            // Use window.open to respect the user's pop-up ad-gate monetization flow
            const w = window.open(redirectPage, '_blank');    
            if (!w || w.closed || typeof w.closed === 'undefined'){    
                alert("Please allow pop-ups to open the link in a new tab!");    
            }    
        } catch(e){    
            console.error(e);    
        }  
    }, 120);
}

// ------------- REELS PLAYER LOGIC (UPDATED FOR BETTER SCROLL) -------------

function shuffleArray(array) {
const arr = array.slice();
for (let i = arr.length - 1; i > 0; i--) {
const j = Math.floor(Math.random() * (i + 1));
[arr[i], arr[j]] = [arr[i], arr[j]];
}
return arr;
}

function toEmbedUrlForReels(url){
if (!url) return '';
url = url.trim();
const y = extractYouTubeID(url);
// 🛑 FIX: autoplay=0 (rely on API), removed mute=1 (allows sound), controls=1 (user control)
if (y) return `https://www.youtube.com/embed/${y}?autoplay=0&rel=0&controls=1&enablejsapi=1&playsinline=1&origin=${window.location.origin}`; 

// Check if Streamtape is in the comma-separated list
if (url.includes('streamtape.com') && url.includes('/v/')){  
    // This is complex for a comma-separated list, but we'll prioritize the first Streamtape link if multiple are present
    const streamtapeMatch = url.split(',').find(link => link.includes('streamtape.com') && link.includes('/v/'));
    if (streamtapeMatch) {
        const id = streamtapeMatch.split('/v/')[1]?.split('/')[0];  
        if (id) return `https://streamtape.com/e/${id}/`;  
    }
}  
  
if (url.startsWith('http')) {  
    return url.split(',')[0].trim(); // Use the first URL for generic embed
}  
return '';
}

function openReelsPlayer() {
markUserGesture();
openAdsterraPop();

if (allReelCandidates.length === 0) {  
    // Filter for items that actually have a usable trailer/watch link for reels
    allReelCandidates = items.filter(it => toEmbedUrlForReels(it.trailer || it.watch));  
}  

// Initial shuffle and reset queue
reelsQueue = shuffleArray(allReelCandidates);   
if (reelsQueue.length === 0) {
    alert("No videos available for Reels playback.");
    return;
}

const container = qs('#reelsContainer');  
container.innerHTML = '';   

loadReelsBatch(); // Load first batch

qs('#reelsPlayer').style.display = 'block';  
document.body.style.overflow = 'hidden';   

setupReelsObserver();
setupInfiniteScrollObserver();

}

function loadReelsBatch() {
const container = qs('#reelsContainer');
let itemsToLoad = [];
let loadCount = 0;

while (loadCount < REELS_LOAD_COUNT) {  
    if (reelsQueue.length === 0) {  
        // Re-shuffle and start a new cycle when queue is exhausted (infinite scroll)
        if (allReelCandidates.length > 0) {  
             reelsQueue = shuffleArray(allReelCandidates);  
        } else {  
             break; // No candidates available
        }  
    }  

    if (reelsQueue.length > 0) {  
        itemsToLoad.push(reelsQueue.shift());   
        loadCount++;  
    }  
}  

itemsToLoad.forEach(it => {  
    // toEmbedUrlForReels uses a single URL (trailer or first watch link)
    const embedUrl = toEmbedUrlForReels(it.trailer || it.watch);  
    if (!embedUrl) return;   
      
    const reelDiv = document.createElement('div');  
    reelDiv.className = 'reel';  
      
    const telegramBtn = it.telegram ?   
        `<button onclick="window.open('${it.telegram}', '_blank')">Download Telegram</button>` : '';  

    // Since it.watch now holds ALL links, we pass the full string to openWatchPage
    const openPlayerBtn = it.watch ?  
        `<button onclick="openWatchPage('${it.watch.replace(/'/g, "\\'")}')">Open Player</button>` :  
        `<button onclick="openTrailerPage('${it.id}')">View Details</button>`;  

    const iframeType = embedUrl.includes('youtube') ? 'youtube' : 'other';  

    reelDiv.innerHTML = `  
        <div class="reel-video-embed">  
            <iframe src="${escapeHtml(embedUrl)}"   
                    frameborder="0"   
                    data-type="${iframeType}"  
                    data-original-src="${escapeHtml(embedUrl)}"  allow="autoplay; fullscreen; encrypted-media; picture-in-picture"  
                    allowfullscreen   
                    loading="lazy">  
            </iframe>  
        </div>  
        <div class="reel-buttons">  
            <div style="padding: 0 0 10px 0; font-size: 1rem; color: var(--primary-color); font-weight: 600;">${escapeHtml(it.title)}</div>  
            <div class="reel-buttons-group">  
                ${openPlayerBtn}  
                ${telegramBtn}  
            </div>  
        </div>  
        <div class="reel-load-more-marker" style="height:1px;"></div>   
    `;  
    container.appendChild(reelDiv);  
      
    // Attach observer only to the reel div
    if (reelsObserver) reelsObserver.observe(reelDiv);   
});  

}

function closeReelsPlayer(){
const player = qs('#reelsPlayer');
if(player) player.style.display = 'none';
document.body.style.overflow = '';

qsa('#reelsPlayer iframe').forEach(iframe => {  
    // Stop playback for YouTube iframes specifically
    if (iframe.dataset.type === 'youtube' && iframe.contentWindow) {
        iframe.contentWindow.postMessage('{"event":"command","func":"stopVideo","args":""}', '*');
    }
    iframe.src = 'about:blank'; // Clear other iframes
});  
  
if (reelsObserver) {  
    reelsObserver.disconnect();  
    reelsObserver = null;  
}
}

function setupReelsObserver() {
if (reelsObserver) {
    reelsObserver.disconnect();
}

const options = {  
    root: qs('#reelsPlayer'),   
    rootMargin: '0px',  
    // Threshold set to 0.7 for reliable play/pause
    threshold: 0.7   
};  

reelsObserver = new IntersectionObserver((entries, observer) => {  
    entries.forEach(entry => {  
        if (entry.target.classList.contains('reel-load-more-marker')) return;   

        const iframe = entry.target.querySelector('iframe');  
        if (!iframe) return;  
        
        const originalUrl = iframe.dataset.originalSrc; // Get the original URL

        if (entry.isIntersecting) {
            // Video is visible
            if (iframe.dataset.type === 'youtube') {  
                iframe.contentWindow.postMessage('{"event":"command","func":"playVideo","args":""}', '*');  
            } else if (iframe.src === 'about:blank' && originalUrl) {
                // For Streamtape/Other: reload the source if cleared
                iframe.src = originalUrl;
            }
        } else {  
            // Video is not visible (scrolled away)
            if (iframe.dataset.type === 'youtube') {  
                iframe.contentWindow.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*');  
            } 
            // 🛑 FIX 3: Removed iframe.src = 'about:blank' for non-YouTube players to improve scroll performance.
        }  
    });  
}, options);  

qsa('#reelsContainer .reel').forEach(reel => {  
    reelsObserver.observe(reel);  
});
}

function setupInfiniteScrollObserver() {
    // The marker is inside the last added reel.
    const marker = qs('#reelsContainer .reel:last-child .reel-load-more-marker');

    if (marker) {  
        const loadMoreObserver = new IntersectionObserver((entries, observer) => {  
            entries.forEach(entry => {  
                if (entry.isIntersecting) {  
                    observer.unobserve(entry.target);   
                    loadReelsBatch(); // Load next batch
                }  
            });  
        }, { root: qs('#reelsPlayer'), threshold: 0.5 });   
          
        loadMoreObserver.observe(marker);  
    }
}


// ------------- INIT / BOOT -------------
async function loadAll(){
    const raw = await fetchSheet();
    const parsed = parseRows(raw);
    items = parsed;
    filteredItems = parsed; // Initial filter is all items

    // 🛑 CORRECT LOCATION: Save data for trailer.html after fetching.
    localStorage.setItem('dareloom_items', JSON.stringify(items)); 

    renderLatest(1);   
    renderRandom(); // Keep rendering random section

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

// 🛑 REMOVED: showRandomPick() function is no longer called/needed

loadAll();
