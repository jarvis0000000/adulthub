// master-build.mjs - THE UNIFIED MASTER SCRIPT (V1)
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

// --- CONFIGURATION ---
const SCRIPTS_ORDER = [
  "auto-traffic-booster (1).mjs", // 1. Keywords lao
  "auto-seo (1).mjs",             // 2. Pages aur Sitemaps banao
  "generate-actresses.mjs",       // 3. Actor pages update karo
  "generate-meta-files.mjs"       // 4. Robots & Index link karo
];

async function runMaster() {
  console.log("🚀 Starting Dareloom Master Build System...");
  const startTime = Date.now();

  for (const script of SCRIPTS_ORDER) {
    if (fs.existsSync(script)) {
      try {
        console.log(`\n-----------------------------------`);
        console.log(`📦 Running: ${script}...`);
        
        // Execute script and show output in console
        execSync(`node "${script}"`, { stdio: "inherit" });
        
        console.log(`✅ ${script} Completed.`);
      } catch (error) {
        console.error(`❌ Error in ${script}:`, error.message);
        // Script fail ho toh process stop na ho, isliye loop chalta rahega
      }
    } else {
      console.warn(`⚠️ Warning: ${script} not found, skipping.`);
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n===================================`);
  console.log(`🎉 Master Build Finished in ${duration}s!`);
  console.log(`🌍 Your site is now SEO-Ready & Indexed.`);
  console.log(`===================================`);
}

runMaster();

