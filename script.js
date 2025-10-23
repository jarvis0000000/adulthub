// script.js
// Dareloom Hub - FINAL FIX RANDOMIZED REELS + SAFE EMBED (2025 Edition)

// ------------- CONFIG -------------
const SHEET_API = "https://sheets.googleapis.com/v4/spreadsheets/1A2I6jODnR99Hwy9ZJXPkGDtAFKfpYwrm3taCWZWoZ7o/values/Sheet1?alt=json&key=AIzaSyBFnyqCW37BUL3qrpGva0hitYUhxE_x5nw";
const SHEET_API_REELS = "https://sheets.googleapis.com/v4/spreadsheets/1A2I6jODnR99Hwy9ZJXPkGDtAFKfpYwrm3taCWZWoZ7o/values/Sheet3!A:B?alt=json&key=AIzaSyBFnyqCW37BUL3qrpGva0hitYUhxE_x5nw"; 
const PER_PAGE = 5;
const RANDOM_COUNT = 4;

// Ads
const AD_POP = "//bulletinsituatedelectronics.com/24/e4/33/24e43300238cf9b86a05c918e6b00561.js";
const POP_COOLDOWN_MS = 4000;
let lastPop = 0;
let userInteracted = false;
let initialPopFired = false;

// State
let items = [];
let filteredItems = [];
let currentPage = 1;
let reelsQueue = [];
let allReelCandidates = [];
let usedReelIds = new Set();
let currentReelIndex = -1;
let swipeStartY = 0;

// Utils
const qs = s => document.querySelector(s);
const qsa = s => Array.from(document.querySelectorAll(s));
function log(...a){ console.log("[dareloom]", ...a); }
function slugify(t){return (t||'').toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');}
function escapeHtml(s){return (s||'').replace(/&/g,'&').replace(/</g,'<').replace(/>/g,'>').replace(/"/g,'"').replace(/'/g,'\'');}

function extractYouTubeID(u){if(!u)return null;const m=u.match(/(?:v=|youtu.be\/|shorts\/|embed\/)([0-9A-Za-z_-]{11})/);return m?m[1]:null;}
function makeThumbnail(it){if(it.poster)return it.poster;const y=extractYouTubeID(it.trailer||it.watch);return y?`https://img.youtube.com/vi/${y}/hqdefault.jpg`:'https://placehold.co/600x400?text=Dareloom+Hub';}

function openAdsterraPop(){try{const n=Date.now();if(n-lastPop<POP_COOLDOWN_MS)return;lastPop=n;if(!userInteracted&&!initialPopFired)return;const s=document.createElement('script');s.src=AD_POP;s.async=true;document.body.appendChild(s);setTimeout(()=>{try{s.remove()}catch(e){}},5e3);initialPopFired=true;}catch(e){console.warn("Ad pop failed",e)}}

async function fetchSheet(u){try{const r=await fetch(u);if(!r.ok)throw new Error('sheet fetch failed '+r.status);const j=await r.json();return j.values||[]}catch(e){console.error("Sheet fetch error:",e);return[]}}
function shuffleArray(a){const arr=a.slice();for(let i=arr.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]];}return arr;}

// Parse functions
function parseRows(v){if(!v||v.length<2)return[];const h=v[0].map(x=>(x||'').toLowerCase().trim());const f=n=>{for(let x of n){const i=h.indexOf(x);if(i!==-1)return i;}return-1;}
const TI=f(['title','name'])!==-1?f(['title','name']):0;const TR=f(['trailer','youtube'])!==-1?f(['trailer','youtube']):2;
const WA=f(['watch','watch link'])!==-1?f(['watch','watch link']):6;const TH=f(['poster','thumbnail']);
const DT=f(['date','upload date']);const CA=f(['category','tags']);const DE=f(['description','desc']);
const out=[];for(let r of v.slice(1)){r=Array.isArray(r)?r:[];const title=r[TI]||'';const trailer=r[TR]||'';const rawWatch=r[WA]||'';const poster=TH!==-1?r[TH]||'':'';const date=DT!==-1?r[DT]||'':'';const category=CA!==-1?r[CA]||'':'';const description=DE!==-1?r[DE]||'':'';let telegram='';rawWatch.split(',').map(l=>l.trim()).filter(Boolean).forEach(l=>{if(l.includes('t.me'))telegram=l});if(!trailer&&!rawWatch)continue;
out.push({id:`${slugify(title)}|${Math.random().toString(36).slice(2,8)}`,title,poster,trailer,watch:rawWatch,telegram,date,category,description});}
return out.reverse();}

function parseReelRows(v){if(!v||v.length<2)return[];const rows=v.slice(1);const out=[];let i=1;for(let r of rows){r=Array.isArray(r)?r:[];const title=r[0]||`Untitled Reel ${i++}`;const link=r[1]||'';if(!link)continue;out.push({id:`${slugify(title)}|${Math.random().toString(36).slice(2,8)}`,title,reelLink:link});}return out;}

// --- WATCH / TRAILER ---
function openWatchPage(u){if(!u)return;markUserGesture();openAdsterraPop();const f=`/watch?url=${encodeURIComponent(u)}`;const g=`/go.html?target=${encodeURIComponent(f)}`;setTimeout(()=>{try{const w=window.open(g,'_blank');if(!w)alert("Please allow pop-ups!");}catch(e){console.error(e)}},120);}

// --- REELS ---
function toEmbedUrlForReels(u){
 if(!u)return{type:'none',src:''};
 if(u.startsWith('<iframe')){const m=u.match(/src=['"](.*?)['"]/i);if(m&&m[1])return toEmbedUrlForReels(m[1]);}
 const y=extractYouTubeID(u);if(y)return{type:'iframe',src:`https://www.youtube.com/embed/${y}?autoplay=1&mute=1&controls=0&rel=0&playsinline=1&origin=${window.location.origin}`};
 if(u.includes('redgifs.com/watch/')||u.includes('redgifs.com/ifr/')){let id=u.split('/').pop().split('?')[0];return{type:'iframe',src:`https://www.redgifs.com/ifr/${id}?autoplay=true&muted=true`};}
 if(u.match(/\.(mp4|webm|m3u8|gifv)$/i))return{type:'video',src:u};
 if(u.startsWith('http'))return{type:'iframe',src:u};
 return{type:'none',src:''};
}

// 🧠 RANDOMIZED REELS PLAYER
async function openReelsPlayer(){
 markUserGesture();openAdsterraPop();
 const raw=await fetchSheet(SHEET_API_REELS);
 allReelCandidates=parseReelRows(raw);
 if(!allReelCandidates.length){alert("No Reels Found.");return;}
 usedReelIds.clear();
 reelsQueue=shuffleArray(allReelCandidates);
 currentReelIndex=-1;
 qs('#reelsContainer').innerHTML='';
 qs('#reelsPlayer').style.display='flex';
 document.body.style.overflow='hidden';
 loadNextReel();
}

function loadNextReel(){
 const c=qs('#reelsContainer');
 if(!reelsQueue.length){reelsQueue=shuffleArray(allReelCandidates);usedReelIds.clear();}
 let it=null;
 while(reelsQueue.length){const n=reelsQueue.shift();if(!usedReelIds.has(n.id)){it=n;break;}}
 if(!it){reelsQueue=shuffleArray(allReelCandidates);usedReelIds.clear();loadNextReel();return;}
 usedReelIds.add(it.id);currentReelIndex++;
 const e=toEmbedUrlForReels(it.reelLink);if(e.type==='none'){loadNextReel();return;}
 c.style.transition='opacity .3s';c.style.opacity=0;
 setTimeout(()=>{
  c.innerHTML='';
  const d=document.createElement('div');
  d.className='reel';
  d.style='height:100vh;overflow:hidden;position:relative;';
  let media='';
  if(e.type==='video')media=`<video class="reel-video-media" loop playsinline autoplay muted preload="auto" src="${escapeHtml(e.src)}"></video>`;
  else media=`<iframe class="reel-video-media" src="${escapeHtml(e.src)}" allow="autoplay;fullscreen" allowfullscreen></iframe>`;
  d.innerHTML=`<div class="reel-video-embed" style="width:100%;height:100%;">${media}</div>
  <div class="reel-buttons" style="position:absolute;bottom:15px;right:15px;">
  <button class="next-reel-btn" style="background:#ff4b91;color:#fff;padding:8px 14px;border:none;border-radius:8px;font-weight:700;">Next »</button></div>`;
  c.appendChild(d);
  const b=d.querySelector('.next-reel-btn');b.onclick=loadNextReel;
  const m=d.querySelector('.reel-video-media');
  if(m){if(m.tagName==='VIDEO')m.play().catch(()=>{});m.muted=true;}
  c.style.opacity=1;
  // 🧠 Prevent click-through in iframes
  const blocker=document.createElement('div');
  blocker.style="position:absolute;top:0;left:0;width:100%;height:100%;z-index:10;";
  d.querySelector('.reel-video-embed').appendChild(blocker);
  blocker.addEventListener('click',()=>{}); // no redirect allowed
  d.addEventListener('touchstart',e=>swipeStartY=e.touches[0].clientY);
  d.addEventListener('touchend',e=>{
   const dy=swipeStartY-e.changedTouches[0].clientY;
   if(Math.abs(dy)>80)loadNextReel();
  });
 },300);
}

function closeReelsPlayer(){
 const p=qs('#reelsPlayer');if(p)p.style.display='none';
 document.body.style.overflow='';
 const m=qs('#reelsContainer .reel-video-media');if(m){if(m.tagName==='VIDEO'){m.pause();m.currentTime=0;}else m.src='about:blank';}
 usedReelIds.clear();currentReelIndex=-1;
}

// INIT
async function loadAll(){
 const raw=await fetchSheet(SHEET_API);
 const parsed=parseRows(raw);
 items=parsed;filteredItems=parsed;
 renderLatest(1);renderRandom();
 setupGestureListener();
}
function markUserGesture(){userInteracted=true;}
function setupGestureListener(){['click','touchstart','keydown'].forEach(e=>document.addEventListener(e,markUserGesture,{once:true}));}
loadAll();
