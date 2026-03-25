const { setupBughouseMatch, performBoardMove } = require('../lib/bughouse_tester');

(async () => {
    const matchId = 'game-test-' + Math.random().toString(36).substring(7);
    const { browser, pages, roles } = await setupBughouseMatch(matchId);
    
    const pageW0 = pages[0];
    const pageB1 = pages[3];

    console.log("White 0 moving e2 to e4 on Board 0...");
    await performBoardMove(pageW0, 0, 'e2', 'e4');

    // Verify b1 view of Board 0
    try {
        console.log("Verifying B1 view of Board 0 after e2e4...");
        const b1State = await pageB1.evaluate(() => {
            const e2 = document.querySelector('#board0-board [data-square="e2"] img');
            const e4 = document.querySelector('#board0-board [data-square="e4"] img');
            return { e2: !!e2, e4: !!e4 };
        });
        console.log("b1 view of Board 0:", b1State);

        if (!b1State.e2 && b1State.e4) {
            console.log("✅ SUCCESS: Sync working between boards.");
        } else {
            console.error("❌ FAILURE: Sync failed.");
            await pageB1.screenshot({ path: 'fail_sync.png' });
        }
    } catch(e) {
        console.error("Verification failed:", e.message);
    }

    await browser.close();
    process.exit(0);
})();
