// script.js
// Dareloom Hub - Complete player + sheet + pagination + preview/watch + tags + random
// 2025-10-20 (UPDATED: Reels Player & Trailer Page Logic)

// ------------- CONFIG -------------
const SHEET_API = "https://sheets.googleapis.com/v4/spreadsheets/1A2I6jODnR99Hwy9ZJXPkGDtAFKfpYwrm3taCWZWoZ7o/values/Sheet1?alt=json&key=AIzaSyBFnyqCW37BUL3qrpGva0hitYUhxE_x5nw";
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
let reelsQueue = []; // For non-repeating random reels
// 🛑 NEW: For Intersection Observer
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

// ------------- SHEET FETCH & PARSE (UNCHANGED) -------------
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

        // 🛑 ID FIX: Use a simple, reliable ID structure for localStorage lookup
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
    return out;
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
        list.appendChild(div);
    });

    renderPagination(totalPages, page);
    attachLatestListeners();
}

// ... (renderPagination, changePage functions are unchanged) ...

function renderPagination(totalPages, page){
    const pager = qs('#pager');
    if (!pager) return;
    pager.innerHTML = '';
    if (totalPages <= 1) return;

    const windowSize = 5;
    const currentWindow = Math.floor((page - 1) / windowSize);
    const start = currentWindow * windowSize + 1;
    const end = Math.min(start + windowSize - 1, totalPages);

    if (page > 1){
        const prev = document.createElement('button');
        prev.className = 'page-btn';
        prev.textContent = '« Prev';
        prev.addEventListener('click', ()=> changePage(page - 1));
        pager.appendChild(prev);
    }

    for (let i = start; i <= end; i++){
        const b = document.createElement('button');
        b.className = 'page-num page-btn' + (i === page ? ' active' : '');
        b.textContent = i;
        b.dataset.page = i;
        b.addEventListener('click', ()=> changePage(i));
        pager.appendChild(b);
    }

    if (end < totalPages){
        const dots = document.createElement('span');
        dots.textContent = '...';
        dots.className = 'dots';
        pager.appendChild(dots);
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
    qsa('#latestList .preview-btn, #latestList .latest-thumb').forEach(el => {
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
    const id = e.currentTarget.dataset.id;
    const it = items.find(x => x.id === id) || filteredItems.find(x => x.id === id);
    if (!it) return;
    // 🛑 NEW LOGIC: Open dedicated trailer page
    openTrailerPage(it);
}

function onWatchClick(e){
    markUserGesture();
    const url = e.currentTarget.dataset.url;
    if (!url) return;
    // 🛑 Direct Watch button now opens the ad-gate page
    openWatchPage(url);
}

function onTagClick(e){
    markUserGesture();
    const tag = e.currentTarget.dataset.tag;
    if (!tag) return;
    applyTagFilter(tag);
}

// ------------- NEW TRAILER PAGE LOGIC -------------

/**
 * Opens a dedicated trailer/detail page in the current window.
 * This replaces the previous modal popup logic.
 */
function openTrailerPage(it){
    markUserGesture();
    openAdsterraPop();

    const trailerURL = `/trailer.html?id=${encodeURIComponent(it.id)}`;

    setTimeout(()=> {
        try {
            // Open in the same tab for better flow, or use '_blank' for a new tab
            window.location.href = trailerURL; 
        } catch(e){
            console.error("Failed to open trailer page", e);
        }
    }, 120);
}

// open watch.html (ad-gate page) in new tab with encoded URL param
function openWatchPage(targetUrl){
    if (!targetUrl) return;
    markUserGesture();
    openAdsterraPop();

    setTimeout(()=> {
        try {
            let final = targetUrl;
            // Convert streamtape /v/ to /e/ for better embedding if needed on the watch page
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

// ------------- REELS PLAYER LOGIC (UPDATED WITH INTERSECTION OBSERVER) -------------

// Utility function to shuffle array
function shuffleArray(array) {
    const arr = array.slice();
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function toEmbedUrlForReels(url){
    if (!url) return '';
    url = url.trim();

    // 1. YouTube (use /embed/ for autoplay)
    const y = extractYouTubeID(url);
    // 🛑 CRITICAL: Add &enablejsapi=1 to allow JS control for play/pause
    if (y) return `https://www.youtube.com/embed/${y}?autoplay=1&rel=0&mute=1&controls=0&enablejsapi=1`; 

    // 2. Streamtape (Convert /v/ to /e/)
    if (url.includes('streamtape.com') && url.includes('/v/')){
        const id = url.split('/v/')[1]?.split('/')[0];
        if (id) return `https://streamtape.com/e/${id}/`;
    }
    
    // 3. Generic Embed/Direct MP4 (use the link itself)
    if (url.startsWith('http')) {
        return url;
    }
    return '';
}

function openReelsPlayer() {
    markUserGesture();
    openAdsterraPop();
    
    // Filter items to only include those with an embeddable trailer/watch link
    const reelCandidates = items.filter(it => toEmbedUrlForReels(it.trailer || it.watch));
    
    // Shuffle the full list and assign it to the queue
    reelsQueue = shuffleArray(reelCandidates); 
    
    const container = qs('#reelsContainer');
    container.innerHTML = ''; 

    // Load first batch
    loadReelsBatch(0);
    
    qs('#reelsPlayer').style.display = 'block';
    document.body.style.overflow = 'hidden'; 
    
    // 🛑 NEW: Setup Intersection Observer for Autoplay/Pause
    setupReelsObserver();
}

function loadReelsBatch(startIndex) {
    const container = qs('#reelsContainer');
    const endIndex = Math.min(startIndex + REELS_LOAD_COUNT, reelsQueue.length);
    
    if (startIndex >= endIndex && reelsQueue.length > 0) {
        // If we hit the end of the queue, reshuffle and start over
        reelsQueue = shuffleArray(items.filter(it => toEmbedUrlForReels(it.trailer || it.watch)));
        loadReelsBatch(0);
        return;
    }

    // Disconnect observer before adding new elements
    if (reelsObserver) reelsObserver.disconnect(); 

    for (let i = startIndex; i < endIndex; i++) {
        const it = reelsQueue[i];
        
        const embedUrl = toEmbedUrlForReels(it.trailer || it.watch);
        if (!embedUrl) continue; // Skip if embed failed
        
        const reelDiv = document.createElement('div');
        reelDiv.className = 'reel';
        
        // Telegram button only if link exists
        const telegramBtn = it.telegram ? 
            `<button onclick="window.open('${escapeHtml(it.telegram)}', '_blank')">Download Telegram</button>` : '';

        // Streamtape button only if link exists (and is streamtape)
        const streamtapeBtn = it.watch.includes('streamtape.com') ? 
            `<button onclick="openWatchPage('${escapeHtml(it.watch)}')">Open Streamtape</button>` : '';

        // Open Player button (main action, opens ad-gate for watch link)
        const openPlayerBtn = it.watch ?
            `<button onclick="openWatchPage('${escapeHtml(it.watch)}')">Open Player</button>` :
            `<button onclick="openTrailerPage('${escapeHtml(it.id)}')">View Details</button>`;

        // 🛑 Added data-type for observer logic
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
        `;
        container.appendChild(reelDiv);
        
        // 🛑 Re-observe new reel element
        if (reelsObserver) reelsObserver.observe(reelDiv); 
    }
}

function closeReelsPlayer(){
    const player = qs('#reelsPlayer');
    if(player) player.style.display = 'none';
    document.body.style.overflow = '';
    
    // Stop all video playback on close
    qsa('#reelsPlayer iframe').forEach(iframe => {
        iframe.src = 'about:blank';
    });
    
    // 🛑 NEW: Disconnect observer on close
    if (reelsObserver) {
        reelsObserver.disconnect();
        reelsObserver = null;
    }
}

// 🛑 NEW: Intersection Observer Setup for Reels Autoplay
function setupReelsObserver() {
    // 1. Clear previous observer if it exists
    if (reelsObserver) {
        reelsObserver.disconnect();
    }

    const options = {
        root: qs('#reelsPlayer'), // Observe intersection within the scrolling player container
        rootMargin: '0px',
        threshold: 0.9 // Trigger callback when 90% of the reel is visible
    };

    reelsObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            const iframe = entry.target.querySelector('iframe');
            if (!iframe) return;

            // Use postMessage to control YouTube player if applicable
            if (iframe.dataset.type === 'youtube') {
                if (entry.isIntersecting) {
                    // Play when visible
                    iframe.contentWindow.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
                } else {
                    // Pause when not visible
                    iframe.contentWindow.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*');
                }
            } else {
                // For Streamtape or direct video links, reload the iframe to trigger autoplay
                if (entry.isIntersecting) {
                    // Only reload if it's currently stopped ('about:blank') or paused
                    if (!iframe.src || iframe.src === 'about:blank') {
                         // A simple reload trick to re-trigger Streamtape autoplay
                         iframe.src = iframe.src; 
                    }
                } else {
                    // For non-YouTube, simply stop the iframe
                    iframe.src = 'about:blank';
                }
            }
        });
    }, options);

    // 3. Start observing all currently loaded reels
    qsa('#reelsContainer .reel').forEach(reel => {
        reelsObserver.observe(reel);
    });
}


// ------------- INIT / BOOT -------------
async function loadAll(){
    const raw = await fetchSheet();
    const parsed = parseRows(raw);

    // Sort new -> old (date first, then sheet order)
    parsed.forEach(p => p._sortDate = (p.date ? Date.parse(p.date) || 0 : 0));
    parsed.sort((a,b) => (b._sortDate || 0) - (a._sortDate || 0));
    const allZero = parsed.every(p => !p._sortDate);
    items = allZero ? parsed.reverse() : parsed;

    filteredItems = items.slice(); 

    updateCount(items.length);
    
     
    // 🛑 CRITICAL FIX for trailer.html: Save data to localStorage
    try {
        localStorage.setItem('dareloom_items', JSON.stringify(items)); 
    } catch(e) {
        console.error("Could not save items to localStorage:", e);
    }

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

    // Set up gesture listener
    setupGestureListener(); 
}

function updateCount(n){
    const c = qs('#count');
    if (c) c.textContent = `${n} items`;
}

// Gesture handling helpers
function markUserGesture(){
    userInteracted = true;
}

function setupGestureListener(){
    ['click', 'touchstart', 'keydown'].forEach(e => {
        document.addEventListener(e, markUserGesture, {once: true});
    });
}

// Random pick function (called by button)
function showRandomPick(){
    const random = items[Math.floor(Math.random() * items.length)];
    if (random) openTrailerPage(random);
}

// Start the application
loadAll();
