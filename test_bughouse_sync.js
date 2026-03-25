const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: true });
    
    // Set fixed viewport
    const contextSettings = { viewport: { width: 1920, height: 1080 } };
    const contextW0 = await browser.newContext(contextSettings);
    const pageW0 = await contextW0.newPage();
    const contextB1 = await browser.newContext(contextSettings);
    const pageB1 = await contextB1.newPage();

    pageW0.on('console', msg => console.log('W0:', msg.text()));

    console.log("Setting up Bughouse pages...");
    await Promise.all([
        pageW0.goto('http://localhost:3000/play/bughouse/final-sync-test?role=w0'),
        pageB1.goto('http://localhost:3000/play/bughouse/final-sync-test?role=b1')
    ]);

    await new Promise(r => setTimeout(r, 8000));

    console.log("Attempting e2e4 drag on W0...");
    const board0 = pageW0.locator('#board0-board');
    const e2 = board0.locator('[data-square="e2"]');
    const e4 = board0.locator('[data-square="e4"]');

    await e2.scrollIntoViewIfNeeded();
    
    // Instead of dragTo, try sequence
    const e2Box = await e2.boundingBox();
    const e4Box = await e4.boundingBox();
    
    await pageW0.mouse.move(e2Box.x + e2Box.width/2, e2Box.y + e2Box.height/2);
    await pageW0.mouse.down();
    await pageW0.mouse.move(e4Box.x + e4Box.width/2, e4Box.y + e4Box.height/2, { steps: 50 });
    await pageW0.mouse.up();
    
    await new Promise(r => setTimeout(r, 4000));

    console.log("Checking B1 view...");
    const state = await pageB1.evaluate(() => {
        const e4 = document.querySelector('#board0-board [data-square="e4"] img');
        return { e4: !!e4 };
    });
    console.log("Result:", state);

    if (state.e4) {
        console.log("✅ SUCCESS: Bughouse move synced!");
    } else {
        console.log("❌ FAILURE: Sync failed.");
        await pageW0.screenshot({ path: 'fail_w0.png' });
        await pageB1.screenshot({ path: 'fail_b1.png' });
    }

    await browser.close();
})();
