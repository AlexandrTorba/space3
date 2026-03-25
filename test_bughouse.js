const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => {
    if (msg.type() === 'error') console.log('BROWSER ERROR:', msg.text());
    else console.log('BROWSER LOG:', msg.text());
  });

  console.log("Navigating to Bughouse Arena...");
  // Test ID 'test-bughouse' with role 'w0'
  await page.goto('http://localhost:3000/play/bughouse/test-bughouse?role=w0');
  
  // Wait for hydration
  await page.waitForTimeout(5000);

  console.log("Verifying Bughouse elements...");
  
  // Check for the "Bughouse" title
  const title = await page.locator('h1').innerText();
  console.log("Title found:", title);
  
  // Verify two chessboards are rendered
  const board0 = await page.locator('#board0-board').isVisible();
  const board1 = await page.locator('#board1-board').isVisible();
  
  if (board0 && board1) {
    console.log("✅ SUCCESS: Both Bughouse boards are rendered with unique IDs.");
  } else {
    console.error("❌ FAILURE: Expected 2 boards, found:", (board0 ? 1 : 0) + (board1 ? 1 : 0));
  }

  // Check for "Board 0" and "Board 1" labels
  const hasBoard0 = await page.getByText('Board 0 (You)').isVisible();
  const hasBoard1 = await page.getByText('Board 1 (Partner)').isVisible();
  console.log("Board 0 label visible:", hasBoard0);
  console.log("Board 1 label visible:", hasBoard1);

  await page.screenshot({ path: 'test_bughouse_result.png' });
  await browser.close();
})();
