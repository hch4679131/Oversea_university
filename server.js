/**
 * Express server - Serves HTML frontend and provides scraping API endpoints
 * 
 * Run: node server.js
 * Then visit: http://localhost:3000
 */

// Load .env if present (required for SMS/DB secrets)
require('dotenv').config();

const express = require('express');
const path = require('path');
const { scrapeWebsiteToExcel, scrapeMultipleUrls } = require('./scraper');
const { sendWeChatWebhook, sendWeChatImage } = require('./wechat');
const authRouter = require('./auth');  // 认证模块
const chatRouter = require('./chat');  // AI 聊天模块
const agentRouter = require('./agent'); // 代理人系统模块

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
// 兼容 x-www-form-urlencoded 以便在运维场景下通过 curl/表单提交
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.dirname(__filename)));

// 将 JSON 解析错误转为 400，并给出清晰提示（避免默认 500）
app.use((err, req, res, next) => {
    if (err && err.type === 'entity.parse.failed') {
        return res.status(400).json({
            success: false,
            error: 'Invalid JSON body',
            hint: '请使用有效 JSON 或改用 application/x-www-form-urlencoded',
            example: { phone: '13800138000', purpose: 'login' }
        });
    }
    next(err);
});

// ============================================================================
// SMS 回执存储（内存）
// ============================================================================
const smsReceipts = [];

/**
 * POST /api/sms/receipt
 * 接收阿里云短信回执回调
 * 阿里云推送的数据格式（数组）:
 * [
 *   {
 *     "sendTime": 1234567890000,
 *     "reportTime": 1234567891000,
 *     "success": true/false,
 *     "err_code": "0"/"SMS_FAIL",
 *     "phoneNumber": "18476411288",
 *     "templateCode": "SMS_499170576",
 *     "bizId": "xxx"
 *   }
 * ]
 */
app.post('/api/sms/receipt', (req, res) => {
    try {
        const receipts = req.body; // 阿里云推送的是数组
        if (Array.isArray(receipts)) {
            receipts.forEach(r => {
                smsReceipts.push({
                    ...r,
                    receivedAt: new Date().toISOString()
                });
                console.log(`[SMS回执] 电话: ${r.phoneNumber}, 成功: ${r.success}, 错误码: ${r.err_code}`);
            });
        }
        // 按阿里云文档返回格式
        res.json({ code: 0, msg: "成功" });
    } catch (err) {
        console.error('POST /api/sms/receipt error:', err);
        res.status(200).json({ code: 0, msg: "成功" }); // 即使错误也返回 200，避免阿里云重试
    }
});

/**
 * GET /api/sms/receipts
 * 查看已收到的 SMS 回执列表
 * Query: ?limit=50&phone=18476411288（可选）
 */
app.get('/api/sms/receipts', (req, res) => {
    try {
        const { limit = 50, phone } = req.query;
        let filtered = smsReceipts;
        
        if (phone) {
            filtered = filtered.filter(r => r.phoneNumber === phone);
        }
        
        const limited = filtered.slice(-parseInt(limit));
        res.json({
            success: true,
            total: smsReceipts.length,
            filtered: filtered.length,
            data: limited
        });
    } catch (err) {
        console.error('GET /api/sms/receipts error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 挂载认证路由
app.use('/api/auth', authRouter);
// 挂载代理系统路由
app.use('/api/agent', agentRouter);
// 挂载 AI 聊天路由
app.use('/api', chatRouter);

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
// ============================================================================
// ORDER MANAGEMENT APIs (CRUD)
// ============================================================================

/**
 * Helper: Generate unique order ID
 */
const generateOrderId = () => 'ORD-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);

/**
 * Helper: Validate order data
 */
const validateOrderData = (data) => {
    const { name, price, wechat } = data;
    if (!name || !price || !wechat) {
        return { valid: false, error: '缺少必需字段: name, price, wechat' };
    }
    if (typeof price !== 'number' || price <= 0) {
        return { valid: false, error: 'price 必须是正数' };
    }
    return { valid: true };
};

/**
 * CREATE - POST /api/orders
 * Create a new order
 * Body: { name: string, price: number, wechat: string }
 * Response: { success: boolean, orderId?: string, data?: object, error?: string }
 */
app.post('/api/orders', async (req, res) => {
    try {
        const { name, price, wechat } = req.body;
        
        const validation = validateOrderData({ name, price, wechat });
        if (!validation.valid) {
            return res.status(400).json({ success: false, error: validation.error });
        }

        const orderId = generateOrderId();
        const orderData = {
            orderId,
            name,
            price,
            wechat,
            status: 'pending',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        // TODO: Save to database: db.orders.insert(orderData)
        console.log('[Order Created]', orderId);

        res.status(201).json({ success: true, orderId, data: orderData });
    } catch (err) {
        console.error('POST /api/orders error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * READ - GET /api/orders/:orderId
 * Retrieve a single order by ID
 * Response: { success: boolean, data?: object, error?: string }
 */
app.get('/api/orders/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;

        // TODO: Fetch from database: const order = db.orders.findById(orderId)
        // Mock response (replace with actual DB query)
        const order = {
            orderId,
            name: 'Sample Order',
            price: 299,
            wechat: 'sample_wechat',
            status: 'pending',
            createdAt: new Date().toISOString()
        };

        if (!order) {
            return res.status(404).json({ success: false, error: '订单不存在' });
        }

        res.json({ success: true, data: order });
    } catch (err) {
        console.error('GET /api/orders/:orderId error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * LIST - GET /api/orders?status=pending&limit=10&offset=0
 * Retrieve orders with optional filtering and pagination
 * Query params: status, limit, offset
 * Response: { success: boolean, data?: array, total?: number, error?: string }
 */
app.get('/api/orders', async (req, res) => {
    try {
        const { status, limit = 10, offset = 0 } = req.query;

        // TODO: Fetch from database with filters
        // const orders = db.orders.find({ ...(status && {status}) }, {limit, offset})
        // const total = db.orders.count({ ...(status && {status}) })
        
        // Mock response (replace with actual DB query)
        const orders = [];
        const total = 0;

        res.json({ success: true, data: orders, total });
    } catch (err) {
        console.error('GET /api/orders error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * UPDATE - PUT /api/orders/:orderId
 * Update an existing order
 * Body: { name?, price?, wechat?, status?, ... }
 * Response: { success: boolean, data?: object, error?: string }
 */
app.put('/api/orders/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;
        const updates = req.body;

        // Validate if price is being updated
        if (updates.price !== undefined && (typeof updates.price !== 'number' || updates.price <= 0)) {
            return res.status(400).json({ success: false, error: 'price 必须是正数' });
        }

        // TODO: Update in database
        // const updated = db.orders.updateById(orderId, {...updates, updatedAt: new Date()})
        // if (!updated) return res.status(404).json({ success: false, error: '订单不存在' })
        
        const updated = { orderId, ...updates, updatedAt: new Date().toISOString() };
        console.log('[Order Updated]', orderId);

        res.json({ success: true, data: updated });
    } catch (err) {
        console.error('PUT /api/orders/:orderId error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * DELETE - DELETE /api/orders/:orderId
 * Delete an order
 * Response: { success: boolean, message?: string, error?: string }
 */
app.delete('/api/orders/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;

        // TODO: Delete from database
        // const deleted = db.orders.deleteById(orderId)
        // if (!deleted) return res.status(404).json({ success: false, error: '订单不存在' })

        console.log('[Order Deleted]', orderId);
        res.json({ success: true, message: `订单 ${orderId} 已删除` });
    } catch (err) {
        console.error('DELETE /api/orders/:orderId error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * API: POST /api/payment
 * Process payment for an order
 * Body: { orderId: string, amount: number, method: 'wechat'|'alipay', wechat?: string }
 * Response: { success: boolean, transactionId?: string, data?: object, error?: string }
 * 
 * TODO: Integrate with payment gateway and update order status
 */
app.post('/api/payment', async (req, res) => {
    try {
        const { orderId, amount, method, wechat } = req.body;

        if (!orderId || !amount || !method) {
            return res.status(400).json({ 
                success: false, 
                error: '缺少必需字段: orderId, amount, method' 
            });
        }

        if (!['wechat', 'alipay'].includes(method)) {
            return res.status(400).json({ 
                success: false, 
                error: '支付方式无效: wechat 或 alipay' 
            });
        }

        // TODO: Call payment gateway API and update order status
        // TODO: db.orders.updateById(orderId, { status: 'paid' })
        
        const transactionId = 'TXN-' + Date.now();
        const paymentData = {
            orderId,
            transactionId,
            amount,
            method,
            status: 'success',
            timestamp: new Date().toISOString()
        };

        console.log('[Payment Processed]', transactionId);
        res.json({ success: true, transactionId, data: paymentData });
    } catch (err) {
        console.error('/api/payment error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});
// ============================================================================
// STAFF ACCOUNT MANAGEMENT APIs (CRUD)
// ============================================================================

/**
 * Helper: Generate unique user ID
 */
const generateUserId = () => 'USR-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);

/**
 * Helper: Validate staff data
 */
const validateStaffData = (data) => {
    const { name, level, parentId } = data;
    if (!name || typeof level !== 'number' || level < 1 || level > 4) {
        return { valid: false, error: '缺少必需字段: name, level (1~4)' };
    }
    // 2级及以下必须有 parentId
    if (level <= 2 && !parentId) {
        return { valid: false, error: '2级及以下员工必须指定 parentId' };
    }
    return { valid: true };
};

/**
 * CREATE - POST /api/users
 * 注册员工账号（由上级调用）
 * Body: { name: string, level: number, parentId?: string, createdBy?: string }
 * Response: { success, userId, data, error }
 */
app.post('/api/users', async (req, res) => {
    try {
        const { name, level, parentId, createdBy } = req.body;
        const validation = validateStaffData({ name, level, parentId });
        if (!validation.valid) {
            return res.status(400).json({ success: false, error: validation.error });
        }
        const userId = generateUserId();
        const userData = {
            userId,
            name,
            level,
            parentId: parentId || null,
            createdBy: createdBy || null,
            createdAt: new Date().toISOString()
        };
        // TODO: Save to database: db.users.insert(userData)
        console.log('[User Created]', userId);
        res.status(201).json({ success: true, userId, data: userData });
    } catch (err) {
        console.error('POST /api/users error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * READ - GET /api/users/:userId
 * 查询单个员工账号
 * Response: { success, data, error }
 */
app.get('/api/users/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        // TODO: Fetch from database: const user = db.users.findById(userId)
        // Mock response
        const user = {
            userId,
            name: '员工A',
            level: 2,
            parentId: 'USR-001',
            createdBy: 'USR-001',
            createdAt: new Date().toISOString()
        };
        if (!user) {
            return res.status(404).json({ success: false, error: '员工不存在' });
        }
        res.json({ success: true, data: user });
    } catch (err) {
        console.error('GET /api/users/:userId error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * LIST - GET /api/users?parentId=USR-001&level=2
 * 查询员工列表（可按上级/等级筛选）
 * Response: { success, data, total, error }
 */
app.get('/api/users', async (req, res) => {
    try {
        const { parentId, level } = req.query;
        // TODO: Fetch from database with filters
        // const users = db.users.find({ ...(parentId && {parentId}), ...(level && {level: Number(level)}) })
        // const total = users.length
        // Mock response
        const users = [];
        const total = 0;
        res.json({ success: true, data: users, total });
    } catch (err) {
        console.error('GET /api/users error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * UPDATE - PUT /api/users/:userId
 * 更新员工信息
 * Body: { name?, level?, parentId? }
 * Response: { success, data, error }
 */
app.put('/api/users/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const updates = req.body;
        // TODO: Update in database
        // const updated = db.users.updateById(userId, {...updates, updatedAt: new Date()})
        // if (!updated) return res.status(404).json({ success: false, error: '员工不存在' })
        const updated = { userId, ...updates, updatedAt: new Date().toISOString() };
        console.log('[User Updated]', userId);
        res.json({ success: true, data: updated });
    } catch (err) {
        console.error('PUT /api/users/:userId error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * DELETE - DELETE /api/users/:userId
 * 删除员工账号
 * Response: { success, message, error }
 */
app.delete('/api/users/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        // TODO: Delete from database
        // const deleted = db.users.deleteById(userId)
        // if (!deleted) return res.status(404).json({ success: false, error: '员工不存在' })
        console.log('[User Deleted]', userId);
        res.json({ success: true, message: `员工 ${userId} 已删除` });
    } catch (err) {
        console.error('DELETE /api/users/:userId error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});
/**
 * API: POST /api/
 */
// ============================================================================
// HKU NEWS SCRAPER APIs (Scrapy Integration)
// ============================================================================

// -----------------------------
// WeChat webhook configuration
// -----------------------------
/**
 * POST /api/config/wechat
 * Body: { webhookUrl: string }
 * Saves webhook locally (in `config/wechat.json`) and sets `process.env.WECHAT_WEBHOOK` for current process.
 */
app.post('/api/config/wechat', async (req, res) => {
    try {
        const { webhookUrl } = req.body || {};
        if (!webhookUrl) return res.status(400).json({ success: false, error: 'webhookUrl is required' });

        const fs = require('fs');
        const cfgDir = path.join(__dirname, 'config');
        if (!fs.existsSync(cfgDir)) fs.mkdirSync(cfgDir, { recursive: true });

        const cfgFile = path.join(cfgDir, 'wechat.json');
        const payload = { webhookUrl, savedAt: new Date().toISOString() };
        fs.writeFileSync(cfgFile, JSON.stringify(payload, null, 2), { encoding: 'utf-8' });
        process.env.WECHAT_WEBHOOK = webhookUrl;

        res.json({ success: true, message: 'webhook 已保存到本地 (config/wechat.json) 并设置于当前进程' });
    } catch (err) {
        console.error('POST /api/config/wechat error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * GET /api/config/wechat
 * Returns masked webhook if saved.
 */
app.get('/api/config/wechat', async (req, res) => {
    try {
        const fs = require('fs');
        const cfgFile = path.join(__dirname, 'config', 'wechat.json');
        if (!fs.existsSync(cfgFile)) return res.json({ success: true, webhook: null, message: '未设置 webhook' });

        const data = JSON.parse(fs.readFileSync(cfgFile, 'utf-8'));
        const webhook = data.webhookUrl || '';

        // Mask key param if present
        let masked = webhook;
        const keyIdx = webhook.indexOf('key=');
        if (keyIdx >= 0) {
            const key = webhook.slice(keyIdx + 4);
            const visible = key.length > 6 ? key.slice(-6) : key;
            masked = webhook.slice(0, keyIdx + 4) + '***' + visible;
        }

        res.json({ success: true, webhook: masked });
    } catch (err) {
        console.error('GET /api/config/wechat error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * POST /api/config/wechat/test
 * Body: { webhookUrl?: string }
 * Send a small test message to the provided webhookUrl or saved webhook.
 */
app.post('/api/config/wechat/test', async (req, res) => {
    try {
        const { webhookUrl } = req.body || {};
        const fs = require('fs');
        const cfgFile = path.join(__dirname, 'config', 'wechat.json');
        let final = webhookUrl;
        if (!final && fs.existsSync(cfgFile)) {
            const data = JSON.parse(fs.readFileSync(cfgFile, 'utf-8'));
            final = data.webhookUrl;
        }

        if (!final && process.env.WECHAT_WEBHOOK) final = process.env.WECHAT_WEBHOOK;
        if (!final) return res.status(400).json({ success: false, error: '未提供 webhookUrl，也未在环境或本地配置中找到' });

        const payload = {
            msgtype: 'text',
            text: { content: `测试消息：来自服务器 ${new Date().toISOString()}` }
        };

        const resp = await sendWeChatWebhook(final, payload);
        res.json({ success: true, webhookResponse: resp });
    } catch (err) {
        console.error('POST /api/config/wechat/test error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

 
/**
 * DELETE - POST /api/config/wechat/delete
 * 删除本地保存的 webhook 并清除当前进程环境变量
 */
app.post('/api/config/wechat/delete', async (req, res) => {
    try {
        const fs = require('fs');
        const cfgFile = path.join(__dirname, 'config', 'wechat.json');
        if (fs.existsSync(cfgFile)) {
            fs.unlinkSync(cfgFile);
        }
        // 清除当前进程环境变量
        try { delete process.env.WECHAT_WEBHOOK; } catch (e) {}
        res.json({ success: true, message: '已删除本地 webhook 配置，并清除当前进程环境变量（需重启其他进程以生效）' });
    } catch (err) {
        console.error('POST /api/config/wechat/delete error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// -----------------------------
// News watcher removed - Scrapy pipeline now sends directly
// -----------------------------



/**
 * READ - GET /api/hku-news
 * 获取最新爬取的新闻列表
 * Response: { success, data: Array<{title, url, scraped_at}>, total, error }
 */
app.get('/api/hku-news', async (req, res) => {
    try {
        const desktopPath = path.join(process.env.USERPROFILE, 'Desktop', 'hku_news_data', 'news_index.json');
        const fs = require('fs');

        if (!fs.existsSync(desktopPath)) {
            return res.json({ success: true, data: [], total: 0, message: '暂无爬取数据' });
        }

        const indexData = JSON.parse(fs.readFileSync(desktopPath, 'utf-8'));
        const newsList = Object.entries(indexData).map(([url, item]) => ({
            title: item.title,
            url: url,
            scraped_at: item.scraped_at,
            file: item.file
        }));

        res.json({ success: true, data: newsList, total: newsList.length });
    } catch (err) {
        console.error('GET /api/hku-news error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * READ - GET /api/hku-news/:id
 * 获取指定新闻的详情（包括文本和图片）
 * Response: { success, data: {title, url, text, images, scraped_at}, error }
 */
app.get('/api/hku-news/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const articleFile = path.join(process.env.USERPROFILE, 'Desktop', 'hku_news_data', `${id}_article.json`);
        const fs = require('fs');

        if (!fs.existsSync(articleFile)) {
            return res.status(404).json({ success: false, error: '新闻不存在' });
        }

        const articleData = JSON.parse(fs.readFileSync(articleFile, 'utf-8'));
        res.json({ success: true, data: articleData });
    } catch (err) {
        console.error('GET /api/hku-news/:id error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

    /**
     * SEND - POST /api/hku-news/:id/send
     * Send a scraped article to an Enterprise WeChat robot webhook
     * Body: { webhookUrl?: string }
     * If `webhookUrl` is omitted, the server will try `process.env.WECHAT_WEBHOOK`.
     */
    app.post('/api/hku-news/:id/send', async (req, res) => {
        try {
            const { id } = req.params;
            const { webhookUrl } = req.body || {};
            const finalWebhook = webhookUrl || process.env.WECHAT_WEBHOOK;

            if (!finalWebhook) {
                return res.status(400).json({ success: false, error: 'webhookUrl is required (or set WECHAT_WEBHOOK env var)' });
            }

            const fs = require('fs');
            const articleFile = path.join(process.env.USERPROFILE, 'Desktop', 'hku_news_data', `${id}_article.json`);

            if (!fs.existsSync(articleFile)) {
                return res.status(404).json({ success: false, error: '新闻不存在' });
            }

            const articleData = JSON.parse(fs.readFileSync(articleFile, 'utf-8'));

            // Build a concise markdown message for WeChat Work robot
            const plainText = (articleData.text || '').replace(/\s+/g, ' ').trim();
            const short = plainText.length > 2000 ? plainText.slice(0, 2000) + '...' : plainText;
            const scrapedAt = articleData.scraped_at || new Date().toISOString();

            const md = `**${articleData.title || '（无标题）'}**\n\n${short}\n\n[阅读原文](${articleData.url || ''})\n\n_抓取时间: ${scrapedAt}_`;

            const payload = {
                msgtype: 'markdown',
                markdown: {
                    content: md
                }
            };

            const resp = await sendWeChatWebhook(finalWebhook, payload);
            
            // 发送所有图片
            const imageResults = [];
            if (Array.isArray(articleData.images) && articleData.images.length > 0) {
                const imagesDir = path.join(process.env.USERPROFILE, 'Desktop', 'hku_news_data', 'images');
                for (const imgRelPath of articleData.images) {
                    const imgPath = path.join(imagesDir, imgRelPath);
                    if (fs.existsSync(imgPath)) {
                        try {
                            const imgResp = await sendWeChatImage(finalWebhook, imgPath);
                            imageResults.push({ image: imgRelPath, success: true, response: imgResp });
                        } catch (ie) {
                            imageResults.push({ image: imgRelPath, success: false, error: ie.message });
                        }
                    }
                }
            }

            res.json({ success: true, message: '消息已发送', webhookResponse: resp, images: imageResults });
        } catch (err) {
            console.error('POST /api/hku-news/:id/send error:', err);
            res.status(500).json({ success: false, error: err.message });
        }
    });

/**
 * TRIGGER - POST /api/hku-scrape
 * 手动触发爬虫运行（异步）
 * Response: { success, message, error }
 */
app.post('/api/hku-scrape', async (req, res) => {
    try {
        const { spawn } = require('child_process');

        // 异步运行爬虫（非阻塞）
        const scraper = spawn('python', ['hku_scraper_runner.py'], {
            cwd: path.dirname(__filename),
            detached: true,
            stdio: 'ignore'
        });

        scraper.unref();  // 让子进程独立运行

        console.log('[HKU Scraper Triggered] 爬虫任务已启动');
        res.json({ success: true, message: '爬虫任务已启动，预计 30 秒完成首次检测' });
    } catch (err) {
        console.error('POST /api/hku-scrape error:', err);
        res.status(500).json({ success: false, error: err.message });
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
    res.sendFile(path.join(__dirname, 'ai_studio_code (41).html'));
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
╔════════════════════════════════════════════════════════════════════╗
║  汇生活留学 Web Server Started                                      ║
║  http://localhost:${PORT}                                          ║
║                                                                    ║
║  Scraping APIs:                                                    ║
║    POST   /api/scrape          (Excel export)                      ║
║    POST   /api/scrape-json     (JSON return)                       ║
║    POST   /api/scrape-batch    (Multi-URL)                         ║
║                                                                    ║
║  Order Management (CRUD):                                          ║
║    POST   /api/orders          (Create)                            ║
║    GET    /api/orders          (List)                              ║
║    GET    /api/orders/:id      (Read)                              ║
║    PUT    /api/orders/:id      (Update)                            ║
║    DELETE /api/orders/:id      (Delete)                            ║
║                                                                    ║
║  Payment:                                                          ║
║    POST   /api/payment         (Process)                           ║
║                                                                    ║
║  Staff Management (CRUD):                                          ║
║    POST   /api/users           (Register)                          ║
║    GET    /api/users           (List)                              ║
║    GET    /api/users/:id       (Read)                              ║
║    PUT    /api/users/:id       (Update)                            ║
║    DELETE /api/users/:id       (Delete)                            ║
║                                                                    ║
║  HKU Arts Scraper (Scrapy):                                        ║
║    GET    /api/hku-news        (List news)                         ║
║    GET    /api/hku-news/:id    (Article detail)                    ║
║    POST   /api/hku-scrape      (Trigger)                           ║
║                                                                    ║
║  Utilities:                                                        ║
║    GET    /api/health         (Health)                             ║
╚════════════════════════════════════════════════════════════════════╝

注意：微信消息发送已集成到 Scrapy pipeline，不再使用文件监测
    `);
});

module.exports = app;
