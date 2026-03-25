const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const matchId = `promo-test-rigorous-${Date.now()}`;
    const url = (role) => `http://localhost:3000/play/bughouse/${matchId}?role=${role}`;

    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const w0 = await context.newPage();
    const b0 = await context.newPage();
    const b1 = await context.newPage();

    console.log(`Match: ${matchId}`);
    await Promise.all([
        w0.goto(url('w0')),
        b0.goto(url('b0')),
        b1.goto(url('b1'))
    ]);
    await new Promise(r => setTimeout(r, 12000));

    const makeMove = async (page, s, t) => {
        const board = page.locator('#board0-board');
        const sSquare = board.locator(`[data-square="${s}"]`);
        const tSquare = board.locator(`[data-square="${t}"]`);
        const sBox = await sSquare.boundingBox();
        const tBox = await tSquare.boundingBox();
        await page.mouse.move(sBox.x + sBox.width/2, sBox.y + sBox.height/2);
        await page.mouse.down();
        await page.mouse.move(tBox.x + tBox.width/2, tBox.y + tBox.height/2, { steps: 30 });
        await page.mouse.up();
        await new Promise(r => setTimeout(r, 4000));
    };

    console.log("Advancing pawn WITHOUT captures...");
    await makeMove(w0, 'a2', 'a4'); await makeMove(b0, 'h7', 'h6');
    await makeMove(w0, 'a4', 'a5'); await makeMove(b0, 'h6', 'h5');
    await makeMove(w0, 'a5', 'a6'); await makeMove(b0, 'g7', 'g6');
    // Ensure square a7 is empty? No, initial pawn is there.
    // Let's capture it.
    await makeMove(w0, 'a6', 'b7'); // This capture WILL give a pawn to b1!
    // So still can't distinguish.
    
    // I will use a different piece for capture.
    // Give b1 a piece.
    await makeMove(b0, 'h5', 'h4');
    await makeMove(w0, 'b7', 'b8'); // Promote to Queen on EMBTY square or piece?
    // Initial b8 is Knight.
    // So w0 captures Knight. b1 gets 'N'.
    
    await new Promise(r => setTimeout(r, 5000));

    console.log("Banks B1 before promo-capture:");
    const bankInitial = await b1.evaluate(() => {
        return Array.from(document.querySelectorAll('div.h-6.md\\:h-10')).map(b => b.innerText).join(" | ");
    });
    console.log(bankInitial);

    console.log("Capture the Promoted Queen (Match Board 0)...");
    // Bishop on c8 captures Queen at b8.
    await makeMove(b0, 'c8', 'b8');
    
    await new Promise(r => setTimeout(r, 6000));

    const bankFinal = await b1.evaluate(() => {
        return Array.from(document.querySelectorAll('div.h-6.md\\:h-10')).map(b => b.innerText).join(" | ");
    });
    console.log("Banks B1 after promo-capture:", bankFinal);

    if (bankFinal.includes('P')) {
        console.log("✅ SUCCESS: Promoted piece reverted to Pawn!");
    } else if (bankFinal.includes('Q')) {
        console.log("⚠️ CURRENT BEHAVIOR: Promoted piece stayed as Queen.");
    } else {
        console.log("❌ FAILURE: Capture not found in bank.");
    }

    await browser.close();
    process.exit(0);
})();
