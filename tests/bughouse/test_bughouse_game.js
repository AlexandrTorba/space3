const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: true });
    
    // 4 Players to fulfill the lobby requirement
    const contexts = await Promise.all([browser.newContext(), browser.newContext(), browser.newContext(), browser.newContext()]);
    const pages = await Promise.all(contexts.map(c => c.newPage()));
    const matchId = 'test-game-' + Math.random().toString(36).substring(7);
    const roles = ['w0', 'b0', 'w1', 'b1'];

    console.log(`Setting up 4 Bughouse players for match ${matchId}...`);
    await Promise.all(pages.map((p, i) => 
        p.goto(`http://localhost:3000/play/bughouse/${matchId}?role=${roles[i]}`)
    ));

    pages.forEach((p, i) => {
        p.on('console', msg => console.log(`[P${i} ${roles[i]}] ${msg.text()}`));
    });

    await new Promise(r => setTimeout(r, 6000)); // Initial hydration

    console.log("Readying up all players...");
    for (const p of pages) {
        try {
            const readyBtn = p.locator('#ready-button');
            await readyBtn.waitFor({ state: 'visible', timeout: 10000 });
            await readyBtn.click();
            console.log(`- Player readied`);
        } catch (e) {
            console.error(`- READY button not found for player. Error: ${e.message}`);
            await p.screenshot({ path: 'ready_failure.png' });
            throw e;
        }
    }

    const pageW0 = pages[0];
    console.log("Waiting for lobby to clear...");
    await pageW0.locator('#ready-button').waitFor({ state: 'hidden', timeout: 10000 });
    console.log("Lobby cleared!");

    const pageB1 = pages[3];

    console.log("Taking initial screenshot for W0...");
    await pageW0.screenshot({ path: 'w0_initial.png' });

    console.log("White 0 moving e2 to e4...");
    try {
        const board0 = pageW0.locator('#board0-board');
        const e2 = board0.locator('[data-square="e2"]');
        const e4 = board0.locator('[data-square="e4"]');
        
        await e2.waitFor({ state: 'visible' });
        
        // Use granular mouse events for more reliable dragging with react-chessboard
        const e2Box = await e2.boundingBox();
        const e4Box = await e4.boundingBox();
        
        if (e2Box && e4Box) {
            await pageW0.mouse.move(e2Box.x + e2Box.width/2, e2Box.y + e2Box.height/2);
            await pageW0.mouse.down();
            await pageW0.mouse.move(e4Box.x + e4Box.width/2, e4Box.y + e4Box.height/2, { steps: 10 });
            await pageW0.mouse.up();
            
            console.log("Move animation triggered via mouse");
        } else {
            console.error("Could not find square bounding boxes");
        }
        
        await new Promise(r => setTimeout(r, 4000));
        await pageW0.screenshot({ path: 'w0_post_move.png' });
    } catch(e) {
        console.error("Move failed:", e.message);
    }

    // Verify b1 view
    try {
        await pageB1.screenshot({ path: 'b1_view.png' });
        const b1State = await pageB1.evaluate(() => {
            const e2 = document.querySelector('#board0-board [data-square="e2"] img');
            const e4 = document.querySelector('#board0-board [data-square="e4"] img');
            
            // Try to find the react state if possible, but at least return the DOM state
            return { 
                e2: !!e2, 
                e4: !!e4,
                html: document.body.innerHTML.substring(0, 500)
            };
        });
        console.log("b1 view of Board 0 after e2e4:", b1State);

        if (!b1State.e2 && b1State.e4) {
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
