// 💰 Dareloom.fun - Adsterra Combo Booster v6 (Optimized for UX/SEO)
// ✅ Popunder + Social Bar (Delayed) + Targeted SmartLink Trigger

(function () {
  console.log("🚀 Adsterra Combo Booster v6 Loaded (Optimized)");

  // 🔗 Ad URLs (replace only if you get new ones)
  const POPUNDER_URL = "//bulletinsituatedelectronics.com/24/e4/33/24e43300238cf9b86a05c918e6b00561.js";
  const SOCIALBAR_URL = "//bulletinsituatedelectronics.com/cb/63/19/cb6319838ced4608354b54fc6faddb8a.js";
  const SMARTLINK_URL = "https://bulletinsituatedelectronics.com/b95e6swf?key=0f61d8bf1a7278d5cf9f161ab55bafbb";

  // 🧩 Dynamic ad loader with retry
  function loadAd(src, type, retries = 3) {
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => console.log(`✅ Loaded: ${type}`);
    s.onerror = () => {
      console.warn(`⚠️ Failed: ${type} | Retrying...`);
      if (retries > 0) setTimeout(() => loadAd(src, type, retries - 1), 3000);
    };
    document.body.appendChild(s);
  }

  // 🚀 Gradual load (Improved Delay for CWV/UX)
  function startAds() {
    // Popunder is less disruptive if loaded slightly later
    loadAd(POPUNDER_URL, "Popunder"); 
    
    // Social Bar loads 5 seconds later (10 seconds total delay)
    setTimeout(() => loadAd(SOCIALBAR_URL, "SocialBar"), 5000); 
  }

  /**
   * 💥 SMARTLINK TRIGGER: Opens the Smartlink in a new tab.
   * This should be called directly from your navigation/watch button logic (e.g., inside openWatchPage).
   */
  window.triggerSmartlink = function() {
    if (sessionStorage.getItem("smartlink_done")) return false;
    sessionStorage.setItem("smartlink_done", "1");

    // Open SmartLink in a new tab
    const w = window.open(SMARTLINK_URL, "_blank");

    if (w) {
        console.log("🔗 Smartlink opened!");
        return true;
    } else {
        // Fallback for strict browsers
        sessionStorage.removeItem("smartlink_done");
        return false;
    }
  }

  // ⏱ Start ads once page is ready, after 5 seconds
  window.addEventListener("DOMContentLoaded", () => {
    setTimeout(startAds, 5000);
  });
})();
