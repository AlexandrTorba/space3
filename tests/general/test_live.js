const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('console', msg => { if (msg.type() === 'error') console.log('BROWSER CONSOLE ERROR:', msg.text()); });
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  try {
    await page.goto('https://antigravitychess.io/play/test?color=white');
    await new Promise(r => setTimeout(r, 4000));
    // check if "This page couldn't load" is visible
    const text = await page.evaluate(() => document.body.innerText);
    if (text.includes("This page couldn")) {
      console.log("REACT CRASH DETECTED ON LIVE SITE!");
    } else {
      console.log("Site loaded fully without crash.", text.substring(0, 100));
    }
  } catch (e) {
    console.error("Navigation failed", e);
  }
  await browser.close();
})();
