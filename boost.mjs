// 💰 Dareloom.fun - Adsterra Booster (Popunder + Social Bar Only)
// ✅ Optimized for User Experience, Page Speed, and Reliability

(function () {
  console.log("🚀 Adsterra Booster Loaded (Popunder & SocialBar)");

  // 🔗 Ad URLs (replace only if you get new ones)
  const POPUNDER = "//bulletinsituatedelectronics.com/24/e4/33/24e43300238cf9b86a05c918e6b00561.js";
  const SOCIALBAR = "//bulletinsituatedelectronics.com/cb/63/19/cb6319838ced4608354b54fc6faddb8a.js";

  // 🧩 Dynamic ad loader with retry logic
  function loadAd(src, retries = 3) {
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => console.log("✅ Loaded:", src.split('/').pop());
    s.onerror = () => {
      console.warn("⚠️ Failed:", src.split('/').pop(), "| Retrying...");
      if (retries > 0) setTimeout(() => loadAd(src, retries - 1), 2500);
    };
    // Ensure the script loads in the body
    document.body.appendChild(s);
  }

  // 🚀 Gradual load sequence (Optimized for CLS/UX)
  function startAds() {
    loadAd(POPUNDER); // 1. Popunder loads first
    
    // 2. SocialBar loads after a delay to improve page speed score
    setTimeout(() => loadAd(SOCIALBAR), 4000); 
  }

  // ⏱ Start ads once page is ready (3-second initial delay)
  window.addEventListener("DOMContentLoaded", () => {
    // 3 seconds delay after the DOM is ready for optimal UX
    setTimeout(startAds, 3000); 
  });
})();
