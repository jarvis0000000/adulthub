// script.js
// Dareloom Hub - FINAL V24 PRO (Updated, performance & search improvements)
// NOTE: This is the V24 PRO file - original logic preserved, no cuts, added debounce + combined search.

// -----------------------------------------------------
// 🛠️ IMPORTANT: Configuration with Corrected Sheet ID
// -----------------------------------------------------
const CORRECT_SHEET_ID = "1A2I6jODnR99Hwy9ZJXPkGDtAFKfpYwrm3taCWZWoZ7o";
const API_KEY = "AIzaSyBFnyqCW37BUL3qrpGva0hitYUhxE_x5nw";

const SHEET_API = `https://sheets.googleapis.com/v4/spreadsheets/${CORRECT_SHEET_ID}/values/Sheet1?alt=json&key=${API_KEY}`;
const SHEET_API_REELS = `https://sheets.googleapis.com/v4/spreadsheets/${CORRECT_SHEET_ID}/values/Sheet3!A:B?alt=json&key=${API_KEY}`;
const PER_PAGE = 5;
const RANDOM_COUNT = 4;

// ------------- STATE -------------
let items = [];
let filteredItems = [];
let currentPage = 1;
let allReelCandidates = [];
let usedReelIds = new Set();
let swipeStartY = 0;
let lastTapTime = 0;

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
    .replace(/'/g,'&#39;');
}

function extractYouTubeID(url){
    if(!url) return null;
    const m = url.match(/(?:v=|youtu.be\/|shorts\/|embed\/)([0-9A-Za-z_-]{11})/);
    return m ? m[1] : null;
}

/**
 * 💥 EMBED FIX: Streamwish and Mixdrop URLs को सही Embed Format में बदलता है।
 * * यह लॉजिक Mixdrop के /f/ को /e/ से और Streamwish के डायरेक्ट ID को /e/ से बदलता है।
 * * @param {string} videoUrl - Google Sheet से मिला वीडियो URL
 * * @returns {string} - सही Embed URL
 */
function getEmbedUrl(videoUrl) {
    if (!videoUrl) return null;

    // 1. Mixdrop Fix: /f/ को /e/ से बदलता है (डोमेन बदलने पर भी काम करेगा)
    if (videoUrl.includes('mixdrop') || videoUrl.includes('mixdrops')) {
        // Case-insensitive replacement
        return videoUrl.replace(/\/(f|embed)\//i, '/e/');
    }

    // 2. Streamwish Fix:
    // (A) अगर URL में /file/ है, तो उसे /e/ से बदलें (पुराने Streamwish फॉर्मेट के लिए)
    if (videoUrl.includes('/file/')) {
        return videoUrl.replace('/file/', '/e/');
    }

    // (B) अगर URL में सिर्फ Domain के बाद ID है (जैसे hglink.to/ID)
    if (videoUrl.match(/https?:\/\/[^\/]+\/[a-zA-Z0-9]+$/)) {
        return videoUrl.replace(/\/([a-zA-Z0-9]+)$/, '/e/$1');
    }

    // 3. Streamtape या अन्य (अगर कोई Fix ज़रूरी नहीं है)
    return videoUrl;
}
// 💥 END OF EMBED FIX LOGIC

function makeThumbnail(it){
    if (it.poster && it.poster.trim()) return it.poster.trim();
    const y = extractYouTubeID(it.trailer || it.watch);
    if (y) return `https://img.youtube.com/vi/${y}/hqdefault.jpg`;
    return 'https://placehold.co/600x400?text=Dareloom+Hub';
}

function getRedgifsDirect(link) {
    if (!link) return link;
    if (link.includes("redgifs.com/watch/")) {
        const slug = link.split("/watch/")[1];
        return `https://thumbs2.redgifs.com/${slug}-mobile.mp4`;
    }
    return link;
}

// ------------- SHEET FETCH & PARSE (UNCHANGED) -------------
async function fetchSheet(url){
    try{
        const res = await fetch(url);
        if (!res.ok) throw new Error('sheet fetch failed ' + res.status);
        const j = await res.json();
        // Google Sheets API returns { values: [...] } and sometimes nested - handle both
        if (j && j.values) return j.values;
        if (Array.isArray(j)) return j;
        return [];
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

function parseReelRows(values){
    if (!values || values.length < 2) return [];

    const rows = values.slice(1);
    const out = [];

    for (let r of rows){
        r = Array.isArray(r) ? r : [];

        const finalTitle = (r[0] || '').toString().trim();  
        const reelLink = (r[1] || '').toString().trim();  

        if (!reelLink) continue;  

        const id = `${slugify(finalTitle || 'reel')}|${Math.random().toString(36).slice(2,8)}`;  

        out.push({  
            id,  
            title: finalTitle,  
            reelLink: reelLink,  
        });

    }
    return out;
}

// ------------- UI / RENDER / FILTER / WATCH LOGIC (UNCHANGED BUT IMPROVED) -------------
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
    // Use a DocumentFragment to reduce reflows when building list
    const frag = document.createDocumentFragment();
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
        renderPagination(totalPages, currentPage);
        attachLatestListeners();
        return;
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

        frag.appendChild(div);

    });

    list.appendChild(frag);
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
    e.stopPropagation();
    const id = e.currentTarget.dataset.id;
    const it = items.find(x => x.id === id);
    if (!it) return;
    openTrailerPage(it);
}

function onWatchClick(e){
    e.stopPropagation();
    const url = e.currentTarget.dataset.url;
    if (!url) return;
    openWatchPage(url);
}

function onTagClick(e){
    e.stopPropagation();
    const tag = e.currentTarget.dataset.tag;
    if (!tag) return;
    applyTagFilter(tag);
}

// ⚠️ FIXED: Removed setTimeout to resolve Smart Link conflict.
function openTrailerPage(it){
    const trailerURL = `/trailer.html?id=${encodeURIComponent(it.id)}`;
    try {
        window.location.href = trailerURL;
    } catch(e){
        console.error("Failed to open trailer page", e);
    }
}

// ⚠️ FIXED: Removed setTimeout to resolve Smart Link conflict.
function openWatchPage(fullWatchLinks){
    if (!fullWatchLinks) return;

    const finalDestination = `/watch?url=${encodeURIComponent(fullWatchLinks)}`;
    const redirectPage = `/go.html?target=${encodeURIComponent(finalDestination)}`;

    try {
        const w = window.open(redirectPage, '_blank');
        if (!w || w.closed || typeof w.closed === 'undefined'){
            alert("Please allow pop-ups to open the link in a new tab!");
        }
    } catch(e){
        console.error(e);
    }
}

/**
 * * Combined, Google-style token matching:
 * * 1. Tokenize the query by spaces (ignore extra spaces).
 * 2. For each token, check if token is included in any of the searchable fields.
 * 3. All tokens must match somewhere (AND behavior) — this mimics Google's multi-term relevance.
 * 4. Fields checked: title, category, description (and watch/trailer URLs optionally if you want)
 */
function matchesQuery(it, tokens){
    if (!tokens || tokens.length === 0) return true;
    // Build a single searchable string combining important fields (lowercased)
    const searchable = [
        (it.title||''),
        (it.category||''),
        (it.description||'')
    ].join(' ').toLowerCase();


    // For better matching, also check the title tokens separately (so partial tokens match)
    for (let tk of tokens){
        if (!tk) continue;
        const t = tk.toLowerCase();
        if (searchable.includes(t)) {
            continue; // this token matched somewhere -> good
        }
        // fallback: check slugified title vs token (helps with dashed slugs)
        if ((slugify(it.title||'')).includes(slugify(t))) {
            continue;
        }
        // If token not found in any field -> no match
        return false;
    }
    return true;
}

// Debounce helper
function debounce(fn, wait){
    let t;
    return function(...args){
        clearTimeout(t);
        t = setTimeout(()=> fn.apply(this, args), wait);
    };
}

// New filterVideos: uses tokenization and matchesQuery().
// Keeps behavior safe: when query empty -> show all.
function filterVideos(query = "") {
    const q = (query || "").toString().toLowerCase().trim();
    if (!q) {
        filteredItems = items;
        renderLatest(1);
        return;
    }
    // Tokenize query on whitespace; remove empty tokens
    const tokens = q.split(/\s+/).map(s => s.trim()).filter(Boolean);
    // Use efficient filtering
    filteredItems = items.filter(it => matchesQuery(it, tokens));
    renderLatest(1);
}

// Apply tag filter (keeps original behavior but clears search input)
function applyTagFilter(tag) {
    const q = tag.toLowerCase().trim();
    filteredItems = items.filter(it => (it.category||'').toLowerCase().includes(q));
    renderLatest(1);
    const s = qs('#searchInput');
    if(s) s.value = ''; // Clear search input
}

// ------------- REELS PLAYER LOGIC (FIXED UI & SOUND FEEDBACK) -------------

function toEmbedUrlForReels(url) {
    if (!url) return { type: "none" };
    url = url.trim();

    if (url.startsWith('<iframe') && url.includes('src=')) {
        const match = url.match(/src="([^'"]+)"/i);
        if (match && match[1]) {
            return toEmbedUrlForReels(match[1]);
        }
    }

    const y = extractYouTubeID(url);
    if (y) {
        return { type: "iframe", src: `https://www.youtube.com/embed/${y}?autoplay=1&mute=1&rel=0&controls=0&enablejsapi=1&playsinline=1&origin=${window.location.origin}` };
    }

    if (url.includes('redgifs.com/watch/')) {
        const parts = url.split("/watch/");
        if (parts.length > 1) {
            const slug = parts[1].split("?")[0];
            const embedUrl = `https://www.redgifs.com/ifr/${slug}`;
            return { type: "iframe", src: embedUrl };
        }
    }

    if (url.includes('redgifs.com/ifr/')) {
        let videoId = url.split('/').pop();
        videoId = videoId.split('?')[0];
        const embedUrl = `https://www.redgifs.com/ifr/${videoId}`;
        return { type: "iframe", src: embedUrl };
    }

    if (url.includes('.mp4') || url.includes('.gifv') || url.includes('.webm') || url.includes('.m3u8')) {
        return { type: "video", src: url };
    }

    if (url.startsWith('http')) {
        return { type: "iframe", src: url };
    }

    return { type: "none" };
}

async function openReelsPlayer() {
    if (allReelCandidates.length === 0) {
        const rawReels = await fetchSheet(SHEET_API_REELS);
        allReelCandidates = parseReelRows(rawReels);
        if (allReelCandidates.length === 0) {
            alert("No videos available for Reels playback. Check Sheet links.");
            return;
        }
    }

    usedReelIds.clear();

    const rc = qs('#reelsContainer');
    if (rc) rc.innerHTML = '';
    const rp = qs('#reelsPlayer');
    if (rp) rp.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    loadNextReel();
}

// Removed toggleReelSound function as requested (kept empty for compatibility)
function toggleReelSound(e) {
    if (e) e.stopPropagation();
    const reelDiv = qs('#reelsContainer .reel');
    if (!reelDiv) return;
    const mediaEl = reelDiv.querySelector('.reel-video-media');

    if (mediaEl && mediaEl.tagName === 'VIDEO') {
        mediaEl.muted = !mediaEl.muted;
    }
}

function loadNextReel() {
    const container = qs("#reelsContainer");

    if (usedReelIds.size >= allReelCandidates.length) {
        usedReelIds.clear();
        log("♻️ All reels shown once — starting new random cycle.");
    }

    let available = allReelCandidates.filter(x => !usedReelIds.has(x.id));
    if (available.length === 0) {
        container.innerHTML = `<h2 style="color:var(--primary-color);text-align:center;margin-top:40vh;">No Reels Found</h2>`;
        return;
    }

    const randomIndex = Math.floor(Math.random() * available.length);
    const reel = available[randomIndex];
    usedReelIds.add(reel.id);

    container.innerHTML = '';
    container.style.opacity = 0;

    const embedInfo = toEmbedUrlForReels(reel.reelLink);

    const reelDiv = document.createElement("div");
    reelDiv.className = "reel";

    if (embedInfo.type === "video") {
        reelDiv.innerHTML = `  
            <video 
                class="reel-video-media" 
                src="${escapeHtml(embedInfo.src)}" 
                loop 
                muted 
                playsinline 
                preload="metadata" 
                controls 
                onloadeddata="this.play().catch(()=>{})" 
            ></video> 
            <div class="reel-buttons" style="position: absolute; bottom: 60px; right: 10px; z-index: 10000; display:flex; flex-direction:column; gap:8px;"> 
                <button class="next-btn" onclick="loadNextReel()" style="background: #e91e63; color: white; border: none; padding: 10px; border-radius: 5px; font-weight:bold;">Next Reel</button> 
            </div>  
        `;
    } else if (embedInfo.type === "iframe") {

        const iframe = document.createElement("iframe");
        iframe.className = "reel-video-media";
        iframe.src = embedInfo.src;
        iframe.frameBorder = "0";
        iframe.allow = "autoplay; fullscreen; picture-in-picture";
        iframe.allowFullscreen = true;
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        reelDiv.appendChild(iframe);
        
        // Add a Next button overlay for iframes
        const btnContainer = document.createElement('div');
        btnContainer.className = 'reel-buttons';
        btnContainer.style.cssText = "position: absolute; bottom: 60px; right: 10px; z-index: 10000; display:flex; flex-direction:column; gap:8px;";
        btnContainer.innerHTML = `
            <button class="next-btn" onclick="loadNextReel()" style="background: #e91e63; color: white; border: none; padding: 10px; border-radius: 5px; font-weight:bold;">Next Reel</button>
        `;
        reelDiv.appendChild(btnContainer);

    } else {
        reelDiv.innerHTML = `
            <div style="text-align:center; padding: 20px; color: var(--muted); margin-top: 40vh;">
                Link type not supported for embed or link is invalid.
                <div style="margin-top: 20px;">
                    <button class="next-btn" onclick="loadNextReel()" style="background: #e91e63; color: white; border: none; padding: 10px; border-radius: 5px; font-weight:bold;">Next Reel</button>
                </div>
            </div>
        `;
    }

    container.appendChild(reelDiv);

    // Fade in the new reel
    setTimeout(() => {
        container.style.opacity = 1;
        // Attempt to play video if it's a video element
        const mediaEl = reelDiv.querySelector('.reel-video-media');
        if (mediaEl && mediaEl.tagName === 'VIDEO') {
            mediaEl.play().catch(e => {
                log("Autoplay blocked for video:", e);
                // Can add a UI message to tap to play if needed
            });
        }
    }, 50); // Small delay for CSS transition

}

function closeReelsPlayer() {
    const rp = qs('#reelsPlayer');
    if (rp) rp.style.display = 'none';
    document.body.style.overflow = 'auto';
    // Stop all media playback when closing
    qsa('#reelsContainer .reel-video-media').forEach(el => {
        if (el.tagName === 'VIDEO') {
            el.pause();
            el.currentTime = 0;
        } else if (el.tagName === 'IFRAME') {
            // Reloading the iframe's source often stops playback
            el.src = el.src;
        }
    });
}

function setupGestureListener() {
    const rp = qs('#reelsPlayer');
    if (!rp) return;

    rp.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
            swipeStartY = e.touches[0].clientY;
        }
    }, false);

    rp.addEventListener('touchend', (e) => {
        if (e.changedTouches.length === 1) {
            const swipeEndY = e.changedTouches[0].clientY;
            const diff = swipeStartY - swipeEndY;

            // Swipe Up to Next Reel
            if (diff > 100) { 
                loadNextReel();
            } 
            // Swipe Down to Close
            else if (swipeEndY - swipeStartY > 100) {
                closeReelsPlayer();
            }
        }
    }, false);
    
    // Simple Tap-to-Play/Mute for Video Element (to handle autoplay restrictions)
    rp.addEventListener('click', (e) => {
        const now = Date.now();
        const reelDiv = qs('#reelsContainer .reel');
        if (!reelDiv) return;
        const mediaEl = reelDiv.querySelector('.reel-video-media');
        
        // Prevent action if clicking on buttons
        if (e.target.closest('.next-btn, .close-btn')) return;

        if (mediaEl && mediaEl.tagName === 'VIDEO') {
            // Double tap to mute/unmute
            if (now - lastTapTime < 300) {
                mediaEl.muted = !mediaEl.muted;
            } else {
                // Single tap to play/pause (good for mobile video UX)
                if (mediaEl.paused) {
                    mediaEl.play().catch(err => log('Play failed on tap:', err));
                } else {
                    mediaEl.pause();
                }
            }
        }
        lastTapTime = now;
    }, false);
}


// ------------- MAIN INIT LOGIC (IMPROVED ERROR HANDLING) -------------
async function loadAll(){
    // Use a temporary function for async work
    async function init() {
        // 1. Fetch Main Sheet Data
        log("Fetching main sheet data...");
        let rawValues = [];
        try {
            rawValues = await fetchSheet(SHEET_API);
        } catch (e) {
            console.error("Failed to fetch main sheet API:", e);
            qs('#latestList').innerHTML = '<div style="text-align:center; padding: 20px; color: red;">ERROR: Could not fetch video data. Check Google Sheet Access and API Key.</div>';
            return;
        }

        // 2. Parse and Prepare Main Items
        items = parseRows(rawValues);
        log("Total main items loaded:", items.length);

        // Fallback for empty list after parsing
        if (items.length === 0) {
            qs('#latestList').innerHTML = '<div style="text-align:center; padding: 20px; color: var(--muted);">No videos found in the sheet.</div>';
        }
        
        // 3. Attempt to fetch Reels data in the background (fail silently)
        try {
            log("Attempting to fetch reels data...");
            const rawReels = await fetchSheet(SHEET_API_REELS);
            allReelCandidates = parseReelRows(rawReels);
            log("Total reels loaded:", allReelCandidates.length);
        } catch(e) {
            console.warn("Could not load Reels data, proceeding without Reels feature.", e);
        }

        // 4. Initial Render
        filteredItems = items;

        // Save to localStorage for quick reloads (if successful)
        if (items.length > 0) {
            try {
                localStorage.setItem('dareloom_items', JSON.stringify(items));
            } catch(e) {
                // localStorage could fail in private modes; ignore silently
            }
        }


        renderLatest(1);
        renderRandom();

        const s = qs('#searchInput');
        if (s){
            // Debounced handler for better UX
            const debounced = debounce((e) => {
                const q = e.target.value || "";
                filterVideos(q);
            }, 250);
            s.removeEventListener('input', debounced);
            s.addEventListener('input', debounced);

            // Also handle Enter key to jump to results immediately  
            s.addEventListener('keydown', (ev) => {  
                if (ev.key === 'Enter') {  
                    filterVideos(s.value || '');  
                }  
            });

        }

        setupGestureListener();
    }

    // Try to load from localStorage first for faster load time
    const cachedItems = localStorage.getItem('dareloom_items');
    if (cachedItems) {
        try {
            items = JSON.parse(cachedItems);
            filteredItems = items;
            log("Loaded items from cache. Total:", items.length);
            renderLatest(1);
            renderRandom();
            // Still run init() to fetch the latest data in background
            init();
            return;
        } catch(e) {
            log("Failed to parse cached items, fetching live data.", e);
            // Fallthrough to live fetch
        }
    }
    
    // If no cache or cache failed, run the main init
    init();
}

loadAll();
