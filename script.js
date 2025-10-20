// script.js
// Dareloom Hub - Complete player + sheet + pagination + preview/watch + tags + random
// 2025-10-20 (UPDATED: Pagination, Unlimited Reels, Tag/Search Filter Fix)

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
    
    // 🛑 Ensure page stays within bounds
    if (page < 1) page = 1;
    if (page > totalPages) page = totalPages;
    currentPage = page;

    const start = (page - 1) * PER_PAGE;
    const slice = filteredItems.slice(start, start + PER_PAGE);

    if (slice.length === 0 && total > 0 && page > 1) {
        // If the current page is empty (e.g., after filtering), go to page 1
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

    // 🛑 Simple, standard pagination logic
    const windowSize = 5;
    let startPage, endPage;

    if (totalPages <= windowSize) {
        startPage = 1;
        endPage = totalPages;
    } else {
        // Show current page centered
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
    qsa('#latestList .preview-btn, #latestList .latest-thumb').forEach(el => {
        el.removeEventListener('click', onPreviewClick);
        el.addEventListener('click', onPreviewClick);
    });
    qsa('#latestList .watch-btn').forEach(btn => {
        btn.removeEventListener('click', onWatchClick);
        btn.addEventListener('click', onWatchClick);
    });
    // 🛑 Attach listener to tags in the current list
    qsa('.tag-btn').forEach(tagbtn => {
        tagbtn.removeEventListener('click', onTagClick);
        tagbtn.addEventListener('click', onTagClick);
    });
}

function onPreviewClick(e){
    markUserGesture();
    const id = e.currentTarget.dataset.id;
    const it = items.find(x => x.id === id); // Find in main list
    if (!it) return;
    openTrailerPage(it);
}

function onWatchClick(e){
    markUserGesture();
    const url = e.currentTarget.dataset.url;
    if (!url) return;
    openWatchPage(url);
}

function onTagClick(e){
    markUserGesture();
    const tag = e.currentTarget.dataset.tag;
    if (!tag) return;
    applyTagFilter(tag);
}

// ------------- FILTER LOGIC (UPDATED) -------------

/**
 * 🛑 NEW: Filters the main list based on search query or tag.
 */
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
    
    // Update counter
    updateCount(filteredItems.length);
    
    // Reset and render to page 1
    renderLatest(1); 
}

/**
 * Helper to handle tag clicks.
 */
function applyTagFilter(tag){
    const s = qs('#searchInput');
    if (s) s.value = tag; // Put the tag in the search box
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

// ------------- REELS PLAYER LOGIC (UPDATED FOR UNLIMITED SCROLL) -------------

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
    const y = extractYouTubeID(url);
    if (y) return `https://www.youtube.com/embed/${y}?autoplay=1&rel=0&mute=1&controls=0&enablejsapi=1`; 

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
    
    // 1. Prepare full list of candidates (done in loadAll now, but ensure it's here)
    if (allReelCandidates.length === 0) {
        allReelCandidates = items.filter(it => toEmbedUrlForReels(it.trailer || it.watch));
    }
    
    // 2. Initial shuffle and queue reset
    reelsQueue = shuffleArray(allReelCandidates); 
    reelsShownIndices = new Set();
    
    const container = qs('#reelsContainer');
    container.innerHTML = ''; 

    // 3. Load first batch
    loadReelsBatch(0);
    
    qs('#reelsPlayer').style.display = 'block';
    document.body.style.overflow = 'hidden'; 
    
    // 4. Setup Intersection Observer for Autoplay/Pause and Infinite Scroll
    setupReelsObserver();
}


function loadReelsBatch(startIndex) {
    const container = qs('#reelsContainer');
    let itemsToLoad = [];
    let loadCount = 0;
    let pool = allReelCandidates.slice();
    let currentCount = container.children.length;


    // 🛑 LOGIC FOR UNLIMITED, NON-REPEATING BATCHES
    while (loadCount < REELS_LOAD_COUNT && pool.length > 0) {
        // Pick a random index from the pool
        const randomIndex = Math.floor(Math.random() * pool.length);
        const item = pool[randomIndex];
        
        // Use a unique identifier (like the original item index or ID) to track if it's been shown
        // Since we are creating a new item list with random IDs in parseRows, 
        // we'll track based on the list size and current count to simulate non-repeat in a cycle.
        
        // Simple cycle-based non-repeat: If all items have been shown in the current shuffled queue, 
        // reshuffle the queue for a new cycle.
        
        // 🛑 Simplified logic: just shuffle the entire available list every time the queue is exhausted.
        if (reelsQueue.length === 0) {
            reelsQueue = shuffleArray(allReelCandidates);
            // Optionally clear the container if you want a complete reset look, 
            // but for "unlimited" feed, we append.
        }

        if (reelsQueue.length > 0) {
            itemsToLoad.push(reelsQueue.shift()); // Take the next from the shuffled queue
            loadCount++;
        } else {
            break; // Should not happen if allReelCandidates is populated
        }
    }
    
    if (reelsObserver) reelsObserver.disconnect(); 

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
            <div class="reel-load-more-marker" style="height:1px;"></div> `;
        container.appendChild(reelDiv);
        
        // Re-observe elements
        if (reelsObserver) reelsObserver.observe(reelDiv); 
    });

    // 🛑 NEW: Ensure observer for "load more" marker is set up
    setupInfiniteScrollObserver();
}

function closeReelsPlayer(){
    const player = qs('#reelsPlayer');
    if(player) player.style.display = 'none';
    document.body.style.overflow = '';
    
    qsa('#reelsPlayer iframe').forEach(iframe => {
        iframe.src = 'about:blank';
    });
    
    if (reelsObserver) {
        reelsObserver.disconnect();
        reelsObserver = null;
    }
}

// 🛑 Intersection Observer Setup for Autoplay/Pause
function setupReelsObserver() {
    if (reelsObserver) {
        reelsObserver.disconnect();
    }

    const options = {
        root: qs('#reelsPlayer'), 
        rootMargin: '0px',
        threshold: 0.9 
    };

    reelsObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            // Ignore the load more marker
            if (entry.target.classList.contains('reel-load-more-marker')) return; 

            const iframe = entry.target.querySelector('iframe');
            if (!iframe) return;
            
            // Only control if the iframe source is not 'about:blank'
            if (!iframe.src || iframe.src === 'about:blank') return; 

            if (iframe.dataset.type === 'youtube') {
                if (entry.isIntersecting) {
                    iframe.contentWindow.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
                } else {
                    iframe.contentWindow.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*');
                }
            } else {
                if (entry.isIntersecting) {
                    // Re-trigger Streamtape autoplay by setting src=src
                    iframe.src = iframe.src; 
                } else {
                    // Pause non-YouTube by setting to blank
                    iframe.src = 'about:blank';
                }
            }
        });
    }, options);

    qsa('#reelsContainer .reel').forEach(reel => {
        reelsObserver.observe(reel);
    });
}

// 🛑 NEW: Intersection Observer for Infinite Scroll
function setupInfiniteScrollObserver() {
    // Check if the current batch is less than the load count (meaning we hit the end of the full list)
    if (allReelCandidates.length > 0 && reelsQueue.length < REELS_LOAD_COUNT) {
         // If the queue is almost empty, prepare to reload the next batch immediately
         if (reelsQueue.length === 0) {
             reelsQueue = shuffleArray(allReelCandidates);
         }
    }

    // Set up a new observer for the last element to trigger loadMore
    const lastReel = qsa('#reelsContainer .reel').pop();

    if (lastReel) {
        const loadMoreObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    observer.unobserve(entry.target); // Stop observing
                    // Load the next batch
                    loadReelsBatch(qsa('#reelsContainer .reel').length); 
                }
            });
        }, { root: qs('#reelsPlayer'), threshold: 0.5 }); 
        
        loadMoreObserver.observe(lastReel);
    }
}


// ------------- INIT / BOOT -------------
async function loadAll(){
    const raw = await fetchSheet();
    const parsed = parseRows(raw);

    // 🛑 Sorting FIX: Sort new -> old by date
    parsed.forEach(p => p._sortDate = (p.date ? Date.parse(p.date) || 0 : 0));
    // Sort by date descending (newest first)
    parsed.sort((a,b) => (b._sortDate || 0) - (a._sortDate || 0)); 
    items = parsed;

    filteredItems = items.slice(); 
    
    // 🛑 Reels Setup
    allReelCandidates = items.filter(it => toEmbedUrlForReels(it.trailer || it.watch));

    updateCount(items.length);
    
    // Save data to localStorage for trailer.html
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
