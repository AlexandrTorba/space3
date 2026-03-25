const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    console.log("Navigating to Analysis page...");
    await page.goto('http://localhost:3000/analysis');
    await new Promise(r => setTimeout(r, 6000));

    const checkLang = async (langCode, expectedTabLabel) => {
        console.log(`Switching to: ${langCode}...`);
        await page.evaluate((l) => {
            localStorage.setItem("ag_lang", l);
            window.dispatchEvent(new CustomEvent("ag_lang_update", { detail: l }));
        }, langCode);
        
        await new Promise(r => setTimeout(r, 2000));
        
        // Check Versions tab label
        const actualLabel = await page.evaluate(() => {
            // Find the first button in the sidebar tabs
            const btn = document.querySelector('button.flex-1.py-1\\.5.text-\\[10px\\]');
            return btn ? btn.innerText.trim() : "NOT FOUND";
        });
        
        console.log(`Expected: ${expectedTabLabel}, Got: ${actualLabel}`);
        return actualLabel.toUpperCase() === expectedTabLabel.toUpperCase();
    };

    const results = [];
    results.push({ lang: 'UK', success: await checkLang('uk', 'ВЕРСІЇ') });
    results.push({ lang: 'EN', success: await checkLang('en', 'VERSIONS') });
    results.push({ lang: 'ES', success: await checkLang('es', 'VERSIONES') });
    results.push({ lang: 'TR', success: await checkLang('tr', 'VERSIYONLAR') });

    console.log("\n--- Localization Results ---");
    results.forEach(r => {
        console.log(`${r.lang}: ${r.success ? "✅ OK" : "❌ FAIL"}`);
    });

    const allOk = results.every(r => r.success);
    if (allOk) {
        console.log("\n✅ ALL LOCALIZATIONS VERIFIED!");
    } else {
        console.log("\n❌ SOME LOCALIZATIONS FAILED.");
        await page.screenshot({ path: 'fail_localization.png', fullPage: true });
    }

    await browser.close();
    process.exit(allOk ? 0 : 1);
})();
