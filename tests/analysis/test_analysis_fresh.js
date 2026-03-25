const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    console.log("Navigating... ");
    await page.goto('http://localhost:3000/analysis');
    await new Promise(r => setTimeout(r, 6000));

    const board = page.locator('#AnalysisBoard-board');
    
    const drag = async (s, t) => {
        const sSq = board.locator(`[data-square="${s}"]`);
        const tSq = board.locator(`[data-square="${t}"]`);
        const sB = await sSq.boundingBox();
        const tB = await tSq.boundingBox();
        await page.mouse.move(sB.x + sB.width/2, sB.y + sB.height/2);
        await page.mouse.down();
        await page.mouse.move(tB.x + tB.width/2, tB.y + tB.height/2, { steps: 20 });
        await page.mouse.up();
        await new Promise(r => setTimeout(r, 3000));
    };

    console.log("Making moves...");
    await drag('e2', 'e4');
    await drag('e7', 'e5');

    // Check history count (should be 2)
    const historyCountBefore = await page.evaluate(() => document.querySelectorAll('.grid-cols-7').length);
    console.log("History rows before:", historyCountBefore);

    // Click "Start analysis from here" button (Timer icon)
    console.log("Clicking 'Start fresh from here'...");
    // Button with title "Новий аналіз звідси"
    const timerButton = page.locator('button[title="Новий аналіз звідси"], button[title="Start from this move"]');
    await timerButton.click();
    await new Promise(r => setTimeout(r, 2000));

    // Check if history cleared
    const historyCountAfter = await page.evaluate(() => document.querySelectorAll('.grid-cols-7').length);
    const hasPawnAtE4 = await page.evaluate(() => !!document.querySelector('#AnalysisBoard-board [data-square="e4"] img'));
    const hasPawnAtE5 = await page.evaluate(() => !!document.querySelector('#AnalysisBoard-board [data-square="e5"] img'));
    
    console.log("History rows after:", historyCountAfter);
    console.log("Pawn at e4 remains:", hasPawnAtE4);
    console.log("Pawn at e5 remains:", hasPawnAtE5);

    if (historyCountAfter === 0 && hasPawnAtE4 && hasPawnAtE5) {
        console.log("✅ SUCCESS: Fresh analysis from current state started!");
    } else {
        console.log("❌ FAILURE: Start fresh failed.");
        await page.screenshot({ path: 'fail_analysis_fresh.png' });
    }

    await browser.close();
    process.exit(0);
})();
