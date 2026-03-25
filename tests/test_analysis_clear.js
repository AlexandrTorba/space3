const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    console.log("Navigating to Analysis page...");
    await page.goto('http://localhost:3000/analysis');
    await new Promise(r => setTimeout(r, 5000));

    // Make a move: e2e4
    const board = page.locator('#AnalysisBoard-board');
    const e2 = board.locator('[data-square="e2"]');
    const e4 = board.locator('[data-square="e4"]');
    
    console.log("Making move e2e4...");
    const e2Box = await e2.boundingBox();
    const e4Box = await e4.boundingBox();
    await page.mouse.move(e2Box.x + e2Box.width/2, e2Box.y + e2Box.height/2);
    await page.mouse.down();
    await page.mouse.move(e4Box.x + e4Box.width/2, e4Box.y + e4Box.height/2, { steps: 20 });
    await page.mouse.up();
    
    await new Promise(r => setTimeout(r, 2000));

    // Check if e4 has a piece
    const hasPawnAtE4 = await page.evaluate(() => !!document.querySelector('#AnalysisBoard-board [data-square="e4"] img'));
    console.log("Pawn at e4:", hasPawnAtE4);

    // Click "Clear Board" button (the red one)
    console.log("Clicking 'Clear Board'...");
    // Button text is from t("clear_board") which is "Очистити дошку" in UK
    const clearButton = page.locator('button:has-text("Очистити дошку"), button:has-text("Clear Board")');
    await clearButton.click();
    
    await new Promise(r => setTimeout(r, 2000));

    // Check if board reset
    const hasPawnAtE4After = await page.evaluate(() => !!document.querySelector('#AnalysisBoard-board [data-square="e4"] img'));
    const hasPawnAtE2After = await page.evaluate(() => !!document.querySelector('#AnalysisBoard-board [data-square="e2"] img'));
    
    console.log("Pawn at e4 after clear:", hasPawnAtE4After);
    console.log("Pawn at e2 after clear:", hasPawnAtE2After);

    if (!hasPawnAtE4After && hasPawnAtE2After) {
        console.log("✅ SUCCESS: Board cleared successfully!");
    } else {
        console.log("❌ FAILURE: Board didn't reset correctly.");
        await page.screenshot({ path: 'fail_analysis_clear.png' });
    }

    await browser.close();
    process.exit(0);
})();
