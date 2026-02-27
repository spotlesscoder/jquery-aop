const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

(async () => {
    // Launch headless browser
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const testDir = __dirname;
    const files = fs.readdirSync(testDir).filter(f => f.endsWith('.html'));

    console.log(`Found ${files.length} test files: ${files.join(', ')}\n`);

    let globalFailures = 0;

    for (const file of files) {
        const filePath = `file://${path.join(testDir, file)}`;
        console.log(`Running ${file}...`);

        const page = await browser.newPage();

        // Capture console messages for debugging
        page.on('console', msg => {
            // Uncomment to see browser console logs
            // console.log('PAGE LOG:', msg.text());
        });

        try {
            await page.goto(filePath, { waitUntil: 'networkidle0' });

            // Wait for QUnit results
            try {
                await page.waitForFunction(() => {
                    const result = document.getElementById('qunit-testresult');
                    return result && (result.innerText.includes('Tests completed') || result.innerText.includes('0 tests of 0'));
                }, { timeout: 5000 });
            } catch (e) {
                // Ignore timeout, check results anyway
            }

            // Extract results
            const result = await page.evaluate(() => {
                const banner = document.getElementById('qunit-banner');
                const isFail = banner && banner.className.indexOf('qunit-fail') !== -1;

                const resultDiv = document.getElementById('qunit-testresult');
                const resultText = resultDiv ? resultDiv.innerText : 'No result found';

                const failedItems = document.querySelectorAll('#qunit-tests > li.fail');

                return {
                    isFail: isFail,
                    text: resultText,
                    failedCount: failedItems.length
                };
            });

            console.log(`  ${result.text.replace(/[\n\r]+/g, ' ')}`);

            if (result.isFail || result.failedCount > 0) {
                console.error(`  FAILED: ${result.failedCount} tests failed.`);
                globalFailures += (result.failedCount || 1);
            } else {
                console.log(`  PASSED`);
            }

        } catch (err) {
            console.error(`  Error running ${file}:`, err);
            globalFailures++;
        } finally {
            await page.close();
        }
        console.log('---');
    }

    await browser.close();

    if (globalFailures > 0) {
        console.error(`\nTest suite failed with ${globalFailures} errors.`);
        process.exit(1);
    } else {
        console.log(`\nAll tests passed successfully.`);
        process.exit(0);
    }
})();
