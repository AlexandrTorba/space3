const { chromium } = require('playwright');

/**
 * Sets up a 4-player Bughouse match and readies everyone.
 * @param {string} matchId The ID of the match to create/join.
 * @param {object} options Configuration options.
 */
async function setupBughouseMatch(matchId, options = {}) {
    const headless = options.headless !== undefined ? options.headless : true;
    const browser = await chromium.launch({ headless });
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    
    const pages = await Promise.all([
        context.newPage(), context.newPage(), context.newPage(), context.newPage()
    ]);
    const roles = ['w0', 'b0', 'w1', 'b1'];
    const url = (role) => `http://localhost:3000/play/bughouse/${matchId}?role=${role}`;

    console.log(`[HELPER] Navigating 4 players to match ${matchId}...`);
    await Promise.all(pages.map((p, i) => p.goto(url(roles[i]))));
    
    // Log browser console for debugging
    pages.forEach((p, i) => {
        p.on('console', msg => {
            const text = msg.text();
            if (text.includes('[BUGHOUSE]')) {
                console.log(`[P${i} ${roles[i]}] ${text}`);
            }
        });
    });

    // Wait for hydration (Next.js takes a few seconds)
    await new Promise(r => setTimeout(r, 8000));

    console.log("[HELPER] Readying up all players...");
    for (const p of pages) {
        const readyBtn = p.locator('#ready-button');
        await readyBtn.waitFor({ state: 'visible', timeout: 10000 });
        await readyBtn.click();
    }

    // Wait for lobby to clear
    await pages[0].locator('#ready-button').waitFor({ state: 'hidden', timeout: 10000 });
    console.log("[HELPER] Lobby cleared, match started.");

    return { browser, context, pages, roles };
}

/**
 * Performs a move on a specific board from a player's perspective.
 * @param {object} page The Playwright page object.
 * @param {number} boardIdx Global board index (0 or 1).
 * @param {string} source Square (e.g., "e2").
 * @param {string} target Square (e.g., "e4").
 */
async function performBoardMove(page, boardIdx, source, target) {
    const board = page.locator(`#board${boardIdx}-board`);
    const sSquare = board.locator(`[data-square="${source}"]`);
    const tSquare = board.locator(`[data-square="${target}"]`);
    
    await sSquare.waitFor({ state: 'visible' });
    const sBox = await sSquare.boundingBox();
    const tBox = await tSquare.boundingBox();
    
    if (!sBox || !tBox) throw new Error(`Could not find squares ${source} or ${target}`);

    await page.mouse.move(sBox.x + sBox.width/2, sBox.y + sBox.height/2);
    await page.mouse.down();
    await page.mouse.move(tBox.x + tBox.width/2, tBox.y + tBox.height/2, { steps: 10 });
    await page.mouse.up();
    
    // Wait for debounce and sync
    await new Promise(r => setTimeout(r, 4000));
}

async function addBotToSlot(page, role) {
    console.log(`[HELPER] Adding bot to slot ${role}...`);
    const slotBtn = page.locator(`button:has-text("${role.toUpperCase()}")`).first();
    const addBotBtn = slotBtn.locator('button:has-text("+ BOT")');
    await addBotBtn.click({ force: true });
}

module.exports = {
    setupBughouseMatch,
    performBoardMove,
    addBotToSlot
};
