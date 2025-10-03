const fs = require("fs");
const fetch = require("node-fetch");
const path = require("path");

// Base URL (Apna site URL yahan daalo)
const BASE_URL = "https://dareloom.fun";

// API Key from Environment
const API_KEY = process.env.SHEET_KEY;
if (!API_KEY) {
    console.error("❌ Error: SHEET_KEY environment variable is not set.");
    // Fail safe: Agar API key nahi hai, toh action ko fail kar do (empty sitemap banane se behtar)
    process.exit(1); 
}

// Google Sheet API
const SHEET_API = `https://sheets.googleapis.com/v4/spreadsheets/1A2I6jODnR99Hwy9ZJXPkGDtAFKfpYwrm3taCWZWoZ7o/values/Sheet1?alt=json&key=${API_KEY}`;

// --- Robust Path Setup ---
// Hum file ko seedhe 'public' folder ke andar save karenge.
const PUBLIC_DIR = path.join(__dirname, "public"); 
const SITEMAP_PATH = path.join(PUBLIC_DIR, "sitemap.xml"); 

// --- Helpers (No changes needed) ---
function norm(s){ return (s||'').toString().trim().toLowerCase(); }

function slugify(text){
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')   
    .replace(/^-+|-+$/g, '');      
}

function parseRows(values){
  if(!values || values.length < 2) return [];
  const headers = (values[0]||[]).map(h=> (h||'').toString());
  
  // FIXED INDEXES: Title(A)=0, Watch(G)=6, Date(T)=19
  const ti = 0;   
  const wa = 6;   
  const dt = 19;  
  
  const findHeaderIndex = (candidates) => {
    for(let i=0;i<headers.length;i++){
      const h = norm(headers[i]);
      for(const c of candidates) if(h === c.toLowerCase()) return i;
    }
    return -1;
  };

  const ti_fallback = findHeaderIndex(['title']);
  const wa_fallback = findHeaderIndex(['watch','watch link']);
  const dt_fallback = findHeaderIndex(['date']);

  const rows = values.slice(1);
  const out = [];

  for(let r of rows){
    const title = (r[ti]||'') || (ti_fallback !== -1 ? (r[ti_fallback]||'') : '');
    const watch = (r[wa]||'') || (wa_fallback !== -1 ? (r[wa_fallback]||'') : '');
    const date = (r[dt]||'') || (dt_fallback !== -1 ? (r[dt_fallback]||'') : '');
    
    if(title.trim() && watch.trim()){
        const slug = slugify(title) || "video";
        const uniqueId = Buffer.from(watch).toString("base64").slice(0,8).replace(/[^a-zA-Z0-9]/g, ''); 
        
        out.push({
            url: `${BASE_URL}/video/${slug}-${uniqueId}`,
            date: date || new Date().toISOString().split("T")[0]
        });
    }
  }
  return out;
}

// --- Sitemap Generator (Final) ---
async function generateSitemap(){
  let items = []; // Items ko try block ke bahar define karein for error logging
  try{
    // 1. Fetch Data
    const res = await fetch(SHEET_API);
    if (!res.ok) { // Check for HTTP errors like 400 or 403
        throw new Error(`HTTP error! Status: ${res.status}`);
    }
    const j = await res.json();
    items = parseRows(j.values);
    
    // 2. Create public directory if it doesn't exist 
    if (!fs.existsSync(PUBLIC_DIR)) {
        fs.mkdirSync(PUBLIC_DIR, { recursive: true });
        console.log(`📂 Created directory: ${PUBLIC_DIR}`);
    }

    // 3. Determine latest modification date
    let latestMod = new Date().toISOString().split("T")[0];
    const validDates = items.map(item => new Date(item.date)).filter(d => !isNaN(d));
    if(validDates.length > 0){
        validDates.sort((a, b) => b - a);
        latestMod = validDates[0].toISOString().split("T")[0];
    }

    // 4. Build XML (No change in XML structure)
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

    // Home Page
    xml += `  <url>\n`;
    xml += `    <loc>${BASE_URL}/</loc>\n`;
    xml += `    <lastmod>${latestMod}</lastmod>\n`;
    xml += `    <changefreq>daily</changefreq>\n`;
    xml += `    <priority>1.0</priority>\n`; 
    xml += `  </url>\n`;

    // Video Pages
    items.forEach(item => {
        const itemDate = new Date(item.date);
        const lastMod = !isNaN(itemDate) ? itemDate.toISOString().split("T")[0] : latestMod;
        
        xml += `  <url>\n`;
        xml += `    <loc>${item.url}</loc>\n`;
        xml += `    <lastmod>${lastMod}</lastmod>\n`;
        xml += `    <changefreq>weekly</changefreq>\n`;
        xml += `    <priority>0.8</priority>\n`; 
        xml += `  </url>\n`;
    });

    xml += `</urlset>`; 

    fs.writeFileSync(SITEMAP_PATH, xml, 'utf8');
    console.log(`✅ SEO-Friendly Sitemap generated with ${items.length} video URLs at: ${SITEMAP_PATH}`);
  }catch(e){
    console.error(`❌ Fatal Error during sitemap generation (Fetched ${items.length} items):`, e.message);
    
    // Fail-safe ke liye agar directory nahi hai toh banao
    if (!fs.existsSync(PUBLIC_DIR)) {
        fs.mkdirSync(PUBLIC_DIR, { recursive: true });
    }
    // Aur phir ek valid empty sitemap save karo
    fs.writeFileSync(SITEMAP_PATH,
        '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>',
        'utf8'
    );
    // Execution ko fail karo taaki log mein dikhe ki kuch galat hua hai
    process.exit(1); 
  }
}

generateSitemap();
            
