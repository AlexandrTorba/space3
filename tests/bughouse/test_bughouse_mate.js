const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const matchId = `mate-test-${Date.now()}`;
    const url = (role) => `http://localhost:3000/play/bughouse/${matchId}?role=${role}`;

    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const w0 = await context.newPage();
    const b0 = await context.newPage();
    const b1 = await context.newPage();

    console.log(`Testing Bughouse Mate: ${matchId}`);
    await Promise.all([
        w0.goto(url('w0')),
        b0.goto(url('b0')),
        b1.goto(url('b1'))
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
        await page.mouse.move(tBox.x + tBox.width/2, tBox.y + tBox.height/2, { steps: 30 });
        await page.mouse.up();
        await new Promise(r => setTimeout(r, 4000));
    };

    console.log("Scholar's Mate on Board 0...");
    await boardMove(w0, 'e2', 'e4');
    await boardMove(b0, 'e7', 'e5');
    await boardMove(w0, 'd1', 'f3'); // Queen to f3
    await boardMove(b0, 'b8', 'c6');
    await boardMove(w0, 'f1', 'c4'); // Bishop to c4
    await boardMove(b0, 'd7', 'd6');
    await boardMove(w0, 'f3', 'f7'); // Mate

    await new Promise(r => setTimeout(r, 5000));

    console.log("Checking Game Over status...");
    const checkGameOver = async (page) => {
        return await page.evaluate(() => {
            return document.body.innerText.toUpperCase().includes('GAME OVER');
        });
    }

    const w0GameOver = await checkGameOver(w0);
    const b1GameOver = await checkGameOver(b1);

    console.log("W0 Game Over:", w0GameOver);
    console.log("B1 Game Over:", b1GameOver);

    if (w0GameOver && b1GameOver) {
        console.log("✅ SUCCESS: Bughouse Checkmate synced across match!");
    } else {
        console.log("❌ FAILURE: Game didn't terminate correctly.");
        await w0.screenshot({ path: 'fail_mate_w0.png' });
        await b1.screenshot({ path: 'fail_mate_b1.png' });
    }

    await browser.close();
    process.exit(0);
})();
