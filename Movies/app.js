const SHEET_ID = "1A2I6jODnR99Hwy9ZJXPkGDtAFKfpYwrm3taCWZWoZ7o";
const API_KEY = "AIzaSyBFnyqCW37BUL3qrpGva0hitYUhxE_x5nw";
const SHEET_NAME = "Sheet2";   // ✅ Correct sheet name
const PAGE_SIZE = 6;

function qs(sel) { return document.querySelector(sel); }

async function fetchAllRows() {
  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(SHEET_NAME)}?key=${API_KEY}`;
    const res = await fetch(url);
    const json = await res.json();

    if (!json.values) {
      console.error("❌ Google Sheet has no values:", json);
      return [];
    }

    const rows = json.values;
    if (rows.length < 2) return [];

    const headers = rows[0].map(h => h.trim());
    const data = rows.slice(1).map(r => {
      const obj = {};
      headers.forEach((h, i) => obj[h] = r[i] ?? "");
      return obj;
    });

    data.forEach((d, i) => {
      d._id = (d.id || d.Title || (i + 1).toString()).trim();
    });

    return data;
  } catch (err) {
    console.error("❌ Fetch Error:", err);
    return [];
  }
}

function paginate(items, page = 1, pageSize = PAGE_SIZE) {
  const total = items.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize;
  return { pageItems: items.slice(start, start + pageSize), total, pages };
}

function renderPagination(totalItems, currentPage, cat = "all", searchQuery = "") {
  const pages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  if (pages <= 1) return '';
  let baseHash = '';
  if (searchQuery) baseHash = `#/search/${encodeURIComponent(searchQuery)}/page/`;
  else if (cat !== 'all') baseHash = `#/category/${cat}/page/`;
  else baseHash = '#/page/';
  let html = '';
  for (let i = 1; i <= pages; i++) {
    html += `<a href="javascript:void(0)" class="page-btn ${i === currentPage ? 'active' : ''}" onclick="navigateTo('${baseHash}${i}')">${i}</a>`;
  }
  return html;
}

function movieCardHtml(item) {
  const genre = item.Genre?.split(',')[0] || item.Category || '';
  const rating = item.Rating || 'N/A';
  return `
  <div class="card" onclick="navigateTo('#/item/${encodeURIComponent(item._id)}')">
    <img src="${item.Poster || ''}" alt="${item.Title}">
    <div class="card-meta">${genre}</div>
    <div class="card-body">
      <h3>${item.Title}</h3>
      <p>⭐ ${rating}</p>
    </div>
  </div>`;
}

async function getUniqueCategories(data) {
  const categories = new Set();
  data.forEach(item => {
    const catValue = item.Category?.trim() || item.Genre?.trim();
    if (catValue) catValue.split(',').forEach(c => {
      const cleanCat = c.trim();
      if (cleanCat) categories.add(cleanCat);
    });
  });
  return Array.from(categories);
}

function renderCategoryList(categories) {
  let html = '<div class="category-list-wrap">';
  categories.forEach(cat => {
    const hash = `#/category/${encodeURIComponent(cat)}`;
    html += `<a href="javascript:void(0)" class="category-list-btn" onclick="navigateTo('${hash}')">${cat}</a>`;
  });
  html += '</div>';
  return html;
}

async function renderHome(page = 1) {
  const app = qs('#app');
  const data = await fetchAllRows();
  const categories = await getUniqueCategories(data);
  const categoryListHtml = renderCategoryList(categories);
  const { pageItems, total } = paginate(data, page, PAGE_SIZE);
  app.innerHTML = `
  <div class="container">
    <div class="header-title-style">
      <h2 class="category-heading">All Titles</h2>
    </div>
    ${categoryListHtml}
    <div id="list" class="grid">${pageItems.map(movieCardHtml).join('')}</div>
    <div id="pagination" class="pagination">${renderPagination(total, page, 'all')}</div>
  </div>`;
}

async function renderCategory(cat, page = 1) {
  const app = qs('#app');
  app.innerHTML = `
  <div class="container">
    <div class="header-title-style">
      <h2 class="category-heading">${decodeURIComponent(cat).toUpperCase()}</h2>
    </div>
    <div id="list" class="grid"></div>
    <div id="pagination" class="pagination"></div>
  </div>`;
  const data = await fetchAllRows();
  const lowerCat = cat.toLowerCase();
  const filtered = data.filter(d =>
    d.Category?.trim().toLowerCase().includes(lowerCat) ||
    d.Genre?.trim().toLowerCase().includes(lowerCat)
  );
  const { pageItems, total } = paginate(filtered, page, PAGE_SIZE);
  qs('#list').innerHTML = pageItems.map(movieCardHtml).join('');
  qs('#pagination').innerHTML = renderPagination(total, page, cat);
}

async function renderSearch(query, page = 1) {
  const app = qs('#app');
  app.innerHTML = `
  <div class="container">
    <div class="header-title-style">
      <h2 class="category-heading">Search Results for: "${query}"</h2>
    </div>
    <div id="list" class="grid"></div>
    <div id="pagination" class="pagination"></div>
  </div>`;
  const data = await fetchAllRows();
  const lowerQuery = query.toLowerCase();
  const filtered = data.filter(d => d.Title?.toLowerCase().includes(lowerQuery));
  const { pageItems, total } = paginate(filtered, page, PAGE_SIZE);
  qs('#list').innerHTML = pageItems.length > 0
    ? pageItems.map(movieCardHtml).join('')
    : `<p class="not-found" style="text-align:center;padding:40px;">No results for "${query}".</p>`;
  qs('#pagination').innerHTML = renderPagination(total, page, null, query);
}

function createWatchLinksHtml(item) {
  const watchData = item["Watch Link"] || item.WatchLink || '';
  if (!watchData) return '';
  const parts = watchData.split('|').map(s => s.trim()).filter(s => s);
  if (parts.length < 2) return '';
  let html = '<div class="watch-links-section"><h3>Watch Links:</h3><div class="watch-links">';
  for (let i = 0; i < parts.length; i += 2) {
    const label = parts[i];
    const url = parts[i + 1];
    if (label && url) html += `<a class="btn btn-watch-dynamic" href="${url}" target="_blank">${label}</a>`;
  }
  html += '</div></div>';
  return html;
}

function createScreenshotsHtml(item) {
  const ssData = item.Screenshot || '';
  if (!ssData) return '';
  const shots = ssData.split('|').map(s => s.trim()).filter(s => s);
  if (shots.length === 0) return '';
  let html = '<div class="screenshot-section"><h3>Screenshots:</h3><div class="screenshots-grid">';
  shots.forEach(url => html += `<img src="${url}" class="screenshot-img" alt="Screenshot">`);
  html += '</div></div>';
  return html;
}

async function renderItemDetail(id) {
  const app = qs('#app');
  const data = await fetchAllRows();
  const item = data.find(d => d._id === decodeURIComponent(id));
  if (!item) { app.innerHTML = "<p class='not-found'>Item not found</p>"; return; }

  const title = item.Title || 'Untitled';
  const desc = item.Description || 'No description available.';
  const poster = item.Poster || '';
  const category = item.Category || 'Unknown';
  const rating = item.Rating || 'N/A';
  const runtime = item.Runtime || 'N/A';
  const date = item.Date || 'N/A';
  const watchLinksHtml = createWatchLinksHtml(item);
  const screenshotsHtml = createScreenshotsHtml(item);

  app.innerHTML = `
  <div class="container detail-container">
    <div class="detail-card">
      <img src="${poster}" alt="${title}" class="detail-poster">
      <div class="detail-meta">
        <h1 class="detail-title">${title}</h1>
        <div class="detail-info-row">
          <span class="info-tag category-tag">${category}</span>
          <span class="info-tag rating-tag">⭐ ${rating}</span>
          <span class="info-tag runtime-tag">🕒 ${runtime}</span>
          <span class="info-tag date-tag">📅 ${date}</span>
        </div>
        <p class="detail-description">${desc}</p>
        ${watchLinksHtml}
        ${screenshotsHtml}
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

  if (parts[0] === '' || parts[0] === 'page') {
    await renderHome(Number(parts[1]) || 1); return;
  }
  if (parts[0] === 'category') {
    await renderCategory(parts[1] || 'all', Number(parts[3]) || 1); return;
  }
  if (parts[0] === 'search') {
    await renderSearch(decodeURIComponent(parts[1] || ''), Number(parts[3]) || 1); return;
  }
  if (isDetail) {
    await renderItemDetail(parts[1] || ''); return;
  }
  await renderHome(1);
}

qs('#searchInput')?.addEventListener('keyup', (e) => {
  if (e.key === 'Enter') {
    const q = e.target.value.trim();
    if (q) window.location.hash = `#/search/${encodeURIComponent(q)}/page/1`;
  }
});

window.addEventListener('hashchange', router);
window.addEventListener('load', router);
