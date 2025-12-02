/**
 * Backward-compatible CLI wrapper for scraper.js
 * For direct CLI usage: node catch.js
 * For module usage: const { scrapeWebsiteToExcel } = require('./scraper');
 */

const { scrapeWebsiteToExcel } = require('./scraper');

/**
 * CLI entry point - scrapes HKU website and exports to Excel
 */
async function main() {
    try {
        console.log('Starting web scraper...');
        const filePath = await scrapeWebsiteToExcel('https://arts.hku.hk/news/---hkuarts-collaborates-with-hkmoa-and-conservation-office-of-the-lcsd-to-launch-douglas-so-post-doctoral-fellowship-in-art-conservation-attracting-global-talent-for-scientific-analysis-of-chinese-paintings-research-fellowship-project', 'hku');//https://www.hku.hk/c_index.html
        console.log('✓ Excel file saved to:', filePath);
    } catch (error) {
        console.error('✗ Error:', error.message);
        process.exit(1);
    }
}

// Only run if executed directly (not imported)
if (require.main === module) {
    main();
}