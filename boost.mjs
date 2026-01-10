// 💰 Dareloom.fun - Adsterra Booster (Popunder + Social Bar Only)
// ✅ Optimized for User Experience, Page Speed, and Reliability

(function () {
  console.log("🚀 Adsterra Booster Loaded (Popunder & SocialBar)");

  const POPUNDER = "https://rockyappliance.com/24/e4/33/24e43300238cf9b86a05c918e6b00561.js";
  const SOCIALBAR = "//bulletinsituatedelectronics.com/cb/63/19/cb6319838ced4608354b54fc6faddb8a.js";

  function loadAd(src, retries = 3) {
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => console.log("✅ Loaded:", src.split('/').pop());
    s.onerror = () => {
      console.warn("⚠️ Failed:", src.split('/').pop(), "| Retrying...");
      if (retries > 0) setTimeout(() => loadAd(src, retries - 1), 2500);
    };
    document.body.appendChild(s);
  }

  function startAds() {
    // 1. Popunder with Session Limit
    if (!sessionStorage.getItem("pop_done")) {
        loadAd(POPUNDER);
        sessionStorage.setItem("pop_done", "1");
    }
    
    // 2. SocialBar loads after a delay (no limit needed for Social Bar)
    setTimeout(() => loadAd(SOCIALBAR), 1000); 
  }

  window.addEventListener("DOMContentLoaded", () => {
    // 3 seconds initial delay
    setTimeout(startAds, 1000); 
  });
})();
