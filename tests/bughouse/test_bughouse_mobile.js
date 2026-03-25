const { chromium, devices } = require('playwright');

(async () => {
    const iphone13 = devices['iPhone 13'];
    const browser = await chromium.launch({ headless: true });
    // Use iPhone emulation for ONE of the players
    const matchId = `mobile-test-${Date.now()}`;
    const url = (role) => `http://localhost:3000/play/bughouse/${matchId}?role=${role}`;

    const contextMobile = await browser.newContext({ ...iphone13 });
    const contextDesktop = await browser.newContext();

    console.log(`Mobile Test: ${matchId}`);
    const mobilePage = await contextMobile.newPage();
    const desktopPage = await contextDesktop.newPage();

    await Promise.all([
        mobilePage.goto(url('w0')),
        desktopPage.goto(url('b1'))
    ]);
    await new Promise(r => setTimeout(r, 12000));

    console.log("Checking mobile layout (one board above the other)...");
    const mobileLayout = await mobilePage.evaluate(() => {
        const boards = document.querySelectorAll('.aspect-square');
        if (boards.length < 2) return "Less than 2 boards";
        const b0 = boards[0].getBoundingClientRect();
        const b1 = boards[1].getBoundingClientRect();
        // Since it's grid-cols-1 on mobile, b0.top should be less than b1.top
        return b0.top < b1.top ? "Stacked Vertically" : "Horizontal? " + b0.left + " vs " + b1.left;
    });
    console.log("Mobile Layout:", mobileLayout);

    console.log("Testing click-to-drop on mobile (selection mode)...");
    // 1. Desktop captures a white piece to give it to White 0 (the mobile user)
    // Team 1: w0 (mobile), b1 (desktop). 
    // Wait! Team 1 is (w0, b1).
    // So if b1 captures a Black piece, w0 gets it.
    // b1 is Black on Board 1. w0 is White on Board 0.
    // So b1 (Black 1) captures White piece -> w0 (White 0) gets it? 
    // Team 1: (w0, b1). White 0 and Black 1.
    // Partner of White 0 is Black 1.
    // If Black 1 captures a White piece on Board 1, White 0 gets it. Correct.
    
    // Setup Board 1 for capture by b1
    const w1 = await contextDesktop.newPage();
    await w1.goto(url('w1'));
    await new Promise(r => setTimeout(r, 8000));
    
    console.log("W1 moves e2e4 on Board 1...");
    const moveOnBoard = async (page, s, t) => {
        const board = page.locator('#board0-board'); // Own board
        const sBox = await board.locator(`[data-square="${s}"]`).boundingBox();
        const tBox = await board.locator(`[data-square="${t}"]`).boundingBox();
        await page.mouse.move(sBox.x + sBox.width/2, sBox.y + sBox.height/2);
        await page.mouse.down();
        await page.mouse.move(tBox.x + tBox.width/2, tBox.y + tBox.height/2, { steps: 50 });
        await page.mouse.up();
        await new Promise(r => setTimeout(r, 4000));
    };
    
    await moveOnBoard(w1, 'e2', 'e4');
    
    const b1 = desktopPage; // This was b1
    console.log("B1 captures Pawn on Board 1 (Match Board 1)...");
    await moveOnBoard(b1, 'd7', 'd5');
    await moveOnBoard(w1, 'd2', 'd4');
    await moveOnBoard(b1, 'd5', 'e4'); // Capture pawn

    await new Promise(r => setTimeout(r, 5000));

    console.log("Mobile (w0) checking bank for P...");
    const bankMobile = await mobilePage.evaluate(() => {
        return Array.from(document.querySelectorAll('button.text-\\[10px\\]')).map(b => b.innerText).join(" | ");
    });
    console.log("Mobile Bank:", bankMobile);

    if (!bankMobile.includes('P')) {
        console.log("❌ FAILURE: Pawn didn't arrive at Mobile bank.");
        await mobilePage.screenshot({ path: 'fail_mobile_bank.png' });
        await browser.close();
        return;
    }

    console.log("Simulating click-to-drop sequence on mobile...");
    // Click 'P'
    await mobilePage.evaluate(() => {
        const pButton = Array.from(document.querySelectorAll('button.text-\\[10px\\]')).find(b => b.innerText === 'P');
        if (pButton) pButton.click();
    });
    await new Promise(r => setTimeout(r, 1000));
    
    // Click d4 on Mobile (Match Board 0)
    await mobilePage.locator('#board0-board [data-square="d4"]').click();
    await new Promise(r => setTimeout(r, 5000));

    // Verify drop on desktop view (b1 seeing partner's board)
    const desktopViewOfPartner = await desktopPage.evaluate(() => {
        const d4 = document.querySelector('#board1-board [data-square="d4"] img');
        return !!d4;
    });

    if (desktopViewOfPartner) {
        console.log("✅ SUCCESS: Mobile click-to-drop verified!");
    } else {
        console.log("❌ FAILURE: Mobile drop didn't sync.");
        await mobilePage.screenshot({ path: 'fail_mobile_drop.png' });
        await desktopPage.screenshot({ path: 'fail_mobile_desktop_view.png' });
    }

    await browser.close();
    process.exit(0);
})();
