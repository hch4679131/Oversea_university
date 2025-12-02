# AI Coding Agent Instructions

## Project Overview
**启航留学** (Study Abroad Services) - Full-stack web application integrating a Tailwind CSS landing page with a web scraping backend.

**Components:**
- **Frontend**: `ai_studio_code.html` - Chinese study abroad services website (responsive, Tailwind CSS)
- **Backend**: `server.js` (Express) - Serves HTML + exposes 3 scraping APIs
- **Scraper Module**: `scraper.js` - Reusable functions for HTTP scraping & Excel export
- **Legacy CLI**: `catch.js` - Backward-compatible wrapper (imports from scraper.js)

## Architecture & Data Flow

### Integration Points
1. **Frontend buttons** → Call API endpoints via `fetch()` with `data-scrape` attributes
2. **Toast notifications** → Show status (loading/success/error) via `showToast()`
3. **API responses** → Return JSON; frontend handles UI updates
4. **Excel exports** → Saved directly to `%USERPROFILE%/Desktop/`

### Key Files
- `server.js` - Express app (port 3000), serves HTML, routes 4 endpoints
- `scraper.js` - Core scraping logic (3 exported functions)
- `ai_studio_code.html` - Embedded JavaScript (backend health check, fetch handlers)

## API Endpoints

### `POST /api/scrape` - Export to Excel
```javascript
// Request: { url: string, filename?: string }
// Response: { success: boolean, path?: string, error?: string }
// Example: scrapeToExcel('https://www.hku.hk', 'hku_content')
```

### `POST /api/scrape-json` - Return JSON content
```javascript
// Request: { url: string }
// Response: { success: boolean, url, content, timestamp }
// Used for processing via JavaScript
```

### `POST /api/scrape-batch` - Multi-URL scraping
```javascript
// Request: { urls: string[] }
// Response: { success, total, successful, results: Array<{url, content, success}> }
```

### `GET /api/health` - Server status check
```javascript
// No request body | Response: { status: 'ok', timestamp }
```

## Frontend Integration Pattern

### Button HTML with scraping (add `data-scrape` attribute):
```html
<button data-scrape 
        data-scrape-url="https://example.com"
        data-scrape-filename="my_content"
        class="...">Scrape Website</button>
```

### Direct JavaScript calls:
```javascript
// Export to Excel (saves to Desktop)
await scrapeToExcel('https://www.hku.hk', 'university_data');

// Get JSON in memory (for processing)
const data = await scrapeToJson('https://example.com');
console.log(data.content);
```

## Development Conventions

### JavaScript/Node.js
- **Async patterns**: Always use `async/await` + `try/catch` (see `scraper.js` pattern)
- **Modules**: Export functions for reuse (not IIFE); `module.exports = {...}`
- **Paths**: Use `process.env.USERPROFILE` for cross-platform Desktop location
- **HTTP**: Use native `https`/`http` modules; no axios/node-fetch required
- **Error handling**: Throw descriptive errors; catch at API endpoint level

### Frontend JavaScript
- **Toast UI**: Call `showToast(message, type)` for user feedback (types: 'success', 'error', 'loading')
- **API calls**: Always use `POST` for scraping, `GET` for health check
- **JSON body**: Wrap URL/filename in object: `{ url, filename }`
- **Global functions**: `window.scrapeToExcel`, `window.scrapeToJson` (exposed for button onclick handlers)

### HTML/Tailwind
- Responsive breakpoints: `md:` for tablet+ (mobile-first default)
- Brand colors: Use `text-brand`, `bg-brand-accent` (defined in tailwind.config)
- Sections: Maintain IDs (`id="services"`, `id="contact"`) for anchor navigation

### File Organization
```
/                 (root)
├── server.js     (Express app, starts with: node server.js)
├── scraper.js    (Core functions, imported by server.js & catch.js)
├── catch.js      (CLI wrapper for catch.js - backward compatible)
├── ai_studio_code.html (Frontend + embedded JS)
├── package.json  (Express, ExcelJS dependencies)
└── .github/
    └── copilot-instructions.md (this file)
```

## Critical Commands
```bash
# First time setup
npm install

# Start web server (serves HTML + API endpoints)
npm start
# OR
node server.js

# Run CLI scraper (backward compatible)
node catch.js

# Run with custom URL
node -e "const {scrapeWebsiteToExcel} = require('./scraper'); scrapeWebsiteToExcel('https://...')"
```

## Common Tasks

### Add scraping functionality to a button
1. Add `data-scrape` attribute to `<a>` or `<button>`
2. Set `data-scrape-url` (target website) and `data-scrape-filename` (output name)
3. JavaScript auto-binds handlers on page load
4. Toast notifications show progress

### Support new scraping format
- Modify `scraper.js` `scrapeWebsiteToExcel()` to parse HTML differently
- Or create new function and expose via `module.exports`
- Add new endpoint in `server.js` that calls new function

### Change scraper behavior from Excel to JSON
- Use `/api/scrape-json` instead of `/api/scrape`
- Returns `data.content` as string in JavaScript
- Frontend can process/parse client-side

### Debug scraping issues
- Check `server.js` console for errors
- Frontend shows toast messages on failure
- Browser DevTools Network tab shows API responses
- Test via `curl -X POST http://localhost:3000/api/health`

## Key Patterns to Preserve
1. **Promise-based async** - All scraping functions return Promises
2. **Modular exports** - Core logic in `scraper.js`, imported by `server.js` & `catch.js`
3. **Cross-platform paths** - Always use `process.env.USERPROFILE` for Desktop
4. **Error messages** - Descriptive; passed to frontend via JSON response
5. **Tailwind CDN** - No build step; CSS extends via inline `<script>` tag
