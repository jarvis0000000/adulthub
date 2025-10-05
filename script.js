// ✅ DARELOOM HUB FINAL SCRIPT v25 — WITH SHARE BUTTON (MOBILE + DESKTOP SUPPORTED)

const SHEET_API = "https://sheets.googleapis.com/v4/spreadsheets/1A2I6jODnR99Hwy9ZJXPkGDtAFKfpYwrm3taCWZWoZ7o/values/Sheet1?alt=json&key=AIzaSyBFnyqCW37BUL3qrpGva0hitYUhxE_x5nw";
const AD_POP = "//pl27626803.revenuecpmgate.com/24/e4/33/24e43300238cf9b86a05c918e6b00561.js";
const PER_PAGE = 5;
let items = [], current = null, currentPage = 1;

const ADSTERRA_NATIVE_BANNER_SCRIPT = `
    <script type="text/javascript" src="//www.highperformanceformat.com/d1be46ed95d3e2db572824c531da5082/invoke.js"></script>
`;
const ADSTERRA_SOCIAL_BAR_SCRIPT = `
    <script type='text/javascript' src='//pl27654958.revenuecpmgate.com/cb/63/19/cb6319838ced4608354b54fc6faddb8a.js'></script>
`;

// --- POP-UNDER AD ---
function openAdsterraPop() {
  const s = document.createElement('script');
  s.src = AD_POP;
  s.async = true;
  document.body.appendChild(s);
}

// --- DYNAMIC WATCH LINK NAMES ---
function getLinkName(url) {
  if (!url) return 'Watch Link';
  if (url.includes('streamtape.com')) return 'Streamtape Watch';
  if (url.includes('t.me') || url.includes('telegram')) return 'Telegram Download';
  if (url.includes('gofile.io')) return 'GoFile Watch';
  if (url.includes('drive.google.com')) return 'Google Drive Watch';
  if (url.includes('mp4upload.com')) return 'Mp4Upload Watch';
  try {
    const domain = new URL(url).hostname.replace('www.', '');
    const namePart = domain.split('.')[0];
    return namePart.charAt(0).toUpperCase() + namePart.slice(1) + ' Link';
  } catch {
    return 'External Watch Link';
  }
}

// --- FETCH SHEET DATA ---
async function fetchSheet() {
  try {
    const res = await fetch(SHEET_API);
    if (!res.ok) throw new Error('sheet fetch failed');
    const j = await res.json();
    return j.values || [];
  } catch (e) {
    console.error("Fetch error:", e);
    return [];
  }
}

function norm(s){ return (s||'').toString().trim().toLowerCase(); }

function parseRows(values){
  if(!values || values.length < 2) return [];
  const TI=0, TR=2, WA=6, TH=17, DT=19, CA=20;
  const headers = (values[0]||[]).map(h=> (h||'').toString());
  const DE = headers.findIndex(h => norm(h) === 'description');
  const rows = values.slice(1);
  const out = [];
  for(let r of rows){
    const title=r[TI]||'', trailer=r[TR]||'', watch=r[WA]||'', poster=r[TH]||'', date=r[DT]||'', category=r[CA]||'', description=DE!==-1?(r[DE]||''):'';
    if((trailer && trailer.trim()) || (watch && watch.trim())){
      out.push({id:(title||'')+'|'+(watch||''),title,trailer,watch,poster,date,description,category});
    }
  }
  return out;
}

// --- UTILS ---
function extractYouTubeID(url){
  const m = url?.match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([0-9A-Za-z_-]{11})/);
  return m ? m[1] : null;
}
function makeThumbnail(it){
  if(it.poster) return it.poster;
  const y = extractYouTubeID(it.trailer) || extractYouTubeID(it.watch);
  return y ? `https://img.youtube.com/vi/${y}/hqdefault.jpg` : 'https://placehold.co/600x400?text=Dareloom+Hub';
}
function toEmbedUrl(url){
  if(!url) return '';
  const y = extractYouTubeID(url);
  if(y) return `https://www.youtube.com/embed/${y}?autoplay=1&rel=0`;
  if(url.match(/drive\.google\.com/)){
    const m=url.match(/[-\w]{25,}/);
    return m ? `https://drive.google.com/file/d/${m[0]}/preview` : '';
  }
  if(url.includes("streamtape.com")){
    if(url.includes("/v/")) {
      const id = url.split("/v/")[1].split("/")[0];
      return "https://streamtape.com/e/" + id + "/";
    }
  }
  if(url.match(/\.mp4($|\?)/i)) return url;
  return '';
}
function escapeHtml(s){ return (s||'').toString().replace(/[&<>]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }

// --- SHARE FUNCTION ---
function shareItem(it){
  if(!it) return;
  const shareUrl = `https://dareloom.fun/#v=${encodeURIComponent(it.id)}`;
  const shareText = `🔥 Watch "${it.title}" now on Dareloom Hub!\n${shareUrl}`;

  if (navigator.share) {
    navigator.share({
      title: it.title,
      text: it.description || "Watch this exclusive video!",
      url: shareUrl
    }).catch(err => console.warn('Share canceled:', err));
  } else {
    navigator.clipboard.writeText(shareText).then(()=>{
      alert("🔗 Link copied! You can share it anywhere.");
    }).catch(()=>{
      prompt("Copy this link manually:", shareUrl);
    });
  }
}

// --- AD + MODAL ---
function triggerAdThenOpenModal(it){
  openAdsterraPop();
  setTimeout(()=>openPlayerModal(it),150);
}
window.triggerAdThenOpenModalById = id => {
  const it = items.find(x=>x.id===id);
  if(it) triggerAdThenOpenModal(it);
};

// --- RANDOM PICK ---
window.showRandomPick = function(){
  openAdsterraPop();
  setTimeout(()=>{
    if(items.length===0) return;
    const r = items[Math.floor(Math.random()*items.length)];
    openPlayerModal(r);
  },150);
};

// --- RENDER ---
function renderRandom(){
  const g=document.getElementById('randomGrid');
  g.innerHTML='';
  const picks = items.sort(()=>0.5-Math.random()).slice(0,4);
  for(let it of picks){
    const d=document.createElement('div');
    d.className='card';
    d.innerHTML=`<img class="thumb" src="${makeThumbnail(it)}" loading="lazy"><div class="meta"><h4>${escapeHtml(it.title)}</h4></div>`;
    d.onclick=()=>triggerAdThenOpenModal(it);
    g.appendChild(d);
  }
}

function renderLatest(page=currentPage){
  const list=document.getElementById('latestList');
  list.innerHTML='';
  const total=items.length, totalPages=Math.ceil(total/PER_PAGE);
  currentPage=page;
  const slice=items.slice((page-1)*PER_PAGE, page*PER_PAGE);
  slice.forEach(it=>{
    const div=document.createElement('div');
    div.className='latest-item';
    div.innerHTML=`
      <img class="latest-thumb" src="${makeThumbnail(it)}" loading="lazy">
      <div class="latest-info">
        <div style="font-weight:700">${escapeHtml(it.title)}</div>
        <div style="color:var(--muted);font-size:13px;margin-top:6px">${escapeHtml(it.date||'')}</div>
        <div style="margin-top:8px">
          <button class="btn" onclick="triggerAdThenOpenModalById('${escapeHtml(it.id)}')">Preview</button>
          <button class="watch-btn" onclick="triggerAdThenOpenModalById('${escapeHtml(it.id)}')">Watch</button>
        </div>
      </div>`;
    list.appendChild(div);
  });
  displayPagination(totalPages,page);
}

function displayPagination(totalPages,currentPage){
  const p=document.getElementById('pager');
  p.innerHTML='';
  if(totalPages<=1)return;
  if(currentPage>1)p.appendChild(pageBtn('« Prev',currentPage-1));
  for(let i=1;i<=totalPages;i++){
    const b=pageBtn(i,i);
    if(i===currentPage)b.classList.add('active');
    p.appendChild(b);
  }
  if(currentPage<totalPages)p.appendChild(pageBtn('Next »',currentPage+1));
}
function pageBtn(txt,page){
  const b=document.createElement('button');
  b.className='page-btn';
  b.textContent=txt;
  b.onclick=()=>{openAdsterraPop();renderLatest(page);};
  return b;
}

// --- MODAL ---
function openPlayerModal(it){
  current=it;
  const embed=toEmbedUrl(it.trailer);
  const p=document.getElementById('modalPlayerWrap');
  const modal=document.getElementById('videoModal');
  const controls=document.getElementById('modalControlsContainer');
  const title=document.getElementById('modalVideoTitle');
  const desc=document.getElementById('modalVideoDescription');

  p.innerHTML='';
  if(embed){
    if(embed.match(/\.mp4/)){
      const v=document.createElement('video');
      v.src=embed;v.controls=true;v.autoplay=true;v.muted=true;v.playsInline=true;
      p.appendChild(v);
    }else{
      const ifr=document.createElement('iframe');
      ifr.src=embed;
      ifr.allow="autoplay;fullscreen";
      ifr.style="width:100%;height:420px;border:none;";
      p.appendChild(ifr);
    }
  } else p.innerHTML='<div style="padding:100px;text-align:center;color:var(--muted)">Trailer not available.</div>';

  title.textContent=it.title;
  desc.textContent=it.description||'';

  // WATCH + SHARE BUTTONS
  const urls=(it.watch||'').split(',').map(u=>u.trim()).filter(Boolean);
  controls.innerHTML=urls.map(u=>`<button class="watch-btn" onclick="openAdsterraThenWatch('${escapeHtml(u)}')">${getLinkName(u)}</button>`).join('')
    + `<button class="btn" style="background-color:var(--secondary-color);" onclick="shareItem(current)">🔗 Share</button>`;

  modal.style.display='flex';
  document.body.style.overflow='hidden';
}

window.closePlayerModal=function(){
  const m=document.getElementById('videoModal');
  m.style.display='none';
  document.body.style.overflow='';
  document.getElementById('modalPlayerWrap').innerHTML='';
};

// --- WATCH OPEN ---
function openAdsterraThenWatch(url){
  openAdsterraPop();
  setTimeout(()=>{
    const w=window.open(url,'_blank');
    if(!w||w.closed) alert("Please allow pop-ups for the link to open!");
    closePlayerModal();
  },150);
}

// --- LOAD ---
async function loadAll(){
  const vals=await fetchSheet();
  items=parseRows(vals).reverse();
  document.getElementById('count').textContent=`${items.length} items`;
  renderRandom();
  renderLatest();
}
loadAll();
