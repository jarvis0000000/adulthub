// ✅ Dareloom Hub – Working Version (Google Sheet + Category Click + Watch Links)
// Updated: 2025-10-12

const SHEET_ID = "1A2I6jODnR99Hwy9ZJXPkGDtAFKfpYwrm3taCWZWoZ7o";
const API_KEY = "AIzaSyBFnyqCW37BUL3qrpGva0hitYUhxE_x5nw";
const SHEET_NAME = "Sheet2";
const PAGE_SIZE = 6;

function qs(sel) { return document.querySelector(sel); }

// ✅ Fetch Google Sheet data
async function fetchAllRows() {
  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${SHEET_NAME}?alt=json&key=${API_KEY}`;
    const res = await fetch(url);
    const json = await res.json();
    if (!json.values) return [];

    const rows = json.values;
    const headers = rows[0].map(h => h.trim());
    const data = rows.slice(1).map(r => {
      const obj = {};
      headers.forEach((h, i) => obj[h] = r[i] ?? "");
      obj._id = (obj.Title || i + 1).trim();
      return obj;
    });
    return data;
  } catch (err) {
    console.error("❌ Fetch Error:", err);
    return [];
  }
}

// ✅ Pagination Helper
function paginate(items, page = 1, pageSize = PAGE_SIZE) {
  const total = items.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize;
  return { pageItems: items.slice(start, start + pageSize), total, pages };
}

// ✅ Pagination Buttons
function renderPagination(totalItems, currentPage, cat = "all", searchQuery = "") {
  const pages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  if (pages <= 1) return "";
  let base = searchQuery
    ? `#/search/${encodeURIComponent(searchQuery)}/page/`
    : cat !== "all"
    ? `#/category/${encodeURIComponent(cat)}/page/`
    : "#/page/";
  return Array.from({ length: pages }, (_, i) =>
    `<a href="javascript:void(0)" class="page-btn ${i + 1 === currentPage ? "active" : ""}"
       onclick="navigateTo('${base}${i + 1}')">${i + 1}</a>`
  ).join("");
}

// ✅ Movie Card
function movieCardHtml(item) {
  const category = item.Category || "";
  const rating = item.Language || "Unknown";
  const catHtml = category
    ? `<span class="card-category" onclick="event.stopPropagation(); navigateTo('#/category/${encodeURIComponent(category.toLowerCase())}/page/1')">${category}</span>`
    : "";

  return `
  <div class="card" onclick="navigateTo('#/item/${encodeURIComponent(item._id)}')">
    <div class="poster-wrap">
      <img src="${item.Poster}" alt="${item.Title}">
      ${catHtml}
    </div>
    <div class="card-body">
      <h3>${item.Title}</h3>
      <p>🌐 ${rating}</p>
    </div>
  </div>`;
}

// ✅ Home Page
async function renderHome(page = 1) {
  const app = qs("#app");
  const data = await fetchAllRows();
  const { pageItems, total } = paginate(data, page);
  app.innerHTML = `
    <div class="container">
      <h2 class="category-heading">All Titles</h2>
      <div class="grid">${pageItems.map(movieCardHtml).join("")}</div>
      <div class="pagination">${renderPagination(total, page)}</div>
    </div>`;
}

// ✅ Category Page
async function renderCategory(cat, page = 1) {
  const app = qs("#app");
  const data = await fetchAllRows();
  const lowerCat = decodeURIComponent(cat).toLowerCase();
  const filtered = data.filter(
    d => d.Category?.toLowerCase().includes(lowerCat)
  );
  const { pageItems, total } = paginate(filtered, page);
  app.innerHTML = `
    <div class="container">
      <h2 class="category-heading">${cat.toUpperCase()}</h2>
      <div class="grid">${pageItems.map(movieCardHtml).join("")}</div>
      <div class="pagination">${renderPagination(total, page, cat)}</div>
    </div>`;
}

// ✅ Detail Page
async function renderItemDetail(id) {
  const app = qs("#app");
  const data = await fetchAllRows();
  const item = data.find(d => d._id === decodeURIComponent(id));
  if (!item) return (app.innerHTML = "<p class='not-found'>Item not found</p>");

  const watch = item["Watch Link"];
  const shots = (item.Screenshot || "").split("|").filter(Boolean);

  app.innerHTML = `
  <div class="container detail-container">
    <div class="detail-card">
      <img src="${item.Poster}" alt="${item.Title}" class="detail-poster">
      <div class="detail-meta">
        <h1>${item.Title}</h1>
        <p>${item.Description || "No description available."}</p>
        <div class="detail-info">
          <span class="info-tag">${item.Language}</span>
          <span class="info-tag category" onclick="navigateTo('#/category/${encodeURIComponent(item.Category.toLowerCase())}/page/1')">${item.Category}</span>
        </div>
        ${watch ? `<a class="btn btn-watch" href="${watch}" target="_blank">▶ Watch Now</a>` : ""}
        ${shots.length
          ? `<div class="screenshot-section"><h3>Screenshots:</h3>
            <div class="screenshots-grid">
              ${shots.map(s => `<img src="${s}" class="screenshot-img">`).join("")}
            </div></div>` : ""}
      </div>
    </div>
  </div>`;
}

// ✅ Search Page
async function renderSearch(query, page = 1) {
  const app = qs("#app");
  const data = await fetchAllRows();
  const filtered = data.filter(d =>
    d.Title?.toLowerCase().includes(query.toLowerCase())
  );
  const { pageItems, total } = paginate(filtered, page);
  app.innerHTML = `
    <div class="container">
      <h2 class="category-heading">Search: ${query}</h2>
      <div class="grid">${pageItems.map(movieCardHtml).join("")}</div>
      <div class="pagination">${renderPagination(total, page, null, query)}</div>
    </div>`;
}

// ✅ Router
function navigateTo(hash) {
  window.location.hash = hash;
}

async function router() {
  const parts = location.hash.replace(/^#\/?/, "").split("/");
  if (parts[0] === "" || parts[0] === "page") return renderHome(Number(parts[1]) || 1);
  if (parts[0] === "category") return renderCategory(parts[1], Number(parts[3]) || 1);
  if (parts[0] === "item") return renderItemDetail(parts[1]);
  if (parts[0] === "search") return renderSearch(parts[1], Number(parts[3]) || 1);
  renderHome(1);
}

qs("#searchInput")?.addEventListener("keyup", e => {
  if (e.key === "Enter") {
    const q = e.target.value.trim();
    if (q) navigateTo(`#/search/${encodeURIComponent(q)}/page/1`);
  }
});

window.addEventListener("hashchange", router);
window.addEventListener("load", router);
