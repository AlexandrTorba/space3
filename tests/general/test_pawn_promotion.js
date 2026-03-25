const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => {
    console.log('BROWSER LOG:', msg.text());
  });

  await page.goto('http://localhost:3000/analysis');
  await page.waitForTimeout(5000);

  const testFen = '1r6/P7/k7/8/8/8/8/K7 w - - 0 1'; 
  console.log("Loading FEN...");
  
  // Click PGN tab to make textarea visible
  const pgnTab = page.locator('button:has-text("PGN")');
  await pgnTab.click();
  await page.waitForTimeout(500);

  await page.fill('textarea', testFen);
  await page.click('button:has-text("OK")');
  await page.waitForTimeout(2000);
  
  console.log("Analyzing squares...");
  const a7Piece = await page.evaluate(() => {
     const img = document.querySelector('[data-square="a7"] img');
     return img ? img.getAttribute('alt') : 'None';
  });
  console.log("Piece at a7:", a7Piece);

  const a7 = page.locator('[data-square="a7"]');
  const b8 = page.locator('[data-square="b8"]');
  
  const src = await a7.boundingBox();
  const dest = await b8.boundingBox();
  
  console.log("Dragging a7 to b8...");
  await page.mouse.move(src.x + src.width/2, src.y + src.height/2);
  await page.mouse.down();
  await page.waitForTimeout(500);
  await page.mouse.move(dest.x + dest.width/2, dest.y + dest.height/2, { steps: 50 });
  await page.waitForTimeout(500);
  await page.mouse.up();
  
  await page.waitForTimeout(3000);
  
  await page.screenshot({ path: 'browser_test_final.png' });
  await browser.close();
})();
