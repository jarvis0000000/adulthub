// ========================================
// Dareloom Hub – Auto Robots & Sitemap Index Generator
// ========================================
import fs from "fs-extra";
import { create } from "xmlbuilder2";

const domain = "https://dareloom.fun";
const outputDir = "./"; // root folder

// 1️⃣ ROBOTS.TXT CONTENT
const robotsTxt = `# ===============================
# Dareloom Hub - robots.txt (SEO + AI Protection)
# ===============================

# -------------------------------
# Block AI & Scraper Bots
# -------------------------------
User-agent: GPTBot
Disallow: /

User-agent: ClaudeBot
Disallow: /

User-agent: PerplexityBot
Disallow: /

User-agent: Diffbot
Disallow: /

User-agent: OmgiliBot
Disallow: /

User-agent: anthropic-ai
Disallow: /

User-agent: ChatGPT
Disallow: /

User-agent: FacebookBot
Disallow: /

User-agent: meta-externalagent
Disallow: /

User-agent: DataForSeoBot
Disallow: /

User-agent: CCBot
Disallow: /

User-agent: Bytespider
Disallow: /

User-agent: Google-Extended
Disallow: /

# -------------------------------
# Major Search Engines
# -------------------------------
User-agent: Googlebot
Allow: /
Disallow: /admin/
Disallow: /private/

User-agent: Bingbot
Allow: /
Disallow: /admin/
Disallow: /private/

User-agent: Yandex
Allow: /

User-agent: DuckDuckBot
Allow: /

User-agent: Applebot
Allow: /

# -------------------------------
# SEO & Crawler Management
# -------------------------------
User-agent: *
Disallow: /admin/
Disallow: /api/
Disallow: /node_modules/
Disallow: /scripts/
Disallow: /private/
Disallow: /temp/
Disallow: /*?*sort=*
Disallow: /*?*filter=*
Disallow: /*?*session=*
Disallow: /*?*ref=*
Disallow: /*?*utm_*
Crawl-delay: 10
Clean-param: utm_source&utm_medium&utm_campaign&utm_term&utm_content&ref /

# -------------------------------
# Backlink & SEO Tool Crawlers
# -------------------------------
User-agent: AhrefsBot
Disallow: /

User-agent: SemrushBot
Disallow: /

User-agent: Majestic
Disallow: /

User-agent: SEOkicks-Robot
Disallow: /

# -------------------------------
# Sitemap Locations
# -------------------------------
Sitemap: ${domain}/sitemap-index.xml
Sitemap: ${domain}/sitemap.xml
Sitemap: ${domain}/sitemap-video.xml
Sitemap: ${domain}/sitemap-seo.xml

# -------------------------------
# End of File
# -------------------------------
`;

// 2️⃣ SITEMAP-INDEX.XML CONTENT
const sitemapList = [
  "sitemap.xml",
  "sitemap-video.xml",
  "sitemap-seo.xml",
  "sitemap-actors.xml",
];

const sitemapIndex = create({ version: "1.0", encoding: "UTF-8" })
  .ele("sitemapindex", { xmlns: "http://www.sitemaps.org/schemas/sitemap/0.9" });

sitemapList.forEach((file) => {
  sitemapIndex
    .ele("sitemap")
    .ele("loc")
    .txt(`${domain}/${file}`)
    .up()
    .ele("lastmod")
    .txt(new Date().toISOString())
    .up()
    .up();
});

const sitemapXml = sitemapIndex.end({ prettyPrint: true });

// 3️⃣ WRITE BOTH FILES
fs.writeFileSync(`${outputDir}/robots.txt`, robotsTxt);
fs.writeFileSync(`${outputDir}/sitemap-index.xml`, sitemapXml);

console.log("✅ robots.txt and sitemap-index.xml generated successfully!");
console.log("📍 Location:", outputDir);
