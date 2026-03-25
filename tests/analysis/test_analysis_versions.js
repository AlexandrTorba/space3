const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    console.log("Navigating to Analysis page...");
    await page.goto('http://localhost:3000/analysis');
    await new Promise(r => setTimeout(r, 6000));

    // 1. Check if Versions tab exists and is active
    const versionsTab = page.locator('button:has-text("Versions"), button:has-text("Версії")');
    console.log("Versions tab visible:", await versionsTab.isVisible());

    // 2. Create a new version
    const plusButton = page.locator('button[title="Створити гілку"], button[title="New Branch"]');
    await plusButton.click();
    await new Promise(r => setTimeout(r, 1000));

    const versionsCount = await page.evaluate(() => document.querySelectorAll('.group.flex.items-center.justify-between').length);
    console.log("Number of versions:", versionsCount);

    // 3. Make a move in Version 2
    const drag = async (s, t) => {
        const board = page.locator('#AnalysisBoard-board');
        const sSq = board.locator(`[data-square="${s}"]`);
        const tSq = board.locator(`[data-square="${t}"]`);
        const sB = await sSq.boundingBox();
        const tB = await tSq.boundingBox();
        await page.mouse.move(sB.x + sB.width/2, sB.y + sB.height/2);
        await page.mouse.down();
        await page.mouse.move(tB.x + tB.width/2, tB.y + tB.height/2, { steps: 10 });
        await page.mouse.up();
        await new Promise(r => setTimeout(r, 1000));
    };

    console.log("Making move e2e4 in Version 2...");
    await drag('e2', 'e4');

    const historyCountV2 = await page.evaluate(() => document.querySelectorAll('.grid-cols-7').length);
    console.log("History in V2:", historyCountV2);

    // 4. Switch back to Version 1
    console.log("Switching to Version 1...");
    const v1Button = page.locator('button div:has-text("Analysis 1")');
    await v1Button.click();
    await new Promise(r => setTimeout(r, 1000));

    const historyCountV1 = await page.evaluate(() => document.querySelectorAll('.grid-cols-7').length);
    console.log("History in V1 (should be 0):", historyCountV1);

    if (versionsCount === 2 && historyCountV2 === 1 && historyCountV1 === 0) {
        console.log("✅ SUCCESS: Multi-version analysis verified!");
    } else {
        console.log("❌ FAILURE: Versions not matching.");
        await page.screenshot({ path: 'fail_versions.png' });
    }

    await browser.close();
    process.exit(0);
})();
