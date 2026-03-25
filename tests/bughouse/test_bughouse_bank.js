const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const contextSettings = { viewport: { width: 1920, height: 1080 } };
    const context = await browser.newContext(contextSettings);
    
    const matchId = `bank-test-${Date.now()}`;
    const url = (role) => `http://localhost:3000/play/bughouse/${matchId}?role=${role}`;

    console.log(`Setting up 4 Bughouse players for match ${matchId}...`);
    const pages = await Promise.all([
        context.newPage(), context.newPage(), context.newPage(), context.newPage()
    ]);
    const roles = ['w0', 'b0', 'w1', 'b1'];
    
    await Promise.all(pages.map((p, i) => p.goto(url(roles[i]))));
    
    pages.forEach((p, i) => {
        p.on('console', msg => console.log(`[P${i} ${roles[i]}] ${msg.text()}`));
    });

    // Wait for hydration
    await new Promise(r => setTimeout(r, 8000));

    console.log("Readying up all players...");
    for (const p of pages) {
        const readyBtn = p.locator('#ready-button');
        await readyBtn.waitFor({ state: 'visible', timeout: 10000 });
        await readyBtn.click();
        console.log(`- Player readied`);
    }

    const pageW0 = pages[0];
    const pageB0 = pages[1];
    const pageW1 = pages[2];
    const pageB1 = pages[3];

    console.log("Waiting for lobby to clear...");
    await pageW0.locator('#ready-button').waitFor({ state: 'hidden', timeout: 10000 });
    console.log("Lobby cleared!");

    const makeMove = async (page, source, target) => {
        console.log(`Moving ${source} -> ${target} on board 0...`);
        const board = page.locator('#board0-board');
        const sPiece = board.locator(`[data-square="${source}"]`);
        const tSquare = board.locator(`[data-square="${target}"]`);
        
        await sPiece.waitFor({ state: 'visible' });
        
        const sBox = await sPiece.boundingBox();
        const tBox = await tSquare.boundingBox();
        
        if (sBox && tBox) {
            await page.mouse.move(sBox.x + sBox.width/2, sBox.y + sBox.height/2);
            await page.mouse.down();
            await page.mouse.move(tBox.x + tBox.width/2, tBox.y + tBox.height/2, { steps: 10 });
            await page.mouse.up();
        } else {
            throw new Error(`Could not find bounding boxes for ${source} or ${target}`);
        }
        await new Promise(r => setTimeout(r, 4000));
    };

    console.log("w0 (White) moves e2e4...");
    await makeMove(pageW0, 'e2', 'e4');
    
    console.log("b0 (Black) moves d7d5...");
    await makeMove(pageB0, 'd7', 'd5');
    
    console.log("w0 (White) captures d5: e4d5...");
    await makeMove(pageW0, 'e4', 'd5');

    await new Promise(r => setTimeout(r, 5000));

    console.log("Checking Partner's (B1) bank for captured piece...");
    const allBanks = await pageB1.evaluate(() => {
        return Array.from(document.querySelectorAll('.h-6.md\\:h-10')).map(b => b.innerText.trim()).join(" | ");
    });
    console.log("All Current Banks:", allBanks);

    if (allBanks.includes('P')) {
        console.log("✅ SUCCESS: Capture synced to partner bank!");
    } else {
        console.log("❌ FAILURE: Piece not found in bank.");
        await pageB1.screenshot({ path: `fail_bank_${matchId}.png` });
    }

    await browser.close();
    process.exit(0);
})();
