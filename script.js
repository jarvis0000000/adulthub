const SHEET_ID = "1A2I6jODnR99Hwy9ZJXPkGDtAFKfpYwrm3taCWZWoZ7o";
const API_KEY = "AIzaSyA2OVy5Y8UGDrhCWLQeEMcBk8DtjXuFowc";
const RANGE = "Sheet1!A1:Z1000";

const SHEET_URL = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${RANGE}?alt=json&key=${API_KEY}`;

let videos = [];
let currentPage = 1;
const perPage = 5;

async function fetchVideos() {
  try {
    const res = await fetch(SHEET_URL);
    const data = await res.json();
    console.log("[Dareloom] Raw sheet data:", data);

    const rows = data.values;
    if (!rows || rows.length < 2) return;

    const headers = rows[0].map(h => h.trim().toLowerCase());
    const titleIndex = headers.findIndex(h => h.startsWith("title"));
    const trailerIndex = headers.findIndex(h => h.startsWith("trailer"));
    const watchIndex = headers.findIndex(h => h.startsWith("watch"));

    videos = rows.slice(1).map(r => ({
      title: r[titleIndex] || "Untitled",
      trailer: r[trailerIndex] || "",
      watch: r[watchIndex] || ""
    })).filter(v => v.title && v.trailer);

    renderRandom();
    renderLatest();
  } catch (err) {
    console.error("Error fetching videos:", err);
  }
}

function getYouTubeThumbnail(url) {
  try {
    let videoId = null;
    if (url.includes("youtu.be/")) {
      videoId = url.split("youtu.be/")[1].split("?")[0];
    } else if (url.includes("youtube.com/watch")) {
      const params = new URL(url).searchParams;
      videoId = params.get("v");
    } else if (url.includes("youtube.com/shorts/")) {
      videoId = url.split("/shorts/")[1].split("?")[0];
    }
    return videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null;
  } catch {
    return null;
  }
}

function renderRandom() {
  const container = document.getElementById("random-videos");
  container.innerHTML = "";
  const randoms = [...videos].sort(() => 0.5 - Math.random()).slice(0, 4);

  randoms.forEach(v => {
    const thumb = getYouTubeThumbnail(v.trailer);
    container.innerHTML += `
      <div class="video-card">
        ${thumb ? `<img src="${thumb}" alt="thumbnail">` : ""}
        <h3>${v.title}</h3>
        <a class="watch-btn" href="${v.watch}" target="_blank" onclick="openPopAd()">Watch Now</a>
      </div>`;
  });
}

function renderLatest() {
  const container = document.getElementById("latest-videos");
  container.innerHTML = "";
  const start = (currentPage - 1) * perPage;
  const end = start + perPage;
  const pageItems = videos.slice().reverse().slice(start, end);

  pageItems.forEach(v => {
    const thumb = getYouTubeThumbnail(v.trailer);
    container.innerHTML += `
      <div class="video-card">
        ${thumb ? `<img src="${thumb}" alt="thumbnail">` : ""}
        <h3>${v.title}</h3>
        <a class="watch-btn" href="${v.watch}" target="_blank" onclick="openPopAd()">Watch Now</a>
      </div>`;
  });

  document.getElementById("page-info").innerText =
    `Page ${currentPage} of ${Math.ceil(videos.length / perPage)}`;
}

document.getElementById("prev").addEventListener("click", () => {
  if (currentPage > 1) {
    currentPage--;
    renderLatest();
  }
});
document.getElementById("next").addEventListener("click", () => {
  if (currentPage < Math.ceil(videos.length / perPage)) {
    currentPage++;
    renderLatest();
  }
});

// Pop ad script injection
function openPopAd() {
  var pop = document.createElement("script");
  pop.src = "//pl27626803.revenuecpmgate.com/24/e4/33/24e43300238cf9b86a05c918e6b00561.js";
  document.body.appendChild(pop);
}

fetchVideos();

// Banner Ad Injection
window.onload = () => {
  const banner = document.createElement("div");
  banner.innerHTML = `
    <div style="margin:1em auto;max-width:300px;">
      <script type="text/javascript">
        atOptions = {
          'key' : '627de0095b96c6bf7f4e1f352a5fa6b5',
          'format' : 'iframe',
          'height' : 250,
          'width' : 300,
          'params' : {}
        };
      </script>
      <script type="text/javascript" src="//www.highperformanceformat.com/627de0095b96c6bf7f4e1f352a5fa6b5/invoke.js"></script>
    </div>`;
  document.body.appendChild(banner);
};
