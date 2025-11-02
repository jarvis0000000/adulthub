// seo-injector.mjs
import fs from "fs";
import path from "path";

const SITE_URL = "https://dareloom.fun";
const PAGES_DIR = path.join(process.cwd(), "dist"); // ya "public" depending on deploy
const SEO_FILE = path.join(process.cwd(), "data", "trending-keywords.json");

// read keywords (ya sitemap based)
const keywords = JSON.parse(fs.readFileSync(SEO_FILE, "utf8"));

function titleCase(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

for (const keyword of keywords) {
  const htmlPath = path.join(PAGES_DIR, "seo", `${keyword}.html`);
  if (fs.existsSync(htmlPath)) {
    let html = fs.readFileSync(htmlPath, "utf8");

    const title = `${titleCase(keyword)} Videos - Watch Free ${titleCase(keyword)} in HD | Dareloom`;
    const desc = `Watch latest ${keyword} videos in HD for free on Dareloom.fun. Explore trending ${keyword} content updated daily.`;

    html = html.replace(
      /<title>.*?<\/title>/,
      `<title>${title}</title>\n<meta name="description" content="${desc}">\n<link rel="canonical" href="${SITE_URL}/seo/${keyword}.html">`
    );

    fs.writeFileSync(htmlPath, html, "utf8");
    console.log(`✅ SEO updated for ${keyword}.html`);
  }
}

console.log("🚀 All SEO meta tags updated successfully!");
