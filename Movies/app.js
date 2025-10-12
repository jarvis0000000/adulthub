const SHEET_ID = "1A2I6jODnR99Hwy9ZJXPkGDtAFKfpYwrm3taCWZWoZ7o";
const API_KEY = "AIzaSyBFnyqCW37BUL3qrpGva0hitYUhxE_x5nw";
const SHEET_NAME = "Sheet2";   
const PAGE_SIZE = 6;

function qs(sel) { return document.querySelector(sel); }

async function fetchAllRows() {
  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(SHEET_NAME)}?key=${API_KEY}`;
    const res = await fetch(url);
    const json = await res.json();
    if (!json.values) return [];
    const rows = json.values;
    const headers = rows[0].map(h => h.trim());
    return rows.slice(1).map((r, i) => {
      const obj = {};
      headers.forEach((h, j) => obj[h] = r[j] ?? "");
      obj._id = (obj.id || obj.Title || (i + 1).toString()).trim();
      return obj;
    });
  } catch (e) {
    console.error("Fetch Error:", e);
    return [];
  }
}

function paginate(items, page = 1, pageSize = PAGE_SIZE) {
  const total = items.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize;
  return { pageItems: items.slice(start, start + pageSize), total, pages };
}

function renderPagination(total, current, cat = "all", searchQuery = "") {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (pages <= 1) return '';
  let base = searchQuery ? `#/search/${encodeURIComponent(searchQuery)}/page/` :
              cat !== "all" ? `#/category/${cat}/page/` : "#/page/";
  return Array.from({ length: pages }, (_, i) => i + 1)
    .map(i => `<a href="javascript:void(0)" class="page-btn ${i===current?'active':''}" onclick="navigateTo('${base}${i}')">${i}</a>`)
    .join('');
}

// ✅ Category badge clickable
function movieCardHtml(item) {
  const rating = item.Rating || 'N/A';
  const category = item.Category || item.Genre || '';
  const catBadge = category 
    ? `<span class="card-category" onclick="navigateTo('#/category/${encodeURIComponent(category)}/page/1'); event.stopPropagation();">${category}</span>`
    : '';
  return `
  <div class="card" onclick="navigateTo('#/item/${encodeURIComponent(item._id)}')">
    <div class="poster-wrap">
      <img src="${item.Poster || ''}" alt="${item.Title}">
      ${catBadge}
    </div>
    <div class="card-body">
      <h3>${item.Title}</h3>
      <p>⭐ ${rating}</p>
    </div>
  </div>`;
}

// Hidden top category list
function renderCategoryList() { return ''; }

async function renderHome(page = 1) {
  const app = qs('#app');
  const data = await fetchAllRows();
  const { pageItems, total } = paginate(data, page);
  app.innerHTML = `
  <div class="container">
    <div class="header-title-style"><h2 class="category-heading">All Titles</h2></div>
    <div id="list" class="grid">${pageItems.map(movieCardHtml).join('')}</div>
    <div id="pagination" class="pagination">${renderPagination(total, page)}</div>
  </div>`;
}

async function renderCategory(cat, page = 1) {
  const app = qs('#app');
  app.innerHTML = `
  <div class="container">
    <div class="header-title-style"><h2 class="category-heading">${decodeURIComponent(cat).toUpperCase()}</h2></div>
    <div id="list" class="grid"></div>
    <div id="pagination" class="pagination"></div>
  </div>`;
  const data = await fetchAllRows();
  const filtered = data.filter(d =>
    d.Category?.toLowerCase().includes(cat.toLowerCase()) ||
    d.Genre?.toLowerCase().includes(cat.toLowerCase())
  );
  const { pageItems, total } = paginate(filtered, page);
  qs('#list').innerHTML = pageItems.map(movieCardHtml).join('');
  qs('#pagination').innerHTML = renderPagination(total, page, cat);
}

async function renderSearch(query, page = 1) {
  const app = qs('#app');
  app.innerHTML = `
  <div class="container">
    <div class="header-title-style"><h2 class="category-heading">Search: "${query}"</h2></div>
    <div id="list" class="grid"></div>
    <div id="pagination" class="pagination"></div>
  </div>`;
  const data = await fetchAllRows();
  const filtered = data.filter(d => d.Title?.toLowerCase().includes(query.toLowerCase()));
  const { pageItems, total } = paginate(filtered, page);
  qs('#list').innerHTML = pageItems.length ? 
    pageItems.map(movieCardHtml).join('') :
    `<p style="text-align:center;padding:40px;">No results for "${query}".</p>`;
  qs('#pagination').innerHTML = renderPagination(total, page, null, query);
}

function createWatchLinksHtml(item) {
  const watchData = item["Watch Link"] || item.WatchLink || '';
  if (!watchData) return '';
  const parts = watchData.split('|').map(s => s.trim()).filter(Boolean);
  let html = '<div class="watch-links-section"><h3>Watch Links:</h3><div class="watch-links">';
  for (let i = 0; i < parts.length; i += 2) {
    const label = parts[i], url = parts[i + 1];
    if (label && url) html += `<a class="btn btn-watch-dynamic" href="${url}" target="_blank">${label}</a>`;
  }
  return html + '</div></div>';
}

function createScreenshotsHtml(item) {
  const ssData = item.Screenshot || '';
  if (!ssData) return '';
  const shots = ssData.split('|').map(s => s.trim()).filter(Boolean);
  return shots.length ? `<div class="screenshot-section"><h3>Screenshots:</h3>
    <div class="screenshots-grid">${shots.map(u=>`<img src="${u}" class="screenshot-img">`).join('')}</div></div>` : '';
}

async function renderItemDetail(id) {
  const app = qs('#app');
  const data = await fetchAllRows();
  const item = data.find(d => d._id === decodeURIComponent(id));
  if (!item) return app.innerHTML = "<p class='not-found'>Item not found</p>";

  const { Title, Poster, Description, Category, Rating, Runtime, Date } = item;
  app.innerHTML = `
  <div class="container detail-container">
    <div class="detail-card">
      <img src="${Poster}" alt="${Title}" class="detail-poster">
      <div class="detail-meta">
        <h1>${Title}</h1>
        <div class="detail-info-row">
          <span class="info-tag category-tag" onclick="navigateTo('#/category/${encodeURIComponent(Category)}/page/1')">${Category}</span>
          <span class="info-tag rating-tag">⭐ ${Rating}</span>
          <span class="info-tag runtime-tag">🕒 ${Runtime}</span>
          <span class="info-tag date-tag">📅 ${Date}</span>
        </div>
        <p class="detail-description">${Description}</p>
        ${createWatchLinksHtml(item)}
        ${createScreenshotsHtml(item)}
      </div>
    </div>
  </div>`;
}

function navigateTo(hash) { window.location.hash = hash; }
function getRoute() { return location.hash.replace(/^#\/?/, '').split('/'); }

async function router() {
  const parts = getRoute();
  const isDetail = parts[0] === 'item';
  document.body.classList.toggle('detail-page', isDetail);

  if (parts[0] === '' || parts[0] === 'page') return renderHome(Number(parts[1]) || 1);
  if (parts[0] === 'category') return renderCategory(parts[1], Number(parts[3]) || 1);
  if (parts[0] === 'search') return renderSearch(decodeURIComponent(parts[1]||''), Number(parts[3])||1);
  if (isDetail) return renderItemDetail(parts[1]);
  renderHome(1);
}

qs('#searchInput')?.addEventListener('keyup', e => {
  if (e.key === 'Enter') {
    const q = e.target.value.trim();
    if (q) window.location.hash = `#/search/${encodeURIComponent(q)}/page/1`;
  }
});

window.addEventListener('hashchange', router);

function loadPopunderAds() {
  const adScript = document.createElement('script');
  adScript.src = "//bulletinsituatedelectronics.com/24/e4/33/24e43300238cf9b86a05c918e6b00561.js";
  adScript.type = "text/javascript";
  adScript.async = true;
  document.body.appendChild(adScript);
}

window.addEventListener('load', () => {
  router();
  loadPopunderAds();
});
