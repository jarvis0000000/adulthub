// script.js
// Dareloom Hub - Complete player + sheet + pagination + preview/watch + tags + random + REELS
// 2025-10-17 (MAXIMUM CTR / CLICK OPTIMIZATION - browser-friendly gesture handling)

// ------------- CONFIG -------------
// 🛑 IMPORTANT: API Key is sensitive. Ensure this is correct and restricted to your domain.
const SHEET_API = "https://sheets.googleapis.com/v4/spreadsheets/1A2I6jODnR99Hwy9ZJXPkGDtAFKfpYwrm3taCWZWoZ7o/values/Sheet1?alt=json&key=AIzaSyBFnyqCW37BUL3qrpGva0hitYUhxE_x5nw";
const PER_PAGE = 5;
const RANDOM_COUNT = 4;

const REELS_BATCH_SIZE = 8; // Load 8 videos at a time for the scroll player
let reelsHistory = new Set(); // To prevent repeats within a session

// Pop / ads config
const AD_POP = "//bulletinsituatedelectronics.com/24/e4/33/24e43300238cf9b86a05c918e6b00561.js";
// 🛑 CTR OPTIMIZATION: Aggressive Timing (we keep short cooldowns but ensure user gesture)
const POP_COOLDOWN_MS = 4000; // minimum gap between pops
let lastPop = 0;

// Track user gestures so we only attempt auto/pop when a real gesture has happened
let userInteracted = false;
let initialPopFired = false;

// ------------- STATE -------------
let items = [];        // all parsed items (newest first)
let filteredItems = []; // items after search/tag filter
let currentPage = 1;
let reelsContainer;

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
.replace(/'/g,'&#039;');
}

function extractYouTubeID(url){
if(!url) return null;
const m = url.match(/(?:v=|youtu.be\/|shorts\/|embed\/)([0-9A-Za-z_-]{11})/);
return m ? m[1] : null;
}

function makeThumbnail(it){
// prefer poster/thumbnail field, otherwise youtube from trailer/watch, otherwise placeholder
if (it.poster && it.poster.trim()) return it.poster.trim();
const y = extractYouTubeID(it.trailer || it.watch);
if (y) return `https://img.youtube.com/vi/${y}/hqdefault.jpg`;
return 'https://placehold.co/600x400?text=Dareloom+Hub';
}

/**
openAdsterraPop()

Injects the Adsterra pop script immediately (no extra timeout) to maximize "user gesture" success.

Respects POP_COOLDOWN_MS.

Keeps script element for a few seconds and then removes it (clean).
*/
function openAdsterraPop(){
try{
const now = Date.now();
if (now - lastPop < POP_COOLDOWN_MS) return; // cooldown
lastPop = now;

// If there's no recent user gesture we avoid firing automatic pops (prevents browser blocking).
if (!userInteracted && !initialPopFired) {
// don't fire if user never interacted — return early
// This avoids impressions-without-gesture which often leads to 0 clicks.
return;
}

// Inject script immediately (best chance to be considered part of user gesture if called from click handler)
const s = document.createElement('script');
s.src = AD_POP;
s.async = true;
document.body.appendChild(s);
// Keep the script for a short time for proper loading, then remove
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
log("fetch status", res.status);
if (!res.ok) throw new Error('sheet fetch failed ' + res.status);
const j = await res.json();
log("sheet raw rows", Array.isArray(j.values) ? j.values.length : 0);
return j.values || [];
}catch(e){
console.error("Sheet fetch error:", e);
return [];
}
}

function parseRows(values){
if (!values || values.length < 2) return [];
// try to detect headers in first row (lowercased)
const headers = (values[0]||[]).map(h => (h||'').toString().toLowerCase().trim());
// helper finds header index of any candidate names
const find = (names) => {
for (let n of names){
const i = headers.indexOf(n);
if (i !== -1) return i;
}
return -1;
};

// common header names to check
const idxTitle = find(['title','name','video title']);
const idxTrailer = find(['trailer','youtube','trailer link','trailer url']);
const idxWatch = find(['watch','watch link','link','url','video url']);
const idxPoster = find(['poster','thumbnail','thumb','image','thumbnail url']);
const idxDate = find(['date','upload date','published']);
const idxCategory = find(['category','categories','tags','tag','genre']);
const idxDesc = find(['description','desc','summary']);

// We use your custom indices here: Title=0 (A), Trailer=2 (C), Watch=6 (G), Category=20 (U)
const TI = idxTitle !== -1 ? idxTitle : 0;
const TR = idxTrailer !== -1 ? idxTrailer : 2;
const WA = idxWatch !== -1 ? idxWatch : 6; // Column G (The WATCH column you are using)
const TH = idxPoster !== -1 ? idxPoster : -1;
const DT = idxDate !== -1 ? idxDate : -1;
const CA = idxCategory !== -1 ? idxCategory : 20; // Column U
const DE = idxDesc !== -1 ? idxDesc : -1;

const rows = values.slice(1);
const out = [];
for (let r of rows){
r = Array.isArray(r) ? r : [];
const title = (r[TI] || '').toString().trim();
const trailer = (r[TR] || '').toString().trim();
const rawWatch = (r[WA] || '').toString().trim(); // Raw data from Watch column
const poster = (TH !== -1 && r[TH]) ? r[TH].toString().trim() : '';
const date = (DT !== -1 && r[DT]) ? r[DT].toString().trim() : '';
const category = (CA !== -1 && r[CA]) ? r[CA].toString().trim() : '';
const description = (DE !== -1 && r[DE]) ? r[DE].toString().trim() : '';

// 🛑 FIX: Split the rawWatch string by comma and assign links based on type
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

// Set 'watch' to the Streamtape/primary link for 'Open in Player' button
const finalWatchLink = streamtapeLink || rawWatch; // Fallback to rawWatch if Streamtape not found

// skip rows with no playable link
if ((!trailer || trailer.length === 0) && (!finalWatchLink || finalWatchLink.length === 0)) continue;

const id = `${slugify(title)}|${encodeURIComponent(finalWatchLink||trailer||Math.random().toString(36).slice(2,8))}`;

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
return out;
}

// ------------- RENDER / UI -------------
function renderTagsForItem(it){
if (!it.category || !it.category.trim()) return '';
// category may be comma-separated
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
// Clicks on random cards now launch the Reels Player
card.addEventListener('click', ()=> {
    openAdsterraPop();
    openReelsPlayer(it);
});
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

slice.forEach(it => {
const div = document.createElement('div');
div.className = 'latest-item';
const thumb = makeThumbnail(it);
// 🛑 UX TWEAK: Changed button text for better CTR
div.innerHTML = `<img class="latest-thumb" src="${escapeHtml(thumb)}" loading="lazy" alt="${escapeHtml(it.title)}"> <div class="latest-info"> <div style="font-weight:700">${escapeHtml(it.title)}</div> <div style="color:var(--muted);font-size:13px;margin-top:6px">${escapeHtml(it.date || '')}</div> <div class="tag-container" style="margin-top:6px">${renderTagsForItem(it)}</div> <div style="margin-top:8px"> <button class="btn preview-btn" data-id="${escapeHtml(it.id)}">Trailer</button> <button class="watch-btn" data-url="${escapeHtml(it.watch || it.trailer)}">Watch Now</button> </div> </div>`;
list.appendChild(div);
});

renderPagination(totalPages, page);
attachLatestListeners();
}

function renderPagination(totalPages, page){
const pager = qs('#pager');
if (!pager) return;
pager.innerHTML = '';
if (totalPages <= 1) return;

const windowSize = 5; // ek bar me 5 page numbers
const currentWindow = Math.floor((page - 1) / windowSize);
const start = currentWindow * windowSize + 1;
const end = Math.min(start + windowSize - 1, totalPages);

// Prev button (previous window)
if (page > 1){
const prev = document.createElement('button');
prev.className = 'page-btn';
prev.textContent = '« Prev';
prev.addEventListener('click', ()=> changePage(page - 1));
pager.appendChild(prev);
}

// Page numbers for current window
for (let i = start; i <= end; i++){
const b = document.createElement('button');
b.className = 'page-num page-btn' + (i === page ? ' active' : '');
b.textContent = i;
b.dataset.page = i;
b.addEventListener('click', ()=> changePage(i));
pager.appendChild(b);
}

// Ellipsis and Next if there are more pages ahead
if (end < totalPages){
const dots = document.createElement('span');
dots.textContent = '...';
dots.className = 'dots';
pager.appendChild(dots);
}

// Next button (next page)
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
// 🛑 CTR OPTIMIZATION: Pop on page change (this will only execute if userInteracted and cooldown allows)
openAdsterraPop();
}

function attachLatestListeners(){
// Preview buttons now launch the Reels Player
qsa('#latestList .preview-btn').forEach(btn => {
    btn.removeEventListener('click', onReelsLaunchClick);
    btn.addEventListener('click', onReelsLaunchClick);
});
// Watch buttons
qsa('#latestList .watch-btn').forEach(btn => {
btn.removeEventListener('click', onWatchClick);
btn.addEventListener('click', onWatchClick);
});
// Tag buttons
qsa('.tag-btn').forEach(tagbtn => {
tagbtn.removeEventListener('click', onTagClick);
tagbtn.addEventListener('click', onTagClick);
});
}

function onReelsLaunchClick(e){
// mark user gesture
markUserGesture();
const id = e.currentTarget.dataset.id;
const it = items.find(x => x.id === id) || filteredItems.find(x => x.id === id);
if (!it) return;
// 🛑 NEW LOGIC: Trigger Ad, then open the Reels Player
openAdsterraPop();
openReelsPlayer(it);
}

function onWatchClick(e){
// mark user gesture
markUserGesture();
const url = e.currentTarget.dataset.url;
if (!url) return;
// 🛑 CTR OPTIMIZATION: Pop on Watch click too
openAdsterraPop();
openWatchPage(url);
}

function onTagClick(e){
// mark user gesture
markUserGesture();
const tag = e.currentTarget.dataset.tag;
if (!tag) return;
applyTagFilter(tag);
}

// ------------- SEARCH & FILTER (No change) -------------
function applyTagFilter(tag){
if (!tag) return;
filteredItems = items.filter(it => (it.category||'').toLowerCase().split(',').map(s=>s.trim()).includes(tag.toLowerCase()));
currentPage = 1;
renderLatest(1);
updateCount(filteredItems.length);
// 🛑 CTR OPTIMIZATION: Pop on tag filter (only if gesture happened)
openAdsterraPop();
}

// Search function (public wrapper for search input)
function filterVideos(q){
q = (q||'').toString().trim().toLowerCase();
if (!q){
filteredItems = items.slice();
renderLatest(1);
updateCount(filteredItems.length);
return;
}
// if user types 'n' special bypass (old logic) — keep compatibility
if (q === 'n'){
localStorage.setItem('adblock_bypassed','true');
filteredItems = items.slice();
renderLatest(1);
updateCount(filteredItems.length);
return;
}

filteredItems = items.filter(it => {
const t = (it.title||'').toLowerCase();
const c = (it.category||'').toLowerCase();
return t.includes(q) || c.includes(q);
});

// 🛑 CTR OPTIMIZATION: Pop on successful search (when search term is long enough)
if (q.length > 2) {
openAdsterraPop();
}

currentPage = 1;
renderLatest(1);
updateCount(filteredItems.length);
}

// ------------- REELS PLAYER LOGIC (NEW) -------------

// 🛑 NEW: RENDER BUTTONS FOR REELS SLIDE
function renderReelControls(item){
    // Use finalWatchLink (Streamtape/Primary) for Open Player, and telegram link if available
    const streamtapeUrl = item.watch.includes('streamtape.com') || item.watch.includes('/v/') ? item.watch : '';
    const telegramUrl = item.telegram;

    return `<div class="reel-info">
                <h3 class="reel-title">${escapeHtml(item.title)}</h3>
                <div class="reel-tags">${renderTagsForItem(item)}</div>
                <div class="reel-buttons-group">
                    <button class="btn watch-btn" onclick="openWatchPage('${escapeHtml(item.watch)}')" title="Open in dedicated player">
                        Open Player
                    </button>
                    ${streamtapeUrl ? 
                        `<button class="btn" onclick="openWatchPage('${escapeHtml(streamtapeUrl)}')">
                            Open Streamtape
                        </button>` : ''}
                    ${telegramUrl ? 
                        `<button class="btn watch-btn" onclick="openWatchPage('${escapeHtml(telegramUrl)}')">
                            Download Telegram
                        </button>` : ''}
                </div>
            </div>`;
}

// 🛑 NEW: FUNCTION TO RENDER THE REELS PLAYER SLIDES
function renderReelSlide(item){
    // Find the YouTube/Trailer ID
    const youtubeId = extractYouTubeID(item.trailer);
    // Use mute=1 and autoplay=0 initially to prevent browser blocking/loudness
    const embedUrl = youtubeId ? `https://www.youtube.com/embed/${youtubeId}?autoplay=0&rel=0&loop=1&playlist=${youtubeId}&mute=1` : '';
    
    // Fallback to placeholder if no trailer is available
    if (!embedUrl) {
         return `<div class="reel-slide">
                    <div class="reel-player-container" style="background-image: url('${escapeHtml(makeThumbnail(item))}');">
                        <div class="no-trailer-msg">Trailer Not Available</div>
                    </div>
                    ${renderReelControls(item)}
                </div>`;
    }

    return `<div class="reel-slide">
                <div class="reel-player-container">
                    <iframe class="reel-video" data-src="${embedUrl}" 
                            src="about:blank" 
                            frameborder="0" allow="autoplay; fullscreen; encrypted-media; picture-in-picture" 
                            allowfullscreen></iframe>
                </div>
                ${renderReelControls(item)}
            </div>`;
}

// 🛑 NEW: FUNCTION TO GET A BATCH OF UNIQUE RANDOM VIDEOS
function getUniqueRandomBatch(count){
    // Ensure we only pick items with a trailer link for the reel player
    const pool = items.filter(it => !reelsHistory.has(it.id) && it.trailer); 
    const batch = [];
    
    for (let i = 0; i < count && pool.length > 0; i++) {
        const randomIndex = Math.floor(Math.random() * pool.length);
        const item = pool.splice(randomIndex, 1)[0];
        batch.push(item);
        reelsHistory.add(item.id);
    }

    // If pool is exhausted, clear history and start over
    if (batch.length < count && items.length > 0) {
        log("Reels history cleared, starting new cycle.");
        reelsHistory.clear();
        const remaining = items.filter(it => it.trailer).slice(); 
        for (let i = 0; i < (count - batch.length) && remaining.length > 0; i++) {
             const randomIndex = Math.floor(Math.random() * remaining.length);
             const item = remaining.splice(randomIndex, 1)[0];
             batch.push(item);
             reelsHistory.add(item.id);
        }
    }
    
    return batch;
}

// 🛑 NEW: MAIN REELS PLAYER LOGIC
function openReelsPlayer(startItem = null){
    if (!reelsContainer) {
        reelsContainer = qs('#reelsPlayer');
        if (!reelsContainer) return;
    }
    
    // Hide main content, show reels player
    qs('#mainWrap').style.display = 'none';
    reelsContainer.style.display = 'flex';
    document.body.style.overflow = 'hidden'; // Lock scrolling
    
    reelsContainer.innerHTML = ''; // Clear previous reels content

    let initialItems = [];
    
    // 1. Determine starting item and initial batch
    if (startItem && startItem.trailer) {
        initialItems.push(startItem);
        reelsHistory.add(startItem.id);
    }
    
    // 2. Get the rest of the batch (REELS_BATCH_SIZE - initialItems.length)
    const count = REELS_BATCH_SIZE - initialItems.length;
    const batch = getUniqueRandomBatch(count);
    initialItems = initialItems.concat(batch);
    
    // If no videos can be found, show alert and exit
    if (initialItems.length === 0) {
        alert("No videos with trailers found to start the Reels player.");
        closeReelsPlayer();
        return;
    }


    // 3. Render and inject all slides
    initialItems.forEach(item => {
        reelsContainer.innerHTML += renderReelSlide(item);
    });

    // 4. Attach scroll listener for infinite loading
    reelsContainer.removeEventListener('scroll', handleReelsScroll);
    reelsContainer.addEventListener('scroll', handleReelsScroll);

    // 5. Initial video playback management (for the first slide)
    setTimeout(() => handleReelsScroll(), 100);
}

// 🛑 NEW: CLOSE REELS PLAYER
function closeReelsPlayer(){
    if (!reelsContainer) return;

    // Stop all videos before closing
    reelsContainer.querySelectorAll('iframe').forEach(iframe => {
        iframe.src = 'about:blank'; // Stop playback
    });

    qs('#mainWrap').style.display = 'block';
    reelsContainer.style.display = 'none';
    document.body.style.overflow = 'auto';
    reelsHistory.clear(); // Clear history when closing
}

// 🛑 NEW: INFINITE SCROLL HANDLER (FIXED AND COMPLETED)
let loadingReels = false;
let lastScrollTop = 0;

function handleReelsScroll(){
    // Only fire ad on downward scroll
    if (reelsContainer.scrollTop > lastScrollTop) {
        openAdsterraPop(); // Pop on scroll (gesture)
    }
    lastScrollTop = reelsContainer.scrollTop <= 0 ? 0 : reelsContainer.scrollTop; // For mobile/safari bounce fix

    // Logic to detect if the user has scrolled near the bottom of the last reel
    const isNearEnd = reelsContainer.scrollTop + reelsContainer.clientHeight >= reelsContainer.scrollHeight - 500;
    
    if (isNearEnd && !loadingReels) {
        loadingReels = true;
        log("Loading new batch of reels...");
        
          // Load the next batch
        const nextBatch = getUniqueRandomBatch(REELS_BATCH_SIZE);

        if (nextBatch.length > 0) {
            nextBatch.forEach(item => {
                reelsContainer.innerHTML += renderReelSlide(item);
            });
            log(`Loaded ${nextBatch.length} new reels.`);
        } else {
            log("No more unique videos to load.");
        }
        loadingReels = false;
    }

    // NEW: Video Autoplay/Mute management based on current slide
    const slideHeight = reelsContainer.clientHeight;
    // Determine which slide is most visible
    const currentSlideIndex = Math.round(reelsContainer.scrollTop / slideHeight);

    reelsContainer.querySelectorAll('.reel-slide').forEach((slide, index) => {
        const iframe = slide.querySelector('iframe');
        // Use data-src for lazy loading
        const initialSrc = iframe ? iframe.getAttribute('data-src') : null;

        if (!iframe || !initialSrc) return;

        // The current video is the one visible
        if (index === currentSlideIndex) {
            // Lazy load the current video if it hasn't loaded (src is 'about:blank')
            if (iframe.src.includes('about:blank')) {
                // Swap data-src (autoplay=0, mute=1) to src (autoplay=1, mute=0) to play the video with sound
                let src = initialSrc.replace('autoplay=0', 'autoplay=1').replace('mute=1', 'mute=0');
                iframe.src = src;
            }
        } else {
            // Stop/mute videos not currently visible
            if (!iframe.src.includes('about:blank')) {
                // Stop video by replacing source with a blank one, or re-setting to mute/no-autoplay
                 iframe.src = 'about:blank';
                // Alternative: if (iframe.src.includes('autoplay=1')) { iframe.src = initialSrc; }
            }
        }
    });
}

// open watch.html (existing file) in new tab with encoded URL param
function openWatchPage(targetUrl){
    if (!targetUrl) return;

    markUserGesture();
    openAdsterraPop();

    setTimeout(()=> {
        try {
            let final = targetUrl;
            // convert streamtape /v/ to /e/ for better embedding
            if (final.includes('/v/')){
                const m = final.match(/\/v\/([0-9A-Za-z_-]+)/);
                if (m && m[1]) final = `https://streamtape.com/e/${m[1]}/`;
            }

            // redirect first to go.html (ad trigger page)
            // This is the new, modified logic.
            const redirectPage = `/go.html?target=${encodeURIComponent(final)}`;
            const w = window.open(redirectPage, '_blank');

            if (!w || w.closed || typeof w.closed === 'undefined'){
                alert("Please allow pop-ups to open the link in a new tab!");
            }

            // Close the Reels player when opening the Watch page
            closeReelsPlayer();
        } catch(e){
            console.error(e);
        }
    }, 120);

}
// Random pick function (called by button)

function showRandomPick(){
    const random = items[Math.floor(Math.random() * items.length)];
    if (random) {
        openAdsterraPop(); // Trigger ad
        openReelsPlayer(random); // Open reels player starting with the random pick
    }
}

// INIT/BOOT
async function loadAll(){

    log("loading sheet...");
    const raw = await fetchSheet();
    const parsed = parseRows(raw);

    // Sort new -> old. If date exists and parseable, attempt to sort by date desc; otherwise keep sheet order reversed
    parsed.forEach(p => p._sortDate = (p.date?
    Date.parse(p.date) || 0 : 0));

    parsed.sort((a,b) => (b._sortDate || 0) - (a._sortDate || 0));

    // if all_sortDate === 0 (no usable dates), reverse the parsed
    // order to show newest-first based on sheet order
    const allZero = parsed.every(p => !p._sortDate);

    items = allZero ? parsed.reverse() : parsed;

    filteredItems = items.slice(); // start unfiltered

    log("items loaded", items.length);

    // update count
    updateCount(items.length);
    
    // initial renders
    renderRandom();
    renderLatest(1);

    // wire search input
    const s = qs('#searchInput'); 
    if (s){ 
        s.addEventListener('input', (e) => { 
            const q = e.target.value || ""; 
            filterVideos(q); 
        });
    }

    // Reels close wiring
    const closeBtn = qs('#reelsCloseBtn'); 
    if (closeBtn){ 
        closeBtn.addEventListener('click', closeReelsPlayer);
    } 

    // Instead of auto-firing pop on page load (which is blocked by many browsers),
    // we listen for the first real user gesture (click/touch) and then allow an initial pop after a short delay.
    setupGestureListener(); 
}

// update item count display
function updateCount(n){ 
    const c = qs('#count'); 
    if (c) c.textContent = `${n} items`; 
}

/*
Gesture handling helpers
markUserGesture: call when a direct user interaction happens
setupGestureListener: listens to first global interaction to enable initial pop
*/

function markUserGesture(){
    userInteracted = true;
}

// Listen for user gestures (click/touch/keydown) once, then allow an initial pop after a short delay.
// This avoids firing a pop before any gesture (which is commonly blocked).

function setupGestureListener(){
    const events = ['click', 'touchstart', 'keydown'];
    const handler = () => {
        markUserGesture();
        // Fire the first pop shortly after the first gesture
        setTimeout(() => openAdsterraPop(), 500);
        events.forEach(event =>
        document.removeEventListener(event, handler, true)); 
    };

    events.forEach(event =>
    document.addEventListener(event, handler, true)); 
}


// start
loadAll();
