/**
 * Express server - Serves HTML frontend and provides scraping API endpoints
 * 
 * Run: node server.js
 * Then visit: http://localhost:3000
 */

const express = require('express');
const path = require('path');
const { scrapeWebsiteToExcel, scrapeMultipleUrls } = require('./scraper');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.dirname(__filename)));

/**
 * API: POST /api/scrape
 * Scrape a single URL and export to Excel
 * Body: { url: string, filename?: string }
 * Response: { success: boolean, message: string, path?: string, error?: string }
 */
app.post('/api/scrape', async (req, res) => {
    try {
        const { url, filename } = req.body;
        
        if (!url) {
            return res.status(400).json({
                success: false,
                error: 'URL is required'
            });
        }
        
        const filePath = await scrapeWebsiteToExcel(url, filename || 'scraped_content');
        
        res.json({
            success: true,
            message: 'Website scraped successfully',
            path: filePath
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * API: POST /api/scrape-batch
 * Scrape multiple URLs and return JSON
 * Body: { urls: string[] }
 * Response: { success: boolean, results: Array<{url, content, success}>, errors?: Array }
 */
app.post('/api/scrape-batch', async (req, res) => {
    try {
        const { urls } = req.body;
        
        if (!Array.isArray(urls) || urls.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'URLs array is required'
            });
        }
        
        const results = await scrapeMultipleUrls(urls);
        const errors = results.filter(r => !r.success);
        
        res.json({
            success: errors.length === 0,
            total: results.length,
            successful: results.length - errors.length,
            results,
            ...(errors.length > 0 && { errors })
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * API: POST /api/scrape-json
 * Scrape a single URL and return HTML as JSON
 * Body: { url: string }
 * Response: { success: boolean, url: string, content: string, timestamp: string }
 */
app.post('/api/scrape-json', async (req, res) => {
    try {
        const { url } = req.body;
        
        if (!url) {
            return res.status(400).json({
                success: false,
                error: 'URL is required'
            });
        }
        
        const results = await scrapeMultipleUrls([url]);
        const result = results[0];
        
        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: result.error
            });
        }
        
        res.json({
            success: true,
            url: result.url,
            content: result.content,
            timestamp: result.timestamp
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * API: GET /api/health
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString()
    });
});

// Serve HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'ai_studio_code.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════╗
║  启航留学 Web Server Started               ║
║  http://localhost:${PORT}                    ║
║                                            ║
║  API Endpoints:                            ║
║  POST   /api/scrape          (Excel export)║
║  POST   /api/scrape-json     (JSON return) ║
║  POST   /api/scrape-batch    (Multi-URL)   ║
║  GET    /api/health          (Health check)║
╚════════════════════════════════════════════╝
    `);
});

module.exports = app;
