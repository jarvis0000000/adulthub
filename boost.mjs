// ✅ Adsterra Combo Setup (Popunder + Social Bar + Smartlink)
// Load all after slight delay for better performance

setTimeout(() => {
  // --- Popunder ---
  const pop = document.createElement('script');
  pop.async = true;
  pop.src = "//pl19088548.profitablegatecpm.com/9b/11/60/9b1160b85f1a9d4cb9b84a91df10b3f0.js";
  document.body.appendChild(pop);

  // --- Social Bar ---
  const social = document.createElement('script');
  social.async = true;
  social.src = "//pl19088550.profitablegatecpm.com/15/3f/17/153f1788bb62cbb931fdf94cfeb0a3fc.js";
  document.body.appendChild(social);

  // --- Smartlink (Open silently for earning boost) ---
  const smartLink = "https://www.profitablecpmrate.com/fpdd7ztfb?key=f5e28ff4d94a3f3e3c2f29e7cd395aa4";
  const openSmartlink = () => {
    const a = document.createElement("a");
    a.href = smartLink;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.click();
  };

  // Trigger smartlink once per session (after 10s)
  if (!sessionStorage.getItem("smartlink_shown")) {
    setTimeout(openSmartlink, 10000);
    sessionStorage.setItem("smartlink_shown", "1");
  }
}, 3000);
