Import fs from "fs";
import fetch from "node-fetch";

// !!! YAHAN APNA WEBSITE KA BASE URL DALEIN (E.g., https://dareloom.fun) !!!
const BASE_URL = "https://dareloom.fun"; 
// !!! UPWALA URL CHANGE KARNA NA BHOOLEIN !!!

const SHEET_API = "https://sheets.googleapis.com/v4/spreadsheets/1A2I6jODnR99Hwy9ZJXPkGDtAFKfpYwrm3taCWZWoZ7o/values/Sheet1?alt=json&key=AIzaSyA2OVy5Y8UGDrhCWLQeEMcBk8DtjXuFowc";
const SITEMAP_PATH = "./public/sitemap.xml";

// --- Functions to fetch and parse data are kept to determine the latest date ---
function norm(s){ return (s||'').toString().trim().toLowerCase(); }
function findHeaderIndex(headers, candidates){
  for(let i=0;i<headers.length;i++){
    const h = norm(headers[i]);
    for(const c of candidates) if(h === c.toLowerCase()) return i;
  }
  return -1;
}
function parseRows(values){
  if(!values || values.length < 2) return [];
  const headers = (values[0]||[]).map(h=> (h||'').toString());
  const dt = findHeaderIndex(headers, ['date','upload date','published']);
  const rows = values.slice(1);
  const out = [];
  for(let r of rows){
    const date = dt !== -1 ? (r[dt]||'') : '';
    if(date && date.trim()) out.push(date.trim());
  }
  return out;
}

// --- Main Sitemap Generation Logic ---
async function generateSitemap(){
  try{
    const res = await fetch(SHEET_API);
    const j = await res.json();
    const dates = parseRows(j.values);
    let latestMod = new Date().toISOString().split("T")[0];

    // Find the latest update date from the sheet
    const validDates = dates.map(d => new Date(d)).filter(d => !isNaN(d));
    if(validDates.length > 0){
        validDates.sort((a, b) => b - a);
        latestMod = validDates[0].toISOString().split("T")[0];
    }

    let xml = `<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n`;
    xml += `<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n`;

    // Only add the Home Page URL
    xml += `  <url>\n`;
    xml += `    <loc>${BASE_URL}</loc>\n`;
    xml += `    <lastmod>${latestMod}</lastmod>\n`;
    xml += `    <priority>1.0</priority>\n`; // Home page ki priority 1.0 rakhein
    xml += `  </url>\n`;

    xml += `</urlset>`;
    
    fs.writeFileSync(SITEMAP_PATH, xml, 'utf8');
    console.log("✅ Sitemap updated successfully with Home Page URL.");
  }catch(e){
    console.error("Error generating sitemap:", e);
  }
}

generateSitemap();
