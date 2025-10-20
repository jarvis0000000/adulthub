// script.js
// Dareloom Hub - Complete player + sheet + pagination + preview/watch + tags + random
// 2025-10-20 (UPDATED: Pagination, Unlimited Reels, Tag/Search Filter Fix)

// ------------- CONFIG -------------
const SHEET_API = "https://sheets.googleapis.com/v4/spreadsheets/1A2I6jODnR99Hwy9ZJXPkGDtAFKfpYwrm3taCWZWoZ7o/values/Sheet1?alt=json&key=AIzaSyBFnyqCW37BUL3qrpGva0hitYUhxE_x5nw";
const PER_PAGE = 5;
// 🛑 RANDOM_COUNT: Hata diya gaya hai, par code mein koi badlav nahi.
const RANDOM_COUNT = 4; // Abhi bhi rakha hai par 'showRandomPick' ko call nahi karenge.
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
// 🛑 Reels State: Tracks which reels have been shown in the current session/queue
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
    const rawWatch = (r[WA] || '').toString().trim();   
    const poster = (TH !== -1 && r[TH]) ? r[TH].toString().trim() : '';  
    const date = (DT !== -1 && r[DT]) ? r[DT].toString().trim() : '';  
    const category = (CA !== -1 && r[CA]) ? r[CA].toString().trim() : '';  
    const description = (DE !== -1 && r[DE]) ? r[DE].toString().trim() : '';  

    let telegramLink = '';  
    let streamtapeLink = '';  
    const links = rawWatch.split(',').map(l => l.trim()).filter(Boolean);  

    links.forEach(link => {  
        if (link.includes('t.me') || link.includes('telegram')) {  
            telegramLink = link;  
        } else if (link.includes('streamtape.com') || link.includes('/v/')) {  
            streamtapeLink = link;  
        }  
    });  

    const finalWatchLink = streamtapeLink || rawWatch;   

    if ((!trailer || trailer.length === 0) && (!finalWatchLink || finalWatchLink.length === 0)) continue;  

    const id = `${slugify(title)}|${Math.random().toString(36).slice(2,8)}`;  

    out.push({  
        id,  
        title: title || 'Untitled',  
        trailer: trailer || '',  
        watch: finalWatchLink || '',  
        telegram: telegramLink || '',  
        poster: poster || '',  
        date: date || '',  
        category: category || '',  
        description: description || ''  
    });  
}  
// 🛑 NEW TO OLD: Since Google Sheets usually adds new data at the bottom, 
// reversing the array here ensures the newest (lowest index in the sheet data) is first.
// If your Google Sheet is sorted NEWEST-TO-OLDEST (top-down), REMOVE the .reverse().
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
    // 🛑 CLICK LISTENER: Add click to item for details
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
e.stopPropagation(); // 🛑 Stop propagation to prevent item click from firing twice
const id = e.currentTarget.dataset.id;
const it = items.find(x => x.id === id); 
if (!it) return;
openTrailerPage(it);
}

function onWatchClick(e){
markUserGesture();
e.stopPropagation(); // 🛑 Stop propagation
const url = e.currentTarget.dataset.url;
if (!url) return;
openWatchPage(url);
}

function onTagClick(e){
markUserGesture();
e.stopPropagation(); // 🛑 Stop propagation
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
// 🛑 Using full relative path to ensure navigation works
const trailerURL = `/trailer.html?id=${encodeURIComponent(it.id)}`; 
setTimeout(()=> {
try {
window.location.href = trailerURL;
} catch(e){
console.error("Failed to open trailer page", e);
}
}, 120);
}

function openWatchPage(targetUrl){
if (!targetUrl) return;
markUserGesture();
openAdsterraPop();

setTimeout(()=> {  
    try {  
        let final = targetUrl;  
        if (final.includes('/v/')){  
            const m = final.match(/\/v\/([0-9A-Za-z_-]+)/);  
            if (m && m[1]) final = `https://streamtape.com/e/${m[1]}/`;  
        }  

        const redirectPage = `/go.html?target=${encodeURIComponent(final)}`;    

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
// 🛑 YouTube embed: added 'origin' for security/API compatibility
if (y) return `https://www.youtube.com/embed/${y}?autoplay=1&rel=0&mute=1&controls=0&enablejsapi=1&playsinline=1&origin=${window.location.origin}`; 

if (url.includes('streamtape.com') && url.includes('/v/')){  
    const id = url.split('/v/')[1]?.split('/')[0];  
    if (id) return `https://streamtape.com/e/${id}/`;  
}  
  
if (url.startsWith('http')) {  
    return url;  
}  
return '';
}

function openReelsPlayer() {
markUserGesture();
openAdsterraPop();

if (allReelCandidates.length === 0) {  
    // 🛑 Filter for items that actually have a usable trailer/watch link for reels
    allReelCandidates = items.filter(it => toEmbedUrlForReels(it.trailer || it.watch));  
}  

// 🛑 Initial shuffle and reset queue
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
        // 🛑 Re-shuffle and start a new cycle when queue is exhausted (infinite scroll)
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
    const embedUrl = toEmbedUrlForReels(it.trailer || it.watch);  
    if (!embedUrl) return;   
      
    const reelDiv = document.createElement('div');  
    reelDiv.className = 'reel';  
      
    const telegramBtn = it.telegram ?   
        `<button onclick="window.open('${it.telegram}', '_blank')">Download Telegram</button>` : '';  

    const streamtapeBtn = it.watch.includes('streamtape.com') ?   
        `<button onclick="openWatchPage('${it.watch}')">Open Streamtape</button>` : '';  

    const openPlayerBtn = it.watch ?  
        `<button onclick="openWatchPage('${it.watch}')">Open Player</button>` :  
        `<button onclick="openTrailerPage('${it.id}')">View Details</button>`;  

    const iframeType = embedUrl.includes('youtube') ? 'youtube' : 'other';  

    reelDiv.innerHTML = `  
        <div class="reel-video-embed">  
            <iframe src="${escapeHtml(embedUrl)}"   
                    frameborder="0"   
                    data-type="${iframeType}"  
                    allow="autoplay; fullscreen; encrypted-media; picture-in-picture"  
                    allowfullscreen   
                    loading="lazy">  
            </iframe>  
        </div>  
        <div class="reel-buttons">  
            <div style="padding: 0 0 10px 0; font-size: 1rem; color: var(--primary-color); font-weight: 600;">${escapeHtml(it.title)}</div>  
            <div class="reel-buttons-group">  
                ${openPlayerBtn}  
                ${streamtapeBtn}  
                ${telegramBtn}  
            </div>  
        </div>  
        <div class="reel-load-more-marker" style="height:1px;"></div>   
    `;  
    container.appendChild(reelDiv);  
      
    // 🛑 Attach observer only to the reel div
    if (reelsObserver) reelsObserver.observe(reelDiv);   
});  

}

function closeReelsPlayer(){
const player = qs('#reelsPlayer');
if(player) player.style.display = 'none';
document.body.style.overflow = '';

qsa('#reelsPlayer iframe').forEach(iframe => {  
    // 🛑 Stop playback for YouTube iframes specifically
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
    // 🛑 Threshold lowered to 0.5 for better performance on scroll snap
    threshold: 0.5   
};  

reelsObserver = new IntersectionObserver((entries, observer) => {  
    entries.forEach(entry => {  
        if (entry.target.classList.contains('reel-load-more-marker')) return;   

        const iframe = entry.target.querySelector('iframe');  
        if (!iframe) return;  
        
        // 🛑 NEW: Use the actual embedded URL for streamtape/other iframes
        const validSrc = iframe.src && iframe.src !== 'about:blank' && iframe.dataset.url;
        
        if (entry.isIntersecting) {
            // Video is visible
            if (iframe.dataset.type === 'youtube') {  
                iframe.contentWindow.postMessage('{"event":"command","func":"playVideo","args":""}', '*');  
            } else if (iframe.src === 'about:blank') {
                // For Streamtape/Other: reload the source if cleared
                iframe.src = iframe.dataset.url;
            }
        } else {  
            // Video is not visible (scrolled away)
            if (iframe.dataset.type === 'youtube') {  
                iframe.contentWindow.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*');  
            } else {
                // For Streamtape/Other: clear the source to stop playback/save resources
                iframe.dataset.url = iframe.src; // Save the original URL
                iframe.src = 'about:blank';
            }
        }  
    });  
}, options);  

qsa('#reelsContainer .reel').forEach(reel => {  
    reelsObserver.observe(reel);  
});
}

function setupInfiniteScrollObserver() {
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
// 🛑 ADD THIS LINE TO SAVE DATA FOR trailer.html
    localStorage.setItem('dareloom_items', JSON.stringify(items)); 
}
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
