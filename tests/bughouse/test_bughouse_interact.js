const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const matchId = `interact-test-${Date.now()}`;
    const url = (role) => `http://localhost:3000/play/bughouse/${matchId}?role=${role}`;

    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const pageW0 = await context.newPage();
    const pageB0 = await context.newPage();
    const pageB1 = await context.newPage();

    console.log(`Match: ${matchId}`);
    await Promise.all([
        pageW0.goto(url('w0')),
        pageB0.goto(url('b0')),
        pageB1.goto(url('b1'))
    ]);

    await new Promise(r => setTimeout(r, 10000));

    const move = async (page, s, t) => {
        const board = page.locator('#board0-board');
        const source = board.locator(`[data-square="${s}"]`);
        const target = board.locator(`[data-square="${t}"]`);
        
        await source.scrollIntoViewIfNeeded();
        const sBox = await source.boundingBox();
        const tBox = await target.boundingBox();
        
        await page.mouse.move(sBox.x + sBox.width/2, sBox.y + sBox.height/2);
        await page.mouse.down();
        // Drag slowly to target
        await page.mouse.move(tBox.x + tBox.width/2, tBox.y + tBox.height/2, { steps: 30 });
        await page.mouse.up();
        await new Promise(r => setTimeout(r, 3000));
    };

    console.log("Move 1: w0 e2e4");
    await move(pageW0, 'e2', 'e4');
    
    console.log("Move 2: b0 d7d5");
    await move(pageB0, 'd7', 'd5');
    
    console.log("Move 3: w0 captures d5 (e4d5)");
    await move(pageW0, 'e4', 'd5');

    console.log("Checking B1 banks...");
    const banks = await pageB1.evaluate(() => {
        return Array.from(document.querySelectorAll('div.h-6.md\\:h-10')).map(b => b.innerText).join(" | ");
    });
    console.log("Banks:", banks);

    if (banks.includes('P')) {
        console.log("✅ SUCCESS: UI Sync and Capture Bank Sync PASSED!");
    } else {
        console.log("❌ FAILURE: Piece not found in bank through UI test.");
        await pageB1.screenshot({ path: 'fail_interact_b1.png' });
        await pageW0.screenshot({ path: 'fail_interact_w0.png' });
    }

    await browser.close();
    process.exit(0);
})();
