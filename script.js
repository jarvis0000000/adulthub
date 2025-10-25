// script.js
// Dareloom Hub - FINAL V19: Enhanced Iframe Anti-Navigation

// ------------- CONFIG -------------
const SHEET_API = "https://sheets.googleapis.com/v4/spreadsheets/1A2I6jODnR99Hwy9ZJXPkGDtAFKfpYwrm3taCWZWoZ7o/values/Sheet1?alt=json&key=AIzaSyBFnyqCW37BUL3qrpGva0hitYUhxE_x5nw";
const SHEET_API_REELS = "https://sheets.googleapis.com/v4/spreadsheets/1A2I6jODnR99Hwy9ZJXPkGDtAFKfpYwrm3taCWZWoZ7o/values/Sheet3!A:B?alt=json&key=AIzaSyBFnyqCW37BUL3qrpGva0hitYUhxE_x5nw"; 
const PER_PAGE = 5;
const RANDOM_COUNT = 4;

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

// ✅ Reels State
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

// NOTE: getRedgifsDirect is no longer used for Reels but kept for legacy/testing
function getRedgifsDirect(link) {
  if (link.includes("redgifs.com/watch/")) {
    const slug = link.split("/watch/")[1];
    return `https://thumbs2.redgifs.com/${slug}-mobile.mp4`;
  }
  return link;
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

// Main Content (Sheet1) Parser
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

// Reels Sheet (Sheet3) parsing for Title (A) and Link (B)
function parseReelRows(values){
    if (!values || values.length < 2) return [];
    
    const rows = values.slice(1);  
    const out = [];  
    let untitledCounter = 1;

    for (let r of rows){  
        r = Array.isArray(r) ? r : [];  
        
        const titleCandidate = (r[0] || '').toString().trim();  
        const reelLink = (r[1] || '').toString().trim(); 

        if (!reelLink) continue;  

        const finalTitle = titleCandidate || (`Untitled Reel ${untitledCounter}`);
        const id = `${slugify(finalTitle)}|${Math.random().toString(36).slice(2,8)}`;  
        untitledCounter++;

        out.push({  
            id,  
            title: finalTitle,  
            reelLink: reelLink, 
        });  
    }  
    return out; 
}


// ------------- UI / RENDER / FILTER / WATCH LOGIC -------------
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

function filterVideos(query = "") {
    const q = query.toLowerCase().trim();
    if (!q) {
        filteredItems = items;
    } else {
        filteredItems = items.filter(it => 
            it.title.toLowerCase().includes(q) || 
            it.category.toLowerCase().includes(q) ||
            it.description.toLowerCase().includes(q)
        );
    }
    renderLatest(1);
}

function applyTagFilter(tag) {
    const q = tag.toLowerCase().trim();
    filteredItems = items.filter(it => it.category.toLowerCase().includes(q));
    renderLatest(1);
    const s = qs('#searchInput');
    if(s) s.value = ''; // Clear search input
}

// ------------- REELS PLAYER LOGIC (UPDATED) -------------

function toEmbedUrlForReels(url) {
    if (!url) return { type: "none" };
    url = url.trim();

    if (url.startsWith('<iframe') && url.includes('src=')) {
        const match = url.match(/src=['"](.*?)['"]/i);
        if (match && match[1]) {
            return toEmbedUrlForReels(match[1]);
        }
    }

    const y = extractYouTubeID(url);
    if (y) {
        // Reduced iframe controls for a cleaner look
        return { type: "iframe", src: `https://www.youtube.com/embed/${y}?autoplay=1&mute=1&rel=0&controls=0&enablejsapi=1&playsinline=1&origin=${window.location.origin}` }; 
    }
    
    // 🔴 REVERTED: RedGifs watch links now load as iframes to bypass the MP4 hotlinking block
    if (url.includes('redgifs.com/watch/')) {
        const parts = url.split("/watch/");
        if (parts.length > 1) {
             const slug = parts[1].split("?")[0];
             // Converts watch link to ifr embed format
             const embedUrl = `https://www.redgifs.com/ifr/${slug}`; 
             return { type: "iframe", src: embedUrl };
        }
    }
    
    // Keep RedGifs IFRAME handling for existing ifr/ links
    if (url.includes('redgifs.com/ifr/')) {
        let videoId = url.split('/').pop(); 
        videoId = videoId.split('?')[0]; 
        const embedUrl = `https://www.redgifs.com/ifr/${videoId}?autoplay=true&muted=true`; 
        return { type: "iframe", src: embedUrl };
    }

    // Direct MP4/Video links will still use the <video> tag
    if (url.includes('.mp4') || url.includes('.gifv') || url.includes('.webm') || url.includes('.m3u8')) {
        return { type: "video", src: url };
    }
    
    // Fallback for general external URLs
    if (url.startsWith('http')) {
        // Use iframe for general external URLs
        return { type: "iframe", src: url };
    }

    return { type: "none" };
}


// Open player and fetch reels
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
    
    // Reset state for a new session
    usedReelIds.clear(); 
    
    qs('#reelsContainer').innerHTML = ''; 
    qs('#reelsPlayer').style.display = 'flex'; 
    document.body.style.overflow = 'hidden';   

    // Load the first random reel
    loadNextReel();
}


// Helper: toggles sound for current reel (works for <video> directly; tries postMessage for iframe)
function toggleReelSound(e) {
    if (e) e.stopPropagation();
    const container = qs('#reelsContainer');
    if (!container) return;
    const reelDiv = container.querySelector('.reel');
    if (!reelDiv) return;

    const mediaEl = reelDiv.querySelector('.reel-video-media');

    // If it's a video element, toggle mute directly
    if (mediaEl && mediaEl.tagName === 'VIDEO') {
        mediaEl.muted = !mediaEl.muted;
        if (!mediaEl.muted) {
            mediaEl.volume = 1.0;
            mediaEl.play().catch(()=>{});
        }
        // Quick icon feedback
        const icon = document.createElement("div");
        icon.textContent = mediaEl.muted ? "🔇" : "🔊";
        Object.assign(icon.style, {
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            fontSize: "60px",
            color: "white",
            textShadow: "0 0 5px black",
            opacity: "0.95",
            transition: "opacity 0.6s ease-out",
            pointerEvents: "none",
            zIndex: "9999",
        });
        reelDiv.appendChild(icon);
        setTimeout(() => (icon.style.opacity = "0"), 100);
        setTimeout(() => icon.remove(), 600);
        return;
    }

    // If it's an iframe, try to postMessage a toggle command
    if (mediaEl && mediaEl.tagName === 'IFRAME') {
        try {
            mediaEl.contentWindow.postMessage({ command: "toggleSound" }, "*");
            const icon = document.createElement("div");
            icon.textContent = "🔊";
            Object.assign(icon.style, {
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                fontSize: "48px",
                color: "white",
                textShadow: "0 0 5px black",
                opacity: "0.95",
                transition: "opacity 0.6s ease-out",
                pointerEvents: "none",
                zIndex: "9999",
            });
            reelDiv.appendChild(icon);
            setTimeout(() => (icon.style.opacity = "0"), 100);
            setTimeout(() => icon.remove(), 600);
        } catch (err) {
            console.warn("Iframe sound toggle postMessage failed:", err);
            // Fallback: show a temporary notice that iframe sound control isn't available
            const note = document.createElement("div");
            note.textContent = "Sound control not available for this embed";
            Object.assign(note.style, {
                position: "absolute",
                bottom: "16px",
                left: "50%",
                transform: "translateX(-50%)",
                fontSize: "13px",
                color: "white",
                background: "rgba(0,0,0,0.5)",
                padding: "6px 10px",
                borderRadius: "6px",
                zIndex: "9999",
                pointerEvents: "none"
            });
            reelDiv.appendChild(note);
            setTimeout(()=> note.remove(), 1400);
        }
        return;
    }

    
    // Nothing found
    log("No media element found to toggle sound");
}


function loadNextReel() {
  openAdsterraPop();

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

  const item = available[Math.floor(Math.random() * available.length)];
  usedReelIds.add(item.id);

  const embedInfo = toEmbedUrlForReels(item.reelLink);
  if (embedInfo.type === "none") {
    log("Invalid embed link, skipping...");
    // schedule retry asynchronously to avoid deep recursion
    setTimeout(loadNextReel, 0);
    return;
  }

  // 🎞️ Fade transition
  container.style.transition = "opacity 0.3s ease";
  container.style.opacity = 0;

  setTimeout(() => {
    container.innerHTML = "";
    const reelDiv = document.createElement("div");
    reelDiv.className = "reel";
    reelDiv.style.height = "100vh";
    reelDiv.style.overflow = "hidden";
    reelDiv.style.position = "relative";
    const reelsPlayer = qs('#reelsPlayer');

    // We'll build DOM nodes to allow overlay handling when iframe is used
    if (embedInfo.type === "video") {
      // ** VIDEO TAG LOGIC (UNTOUCHED) **
      const video = document.createElement('video');
      video.className = "reel-video-media";
      video.loop = true;
      video.playsInline = true;
      video.autoplay = true;
      video.muted = true;
      video.preload = "auto";
      video.src = embedInfo.src;
      video.style.width = "100%";
      video.style.height = "100%";
      video.style.objectFit = "cover";

      // wrapper for consistent layout
      const embedWrap = document.createElement('div');
      embedWrap.className = "reel-video-embed";
      embedWrap.style.position = "relative";
      embedWrap.style.width = "100%";
      embedWrap.style.height = "100%";
      embedWrap.appendChild(video);

      // overlay for tap detection
      const overlay = document.createElement('div');
      overlay.className = "reel-touch-overlay";
      overlay.style.position = "absolute";
      overlay.style.inset = "0";
      overlay.style.background = "transparent";
      overlay.style.zIndex = "30";
      overlay.style.cursor = "pointer";

      overlay.addEventListener('click', (e) => {
        e.stopPropagation();
        const now = Date.now();
        const tapDiff = now - (overlay._lastTap || 0);
        overlay._lastTap = now;

        // Double tap -> next
        if (tapDiff < 300) {
          log("👆 Double tap detected - next reel");
          loadNextReel();
          return;
        }

        // Single tap -> toggle sound on video
        video.muted = !video.muted;
        if (!video.muted) {
          video.volume = 1.0;
          video.play().catch(()=>{});
        }

        const icon = document.createElement("div");
        icon.textContent = video.muted ? "🔇" : "🔊";
        Object.assign(icon.style, {
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            fontSize: "60px",
            color: "white",
            textShadow: "0 0 5px black",
            opacity: "0.9",
            transition: "opacity 0.6s ease-out",
            pointerEvents: "none",
            zIndex: "9999",
        });
        reelDiv.appendChild(icon);
        setTimeout(() => (icon.style.opacity = "0"), 100);
        setTimeout(() => icon.remove(), 600);
      });

      embedWrap.appendChild(overlay);
      reelDiv.appendChild(embedWrap);

    } else if (embedInfo.type === "iframe") {
      // ** IFRAME LOGIC (UPDATED for Sound and Security Compromise) **
    } else if (embedInfo.type === "iframe") {
      
      // --- Create iframe ---
      const iframe = document.createElement("iframe");
      iframe.className = "reel-video-media";
      iframe.src = embedInfo.src;
      iframe.allow = "autoplay; fullscreen; encrypted-media";
      iframe.allowFullscreen = true;
      iframe.setAttribute("sandbox", "allow-scripts allow-same-origin allow-fullscreen");
      iframe.style.width = "100%";
      iframe.style.height = "100%";
      iframe.style.border = "none";
      // Iframe is fully clickable to allow internal RedGifs buttons to work
      iframe.style.pointerEvents = "auto"; 
      iframe.style.transformOrigin = "center center";
      iframe.style.transform = 'scale(1.05)'; 

      // --- Wrapper ---
      const wrapper = document.createElement("div");
      wrapper.className = "reel-frame";
      wrapper.style.position = "relative";
      wrapper.style.width = "100%";
      wrapper.style.height = "100%";
      wrapper.style.overflow = "hidden"; // Important for masking

      // 🔴 TOUCH BLOCKER MASK (Covers everything EXCEPT the bottom right corner)
      // This is the core of the new anti-redirect/sound solution
      const touchBlocker = document.createElement("div");
      touchBlocker.className = "reel-touch-blocker";
      touchBlocker.style.position = "absolute";
      touchBlocker.style.inset = "0";
      touchBlocker.style.zIndex = "30"; 
      touchBlocker.style.background = "transparent";
      
      // We use clip-path or a similar technique to create a hole. 
      // Using multiple DIVs is more reliable in cross-browser JS:
      
      // 1. Top Blocker (Covers everything above 60% of the screen)
      const topBlocker = document.createElement("div");
      topBlocker.style.position = "absolute";
      topBlocker.style.inset = "0 0 40% 0"; // Covers top 60%
      topBlocker.style.background = "transparent";
      
      // 2. Left Blocker (Covers the left side of the screen)
      const leftBlocker = document.createElement("div");
      leftBlocker.style.position = "absolute";
      leftBlocker.style.inset = "60% 50% 0 0"; // Covers bottom-left
      leftBlocker.style.background = "transparent";


      // 🛑 Function to stop external navigation
      const stopNavigation = (e) => {
        e.stopPropagation();
        e.preventDefault();
        // Custom logic for double-tap next reel is removed here to prioritise sound/buttons.
        log("🛑 Iframe tap blocked by mask.");
      };

      // Attach blocker logic
      topBlocker.addEventListener("click", stopNavigation);
      leftBlocker.addEventListener("click", stopNavigation);

      touchBlocker.appendChild(topBlocker);
      touchBlocker.appendChild(leftBlocker);
      

      // --- Custom Next Reel Button ---
      // We must move Next Reel button logic here to make sure it's clickable
      const buttons = document.createElement('div');
      buttons.className = "reel-buttons";
      // This Z-Index must be higher than the touchBlocker (30)
      buttons.style.zIndex = "50"; 
      buttons.style.justifyContent = "flex-end";
      buttons.style.position = "absolute";
      buttons.style.bottom = "10px";
      buttons.style.right = "10px";
      buttons.innerHTML = `<button class="next-reel-btn">Next Reel »</button>`;
      
      // --- Combine ---
      wrapper.appendChild(iframe);
      wrapper.appendChild(touchBlocker); // The blocker is now a mask with a hole
      
      reelDiv.appendChild(wrapper);
      reelDiv.appendChild(buttons); // Add custom buttons to the reelDiv


    // Buttons area (unchanged)
    const buttons = document.createElement('div');
    buttons.className = "reel-buttons";
    buttons.style.zIndex = "50";
    buttons.style.justifyContent = "flex-end";
    buttons.innerHTML = `<button class="next-reel-btn">Next Reel »</button>`;
    reelDiv.appendChild(buttons);

    container.appendChild(reelDiv);

    // --------------- BUTTON LOGIC ---------------
    const nextBtn = reelDiv.querySelector(".next-reel-btn");
    if (nextBtn) {
      nextBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          log("👉 Next Reel Button Clicked");
          loadNextReel();
      });
    }

    // --------------- AUTOPLAY / IFRAME TWEAKS ---------------
    const mediaEl = reelDiv.querySelector(".reel-video-media");
    if (mediaEl) {
      if (mediaEl.tagName === "VIDEO") {
        // FIX: Autoplay start
        mediaEl.muted = true; 
        mediaEl.volume = 1.0;
        mediaEl.play().catch(() => log("Autoplay blocked — muted"));
      }
      // Note: Iframe scale is already applied above
    }

    // fade-in
    setTimeout(() => (container.style.opacity = 1), 50);

    // 🧠 Swipe system (attached to container)
    container.removeEventListener('touchstart', handleTouchStart);
    container.removeEventListener('touchend', handleTouchEnd);
    container.addEventListener('touchstart', handleTouchStart);
    container.addEventListener('touchend', handleTouchEnd);


  }, 300);
}

function handleTouchStart(e){
    swipeStartY = e.touches[0].clientY;
}

function handleTouchEnd(e){
    const swipeEndY = e.changedTouches[0].clientY;
    const diffY = swipeStartY - swipeEndY;
    
    // Only proceed if it was a clear SWIPE (large movement)
    if (Math.abs(diffY) > 80) { 
        if (diffY > 0) {
            // swipe up → next reel
            loadNextReel(); 
        } else {
             // swipe down → next reel 
            loadNextReel();
        }
    } 
}


function closeReelsPlayer(){
    const player = qs('#reelsPlayer');
    if(player) player.style.display = 'none';
    document.body.style.overflow = '';

    const mediaEl = qs('#reelsContainer .reel-video-media');  
    if (mediaEl) {
        if (mediaEl.tagName === 'VIDEO') {
            mediaEl.pause();
            mediaEl.currentTime = 0;
            mediaEl.muted = true; 
        } else if (mediaEl.tagName === 'IFRAME') {
            mediaEl.src = 'about:blank'; 
        }
    }
    
    usedReelIds.clear(); 
}


// ------------- INIT / BOOT -------------

function markUserGesture(){
userInteracted = true;
}

function setupGestureListener(){
    ['click', 'touchstart', 'keydown'].forEach(e => {
        document.addEventListener(e, markUserGesture, {once: true});
    });

    // Block Redgifs auto navigation attempts (Added your new code here)
    window.addEventListener("blur", () => {
        if (document.activeElement && document.activeElement.tagName === "IFRAME") {
            window.focus(); // Prevent external focus / redirect
            log("🛑 RedGifs blur redirect attempt blocked.");
        }
    });
}

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

loadAll();
