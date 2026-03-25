const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const contextSettings = { viewport: { width: 1920, height: 1080 } };
    const context = await browser.newContext(contextSettings);
    
    const matchId = `bank-test-${Date.now()}`;
    const url = (role) => `http://localhost:3000/play/bughouse/${matchId}?role=${role}`;

    console.log(`Setting up Bughouse pages for match ${matchId}...`);
    const pageW0 = await context.newPage();
    const pageB0 = await context.newPage();
    const pageB1 = await context.newPage();

    pageW0.on('console', msg => console.log('W0:', msg.text()));
    pageB0.on('console', msg => console.log('B0:', msg.text()));

    await Promise.all([
        pageW0.goto(url('w0')),
        pageB0.goto(url('b0')),
        pageB1.goto(url('b1'))
    ]);

    // Give plenty of time for Next.js to be fully ready
    await new Promise(r => setTimeout(r, 15000));

    const makeMove = async (page, source, target) => {
        const board = page.locator('#board0-board');
        // Drag the IMAGE inside the square to the target SQUARE
        const sPiece = board.locator(`[data-square="${source}"] img`);
        const tSquare = board.locator(`[data-square="${target}"]`);
        
        await sPiece.waitFor({ state: 'visible' });
        await sPiece.dragTo(tSquare, { force: true });
        await new Promise(r => setTimeout(r, 4000));
    };

    console.log("w0 (White) moves e2e4...");
    await makeMove(pageW0, 'e2', 'e4');
    
    console.log("b0 (Black) moves d7d5...");
    await makeMove(pageB0, 'd7', 'd5');
    
    console.log("w0 (White) captures d5: e4d5...");
    await makeMove(pageW0, 'e4', 'd5');

    await new Promise(r => setTimeout(r, 5000));

    console.log("Checking B1 bank (Partner) for P...");
    const bankB1 = await pageB1.evaluate(() => {
        const banks = Array.from(document.querySelectorAll('div.h-6.md\\:h-10'));
        return banks[3]?.innerText || ""; // Bank 1b is the last one in the grid usually
    });
    const allBanks = await pageB1.evaluate(() => {
        return Array.from(document.querySelectorAll('div.h-6.md\\:h-10')).map(b => b.innerText).join(" | ");
    });
    console.log("B1 Current Banks:", allBanks);

    if (allBanks.includes('P')) {
        console.log("✅ SUCCESS: Capture synced to partner bank!");
    } else {
        console.log("❌ FAILURE: Piece not found in bank.");
        // Try one more check: screenshot with specific focus
        await pageB1.screenshot({ path: `fail_bank_${matchId}.png` });
    }

    await browser.close();
    process.exit(0);
})();
