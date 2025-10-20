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

// 🛑 NEW: Function to mark user interaction (used by click handlers)
function markUserGesture() {
    userInteracted = true;
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

// The 'watch' column can contain multiple links, so we try to separate them.
links.forEach(link => {
if (link.includes('t.me') || link.includes('telegram')) {
telegramLink = link;
} else if (link.includes('streamtape.com') || link.includes('/v/')) {
streamtapeLink = link;
}
});

// Set 'watch' to the Streamtape/primary link for 'Open in Player' button
// If there are multiple links, 'finalWatchLink' will be the first non-telegram one (streamtape if present, otherwise the first in the list)
const finalWatchLink = streamtapeLink || links.find(l => l !== telegramLink) || rawWatch;

// skip rows with no playable link
if ((!trailer || trailer.length === 0) && (!finalWatchLink || finalWatchLink.length === 0)) continue;

const id = `${slugify(title)}|${encodeURIComponent(finalWatchLink||trailer||Math.random().toString(36).slice(2,8))}`;

out.push({
id,
title: title || 'Untitled',
trailer: trailer || '',
watch: finalWatchLink || '', // The primary link for the Open Player button (Streamtape/Other embed)
telegram: telegramLink || '', // The link for the Download Telegram button
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
div.innerHTML = `<img class="latest-thumb" src="${escapeHtml(thumb)}" loading="lazy" alt="${escapeHtml(it.title)}"> <div class="latest-info"> <div style="font-weight:700">${escapeHtml(it.title)}</div> <div style="color:var(--muted);font-size:13px;margin-top:6px">${escapeHtml(it.date || '')}</div> <div class="tag-container" style="margin-top:6px">${renderTagsForItem(it)}</div> <div style="margin-top:8px"> <button class="btn preview-btn" data-id="${escapeHtml(it.id)}">Trailer</button> <button class="watch-btn" data-url="${escapeHtml(it.watch || it.trailer)}" ${it.watch ? '' : 'disabled'}>Watch Now</button> </div> </div>`;
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

// Function to open the video in a new page (go.html)
function openWatchPage(url) {
    // 🛑 CRITICAL: Pass the primary watch link AND the telegram link if available
    const item = items.find(i => i.watch === url) || filteredItems.find(i => i.watch === url);
    let targetUrl = url;
    if (item && item.telegram) {
        // If Telegram link is present, pass both links separated by a comma
        targetUrl = `${url},${item.telegram}`;
    }
    
    // Encode the full target string before passing to go.html
    window.open(`/go.html?target=${encodeURIComponent(targetUrl)}`, '_blank');
}


// ------------- SEARCH & FILTER -------------
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

function updateCount(count){
    const controls = qs('#controlsContainer');
    if (controls) controls.innerHTML = `<div id="count" class="pill">${count} items</div>`;
}

// ------------- MODAL PLAYER LOGIC (for Trailer button) -------------
// This function handles the separate modal for the 'Trailer' button in the latest list
function showPlayerModal(videoUrl, title) {
    const modal = qs('#videoModal');
    const modalContent = qs('#modalContent');
    const modalTitle = qs('#modalTitle');
    
    if (!modal || !modalContent || !modalTitle) return;

    // Check if the link is Streamtape /v/ and convert it to /e/ for embed
    let finalEmbedUrl = videoUrl;
    if (finalEmbedUrl.includes("streamtape.com/v/")) {
        const m = finalEmbedUrl.match(/\/v\/([0-9A-Za-z_-]+)/);
        if (m && m[1]) {
            finalEmbedUrl = `https://streamtape.com/e/${m[1]}/`;
        }
    }

    modalTitle.textContent = "Trailer: " + title;
    
    // Set the modal content with an iframe and the new Back button
    modalContent.innerHTML = `
        <div class="modal-controls">
            <button id="modalBackBtn" class="modal-btn">
                ← Back to Feed
            </button>
        </div>
        <iframe src="${finalEmbedUrl}" frameborder="0" allowfullscreen allow="autoplay; fullscreen; encrypted-media; picture-in-picture"></iframe>
    `;

    // 🛑 Back button implementation for Trailer Modal
    const modalBackBtn = document.getElementById('modalBackBtn');
    modalBackBtn.onclick = () => {
        // Close the modal
        modal.style.display = "none";
        // Show the reels player again
        document.getElementById('reelsPlayer').style.display = 'flex';
        document.body.style.overflow = 'hidden'; // Restore feed scroll
    };

    // Show modal and hide the reels player
    modal.style.display = "block";
    document.getElementById('reelsPlayer').style.display = 'none';
    document.body.style.overflow = 'auto'; // Allow scrolling in modal/iframe area
    
    openAdsterraPop(); // Pop-up Ad

}


// ------------- REELS PLAYER LOGIC -------------

// 🛑 REELS PLAYER CONTROLS (Render buttons for each slide)
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
                        // Note: Streamtape button uses the same link as Open Player if it's the primary link.
                        // I will update this to just be Open Streamtape if the link is streamtape for clarity.
                        `<button class="btn" onclick="openWatchPage('${escapeHtml(streamtapeUrl)}')">
                            Open Streamtape
                        </button>` : ''}
                    ${telegramUrl ? 
                        `<button class="btn watch-btn" onclick="openWatchPage('${escapeHtml(telegramUrl)}')" style="background:#0088cc;">
                            Download Telegram
                        </button>` : ''}
                </div>
            </div>`;
}

// 🛑 REELS PLAYER SLIDE RENDERER
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

    // data-src is used to store the full autoplay URL which is swapped when centered
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

// 🛑 UNIQUE RANDOM BATCH LOADER
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

    // Load the next batch
        const nextBatch = getUniqueRandomBatch(REELS_BATCH_SIZE);
        
        if (nextBatch.length > 0) {
            nextBatch.forEach(item => {
                reelsContainer.innerHTML += renderReelSlide(item);
            });
            log(`Loaded ${nextBatch.length} new reels.`);
        } else {
            log("All unique trailers played. Looping will restart next cycle.");
        }
        loadingReels = false;
    }

    // 6. Playback Control (Autoplay the video currently in view)
    const slides = reelsContainer.querySelectorAll('.reel-slide');
    const center = reelsContainer.clientHeight / 2;

    slides.forEach(slide => {
        const video = slide.querySelector('iframe.reel-video');
        if (!video) return;

        const rect = slide.getBoundingClientRect();
        // Check if the slide is mostly visible AND centered enough
        const isCentered = rect.top < center && rect.bottom > center;

        if (isCentered) {
            // Start video playback if not already playing and has a data-src
            if (video.src.includes('about:blank') && video.dataset.src) {
                // Swap data-src (autoplay=0) to src (autoplay=1)
                video.src = video.dataset.src.replace('autoplay=0', 'autoplay=1');
            }
        } else {
            // Pause/Stop playback for videos that scroll far out of center view
             if (!video.src.includes('about:blank')) {
                 // Stop video by replacing source (most reliable way)
                 video.src = 'about:blank';
            }
        }
    });
}


// ------------- INITIALIZATION -------------

function init(){
    // Global listener for any interaction to enable pop-unders
    document.body.addEventListener('click', markUserGesture, { once: true });
    document.body.addEventListener('scroll', markUserGesture, { once: true });
    
    fetchSheet()
        .then(rows => {
            items = parseRows(rows);
            
            // 🛑 CRITICAL FIX: REVERSE THE ORDER (Newest to Oldest)
            // Assuming the sheet data is ordered oldest to newest from top to bottom
            items.reverse(); 
            
            filteredItems = items.slice();
            log("Parsed items:", items.length);
            
            renderLatest(1);
            renderRandom();
            updateCount(filteredItems.length);
            
            // Re-render random items periodically for freshness (optional)
            setInterval(renderRandom, 15000); 

            // Handle potential URL search/category parameters after load (optional)
        })
        .catch(e => {
            log("Initialization failed:", e);
            qs('#latestList').innerHTML = `<p style="color:var(--primary-color);">⚠️ Failed to load content. Please check the API key and sheet link.</p>`;
        });
}

document.addEventListener('DOMContentLoaded', init);
