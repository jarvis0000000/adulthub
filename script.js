// script.js
// Dareloom Hub - Complete player + sheet + pagination + preview/watch + tags + random
// 2025-10-17 (MAXIMUM CTR / CLICK OPTIMIZATION)

// ------------- CONFIG -------------
// 🛑 IMPORTANT: API Key is sensitive. Ensure this is correct and restricted to your domain.
const SHEET_API = "https://sheets.googleapis.com/v4/spreadsheets/1A2I6jODnR99Hwy9ZJXPkGDtAFKfpYwrm3taCWZWoZ7o/values/Sheet1?alt=json&key=AIzaSyBFnyqCW37BUL3qrpGva0hitYUhxE_x5nw";
const PER_PAGE = 5;
const RANDOM_COUNT = 4;

// Pop / ads config 
const AD_POP = "//bulletinsituatedelectronics.com/24/e4/33/24e43300238cf9b86a05c918e6b00561.js";
// 🛑 CTR OPTIMIZATION: Aggressive Timing
const POP_COOLDOWN_MS = 4000; // 7000ms से 4000ms
const POP_DELAY_MS = 500;     // 2000ms से 500ms
const INITIAL_AUTO_POP_DELAY = 5000; // 10000ms से 5000ms
let lastPop = 0;

// ------------- STATE -------------
let items = [];        // all parsed items (newest first)
let filteredItems = []; // items after search/tag filter
let currentPage = 1;

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
// prefer poster/thumbnail field, otherwise youtube from trailer/watch, otherwise placeholder
if (it.poster && it.poster.trim()) return it.poster.trim();
const y = extractYouTubeID(it.trailer || it.watch);
if (y) return `https://img.youtube.com/vi/${y}/hqdefault.jpg`;
return 'https://placehold.co/600x400?text=Dareloom+Hub';
}

function openAdsterraPop(){
const now = Date.now();
if (now - lastPop < POP_COOLDOWN_MS) return;
lastPop = now;
setTimeout(() => {
try{
const s = document.createElement('script');
s.src = AD_POP;
s.async = true;
document.body.appendChild(s);
// Keep the script for a longer time for better loading chance
setTimeout(()=>{ try{s.remove();}catch(e){} }, 5000); 
}catch(e){ console.warn("Ad pop failed", e); }
}, POP_DELAY_MS);
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
  watch: finalWatchLink || '', // Streamtape/Primary link
  telegram: telegramLink || '', // Telegram link
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
// Clicks on random cards also trigger ad
card.addEventListener('click', ()=> triggerAdThenOpenModal(it));
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
div.innerHTML = `<img class="latest-thumb" src="${escapeHtml(thumb)}" loading="lazy" alt="${escapeHtml(it.title)}"> <div class="latest-info"> <div style="font-weight:700">${escapeHtml(it.title)}</div> <div style="color:var(--muted);font-size:13px;margin-top:6px">${escapeHtml(it.date || '')}</div> <div class="tag-container" style="margin-top:6px">${renderTagsForItem(it)}</div> <div style="margin-top:8px"> <button class="btn preview-btn" data-id="${escapeHtml(it.id)}">Open Details</button> <button class="watch-btn" data-url="${escapeHtml(it.watch || it.trailer)}">Watch Now</button> </div> </div>`;
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
// 🛑 CTR OPTIMIZATION: Pop on page change
openAdsterraPop(); 
}

function attachLatestListeners(){
// Preview buttons
qsa('#latestList .preview-btn').forEach(btn => {
btn.removeEventListener('click', onPreviewClick);
btn.addEventListener('click', onPreviewClick);
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

function onPreviewClick(e){
const id = e.currentTarget.dataset.id;
const it = items.find(x => x.id === id) || filteredItems.find(x => x.id === id);
if (!it) return;
// 🛑 CTR OPTIMIZATION: Trigger ad then open modal
triggerAdThenOpenModal(it);
}

function onWatchClick(e){
const url = e.currentTarget.dataset.url;
if (!url) return;
// 🛑 CTR OPTIMIZATION: Pop on Watch click too
openAdsterraPop();
openWatchPage(url);
}

function onTagClick(e){
const tag = e.currentTarget.dataset.tag;
if (!tag) return;
applyTagFilter(tag);
}

// ------------- SEARCH & FILTER -------------
function applyTagFilter(tag){
if (!tag) return;
filteredItems = items.filter(it => (it.category||'').toLowerCase().split(',').map(s=>s.trim()).includes(tag.toLowerCase()));
currentPage = 1;
renderLatest(1);
updateCount(filteredItems.length);
// 🛑 CTR OPTIMIZATION: Pop on tag filter
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


// ------------- MODAL PREVIEW & WATCH -------------
function triggerAdThenOpenModal(it){
openAdsterraPop();
// 🛑 Increased delay slightly to ensure ad loads before modal takes focus
setTimeout(()=> openPlayerModal(it), 250);
}

function openPlayerModal(it){
const modal = qs('#videoModal');
const pWrap = qs('#modalPlayerWrap');
const controls = qs('#modalControlsContainer');
const titleEl = qs('#modalVideoTitle');
const descEl = qs('#modalVideoDescription');

if (!modal || !pWrap || !controls || !titleEl) {
// fallback simple popup
alert(it.title);
return;
}

// set title/desc
titleEl.textContent = it.title || 'Video';
descEl.textContent = it.description || '';

// build embed (prefer trailer youtube, fallback to primary watch link)
const embedUrl = toEmbedUrlForModal(it.trailer || it.watch);
pWrap.innerHTML = '';

// 🛑 FIX: If no valid embed URL is found, show a message.
if (!embedUrl){
    pWrap.innerHTML = `<div style="padding:80px 20px;text-align:center;color:var(--muted)">
        Preview not available for embed. Please use the 'Open in Player' button.
    </div>`;
} else if (embedUrl.match(/.mp4($|\?)/i)){
    const v = document.createElement('video');
    v.controls = true; v.autoplay = true; v.muted = false; v.playsInline = true;
    v.src = embedUrl;
    v.style.width = '100%'; v.style.height = '420px';
    pWrap.appendChild(v);
} else {
    // This runs for YouTube, Drive, Streamtape Embeds, and generic HTTP(S) links
    const iframe = document.createElement('iframe');
    iframe.src = embedUrl;
    iframe.setAttribute('allow','autoplay; fullscreen; encrypted-media; picture-in-picture');
    iframe.setAttribute('allowfullscreen','true');
    iframe.style.width = '100%'; iframe.style.height = '420px'; iframe.style.border = 'none';
    pWrap.appendChild(iframe);
}


// controls: Watch (open watch.html) + Telegram/Stream buttons
let html = '<div style="display: flex; flex-wrap: wrap; gap: 10px; justify-content: center;">';
const watchUrl = it.watch || it.trailer || ''; // Primary link (Streamtape)
const telegramUrl = it.telegram || ''; // Telegram link

// Open in Player button (main action) - Uses Streamtape link
if (watchUrl) {
    // 🛑 UX TWEAK: Changed button text for better CTR
    html += `<button class="btn watch-btn-modal" data-url="${escapeHtml(watchUrl)}" style="min-width: 150px;">Open in Player</button>`;
}

// Streamtape button using its dedicated URL
if (watchUrl.includes('streamtape.com') || watchUrl.includes('/v/')){
    html += `<button class="btn" onclick="(function(){window.open('${escapeHtml(watchUrl)}','_blank')})()" style="min-width: 150px;">Open Streamtape</button>`;
}

// Telegram button using its dedicated URL
if (telegramUrl.includes('t.me') || telegramUrl.includes('telegram')){
    html += `<button class="btn" onclick="(function(){window.open('${escapeHtml(telegramUrl)}','_blank')})()" style="min-width: 150px;">Open Telegram</button>`;
}

// share button
html += `<button class="btn" id="modalShareBtn" style="min-width: 150px;">🔗 Share</button>`;

html += '</div>'; // Close the flex container
controls.innerHTML = html;

// show modal
modal.style.display = 'flex';
document.body.style.overflow = 'hidden';

// bind modal control events
qs('#modalShareBtn')?.addEventListener('click', ()=> {
const shareUrl = `${window.location.origin}${window.location.pathname}#v=${encodeURIComponent(it.id)}`;
const text = `🔥 Watch "${it.title}" on Dareloom Hub\n${shareUrl}`;
if (navigator.share) navigator.share({ title: it.title, text, url: shareUrl }).catch(()=>{});
else navigator.clipboard.writeText(text).then(()=> alert("Link copied to clipboard")).catch(()=> prompt("Copy link:", shareUrl));
});

qs('.watch-btn-modal')?.addEventListener('click', (e) => {
const url = e.currentTarget.dataset.url;
openWatchPage(url);
});
}

// helper to create embed link for modal (youtube/streamtape/drive/mp4)
function toEmbedUrlForModal(url){
if (!url) return '';
url = url.trim();

// 1. YouTube
const y = extractYouTubeID(url);
if (y) return `https://www.youtube.com/embed/${y}?autoplay=1&rel=0`;
if (url.includes('youtube.com/embed')) return url;

// 🛑 2. MEGA Link Fix (Cannot be embedded, force user to watch page)
if (url.includes('mega.nz')) {
    openWatchPage(url);
    return ''; // Stop modal from showing empty player
}

// 3. Google Drive
if (url.match(/drive.google.com/)){
    const m = url.match(/[-\w]{25,}/);
    if (m) return `https://drive.google.com/file/d/${m[0]}/preview`;
    if (url.includes('/view')) return url.replace('/view', '/preview'); // common mistake fix
}

// 4. Streamtape
if (url.includes('streamtape.com')){
    if (url.includes('/v/')){
        const id = url.split('/v/')[1]?.split('/')[0];
        if (id) return `https://streamtape.com/e/${id}/`; // Convert /v/ to /e/
    }
    if (url.includes('/e/')) return url;
}

// 5. Generic Embed/Direct MP4/Other Custom Embed Links
// If it starts with http/https, we treat it as an embeddable link (e.g., direct mp4 or other custom player)
if (url.startsWith('http') || url.startsWith('https')) {
    return url;
}

return '';
}

// open watch.html (existing file) in new tab with encoded URL param
function openWatchPage(targetUrl){
if (!targetUrl) return;
openAdsterraPop();
setTimeout(()=> {
try{
let final = targetUrl;
// convert streamtape /v/ to /e/ for better embedding in watch page
if (final.includes('/v/')){
const m = final.match(/\/v\/([0-9A-Za-z_-]+)\//);
if (m && m[1]) final = `https://streamtape.com/e/${m[1]}/`;
}
// 🛑 FIX: Use ABSOLUTE path for watch.html to work from all directories (e.g., /video/)
const watchPage = `/watch.html?url=${encodeURIComponent(final)}`;
const w = window.open(watchPage,'_blank');
if (!w || w.closed || typeof w.closed === 'undefined'){
alert("Please allow pop-ups to open the link in a new tab!");
}
closePlayerModal();
}catch(e){ console.error(e); }
}, 120);
}

// Random pick function (called by button)
function showRandomPick(){
const random = items[Math.floor(Math.random() * items.length)];
if (random) triggerAdThenOpenModal(random);
}


// ------------- INIT / BOOT -------------
async function loadAll(){
log("loading sheet...");
const raw = await fetchSheet();
const parsed = parseRows(raw);
// Sort new -> old. If date exists and parseable, attempt to sort by date desc; otherwise keep sheet order reversed
parsed.forEach(p => p._sortDate = (p.date ? Date.parse(p.date) || 0 : 0));
parsed.sort((a,b) => (b._sortDate || 0) - (a._sortDate || 0));
// if all _sortDate === 0 (no usable dates), reverse the parsed order to show newest-first based on sheet order
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
const q = e.target.value || '';
filterVideos(q);
});
}

// modal close wiring (if modal close button exists in DOM)
const closeBtn = qs('#videoModal .close-btn');
if (closeBtn){
closeBtn.addEventListener('click', closePlayerModal);
}
// click outside modal to close (optional)
const modal = qs('#videoModal');
if (modal){
modal.addEventListener('click', (ev) => {
if (ev.target === modal) closePlayerModal();
});
}

// auto pop once after delay 
// 🛑 CTR OPTIMIZATION: Initial pop delay reduced
window.addEventListener('load', ()=> setTimeout(()=> openAdsterraPop(), INITIAL_AUTO_POP_DELAY), { once:true });
}

// update item count display
function updateCount(n){
const c = qs('#count');
if (c) c.textContent = `${n} items`;
}

// function to close the modal (missing in original code, but required)
function closePlayerModal(){
    const modal = qs('#videoModal');
    if(modal) modal.style.display = 'none';
    document.body.style.overflow = '';
    const pWrap = qs('#modalPlayerWrap');
    if(pWrap) pWrap.innerHTML = ''; // Stop the video/audio playback
}

// start
loadAll();
