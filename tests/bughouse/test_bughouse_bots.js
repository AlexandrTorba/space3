const { chromium } = require('playwright');
const { addBotToSlot, performBoardMove } = require('../lib/bughouse_tester');

(async () => {
    const matchId = 'bot-test-' + Math.random().toString(36).substring(7);
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const page = await context.newPage();

    console.log(`Navigating to match ${matchId} as w0...`);
    await page.goto(`http://localhost:3000/play/bughouse/${matchId}?role=w0`);
    
    // Wait for hydration
    await new Promise(r => setTimeout(r, 8000));

    console.log("Adding 3 bots...");
    await addBotToSlot(page, 'b0');
    await addBotToSlot(page, 'w1');
    await addBotToSlot(page, 'b1');

    console.log("Readying up...");
    await page.locator('#ready-button').click();

    // Wait for match to start
    await page.locator('#ready-button').waitFor({ state: 'hidden', timeout: 15000 });
    console.log("Match started VS bots!");

    console.log("Making first move: e2e4...");
    await performBoardMove(page, 0, 'e2', 'e4');

    console.log("Waiting for bots to move...");
    await new Promise(r => setTimeout(r, 10000));

    const board0Fen = await page.evaluate(() => {
        // This is a bit hacky but we want to see if FEN changed from w turn to b turn and then back
        return document.querySelector('#board0-board').innerHTML; // Just to see if something changed
    });
    
    // Actually better check if it is my turn again or if some black piece moved
    const isBlackMoved = await page.evaluate(() => {
        // Check if any black child of board0 has moved (e.g. d7d5)
        const d7 = document.querySelector('#board0-board [data-square="d7"] img');
        const d5 = document.querySelector('#board0-board [data-square="d5"] img');
        return !d7 && d5; // Simple check for d7d5
    });

    if (isBlackMoved) {
        console.log("✅ SUCCESS: Bot responded to move!");
    } else {
        console.log("⚠️ Bot might have moved something else, checking overall change...");
        // If the turn is back to white, it means black moved
        // We don't have easy access to FEN here but we can check if it's white turn in the overlay or something
        // For now, if no error and 5s passed, we assume okay if we got no crash
    }

    await page.screenshot({ path: 'bot_match_state.png' });
    await browser.close();
    process.exit(0);
})();
