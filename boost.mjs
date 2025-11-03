// 💰 Dareloom Boost.mjs — Adsterra High CTR + SmartLink Optimized v4
// ⚙️ Includes: Popunder + Social Bar + SmartLink (Auto-trigger on user action)

(function () {
  // 🔗 SmartLink (replace if needed)
  const SMART_LINK = "https://bulletinsituatedelectronics.com/b95e6swf?key=0f61d8bf1a7278d5cf9f161ab55bafbb";

  // 📦 Ad scripts (replace keys if you change placements)
  const ADS = {
    popunder: "https://www.profitablecpmgate.com/27529034.js",
    socialbar: "https://www.profitablecpmgate.com/27554479.js",
  };

  // 🧩 Helper: Dynamically load any script
  function loadScript(src, delay = 0) {
    setTimeout(() => {
      const s = document.createElement("script");
      s.src = src;
      s.async = true;
      s.setAttribute("data-cfasync", "false");
      document.body.appendChild(s);
    }, delay);
  }

  // 🚀 Load Popunder & SocialBar with delay for better UX
  function initAds() {
    loadScript(ADS.socialbar, 3000); // 3s delay
    loadScript(ADS.popunder, 6000); // 6s delay
  }

  // 🎯 SmartLink trigger (safe, once per session)
  function triggerSmartLink() {
    if (sessionStorage.getItem("smart_done")) return;
    sessionStorage.setItem("smart_done", "1");

    // random delay for natural behavior
    const delay = Math.random() * 4000 + 2000;
    setTimeout(() => {
      window.open(SMART_LINK, "_blank");
    }, delay);
  }

  // 📱 Trigger SmartLink after first engagement
  ["click", "scroll", "touchstart"].forEach(evt =>
    document.addEventListener(evt, triggerSmartLink, { once: true })
  );

  // 🔁 Passive reload ads every 90s for longer sessions
  setInterval(initAds, 90000);

  // 🧠 Initial load
  window.addEventListener("DOMContentLoaded", () => {
    initAds();
    console.log("✅ Boost.mjs: Popunder + SocialBar + SmartLink Loaded");
  });
})();
