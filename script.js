// script.js
// Dareloom Hub - FINAL REELS INTEGRATION (v12): Double-Tap Next Reel & Volume Toggle, Perfect Anti-Exit/Audio Fix

// ------------- CONFIG -------------
const SHEET_API = "https://sheets.googleapis.com/v4/spreadsheets/1A2I6jODnR99Hwy9ZJXPkGDtAFKfpYwrm3taCWZWoZ7o/values/Sheet1?alt=json&key=AIzaSyBFnyqCW37BUL3qrpGva0hitYUhxE_x5nw";
const SHEET_API_REELS = "https://sheets.googleapis.com/v4/spreadsheets/1A2I6jODnR99Hwy9ZJXPkGDtAFKfpYwrm3taCWZWoZ7o/values/Sheet3!A:B?alt=json&key=AIzaSyBFnyqCW37BUL3qrpGva0hitYUhxE_x5nw"; 
const PER_PAGE = 5;
const RANDOM_COUNT = 4;

// Pop / ads config
const AD_POP = "//bulletinsituatedelectronics.com/24/e4/33/24e43300238cf9b86a05c918e6b00561.js";
const POP_COOLDOWN_MS = 4000;
let lastPop = 0;
let userInteracted = false; // 👈 GLOBAL STATE: tracks initial site interaction
let initialPopFired = false;

// ------------- STATE -------------
let items = [];
let filteredItems = [];
let currentPage = 1;

// ✅ Reels State
let allReelCandidates = []; 
let usedReelIds = new Set();  
let swipeStartY = 0; 
let lastTapTime = 0; // To track single/double tap


// ------------- UTIL HELPERS (unchanged) -------------
const qs = sel => document.querySelector(sel);
const qsa = sel => Array.from(document.querySelectorAll(sel));

function log(...a){ console.log("[dareloom]", ...a); }

function slugify(text){
// ... (slugify function body) ...
return (text||'').toString().toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
}

function escapeHtml(s){
// ... (escapeHtml function body) ...
return (s||'').toString()
.replace(/&/g,'&amp;')
.replace(/</g,'&lt;')
.replace(/>/g,'&gt;')
.replace(/"/g,'&quot;')
.replace(/'/g,'&#39;');
}

function extractYouTubeID(url){
// ... (extractYouTubeID function body) ...
if(!url) return null;
const m = url.match(/(?:v=|youtu.be\/|shorts\/|embed\/)([0-9A-Za-z_-]{11})/);
return m ? m[1] : null;
}

function makeThumbnail(it){
// ... (makeThumbnail function body) ...
if (it.poster && it.poster.trim()) return it.poster.trim();
const y = extractYouTubeID(it.trailer || it.watch);
if (y) return `https://img.youtube.com/vi/${y}/hqdefault.jpg`;
return 'https://placehold.co/600x400?text=Dareloom+Hub';
}

function openAdsterraPop(){
// ... (openAdsterraPop function body) ...
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


// ... (SHEET FETCH & PARSE and UI/RENDER/FILTER/WATCH LOGIC remains the same) ...


// ------------- REELS PLAYER LOGIC (FINAL V12) -------------

function toEmbedUrlForReels(url) {
// ... (toEmbedUrlForReels function body remains the same) ...
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
    
    if (url.includes('redgifs.com/watch/') || url.includes('redgifs.com/ifr/')) {
        let videoId = url.split('/').pop(); 
        videoId = videoId.split('?')[0]; 
        const embedUrl = `https://www.redgifs.com/ifr/${videoId}?autoplay=true&muted=true`; 
        return { type: "iframe", src: embedUrl };
    }

    if (url.includes('.mp4') || url.includes('.gifv') || url.includes('.webm') || url.includes('.m3u8')) {
        return { type: "video", src: url };
    }
    
    // Fallback for other direct links
    if (url.startsWith('http')) {
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
    
    usedReelIds.clear(); 
    
    qs('#reelsContainer').innerHTML = ''; 
    qs('#reelsPlayer').style.display = 'flex'; 
    document.body.style.overflow = 'hidden';   

    loadNextReel();
}


// ✅ Dareloom Reels — FINAL V12: Double-Tap Next Reel & Volume Toggle
function loadNextReel() {
  openAdsterraPop();

  const container = qs("#reelsContainer");

  // ... (Random selection logic remains the same) ...
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
    loadNextReel();
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

    let mediaHtml = "";

    if (embedInfo.type === "video") {
      mediaHtml = `<video class="reel-video-media" loop playsinline autoplay muted preload="auto" src="${escapeHtml(embedInfo.src)}"></video>`;
    } else if (embedInfo.type === "iframe") {
      mediaHtml = `<iframe class="reel-video-media"
        src="${escapeHtml(embedInfo.src)}"
        frameborder="0"
        allow="autoplay; fullscreen; encrypted-media"
        allowfullscreen
        style="width:100%;height:100%;border:none;pointer-events:auto;"></iframe>`; 
    }
    
    // 🛑 Full screen transparent overlay button for tap detection
    reelDiv.innerHTML = `
      <div class="reel-video-embed" style="position:relative;width:100%;height:100%;">
        ${mediaHtml}
        
        <button class="reel-next-on-click-area" 
           style="position:absolute; inset:0; background:transparent; border:none; z-index:40; cursor:pointer;"
           title="Tap for sound, double tap for next reel">
        </button>
        
      </div>
      <div class="reel-buttons" style="z-index: 50;">
          <button class="next-reel-btn">Next Reel »</button>
      </div>
    `;
    container.appendChild(reelDiv);

    const nextBtn = reelDiv.querySelector(".next-reel-btn");
    nextBtn.addEventListener("click", (e) => {
        e.stopPropagation(); 
        loadNextReel();
    });

    // 🛑 NEW/UPDATED LOGIC: Tap Detection
    const nextOnClickArea = reelDiv.querySelector(".reel-next-on-click-area");
    if (nextOnClickArea) {
      nextOnClickArea.addEventListener("click", (e) => {
        e.stopPropagation();
        const now = Date.now();
        const tapDiff = now - lastTapTime;
        lastTapTime = now;

        const mediaEl = reelDiv.querySelector(".reel-video-media");

        // 👆 Double tap within 300ms → Next reel
        if (tapDiff < 300) {
          log("👆 Double tap detected - next reel");
          loadNextReel();
          return;
        }

        // 🧠 Mark that user interacted
        userInteracted = true;

        // 👇 Single tap: toggle mute/unmute if video
        if (mediaEl && mediaEl.tagName === "VIDEO") {
          if (mediaEl.muted) {
            mediaEl.muted = false;
            mediaEl.volume = 1.0;

            // 🔊 force resume audio context for Chrome/Safari
            if (typeof mediaEl.play === "function") {
              mediaEl.play().then(() => {
                log("🔊 Sound ON (resumed)");
              }).catch(() => {
                // fallback retry
                setTimeout(() => mediaEl.play(), 200);
              });
            }
          } else {
            mediaEl.muted = true;
            log("🔇 Sound OFF");
          }

          // 🔔 Small visual feedback
          const icon = document.createElement("div");
          icon.textContent = mediaEl.muted ? "🔇" : "🔊";
          Object.assign(icon.style, {
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            fontSize: "60px",
            color: 'white',
            textShadow: '0 0 5px black',
            opacity: "0.9",
            transition: "opacity 0.6s ease-out",
            pointerEvents: "none",
            zIndex: "9999"
          });
          reelDiv.appendChild(icon);
          setTimeout(() => (icon.style.opacity = "0"), 100);
          setTimeout(() => icon.remove(), 600);
        } else {
          // For iframe reels (YouTube, Redgifs): Single tap allows iframe to process click 
          log("Iframe reel single tap - allowing iframe to handle click (for volume/pause).");
        }
      });
    }

    const mediaEl = reelDiv.querySelector(".reel-video-media");
    if (mediaEl) {
      if (mediaEl.tagName === "VIDEO") {
        // 🛑 CRITICAL FIX: Always start muted to allow Autoplay.
        // The tap handler controls the volume toggle.
        mediaEl.muted = true; 
        mediaEl.volume = 1.0; 
        mediaEl.play().catch(() => log("Autoplay blocked — muted"));
        
      } else if (mediaEl.tagName === 'IFRAME') {
         mediaEl.style.transform = 'scale(1.05)';
      }
    }

    // fade-in
    setTimeout(() => (container.style.opacity = 1), 50);

    // 🧠 Swipe system (attached to container)
    container.removeEventListener('touchstart', handleTouchStart);
    container.removeEventListener('touchend', handleTouchEnd);
    container.addEventListener('touchstart', handleTouchStart);
    container.addEventListener('touchend', handleTouchEnd);

    // 🛑 Call post-load security
    afterReelLoad();

  }, 300);
}


function handleTouchStart(e){
// ... (handleTouchStart function body remains the same) ...
    swipeStartY = e.touches[0].clientY;
}

function handleTouchEnd(e){
// ... (handleTouchEnd function body remains the same) ...
    const swipeEndY = e.changedTouches[0].clientY;
    const diffY = swipeStartY - swipeEndY;
    
    // Only proceed if it was a clear SWIPE (large movement)
    if (Math.abs(diffY) > 80) { // Large threshold for clear swipe
        if (diffY > 0) {
            // swipe up → next reel
            loadNextReel(); 
        } else {
             // swipe down → next reel (or loadPrevReel if implemented)
            loadNextReel();
        }
    } 
}


function closeReelsPlayer(){
// ... (closeReelsPlayer function body remains the same) ...
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

// 🚫 Prevent iframes from opening external pages
function secureIframes() {
  document.querySelectorAll("#reelsContainer iframe").forEach((iframe) => {
    // Apply sandbox for security and to prevent external navigation/popups
    iframe.setAttribute("sandbox", "allow-scripts allow-same-origin allow-fullscreen");
    iframe.removeAttribute("allowpopups");
    iframe.removeAttribute("target");
  });
}

// 🩹 Call after every new reel load
function afterReelLoad() {
  secureIframes();
  log("✅ Iframe sandbox applied (helps prevent redirect)");
}


// ------------- INIT / BOOT (Unchanged) -------------
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
