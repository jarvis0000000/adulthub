// 💰 Dareloom.fun - Adsterra Combo Booster v5
// ✅ Popunder + Social Bar + SmartLink (Bulletinsituatedelectronics) + Retry + Delay Optimized

(function () {
  console.log("🚀 Adsterra Combo Booster v5 Loaded (Bulletinsituatedelectronics)");

  // 🔗 Ad URLs (replace only if you get new ones)
  const POPUNDER = "//bulletinsituatedelectronics.com/24/e4/33/24e43300238cf9b86a05c918e6b00561.js";
  const SOCIALBAR = "//bulletinsituatedelectronics.com/cb/63/19/cb6319838ced4608354b54fc6faddb8a.js";

  // 🧩 Dynamic ad loader with retry
  function loadAd(src, retries = 3) {
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => console.log("✅ Loaded:", src);
    s.onerror = () => {
      console.warn("⚠️ Failed:", src, "| Retrying...");
      if (retries > 0) setTimeout(() => loadAd(src, retries - 1), 2500);
    };
    document.body.appendChild(s);
  }

  // 🚀 Gradual load (for smooth user experience)
  function startAds() {
    loadAd(POPUNDER); // Popunder first
    setTimeout(() => loadAd(SOCIALBAR), 4000); // SocialBar after 4s
  }

  // 💥 SmartLink trigger (after real engagement only)
  function triggerSmartlink() {
    if (sessionStorage.getItem("smartlink_done")) return;
    sessionStorage.setItem("smartlink_done", "1");

    // natural random delay (looks organic)
    setTimeout(() => {
      window.open(SMARTLINK, "_blank");
      console.log("🔗 Smartlink opened!");
    }, Math.random() * 4000 + 2000);
  }

  // 🎯 Trigger Smartlink only on real user actions
  ["click", "scroll", "touchstart"].forEach(evt => {
    document.addEventListener(evt, triggerSmartlink, { once: true });
  });

  // ⏱ Start ads once page is ready
  window.addEventListener("DOMContentLoaded", () => {
    setTimeout(startAds, 3000);
  });
})();
