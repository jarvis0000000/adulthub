const fs = require("fs");
const fetch = require("node-fetch");

// !!! KRIPYA YAHAN APNA WEBSITE KA BASE URL DALEIN (E.g., https://dareloom.fun) !!!
// Dhyaan dein: Yeh URL HTTPS ke saath hona chahiye
const BASE_URL = "https://dareloom.fun"; 

// ✅ CHANGES START HERE: Key ab Environment Variable se aayegi
const API_KEY = process.env.SHEET_KEY; 

// Agar key na ho toh script fail ho jaani chahiye
if (!API_KEY) {
    console.error("Error: SHEET_KEY environment variable is not set. Cannot run sitemap generation.");
    // Fail safe: empty sitemap bana do
    fs.writeFileSync("./sitemap.xml", '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>', 'utf8');
    return;
}

const SHEET_API = `https://sheets.googleapis.com/v4/spreadsheets/1A2I6jODnR99Hwy9ZJXPkGDtAFKfpYwrm3taCWZWoZ7o/values/Sheet1?alt=json&key=${API_KEY}`;
// ✅ CHANGES END HERE

const SITEMAP_PATH = "./sitemap.xml"; 

// --- Functions to fetch and parse data ---
function norm(s){ return (s||'').toString().trim().toLowerCase(); }
function findHeaderIndex(headers, candidates){
  for(let i=0;i<headers.length;i++){
    const h = norm(headers[i]);
    for(const c of candidates) if(h === c.toLowerCase()) return i;
  }
  return -1;
}

// ✅ UPDATED: Ab yeh function Title, Watch link aur Date teenon nikalega
function parseRows(values){
  if(!values || values.length < 2) return [];
  const headers = (values[0]||[]).map(h=> (h||'').toString());
  const ti = findHeaderIndex(headers, ['title']);
  const wa = findHeaderIndex(headers, ['watch','watch link']);
  const dt = findHeaderIndex(headers, ['date']);
  const rows = values.slice(1);
  const out = [];

  for(let r of rows){
    const title = ti !== -1 ? (r[ti]||'') : '';
    const watch = wa !== -1 ? (r[wa]||'') : '';
    const date = dt !== -1 ? (r[dt]||'') : '';
    
    // Sirf woh items lo jinka title aur watch link ho
    if(title.trim() && watch.trim()){
        out.push({
            // Deep-link ID: Title|WatchLink
            id: (title||'') + '|' + (watch||''), 
            date: date || new Date().toISOString().split("T")[0]
        });
    }
  }
  return out;
}

// --- Main Sitemap Generation Logic ---
async function generateSitemap(){
  try{
    const res = await fetch(SHEET_API);
    const j = await res.json();
    const items = parseRows(j.values); // Saare items fetch kiye
    
    // Default to today's date
    let latestMod = new Date().toISOString().split("T")[0];

    // Find the latest update date from the sheet
    const validDates = items.map(item => new Date(item.date)).filter(d => !isNaN(d));
    if(validDates.length > 0){
        validDates.sort((a, b) => b - a);
        latestMod = validDates[0].toISOString().split("T")[0];
    }

    let xml = `<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n`;
    xml += `<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n`;

    // 1. Home Page URL (Most Important)
    xml += `  <url>\n`;
    xml += `    <loc>${BASE_URL}/</loc>\n`;
    xml += `    <lastmod>${latestMod}</lastmod>\n`;
    xml += `    <changefreq>daily</changefreq>\n`;
    xml += `    <priority>1.0</priority>\n`; 
    xml += `  </url>\n`;

    // 2. ✅ Video Deep Links (Ab saare videos add honge)
    items.forEach(item => {
        // Deep link URL: Base URL + #v= + URL Encoded ID (Title|WatchLink)
        const videoUrl = `${BASE_URL}/#v=${encodeURIComponent(item.id)}`;
        
        // Date ko yyyy-mm-dd format mein rakhte hain
        const itemDate = new Date(item.date);
        const lastMod = !isNaN(itemDate) ? itemDate.toISOString().split("T")[0] : latestMod;
        
        xml += `  <url>\n`;
        xml += `    <loc>${videoUrl}</loc>\n`;
        xml += `    <lastmod>${lastMod}</lastmod>\n`;
        xml += `    <changefreq>weekly</changefreq>\n`;
        xml += `    <priority>0.8</priority>\n`; 
        xml += `  </url>\n`;
    });


    xml += `</urlset>`;
    
    fs.writeFileSync(SITEMAP_PATH, xml, 'utf8');
    console.log(`✅ Sitemap updated successfully with ${items.length} video URLs.`);
  }catch(e){
    console.error("Error generating sitemap:", e);
    // Agar fetch fail ho toh bhi empty sitemap create ho, taki purana wala delete na ho jaaye
    fs.writeFileSync(SITEMAP_PATH, '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>', 'utf8');
  }
}

generateSitemap();
