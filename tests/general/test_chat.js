const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  page.on('console', msg => {
    if (msg.type() === 'error') console.log('BROWSER ERROR:', msg.text());
    else console.log('BROWSER LOG:', msg.text());
  });

  console.log("Navigating to Arena...");
  await page.goto('http://localhost:3000/play/test-match?color=white');
  
  // Wait for hydration and WS connection
  await page.waitForTimeout(5000);

  console.log("Finding chat input...");
  const chatInput = page.getByPlaceholder('Type to chat...');
  
  if (await chatInput.isVisible()) {
    console.log("✅ Chat input is visible.");
    
    const testMessage = "Hello from automated test " + Math.random().toString(36).substring(7);
    console.log(`Sending message: ${testMessage}`);
    
    await chatInput.fill(testMessage);
    await page.keyboard.press('Enter');
    
    // Wait for message to appear in logs
    await page.waitForTimeout(2000);
    
    const logsContent = await page.locator('.flex-1.p-4.overflow-y-auto.font-mono').innerText();
    if (logsContent.includes(testMessage)) {
       console.log("✅ SUCCESS: Message appeared in logs.");
    } else {
       console.error("❌ FAILURE: Message not found in logs.");
       console.log("Logs content:", logsContent);
    }
  } else {
    console.error("❌ FAILURE: Chat input NOT found.");
  }

  await page.screenshot({ path: 'test_chat_result.png' });
  await browser.close();
})();
