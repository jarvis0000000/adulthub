// script.js
// Dareloom Hub - Complete player + sheet + pagination + preview/watch + tags + random
// 2025-10-23 (FINAL FIX: Multi-Link Embed, Duplication, Smooth Playback/Sound)

// ------------- CONFIG -------------
// Sheet 1 for Main Content (Latest List & Random Grid)
const SHEET_API = "https://sheets.googleapis.com/v4/spreadsheets/1A2I6jODnR99Hwy9ZJXPkGDtAFKfpYwrm3taCWZWoZ7o/values/Sheet1?alt=json&key=AIzaSyBFnyqCW37BUL3qrpGva0hitYUhxE_x5nw";
// ✅ FIXED: Sheet 3 (Reels) API using your provided Spreadsheet ID (1A2I6jODnR99Hwy9ZJXPkGDtAFKfpYwrm3taCWZWoZ7o)
const SHEET_API_REELS = "https://sheets.googleapis.com/v4/spreadsheets/1A2I6jODnR99Hwy9ZJXPkGDtAFKfpYwrm3taCWZWoZ7o/values/Sheet3!A:B?alt=json&key=AIzaSyBFnyqCW37BUL3qrpGva0hitYUhxE_x5nw"; 
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
let allReelCandidates = []; // Full list of items suitable for reels
let reelsObserver;
let currentPlayingReel = null; // Track the currently playing element
let usedReelIds = new Set(); // NEW: Track reels played in the current cycle for duplication prevention

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

// ------------- SHEET FETCH & PARSE (UPDATED) -------------
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

// (Existing parseRows function for Sheet1 remains here)
function parseRows(values){
// ... (Existing Sheet1 parsing logic) ...
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
// NEW TO OLD: Reversing ensures the newest data (at the bottom of the sheet) is first.
return out.reverse(); 
// ... (End of existing Sheet1 parsing logic) ...
}


// 🛑 FINAL FIX: Reels Sheet parsing (Added 'video' to supported headers)
function parseReelRows(values){
    if (!values || values.length < 2) return [];
    const headers = (values[0]||[]).map(h => (h||'').toString().toLowerCase().trim());
    const find = (names) => {
        for (let n of names){
            const i = headers.indexOf(n);
            if (i !== -1) return i;
        }
        return -1;
    };

    // FIX: Added 'video' to supported headers
    const TI = find(['title','name']) !== -1 ? find(['title','name']) : 0;  
    const VL = find(['video nam','link','reel link', 'video']) !== -1 ? find(['video nam','link','reel link', 'video']) : 1; 

    const rows = values.slice(1);  
    const out = [];  
    let untitledCounter = 1;

    for (let r of rows){  
        r = Array.isArray(r) ? r : [];  
        const title = (r[TI] || '').toString().trim();  
        const reelLink = (r[VL] || '').toString().trim(); // Direct video link (RedGifs, MP4, etc.)

        if (!reelLink) continue;  

        const id = `${slugify(title || 'untitled-reel-'+untitledCounter)}|${Math.random().toString(36).slice(2,8)}`;  
        untitledCounter++;

        out.push({  
            id,  
            title: title || 'Untitled Reel',  
            reelLink: reelLink, // The primary link for embed
            watch: '',          // No full watch link needed from this sheet
            telegram: '',       // No telegram link needed from this sheet
        });  
    }  
    // 🛑 CRITICAL: Do NOT shuffle here. Shuffle when opening the player.
    return out; 
}


// (Existing RENDER / UI functions remain here)
function renderTagsForItem(it){
if (!it.category || !it.category.trim()) return '';
const parts = it.category.split(',').map(p => p.trim()).filter(Boolean);
return parts.map(p => `<button class="tag-btn" data-tag="${escapeHtml(p)}">#${escapeHtml(p)}</button>`).join(' ');
}
// ... (renderRandom, renderLatest, renderPagination, changePage, attachLatestListeners, 
//      onPreviewClick, onWatchClick, onTagClick, filterVideos, applyTagFilter 
//      remain the same) ...

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

    // fullWatchLinks is now the full string: link1,link2,link3...
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

// 🛑 FINAL FIX: Comprehensive link handling for RedGifs, Iframe code, YouTube, and other embeds.
function toEmbedUrlForReels(url){
    if (!url) return { type: 'none', src: '' };
    url = url.trim();

    // 1. Iframe SRC Extraction (Handles the full HTML code the user pasted)
    // If the content starts with <iframe, extract the src and process it recursively.
    if (url.startsWith('<iframe') && url.includes('src=')) {
        const match = url.match(/src=['"](.*?)['"]/i);
        if (match && match[1]) {
            // Process the extracted SRC again (e.g., if it's a YouTube or RedGifs link)
            return toEmbedUrlForReels(match[1]);
        }
    }

    // 2. YouTube Link (Handle first for clean extraction)
    const y = extractYouTubeID(url);
    if (y) {
        // Mute=1 is essential for guaranteed autoplay
        return { type: 'iframe', src: `https://www.youtube.com/embed/${y}?autoplay=1&mute=1&rel=0&controls=0&enablejsapi=1&playsinline=1&origin=${window.location.origin}` }; 
    }
    
    // 3. RedGifs Iframe Link (Watch or IFR)
    if (url.includes('redgifs.com/watch/') || url.includes('redgifs.com/ifr/')) {
        let videoId = url.split('/').pop(); 
        videoId = videoId.split('?')[0]; 
        
        // Convert 'watch' to 'ifr' format for guaranteed iframe embed
        const embedUrl = `https://www.redgifs.com/ifr/${videoId}`; 
        
        return { type: 'iframe', src: embedUrl };
    }

    // 4. Direct Video (MP4/WEBM/Gfycat)
    if (url.includes('.mp4') || url.includes('.gifv') || url.includes('.webm') || url.includes('.m3u8')) {
        return { type: 'video', src: url };
    }
    
    // 5. General Porn Site Link (Treat all other HTTP/HTTPS links as potential Iframe SRC)
    // This allows other embed links (Pornhub, Xvideos, etc.) to be attempted as an Iframe source.
    if (url.startsWith('http')) {
        return { type: 'iframe', src: url };
    }

    // Default Fallback
    return { type: 'none', src: '' };
}


// 🛑 UPDATED: Load reel data and handle media types
async function openReelsPlayer() {
    markUserGesture();
    openAdsterraPop();

    // 🛑 CRITICAL: Fetch and parse reels only once, then use for infinite scroll.
    if (allReelCandidates.length === 0) {  
        const rawReels = await fetchSheet(SHEET_API_REELS);
        allReelCandidates = parseReelRows(rawReels);
        if (allReelCandidates.length === 0) {
             alert("No videos available for Reels playback. Check Sheet2 links.");
             return;
        }
    }
    
    // 🛑 CRITICAL: Reset used list and shuffle candidates on every open for a new random cycle.
    reelsQueue = shuffleArray(allReelCandidates); 
    usedReelIds.clear(); // Ensure fresh cycle

    if (reelsQueue.length === 0) {
        alert("No videos available for Reels playback.");
        return;
    }

    const container = qs('#reelsContainer');  
    container.innerHTML = '';   
    currentPlayingReel = null; // Reset playback tracker

    loadReelsBatch(); // Load first batch

    qs('#reelsPlayer').style.display = 'block';  
    document.body.style.overflow = 'hidden';   

    setupReelsObserver();
    setupInfiniteScrollObserver();
}

// 🛑 FINAL FIX: Load reels smoothly, preventing immediate duplication
function loadReelsBatch() {
    const container = qs('#reelsContainer');
    let itemsToLoad = [];
    let loadCount = 0;

     // Logic to refill the queue only after the current batch is exhausted
    if (reelsQueue.length === 0 || (reelsQueue.length < REELS_LOAD_COUNT && usedReelIds.size >= allReelCandidates.length)) {
        // If queue is empty AND we have candidates, refill and shuffle
        if (allReelCandidates.length > 0) {
            reelsQueue = shuffleArray(allReelCandidates);
            usedReelIds.clear(); // Reset the used list after one full cycle
        } else {
            return; // No candidates available
        }
    }

    while (loadCount < REELS_LOAD_COUNT) {
        if (reelsQueue.length === 0) break; 

        const item = reelsQueue.shift();

        // Skip if already played in the current cycle
        if (usedReelIds.has(item.id)) continue; 

        const embedInfo = toEmbedUrlForReels(item.reelLink); 
        if (embedInfo.type !== 'none') {
            itemsToLoad.push({ ...item, embedInfo });
            usedReelIds.add(item.id); // Mark as used
            loadCount++;
        }
    }
    
    itemsToLoad.forEach(it => {  
        const reelDiv = document.createElement('div');  
        reelDiv.className = 'reel';  
        
        const openPlayerBtn = `<button onclick="alert('Watch button not fully configured for Reel Links.');">Watch Link</button>`;  
        const telegramBtn = ``; 
        

        let mediaHtml;
        let mediaElType;

        if (it.embedInfo.type === 'video') {
            // Removed 'muted' attribute from HTML to allow unmuting via JS
            mediaHtml = `
                <video class="reel-video-media" loop playsinline preload="none" data-src="${escapeHtml(it.embedInfo.src)}" poster="https://placehold.co/480x800?text=Loading+Reel">
                    <source src="${escapeHtml(it.embedInfo.src)}" type="video/mp4">
                    Your browser does not support the video tag.
                </video>`;
            mediaElType = 'video';
        } else if (it.embedInfo.type === 'iframe') {
            // Use iframe for YouTube/RedGifs embed
            mediaHtml = `
                <iframe class="reel-video-media" src="about:blank" data-src="${escapeHtml(it.embedInfo.src)}" 
                        data-type="iframe" allow="autoplay; fullscreen; encrypted-media; picture-in-picture"  
                        allowfullscreen loading="lazy" frameborder="0">
                </iframe>`;
            mediaElType = 'iframe';
        } else {
            return; // Skip if no valid embed
        }


        reelDiv.innerHTML = `  
            <div class="reel-video-embed" data-media-type="${mediaElType}">  
                ${mediaHtml}
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
        
        // Attach observer only to the NEW reel div
        if (reelsObserver) reelsObserver.observe(reelDiv);   
    });
    
    // Attach infinite scroll observer to the last element added
    setupInfiniteScrollObserver();
}

function closeReelsPlayer(){
    const player = qs('#reelsPlayer');
    if(player) player.style.display = 'none';
    document.body.style.overflow = '';

    qsa('#reelsPlayer .reel-video-media').forEach(mediaEl => {  
        if (mediaEl.tagName === 'VIDEO') {
            mediaEl.pause();
            mediaEl.currentTime = 0;
            mediaEl.muted = true; // Mute on close
        } else if (mediaEl.tagName === 'IFRAME') {
            // Stop playback for YouTube iframes specifically
            if (mediaEl.src.includes('youtube')) {
                mediaEl.contentWindow.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*');
            }
            // Clear other iframes to stop them from running in the background
            mediaEl.src = 'about:blank'; 
        }
    });  
    
    if (reelsObserver) {  
        reelsObserver.disconnect();  
        reelsObserver = null;  
    }
    currentPlayingReel = null;
    usedReelIds.clear(); // Clear used IDs on close
}

// 🛑 FINAL FIX: New Intersection Observer logic for Smooth Video/Iframe control
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

            const mediaEl = entry.target.querySelector('.reel-video-media');  
            if (!mediaEl) return;  
            
            if (entry.isIntersecting) {
                if (currentPlayingReel && currentPlayingReel !== mediaEl) {
                    // Pause the previously playing reel
                    controlMedia(currentPlayingReel, 'pause');
                }
                
                // Play the current reel after a slight delay to ensure smooth transition
                setTimeout(() => {
                    if (entry.isIntersecting) { // Re-check if still visible
                        controlMedia(mediaEl, 'play');
                        currentPlayingReel = mediaEl;
                    }
                }, 100);

            } else {
                // Video is not visible (scrolled away)
                controlMedia(mediaEl, 'pause');
                if (currentPlayingReel === mediaEl) {
                    currentPlayingReel = null;
                }
            }  
        });  
    }, options);  

    qsa('#reelsContainer .reel').forEach(reel => {  
        reelsObserver.observe(reel);  
    });
}

// 🛑 FINAL FIX: Helper to control media elements with better mute/unmute logic for smooth transition
function controlMedia(mediaEl, action) {
    if (!mediaEl) return;

    if (mediaEl.tagName === 'VIDEO') {
        // Load src only on first play attempt
        if (mediaEl.dataset.src && !mediaEl.src) {
             mediaEl.src = mediaEl.dataset.src;
             mediaEl.load();
        }
        if (action === 'play') {
            // Start muted for guaranteed autoplay, then try to unmute.
            mediaEl.muted = true; 
            mediaEl.play().then(() => {
                // If play succeeds, try to unmute. This depends on a user gesture having occurred.
                mediaEl.muted = false; // Attempt to unmute for sound
            }).catch(e => {
                // If autoplay is blocked (usually because sound is required)
                mediaEl.muted = true; 
                mediaEl.play().catch(e => console.warn("Video autoplay/sound blocked:", e));
            });
        } else if (action === 'pause') {
            mediaEl.pause();
            mediaEl.currentTime = 0; // Rewind on pause for smooth replay
            mediaEl.muted = true; // Ensure it's muted when paused
        }
    } else if (mediaEl.tagName === 'IFRAME') {
        // Load src only on first play attempt
        if (mediaEl.dataset.src && mediaEl.src === 'about:blank') {
             mediaEl.src = mediaEl.dataset.src;
        }

        // YouTube specific control via postMessage
        if (mediaEl.src.includes('youtube')) {
            const command = action === 'play' ? 'playVideo' : 'pauseVideo';
            // PostMessage to play/pause the YouTube video
            mediaEl.contentWindow.postMessage(`{"event":"command","func":"${command}","args":""}`, '*');
        } else if (action === 'play') {
            // For other iframes (RedGifs IFR), simply refreshing the source often forces autoplay.
            // This is a common workaround for Iframe-based embeds.
            if (mediaEl.src === 'about:blank' || mediaEl.src === mediaEl.dataset.src) {
                 mediaEl.src = mediaEl.dataset.src;
            }
        }
    }
}


function setupInfiniteScrollObserver() {
    // The marker is inside the last added reel.
    const marker = qs('#reelsContainer .reel:last-child .reel-load-more-marker');

    if (marker) {  
        // Ensure old observer is disconnected if present
        if (window.loadMoreObserver) {
            window.loadMoreObserver.disconnect();
        }
        
        const loadMoreObserver = new IntersectionObserver((entries, observer) => {  
            entries.forEach(entry => {  
                if (entry.isIntersecting) {  
                    observer.unobserve(entry.target);   
                    loadReelsBatch(); // Load next batch
                }  
            });  
        }, { root: qs('#reelsPlayer'), threshold: 0.5 });   
          
        loadMoreObserver.observe(marker);
        window.loadMoreObserver = loadMoreObserver; // Save observer reference
    }
}

// ------------- INIT / BOOT -------------
async function loadAll(){
    const raw = await fetchSheet(SHEET_API); // Fetch main sheet
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

loadAll();
