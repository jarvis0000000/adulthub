// script.js
// Dareloom Hub - Complete player + sheet + pagination + preview/watch + tags + random
// 2025-10-20 (UPDATED: Trailer Page Fix, Reels Autoplay/Pause Logic)

// ------------- CONFIG -------------
const SHEET_API = "https://sheets.googleapis.com/v4/spreadsheets/1A2I6jODnR99Hwy9ZJXPkGDtAFKfpYwrm3taCWGZWoZ7o/values/Sheet1?alt=json&key=AIzaSyBFnyqCW37BUL3qrpGva0hitYUhxE_x5nw";
const PER_PAGE = 5;
const RANDOM_COUNT = 4;
const REELS_LOAD_COUNT = 8;

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
let reelsObserver; // Intersection Observer for reels

// ------------- UTIL HELPERS -------------
const qs = sel => document.querySelector(sel);
const qsa = sel => Array.from(document.querySelectorAll(sel));

function log(...a){ console.log("[dareloom]", ...a); }

function slugify(text){
    return (text||'').toString().toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'','');
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

        // 🛑 IMPORTANT: Use slugify(title) only for ID prefix
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
    // (Unchanged)
    // ...
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
                    <button class="btn preview-btn" data-id="${escapeHtml(it.id)}">Details & Trailer</button> 
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
    // (Unchanged)
    // ...
}

function changePage(page){
    // (Unchanged)
    // ...
}

function attachLatestListeners(){
    qsa('#latestList .preview-btn, #latestList .latest-thumb').forEach(el => {
        el.removeEventListener('click', onPreviewClick);
        el.addEventListener('click', onPreviewClick);
    });
    // Removed direct watch button listener from latest list, all clicks go to trailer page first
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
    openTrailerPage(it);
}

function onWatchClick(e){
    // This is now redundant if all buttons point to trailer page or use openWatchPage directly
    markUserGesture();
    const url = e.currentTarget.dataset.url;
    if (!url) return;
    openWatchPage(url);
}

function onTagClick(e){
    // (Unchanged)
    // ...
}

// ------------- TRAILER PAGE LOGIC -------------

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

// ------------- REELS PLAYER LOGIC & AUTOPLAY FIX -------------

function shuffleArray(array) {
    // (Unchanged)
    // ...
}

function toEmbedUrlForReels(url){
    if (!url) return '';
    url = url.trim();

    const y = extractYouTubeID(url);
    // 🛑 CRITICAL: Add &enablejsapi=1 to allow JS control for play/pause
    if (y) return `https://www.youtube.com/embed/${y}?autoplay=1&rel=0&mute=1&controls=0&enablejsapi=1`; 

    if (url.includes('streamtape.com') && url.includes('/v/')){
        const id = url.split('/v/')[1]?.split('/')[0];
        if (id) return `https://streamtape.com/e/${id}/`;
    }
    
    if (url.startsWith('http') && !url.includes('youtube') && !url.includes('streamtape')) {
        // Assume direct video file (will use a <video> tag later for better control, but iframe for now)
        return url; 
    }
    return '';
}

function openReelsPlayer() {
    markUserGesture();
    openAdsterraPop();
    
    const reelCandidates = items.filter(it => toEmbedUrlForReels(it.trailer || it.watch));
    reelsQueue = shuffleArray(reelCandidates); 
    
    const container = qs('#reelsContainer');
    container.innerHTML = ''; 

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
        reelsQueue = shuffleArray(items.filter(it => toEmbedUrlForReels(it.trailer || it.watch)));
        loadReelsBatch(0);
        return;
    }

    // Disconnect observer before adding new elements
    if (reelsObserver) reelsObserver.disconnect(); 

    for (let i = startIndex; i < endIndex; i++) {
        const it = reelsQueue[i];
        
        const embedUrl = toEmbedUrlForReels(it.trailer || it.watch);
        if (!embedUrl) continue; 
        
        const reelDiv = document.createElement('div');
        reelDiv.className = 'reel';
        
        const telegramBtn = it.telegram ? 
            `<button onclick="window.open('${escapeHtml(it.telegram)}', '_blank')">Download Telegram</button>` : '';
        const streamtapeBtn = it.watch.includes('streamtape.com') ? 
            `<button onclick="openWatchPage('${escapeHtml(it.watch)}')">Open Streamtape</button>` : '';

        // Main action button
        const mainBtnText = it.watch ? 'Open Player' : 'View Details';
        const mainBtnAction = it.watch ? `openWatchPage('${escapeHtml(it.watch)}')` : `openTrailerPage('${escapeHtml(it.id)}')`;

        reelDiv.innerHTML = `
            <div class="reel-video-embed">
                <iframe src="${escapeHtml(embedUrl)}" 
                        frameborder="0" 
                        data-type="${embedUrl.includes('youtube') ? 'youtube' : 'other'}"
                        allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                        allowfullscreen 
                        loading="lazy">
                </iframe>
            </div>
            <div class="reel-buttons">
                <div style="padding: 0 0 10px 0; font-size: 1rem; color: var(--primary-color); font-weight: 600;">${escapeHtml(it.title)}</div>
                <div class="reel-buttons-group">
                    <button onclick="${mainBtnAction}">${mainBtnText}</button>
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

            // Use postMessage to control YouTube player if applicable, otherwise reload/pause
            if (iframe.dataset.type === 'youtube') {
                // If it's the main visible element, post "play"
                if (entry.isIntersecting) {
                    // console.log("Playing:", entry.target.querySelector('.reel-buttons div').textContent);
                    iframe.contentWindow.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
                } else {
                    // console.log("Pausing:", entry.target.querySelector('.reel-buttons div').textContent);
                    iframe.contentWindow.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*');
                }
            } else {
                // For Streamtape or direct video links, simply reload the iframe (Streamtape will auto-play on load)
                if (entry.isIntersecting) {
                    // Only reload if it's currently showing 'about:blank' or is not already playing
                    if (!iframe.src || iframe.src === 'about:blank') {
                         iframe.src = iframe.src; // Simple way to reload the current src
                    }
                } else {
                    // For non-YouTube, simply stop the iframe
                    iframe.src = 'about:blank';
                }
            }
        });
    }, options);

    // Start observing all currently loaded reels
    qsa('#reelsContainer .reel').forEach(reel => {
        reelsObserver.observe(reel);
    });
}


// ------------- INIT / BOOT -------------
async function loadAll(){
    const raw = await fetchSheet();
    const parsed = parseRows(raw);

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

    const s = qs('#searchInput'); 
    if (s){ 
        s.addEventListener('input', (e) => { 
            const q = e.target.value || ""; 
            filterVideos(q); 
        }); 
    }

    setupGestureListener(); 
}

// ... (updateCount, markUserGesture, setupGestureListener, showRandomPick functions are unchanged) ...

// Start the application
loadAll();
                // Add this line inside the loadAll function, right before the initial renders:
// Save data to localStorage for the trailer.html page to access
localStorage.setItem('dareloom_items', JSON.stringify(items)); 
        
