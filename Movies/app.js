const SHEET_ID = "1A2I6jODnR99Hwy9ZJXPkGDtAFKfpYwrm3taCWZWoZ7o";
const API_KEY = "AIzaSyBFnyqCW37BUL3qrpGva0hitYUhxE_x5nw";
const SHEET_NAME = "Sheet2";
const PAGE_SIZE = 6;

// ✅ Improvement: Global cache for data to prevent fetching on every route change
let allDataCache = null; 

function qs(sel) { return document.querySelector(sel); }

async function fetchAllRows() {
  // Return cached data if available
  if (allDataCache) {
    return allDataCache;
  }
  
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
    let data = rows.slice(1).map(r => {
      const obj = {};
      headers.forEach((h, i) => obj[h] = r[i] ?? "");
      return obj;
    });

    data.forEach((d, i) => {
      // Use Title as fallback for a unique ID if 'id' field is empty
      d._id = (d.id || d.Title || (i + 1).toString()).trim();
    });

    // 🌟 FIX: Reverse the data array so that the newest entries (at the bottom of the sheet) appear first.
    data.reverse();

    allDataCache = data; // Cache the fetched data
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
  // Use the first genre/category found for the badge
  const genre = item.Genre?.split(',')[0]?.trim() || item.Category?.split(',')[0]?.trim() || 'Unknown';
  const rating = item.Rating || 'N/A';
  const genreHash = `#/category/${encodeURIComponent(genre)}`;
  
  return `
  <div class="card" onclick="navigateTo('#/item/${encodeURIComponent(item._id)}')">
    <img src="${item.Poster || ''}" alt="${item.Title}">
    <a href="javascript:void(0)" class="card-category" onclick="event.stopPropagation(); navigateTo('${genreHash}')">${genre}</a>
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

// FIX: Returns empty string to hide the category list bar completely
function renderCategoryList(categories) {
  return ''; 
}

// 🌟 NEW FUNCTION: Dynamic SEO Update 🌟
function updateDynamicSEO(item) {
  // Fallback values
  const defaultTitle = "Dareloom Hub - Movies, Shows & Anime";
  const defaultDescription = "Dareloom Hub पर HD क्वालिटी में सभी नई फ़िल्में, शो और एनिमेशन देखें और डाउनलोड करें।";

  if (!item || !item.Title) {
      document.title = defaultTitle;
      // Also reset meta description to default
      let meta = document.querySelector('meta[name="description"]');
      if (meta) meta.content = defaultDescription;
      return;
  }

  const movieName = item.Title;
  const year = item.Year || new Date().getFullYear();
  // Ensure description is used, with fallback to name if empty
  const description = item.Description?.trim() || `Watch and download ${movieName} (${year}) full movie online.`;

  // 1. Title Tag अपडेट करें
  document.title = `${movieName} (${year}) Full Movie Watch Online & Download - Dareloom Hub`;

  // 2. META Description Tag अपडेट करें
  let meta = document.querySelector('meta[name="description"]');
  if (!meta) {
      // अगर meta tag मौजूद नहीं है, तो नया बनाएं (should be in index.html, but safety first)
      meta = document.createElement('meta');
      meta.name = 'description';
      document.head.appendChild(meta);
  }
  // SEO optimization: Include keywords in the meta description
  meta.content = `${description} | ${movieName} (${year}) को Dareloom Hub पर HD क्वालिटी में देखें और डाउनलोड करें।`;
}

// ---------------------------------------------------------------------------------

async function renderHome(page = 1) {
  // 🌟 SEO FIX: Reset to default SEO for Home Page
  updateDynamicSEO(null); 
  
  const app = qs('#app');
  const data = await fetchAllRows();
  const categories = await getUniqueCategories(data);
  const categoryListHtml = renderCategoryList(categories); // This is now empty
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
  // 🌟 SEO FIX: Reset to default SEO for Category Page
  updateDynamicSEO(null); 
  
  const app = qs('#app');
  const catTitle = decodeURIComponent(cat).toUpperCase();
  app.innerHTML = `
  <div class="container">
    <div class="header-title-style">
      <h2 class="category-heading">${catTitle}</h2>
    </div>
    <div id="list" class="grid"></div>
    <div id="pagination" class="pagination"></div>
  </div>`;
  const data = await fetchAllRows();
  const lowerCat = decodeURIComponent(cat).toLowerCase();
  
  // Filter based on Category or Genre column containing the selected category
  const filtered = data.filter(d =>
    d.Category?.trim().toLowerCase().includes(lowerCat) ||
    d.Genre?.trim().toLowerCase().includes(lowerCat)
  );
  
  const { pageItems, total } = paginate(filtered, page, PAGE_SIZE);
  qs('#list').innerHTML = pageItems.map(movieCardHtml).join('');
  qs('#pagination').innerHTML = renderPagination(total, page, cat);
}

async function renderSearch(query, page = 1) {
  // 🌟 SEO FIX: Reset to default SEO for Search Page
  updateDynamicSEO(null); 
  
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

// 🛑 REVERTED: Now renders separate buttons for all Label|URL pairs.
function createWatchLinksHtml(item) {
  const watchData = item["Watch Link"] || item.WatchLink || '';
  if (!watchData) return '';
  
  // Split the entire string by comma (,)
  const parts = watchData.split(',').map(s => s.trim()).filter(s => s); 
  
  // Prepare the URL string to pass to /watch.html for the main button
  const fullWatchUrl = encodeURIComponent(watchData); 
  
  let html = '<div class="watch-links-section"><h3>Watch Links:</h3><div class="watch-links">';
  
  // 1. Main Watch Button (Sends all links to /watch.html)
  html += `<a class="btn btn-watch-dynamic" href="/watch?url=${fullWatchUrl}" target="_blank" onclick="openAdsterraPop();">
              ▶️ Watch Now (Video Player)
            </a>`;
            
  // 2. Separate Buttons for Telegram/Other (Checks for t.me/telegram)
  if (parts.length > 0) {
      parts.forEach(link => {
          const lowerLink = link.toLowerCase();
          
          // Check for Telegram link
          if (lowerLink.includes("t.me") || lowerLink.includes("telegram")) {
              html += `<a class="btn btn-telegram" href="${link}" target="_blank" onclick="openAdsterraPop();">
                        ⬇️ Telegram Channel
                     </a>`;
          } 
          // Check for Mega link
          else if (lowerLink.includes("mega.nz")) {
               html += `<a class="btn btn-mega" href="${link}" target="_blank" onclick="openAdsterraPop();">
                        ☁️ Open MEGA Link
                     </a>`;
          }
      });
  }

  // NOTE: Mixdrop/Streamwish are handled by the single "Watch Now" button, 
  // which will send the links to /watch.html where the priority logic runs.

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
  // Since we reversed the data for home/pagination, we need to find the item in the reversed array
  const item = data.find(d => d._id === decodeURIComponent(id)); 
  if (!item) { 
    app.innerHTML = "<p class='not-found'>Item not found</p>"; 
    // 🌟 SEO FIX: Reset SEO if item not found
    updateDynamicSEO(null); 
    return; 
  }
  
  // 🌟 SEO FIX: Update Title and Meta Tags for this specific movie
  updateDynamicSEO(item); 

  const title = item.Title || 'Untitled';
  const year = item.Year || 'N/A';
  const desc = item.Description || 'No description available.';
  const poster = item.Poster || '';
  // Use the full list of categories/genres for detail page
  const categories = (item.Category || item.Genre || 'Unknown').split(',').map(c => c.trim()).filter(c => c);
  const rating = item.Rating || 'N/A';
  const runtime = item.Runtime || 'N/A';
  const date = item.Date || 'N/A';
  const watchLinksHtml = createWatchLinksHtml(item);
  const screenshotsHtml = createScreenshotsHtml(item);

  // Make category tags clickable on the detail page
  const categoryTags = categories.map(cat => 
    `<span class="info-tag category-tag" onclick="navigateTo('#/category/${encodeURIComponent(cat)}/page/1')">${cat}</span>`
  ).join('');

  app.innerHTML = `
  <div class="container detail-container">
    <div class="detail-card">
      <img src="${poster}" alt="${title}" class="detail-poster">
      <div class="detail-meta">
        <h1 class="detail-title">${title} (${year})</h1> 
        <div class="detail-info-row">
          ${categoryTags}
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

async function router() {
  const hash = location.hash.replace(/^#\/?/, ''); 
  const parts = hash.split('/');

  const isDetail = parts[0] === 'item';
  document.body.classList.toggle('detail-page', isDetail);

  if (parts[0] === '' || parts[0] === 'page') {
    await renderHome(Number(parts[1]) || 1); return;
  }
  if (parts[0] === 'category') {
    // parts[1] is the category name, parts[3] is the page number
    await renderCategory(parts[1] || 'all', Number(parts[3]) || 1); return;
  }
  if (parts[0] === 'search') {
    // parts[1] is the query, parts[3] is the page number
    await renderSearch(decodeURIComponent(parts[1] || ''), Number(parts[3]) || 1); return;
  }
  if (isDetail) {
    await renderItemDetail(parts[1] || ''); return;
  }
  await renderHome(1);
}

// Event listener for search input on Enter key press
qs('#searchInput')?.addEventListener('keyup', (e) => {
  if (e.key === 'Enter') {
    const q = e.target.value.trim();
    if (q) window.location.hash = `#/search/${encodeURIComponent(q)}/page/1`;
  }
});

window.addEventListener('hashchange', router);
window.addEventListener('load', router);
    
