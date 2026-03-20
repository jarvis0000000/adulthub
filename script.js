// script.js
// Dareloom Hub - FINAL V25 ULTRA (SEO & Embed Optimized)
// Focus: Stable Embeds, Fast Caching, and Search Tokenization

// -----------------------------------------------------
// 🛠️ CONFIGURATION
// -----------------------------------------------------
const CORRECT_SHEET_ID = "1A2I6jODnR99Hwy9ZJXPkGDtAFKfpYwrm3taCWZWoZ7o";
const API_KEY = "AIzaSyBFnyqCW37BUL3qrpGva0hitYUhxE_x5nw";

const SHEET_API = `https://sheets.googleapis.com/v4/spreadsheets/${CORRECT_SHEET_ID}/values/Sheet1?alt=json&key=${API_KEY}`;
const SHEET_API_REELS = `https://sheets.googleapis.com/v4/spreadsheets/${CORRECT_SHEET_ID}/values/Sheet3!A:B?alt=json&key=${API_KEY}`;
const PER_PAGE = 8; // Optimized for grid display
const RANDOM_COUNT = 4;

// ------------- STATE -------------
let items = [];
let filteredItems = [];
let currentPage = 1;
let allReelCandidates = [];
let usedReelIds = new Set();
let lastTapTime = 0;

// ------------- UTIL HELPERS -------------
const qs = sel => document.querySelector(sel);
const qsa = sel => Array.from(document.querySelectorAll(sel));

function log(...a){ console.log("[dareloom]", ...a); }

function slugify(text){
    return (text||'').toString().toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
}

function escapeHtml(s){
    return (s||'').toString().replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

/**
 * 💥 ADVANCED EMBED FIX (V25): 
 * Mixdrop, Streamwish aur alternative mirrors ko smartly handle karta hai.
 */
function getEmbedUrl(videoUrl) {
    if (!videoUrl) return null;
    let url = videoUrl.trim();

    // 1. Mixdrop Fix
    if (url.includes('mixdrop')) {
        return url.replace(/\/(f|embed)\//i, '/e/');
    }

    // 2. Streamwish / HGLink / Dwish Mirror Fix
    // hglink.to ya streamwish ke dynamic IDs ko secure mirror par redirect karta hai.
    if (url.includes('hglink.to') || url.includes('streamwish') || url.includes('dwish')) {
        const id = url.split('/').pop();
        return `https://dwish.pro/e/${id}`; 
    }

    // 3. YouTube ID Extraction for Embed
    const yId = extractYouTubeID(url);
    if (yId) return `https://www.youtube.com/embed/${yId}`;

    return url;
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

// ------------- CORE LOGIC (DEBOUNCE & SEARCH) -------------
function debounce(fn, wait){
    let t;
    return function(...args){
        clearTimeout(t);
        t = setTimeout(()=> fn.apply(this, args), wait);
    };
}

/**
 * Google-style token matching: multiple words search support.
 */
function filterVideos(query = "") {
    const q = query.toLowerCase().trim();
    if (!q) {
        filteredItems = items;
    } else {
        const tokens = q.split(/\s+/).filter(Boolean);
        filteredItems = items.filter(it => {
            const searchable = (it.title + ' ' + it.category + ' ' + it.description).toLowerCase();
            return tokens.every(tk => searchable.includes(tk));
        });
    }
    renderLatest(1);
}

// ------------- RENDERING -------------
function renderLatest(page = 1){
    const list = qs('#latestList');
    if (!list) return;

    const start = (page - 1) * PER_PAGE;
    const slice = filteredItems.slice(start, start + PER_PAGE);

    if (slice.length === 0) {
        list.innerHTML = '<p style="text-align:center;width:100%;padding:40px;color:#777;">No results found.</p>';
        return;
    }

    list.innerHTML = slice.map(it => `
        <div class="latest-item" onclick="location.href='/trailer.html?id=${encodeURIComponent(it.id)}'">
            <img class="latest-thumb" src="${escapeHtml(makeThumbnail(it))}" loading="lazy" alt="${escapeHtml(it.title)}">
            <div class="latest-info">
                <div style="font-weight:700; font-size:15px; color:#fff;">${escapeHtml(it.title)}</div>
                <div style="font-size:12px; color:#ff4b91; margin-top:5px;">${escapeHtml(it.category || 'Trending')}</div>
                <div style="margin-top:10px; display:flex; gap:5px;">
                    <button class="watch-btn" style="flex:1; padding:8px; background:#ff4b91; border:none; color:#fff; border-radius:5px; cursor:pointer; font-weight:bold;">Watch HD</button>
                </div>
            </div>
        </div>
    `).join('');

    renderPagination(Math.ceil(filteredItems.length / PER_PAGE), page);
}

function renderPagination(total, current){
    const pager = qs('#pager');
    if (!pager || total <= 1) { if(pager) pager.innerHTML=''; return; }
    
    let html = '';
    if (current > 1) html += `<button class="page-btn" onclick="changePage(${current-1})">« Prev</button>`;
    html += `<span style="margin:0 15px; color:#555;">${current} / ${total}</span>`;
    if (current < total) html += `<button class="page-btn" onclick="changePage(${current+1})">Next »</button>`;
    
    pager.innerHTML = `<div style="text-align:center; padding:20px;">${html}</div>`;
}

window.changePage = (p) => {
    currentPage = p;
    renderLatest(p);
    window.scrollTo({ top: qs('#latestSection').offsetTop - 20, behavior: 'smooth' });
};

// ------------- INITIALIZATION & FETCH -------------
async function fetchSheet(url){
    try{
        const res = await fetch(url);
        const j = await res.json();
        return j.values || [];
    }catch(e){
        log("Fetch Error", e);
        return [];
    }
}

function parseRows(values){
    if (!values || values.length < 2) return [];
    return values.slice(1).map(r => ({
        id: slugify(r[0] || 'video') + '-' + Math.random().toString(36).slice(2,7),
        title: (r[0] || '').trim(),
        trailer: (r[2] || '').trim(),
        watch: (r[6] || '').trim(),
        poster: (r[15] || '').trim(),
        category: (r[20] || '').trim()
    })).filter(it => it.title).reverse();
}

async function loadAll() {
    // 1. Local Cache for Instant Load
    const cache = localStorage.getItem('dareloom_data');
    if (cache) {
        items = JSON.parse(cache);
        filteredItems = items;
        renderLatest(1);
    }

    // 2. Fetch Live Data
    const raw = await fetchSheet(SHEET_API);
    if (raw.length > 0) {
        items = parseRows(raw);
        filteredItems = items;
        localStorage.setItem('dareloom_data', JSON.stringify(items));
        renderLatest(1);
    }

    // 3. Search Setup
    const s = qs('#searchInput');
    if (s) {
        s.addEventListener('input', debounce((e) => filterVideos(e.target.value), 300));
    }
}

// ------------- REELS PLAYER -------------
async function openReelsPlayer() {
    qs('#reelsPlayer').style.display = 'flex';
    document.body.style.overflow = 'hidden';
    
    if (allReelCandidates.length === 0) {
        const raw = await fetchSheet(SHEET_API_REELS);
        allReelCandidates = raw.slice(1).map(r => ({ title: r[0], link: r[1] }));
    }
    loadNextReel();
}

window.loadNextReel = () => {
    const container = qs("#reelsContainer");
    if (allReelCandidates.length === 0) return;
    
    const reel = allReelCandidates[Math.floor(Math.random() * allReelCandidates.length)];
    let embedUrl = reel.link;
    if (embedUrl.includes('redgifs.com/watch/')) {
        embedUrl = embedUrl.replace('/watch/', '/ifr/');
    }
    
    container.innerHTML = `
        <div style="width:100%; height:80vh; max-width:400px; position:relative;">
            <iframe src="${embedUrl}" frameborder="0" allowfullscreen style="width:100%; height:100%; border-radius:15px; background:#000;"></iframe>
            <button onclick="loadNextReel()" style="position:absolute; bottom:20px; left:50%; transform:translateX(-50%); background:#ff4b91; color:#fff; border:none; padding:12px 25px; border-radius:25px; font-weight:bold; cursor:pointer;">Next Reel 🔥</button>
        </div>
    `;
};

window.closeReelsPlayer = () => {
    qs('#reelsPlayer').style.display = 'none';
    document.body.style.overflow = 'auto';
    qs("#reelsContainer").innerHTML = '';
};

loadAll();
    
