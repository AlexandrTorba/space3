const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log(`CONSOLE: ${msg.text()}`));
  
  await page.goto('https://antigravitychess.io/play/test12345?color=white&tc=3&w=Alice&b=Bob');
  
  // Wait for the move log to contain some websocket info
  await new Promise(r => setTimeout(r, 8000));
  
  const moveLog = await page.evaluate(() => {
    const logs = Array.from(document.querySelectorAll('.flex-1.overflow-y-auto > div'));
    return logs.map(l => l.innerText).join('\n');
  });
  
  console.log("MOVE LOG CONTENT:\n", moveLog);
  
  const statusToken = await page.evaluate(() => {
    const span = document.querySelector('.flex.items-center.gap-2.px-4.py-2 span');
    return span ? span.innerText : 'NOT FOUND';
  });
  console.log("STATUS:", statusToken);
  
  await browser.close();
})();
