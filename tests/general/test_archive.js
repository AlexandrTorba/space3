const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('console', msg => { if (msg.type() === 'error') console.log('BROWSER CONSOLE ERROR:', msg.text()); });
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  try {
    await page.goto('http://localhost:3000/archive/123');
    await new Promise(r => setTimeout(r, 4000));
    const text = await page.evaluate(() => document.body.innerText);
    if (text.includes("This page couldn")) {
      console.log("REACT CRASH DETECTED ON ARCHIVE!");
    } else {
      console.log("Archive loaded fine");
    }
  } catch (e) {
    console.error("Navigation failed", e);
  }
  await browser.close();
})();
