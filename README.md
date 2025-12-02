# 汇生活留学 - Full-Stack Web Application

Study abroad services website with integrated web scraper.

## Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Start the server
```bash
npm start
```
Server runs on `http://localhost:3000`

### 3. Open in browser
Visit `http://localhost:3000` and use buttons to scrape websites. Results save to Desktop as Excel files.

## Project Structure

```
├── server.js              # Express backend (serves HTML + API)
├── scraper.js             # Core scraping functions
├── catch.js               # CLI wrapper (backward compatible)
├── ai_studio_code.html    # Frontend (Tailwind CSS)
├── package.json           # Dependencies
└── .github/
    └── copilot-instructions.md  # AI agent guidelines
```

## Available Commands

```bash
# Start web server
npm start

# Run CLI scraper (legacy)
npm run scrape
# or
node catch.js

# Scrape custom URL via Node
node -e "const {scrapeWebsiteToExcel} = require('./scraper'); scrapeWebsiteToExcel('https://example.com', 'output_name')"
```

## API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/health` | Health check |
| `POST` | `/api/scrape` | Scrape & export to Excel |
| `POST` | `/api/scrape-json` | Scrape & return JSON |
| `POST` | `/api/scrape-batch` | Multi-URL scraping |

### Example: Scrape via API

```javascript
// In browser console or code
await scrapeToExcel('https://www.hku.hk', 'hku_data');
```

## Frontend Buttons with Scraping

Add `data-scrape` attribute to buttons:

```html
<button data-scrape 
        data-scrape-url="https://example.com"
        data-scrape-filename="my_content">
    Scrape Website
</button>
```

JavaScript automatically:
1. Detects the attribute on page load
2. Sends request to `/api/scrape`
3. Shows toast notifications (loading/success/error)
4. Saves Excel file to Desktop

## Debugging

- **Server errors**: Check terminal output when running `npm start`
- **Toast messages**: Show in bottom-right corner with status
- **Network requests**: View in browser DevTools > Network tab
- **API response**: Check console logs or network inspector

## Requirements

- Node.js 14+
- npm or yarn
