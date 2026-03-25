const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  try {
    await page.goto('http://localhost:3000/play/123');
    await new Promise(r => setTimeout(r, 3000));
  } catch (e) {
    console.error("Navigation failed", e);
  }
  await browser.close();
})();
