const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const matchId = `drop-test-final-${Date.now()}`;
    const url = (role) => `http://localhost:3000/play/bughouse/${matchId}?role=${role}`;

    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    
    console.log(`Testing Bughouse Drop: ${matchId}`);
    const w0 = await context.newPage();
    const b0 = await context.newPage();
    const w1 = await context.newPage();
    const b1 = await context.newPage();
    const pages = [w0, b0, w1, b1];

    w0.on('console', msg => console.log('W0:', msg.text()));
    b1.on('console', msg => console.log('B1:', msg.text()));
    w1.on('console', msg => console.log('W1:', msg.text()));

    await Promise.all([
        w0.goto(url('w0')),
        b0.goto(url('b0')),
        w1.goto(url('w1')),
        b1.goto(url('b1'))
    ]);

    await new Promise(r => setTimeout(r, 10000));

    console.log("Readying up all players...");
    for (const p of pages) {
        const readyBtn = p.locator('#ready-button');
        await readyBtn.waitFor({ state: 'visible', timeout: 10000 });
        await readyBtn.click();
        console.log(`- Player readied`);
    }

    console.log("Waiting for lobby to clear...");
    await w0.locator('#ready-button').waitFor({ state: 'hidden', timeout: 10000 });

    const boardMove = async (page, boardIdx, s, t) => {
        console.log(`Moving ${s} -> ${t} on Board ${boardIdx}...`);
        const board = page.locator(`#board${boardIdx}-board`);
        const source = board.locator(`[data-square="${s}"]`);
        const target = board.locator(`[data-square="${t}"]`);
        
        await source.waitFor({ state: 'visible' });
        const sBox = await source.boundingBox();
        const tBox = await target.boundingBox();
        
        await page.mouse.move(sBox.x + sBox.width/2, sBox.y + sBox.height/2);
        await page.mouse.down();
        await page.mouse.move(tBox.x + tBox.width/2, tBox.y + tBox.height/2, { steps: 10 });
        await page.mouse.up();
        await new Promise(r => setTimeout(r, 4000));
    };

    console.log("1. Move Board 1 (Match Board 1) as White 1...");
    await boardMove(w1, 1, 'e2', 'e4');
    
    console.log("2. Capture Board 0 (Match Board 0) as White 0 to give bank piece to Black 1...");
    await boardMove(w0, 0, 'e2', 'e4');
    await boardMove(b0, 0, 'd7', 'd5');
    await boardMove(w0, 0, 'e4', 'd5');

    await new Promise(r => setTimeout(r, 4000));

    console.log("3. B1 (Black on Board 1) dropping Pawn...");
    const banksB1 = await b1.evaluate(() => {
        return Array.from(document.querySelectorAll('.h-6.md\\:h-10')).map(b => b.innerText.trim()).join(" | ");
    });
    console.log("B1 Banks:", banksB1);

    await b1.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button.text-\\[10px\\]'));
        const pButton = buttons.find(b => b.innerText.trim() === 'P');
        if (pButton) {
           console.log("TEST: Clicking bank piece P");
           pButton.click();
        } else {
           console.log("TEST: P not found in buttons!");
        }
    });
    await new Promise(r => setTimeout(r, 2000));

    // Click e5 on B1's board (Match Board 1)
    console.log("B1 clicking e5 on Board 1...");
    const squareE5 = b1.locator('#board1-board [data-square="e5"]');
    await squareE5.click();
    
    await new Promise(r => setTimeout(r, 5000));

    const check = await w1.evaluate(() => {
        const e5 = document.querySelector('#board1-board [data-square="e5"] img');
        return !!e5;
    });

    if (check) {
        console.log("✅ SUCCESS: Bughouse Piece Drop Synced!");
    } else {
        console.log("❌ FAILURE: Drop failed to sync.");
        await w1.screenshot({ path: 'fail_drop.png' });
    }

    await browser.close();
    process.exit(0);
})();
