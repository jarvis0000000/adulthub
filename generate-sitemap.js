import fs from "fs";
import fetch from "node-fetch";

const SHEET_API = "https://sheets.googleapis.com/v4/spreadsheets/1A2I6jODnR99Hwy9ZJXPkGDtAFKfpYwrm3taCWZWoZ7o/values/Sheet1?alt=json&key=AIzaSyA2OVy5Y8UGDrhCWLQeEMcBk8DtjXuFowc";
const SITEMAP_PATH = "./public/sitemap.xml";

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
  const wa = findHeaderIndex(headers, ['watch','watch ','watch link','watchlink']);
  const dt = findHeaderIndex(headers, ['date','upload date','published']);
  const rows = values.slice(1);
  const out = [];
  for(let r of rows){
    const watch = wa !== -1 ? (r[wa]||'') : '';
    const date = dt !== -1 ? (r[dt]||'') : '';
    if(watch && watch.trim()) out.push({ watch: watch.trim(), date: date.trim() });
  }
  return out;
}

async function generateSitemap(){
  try{
    const res = await fetch(SHEET_API);
    const j = await res.json();
    const items = parseRows(j.values);

    let xml = `<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n`;
    xml += `<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n`;

    items.forEach(i=>{
      let lastmod = new Date().toISOString().split("T")[0];
      if(i.date){
        const d = new Date(i.date);
        if(!isNaN(d)) lastmod = d.toISOString().split("T")[0];
      }
      xml += `  <url>\n`;
      xml += `    <loc>${i.watch}</loc>\n`;
      xml += `    <lastmod>${lastmod}</lastmod>\n`;
      xml += `    <priority>0.8</priority>\n`;
      xml += `  </url>\n`;
    });

    xml += `</urlset>`;
    fs.writeFileSync(SITEMAP_PATH, xml, 'utf8');
    console.log("✅ Sitemap updated!");
  }catch(e){
    console.error("Error generating sitemap:", e);
  }
}

generateSitemap();