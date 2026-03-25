const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const context = await browser.newContext({
        viewport: { width: 375, height: 667 }, // iPhone size
        hasTouch: true,
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1'
    });
    const page = await context.newPage();

    console.log("Checking board touch settings...");

    try {
        await page.goto('http://localhost:3000/play/test-id-123?color=white&w=A&b=B&tc=3');
        await page.waitForTimeout(2000); // Wait for board to render

        // 1. Check CSS properties
        const touchAction = await page.evaluate(() => {
            const boardContainer = document.querySelector('.aspect-square.relative'); // Container of Chessboard
            return window.getComputedStyle(boardContainer).touchAction;
        });

        const overscroll = await page.evaluate(() => {
            return window.getComputedStyle(document.body).overscrollBehavior || 
                   window.getComputedStyle(document.querySelector('.min-h-screen')).overscrollBehavior;
        });

        console.log(`- touch-action on board: ${touchAction}`);
        console.log(`- overscroll-behavior: ${overscroll}`);

        if (touchAction === 'none') {
            console.log("✅ OK: touch-action is 'none'. Scrolling should be blocked on the board.");
        } else {
            console.log("❌ FAIL: touch-action is NOT 'none'. Browser may scroll when dragging.");
        }

        // 2. Simulate vertical drag to see if page scrolls
        await page.evaluate(() => window.scrollTo(0, 0));
        
        const boardBox = await page.evaluate(() => {
            const b = document.querySelector('.aspect-square.relative').getBoundingClientRect();
            return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
        });

        console.log("Simulating vertical drag on board...");
        await page.touchscreen.tap(boardBox.x, boardBox.y);
        await page.touchscreen.touchStart(boardBox.x, boardBox.y);
        await page.touchscreen.touchMove(boardBox.x, boardBox.y - 100); // Drag up
        await page.touchscreen.touchMove(boardBox.x, boardBox.y + 100); // Drag down

        const scrollY = await page.evaluate(() => window.scrollY);
        if (scrollY === 0) {
            console.log("✅ OK: Scroll stayed at 0 during drag.");
        } else {
            console.log(`❌ FAIL: Scroll moved to ${scrollY} during drag!`);
        }

    } catch (e) {
        console.error("Test error:", e.message);
    }

    await browser.close();
    process.exit(0);
})();
