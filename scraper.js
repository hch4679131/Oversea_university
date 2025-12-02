/**
 * Scraper module - Exports web scraping functions for use in server and CLI
 * Handles fetching webpage content and exporting to Excel
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');
const path = require('path');
const ExcelJS = require('exceljs');

/**
 * Fetch webpage content via HTTP/HTTPS
 * @param {string} urlString - URL to fetch
 * @returns {Promise<string>} HTML content
 */
function fetchWebPage(urlString) {
    return new Promise((resolve, reject) => {
        try {
            const url = new URL(urlString);
            const protocol = url.protocol === 'https:' ? https : http;

            protocol.get(urlString, (res) => {
                let data = '';

                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    resolve(data);
                });
            }).on('error', (err) => {
                reject(err);
            });
        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Scrape website and save to Excel
 * @param {string} urlString - URL to scrape
 * @param {string} filename - Output filename (without .xlsx)
 * @returns {Promise<string>} Path to saved file
 */
async function scrapeWebsiteToExcel(urlString, filename = 'scraped_content') {
    try {
        const html = await fetchWebPage(urlString);
        
        // Create Excel workbook
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Web Content');
        
        // Add metadata
        worksheet.addRow(['URL:', urlString]);
        worksheet.addRow(['Scraped at:', new Date().toISOString()]);
        worksheet.addRow([]);
        
        // Add HTML content
        worksheet.addRow(['HTML Content']);
        worksheet.addRow([html]);
        
        // Auto-fit columns
        worksheet.columns[0].width = 50;
        worksheet.columns[1].width = 100;
        
        // Save to Desktop
        const desktopPath = path.join(process.env.USERPROFILE, 'Desktop', `${filename}.xlsx`);
        await workbook.xlsx.writeFile(desktopPath);
        
        return desktopPath;
    } catch (error) {
        throw new Error(`Scraping failed: ${error.message}`);
    }
}

/**
 * Scrape multiple URLs and return as JSON
 * @param {string[]} urls - Array of URLs to scrape
 * @returns {Promise<Array>} Array of {url, content, timestamp}
 */
async function scrapeMultipleUrls(urls) {
    const results = [];
    
    for (const url of urls) {
        try {
            const content = await fetchWebPage(url);
            results.push({
                url,
                content,
                timestamp: new Date().toISOString(),
                success: true
            });
        } catch (error) {
            results.push({
                url,
                error: error.message,
                timestamp: new Date().toISOString(),
                success: false
            });
        }
    }
    
    return results;
}

module.exports = {
    fetchWebPage,
    scrapeWebsiteToExcel,
    scrapeMultipleUrls
};
