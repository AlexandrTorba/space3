const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const matchId = `spec-test-${Date.now()}`;
    const url = (role) => `http://localhost:3000/play/bughouse/${matchId}?role=${role}`;

    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const w0 = await context.newPage();
    const b0 = await context.newPage();

    console.log(`Testing Bughouse Spectator: ${matchId}`);
    await Promise.all([
        w0.goto(url('w0')),
        b0.goto(url('b0'))
    ]);
    await new Promise(r => setTimeout(r, 12000));

    const boardMove = async (page, s, t) => {
        const board = page.locator('#board0-board');
        const source = board.locator(`[data-square="${s}"]`);
        const target = board.locator(`[data-square="${t}"]`);
        const sBox = await source.boundingBox();
        const tBox = await target.boundingBox();
        await page.mouse.move(sBox.x + sBox.width/2, sBox.y + sBox.height/2);
        await page.mouse.down();
        await page.mouse.move(tBox.x + tBox.width/2, tBox.y + tBox.height/2, { steps: 20 });
        await page.mouse.up();
        await new Promise(r => setTimeout(r, 3000));
    };

    console.log("Making a move on Board 0 before spectator joins...");
    await boardMove(w0, 'e2', 'e4');

    console.log("Spectator joins...");
    const spec = await context.newPage();
    await spec.goto(url('spectator'));
    await new Promise(r => setTimeout(r, 8000));

    // Verify spectator sees e4
    const specViewBoard0 = await spec.evaluate(() => {
        const e4 = document.querySelector('#board0-board [data-square="e4"] img');
        return !!e4;
    });
    console.log("Spectator sees Board 0 e4:", specViewBoard0);

    console.log("Making a move on Board 1 (Match Board 1)...");
    const w1 = await context.newPage();
    await w1.goto(url('w1'));
    await new Promise(r => setTimeout(r, 8000));
    await boardMove(w1, 'd2', 'd4'); // Own board 0 for w1 is Match Board 1

    await new Promise(r => setTimeout(r, 4000));

    // Verify spectator sees d4 on Board 1 (Match Board 1)
    const specViewBoard1 = await spec.evaluate(() => {
        const d4 = document.querySelector('#board1-board [data-square="d4"] img');
        return !!d4;
    });
    console.log("Spectator sees Board 1 d4:", specViewBoard1);

    if (specViewBoard0 && specViewBoard1) {
        console.log("✅ SUCCESS: Spectator see BOTH boards synced correctly!");
    } else {
        console.log("❌ FAILURE: Spectator sync failed.");
        await spec.screenshot({ path: 'fail_spec.png' });
    }

    await browser.close();
    process.exit(0);
})();
