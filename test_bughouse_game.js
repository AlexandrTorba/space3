const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: true });
    
    // Player 1: White on Board 0 (w0)
    const contextW0 = await browser.newContext();
    const pageW0 = await contextW0.newPage();
    
    // Player 2: Black on Board 1 (b1) - Partner of w0
    const contextB1 = await browser.newContext();
    const pageB1 = await contextB1.newPage();

    pageW0.on('console', msg => console.log('W0 CONSOLE:', msg.text()));
    pageB1.on('console', msg => console.log('B1 CONSOLE:', msg.text()));

    console.log("Setting up Bughouse pages...");
    await Promise.all([
        pageW0.goto('http://localhost:3000/play/bughouse/test-game-debug?role=w0'),
        pageB1.goto('http://localhost:3000/play/bughouse/test-game-debug?role=b1')
    ]);

    await new Promise(r => setTimeout(r, 10000)); // Wait for hydration and WS

    const board0 = pageW0.locator('#board0-board');
    const e2 = board0.locator('[data-square="e2"]');
    const e4 = board0.locator('[data-square="e4"]');

    console.log("Taking initial screenshot for W0...");
    await pageW0.screenshot({ path: 'w0_initial.png' });

    console.log("White 0 moving e2 to e4...");
    try {
        const board0 = pageW0.locator('#board0-board');
        const e2 = board0.locator('[data-square="e2"]');
        const e4 = board0.locator('[data-square="e4"]');
        
        await e2.waitFor({ state: 'visible' });
        await e2.dragTo(e4);
        
        console.log("Move animation triggered");
        await new Promise(r => setTimeout(r, 4000));
        
        await pageW0.screenshot({ path: 'w0_post_move.png' });
    } catch(e) {
        console.error("Move failed:", e.message);
    }

    // Verify b1 view
    try {
        await pageB1.screenshot({ path: 'b1_view.png' });
        const b1Board0State = await pageB1.evaluate(() => {
            const e2 = document.querySelector('#board0-board [data-square="e2"] img');
            const e4 = document.querySelector('#board0-board [data-square="e4"] img');
            return { e2: !!e2, e4: !!e4 };
        });
        console.log("b1 view of Board 0 after e2e4:", b1Board0State);

        if (!b1Board0State.e2 && b1Board0State.e4) {
            console.log("✅ SUCCESS: Sync working between boards.");
        } else {
            console.error("❌ FAILURE: Sync failed. See screenshots.");
        }
    } catch(e) {
        console.error("Verification failed:", e.message);
    }

    await browser.close();
    process.exit(0);
})();
