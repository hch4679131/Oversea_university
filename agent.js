/**
 * Agent system module
 * - Phone + password login OR phone + code login
 * - Hierarchical account creation (admin -> consultant -> agent1 -> agent2 -> agent3 -> agent4)
 * - Orders table with user_id mapping
 * - Logs table
 */

const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'HKSD_2025_Secret_Key_Change_In_Production';
const IS_PROD = process.env.NODE_ENV === 'production';

// 阿里云配置（与 auth.js 保持一致；生产环境需在服务器设置环境变量）
const ALIYUN_CONFIG = {
    accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID || '',
    accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET || '',
    smsSignName: process.env.SMS_SIGN_NAME || '汇生活深圳文化科技',
    smsTemplateCode: process.env.SMS_TEMPLATE_CODE || 'SMS_499170576',
    // 身份证实名认证服务（阿里云市场 AppCode）
    idVerifyAppCode: process.env.ID_VERIFY_APP_CODE || ''
};

async function verifyIDCard(idCard, name) {
    // 基本格式验证
    const idCardRegex = /^[1-9]\d{5}(18|19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]$/;
    if (!idCardRegex.test(String(idCard || ''))) {
        return { valid: false, message: '身份证号码格式不正确' };
    }

    if (!name || !String(name).trim()) {
        return { valid: false, message: '姓名不能为空' };
    }

    // 检查是否配置了AppCode
    if (!ALIYUN_CONFIG.idVerifyAppCode) {
        console.error('[agent][身份证验证] 未配置 ID_VERIFY_APP_CODE');
        return { valid: false, message: '身份证验证服务未配置，请联系管理员' };
    }

    try {
        const axios = require('axios');
        const qs = require('querystring');

        const response = await axios.post(
            'https://kzidcardv1.market.alicloudapi.com/api-mall/api/id_card/check',
            qs.stringify({
                idcard: String(idCard).trim(),
                name: String(name).trim()
            }),
            {
                headers: {
                    'Authorization': `APPCODE ${ALIYUN_CONFIG.idVerifyAppCode}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                timeout: 10000
            }
        );

        // result=0 表示一致
        if (response.data?.code === 200 && response.data?.data?.result === 0) {
            return { valid: true, message: '身份证验证通过' };
        }

        if (response.data?.data?.result === 1) {
            return { valid: false, message: '身份证与姓名不一致' };
        }
        if (response.data?.data?.result === 2) {
            return { valid: false, message: '身份证号无记录' };
        }
        return { valid: false, message: response.data?.msg || '身份证验证失败' };
    } catch (error) {
        console.error('[agent][身份证验证失败]', error.message);
        return { valid: false, message: '身份证验证服务异常，请稍后重试' };
    }
}

// MySQL 连接池（与 auth.js 保持一致）
const pool = mysql.createPool({
    host: process.env.MYSQL_HOST || '127.0.0.1',
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || 'Hksd2025!@#',
    database: process.env.MYSQL_DATABASE || 'hksd_auth',
    port: process.env.MYSQL_SOCKET ? undefined : (process.env.MYSQL_PORT ? Number(process.env.MYSQL_PORT) : 3333),
    socketPath: process.env.MYSQL_SOCKET || undefined,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

function maskPhone(p) {
    if (!p) return '';
    return String(p).replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2');
}

function roleLevel(role) {
    // Smaller number = higher privilege
    switch (role) {
        case 'admin':
            return 0;
        case 'consultant':
            return 1;
        case 'agent1':
            return 2;
        case 'agent2':
            return 3;
        case 'agent3':
            return 4;
        case 'agent4':
            return 5;
        default:
            return 99;
    }
}

function canCreateChild(parentRole, childRole) {
    const parent = roleLevel(parentRole);
    const child = roleLevel(childRole);
    if (parent === 0 && child === 1) return true; // admin -> consultant
    if (parent === 1 && child === 2) return true; // consultant -> agent1
    if (parent === 2 && child === 3) return true; // agent1 -> agent2
    if (parent === 3 && child === 4) return true; // agent2 -> agent3
    if (parent === 4 && child === 5) return true; // agent3 -> agent4
    return false;
}

function generateVerificationCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendSMS(phone, code) {
    try {
        // 只要服务器配置了短信 4 项环境变量，就尝试真实发送；否则仅打印验证码（便于开发调试）
        const hasEnvTemplate = !!(process.env.SMS_TEMPLATE_CODE && String(process.env.SMS_TEMPLATE_CODE).trim());
        const hasEnvSign = !!(process.env.SMS_SIGN_NAME && String(process.env.SMS_SIGN_NAME).trim());
        const hasEnvKeyId = !!(process.env.ALIYUN_ACCESS_KEY_ID && String(process.env.ALIYUN_ACCESS_KEY_ID).trim());
        const hasEnvKeySecret = !!(process.env.ALIYUN_ACCESS_KEY_SECRET && String(process.env.ALIYUN_ACCESS_KEY_SECRET).trim());
        const isPlaceholder = !hasEnvTemplate || ALIYUN_CONFIG.smsTemplateCode === 'SMS_123456789';

        if (!hasEnvTemplate || !hasEnvSign || !hasEnvKeyId || !hasEnvKeySecret || isPlaceholder) {
            console.log(`[agent][短信未配置] 跳过真实短信发送 → 手机号: ${maskPhone(phone)} 验证码: ${code}`);
            return true;
        }

        const Client = require('@alicloud/dysmsapi20170525').default;
        const Config = require('@alicloud/openapi-client').Config;

        const config = new Config({
            accessKeyId: ALIYUN_CONFIG.accessKeyId,
            accessKeySecret: ALIYUN_CONFIG.accessKeySecret,
            endpoint: 'dysmsapi.aliyuncs.com'
        });

        const client = new Client(config);
        const SendSmsRequest = require('@alicloud/dysmsapi20170525').SendSmsRequest;
        const request = new SendSmsRequest({
            phoneNumbers: phone,
            signName: ALIYUN_CONFIG.smsSignName,
            templateCode: ALIYUN_CONFIG.smsTemplateCode,
            templateParam: JSON.stringify({ code })
        });

        const response = await client.sendSms(request);
        console.log(`[agent][短信] 发送到 ${phone}，结果代码: ${response.body?.code || 'unknown'}，消息: ${response.body?.message || 'no message'}`);
        return response?.body?.code === 'OK';
    } catch (error) {
        console.error('[agent][短信发送失败]', error.message, error.code || '');
        return false;
    }
}

async function ensureSchemaOnce() {
    // cache promise to avoid concurrent CREATE TABLE
    if (ensureSchemaOnce._promise) return ensureSchemaOnce._promise;
    ensureSchemaOnce._promise = (async () => {
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS agent_users (
                id BIGINT PRIMARY KEY AUTO_INCREMENT,
                phone VARCHAR(20) NOT NULL UNIQUE,
                password_hash VARCHAR(255) NOT NULL,
                role VARCHAR(20) NOT NULL,
                parent_id BIGINT NULL,
                status VARCHAR(20) NOT NULL DEFAULT 'active',
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_parent (parent_id),
                INDEX idx_role (role)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        await pool.execute(`
            CREATE TABLE IF NOT EXISTS agent_orders (
                id BIGINT PRIMARY KEY AUTO_INCREMENT,
                user_id BIGINT NOT NULL,
                order_no VARCHAR(64) NOT NULL UNIQUE,
                title VARCHAR(255) NOT NULL,
                amount DECIMAL(12,2) NOT NULL DEFAULT 0,
                status VARCHAR(20) NOT NULL DEFAULT 'pending',
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_user (user_id),
                INDEX idx_status (status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        await pool.execute(`
            CREATE TABLE IF NOT EXISTS agent_logs (
                id BIGINT PRIMARY KEY AUTO_INCREMENT,
                user_id BIGINT NULL,
                action VARCHAR(64) NOT NULL,
                detail TEXT NULL,
                ip VARCHAR(64) NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_user (user_id),
                INDEX idx_action (action)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        await pool.execute(`
            CREATE TABLE IF NOT EXISTS agent_config (
                k VARCHAR(100) PRIMARY KEY,
                v TEXT NULL,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // Reuse verification_codes table for SMS code login/reset.
        // Note: legacy schema may use ENUM('register','reset_password','login') for purpose.
        // For agent_* purposes we must widen it to VARCHAR.
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS verification_codes (
                id BIGINT PRIMARY KEY AUTO_INCREMENT,
                phone VARCHAR(20) NOT NULL,
                code VARCHAR(10) NOT NULL,
                purpose VARCHAR(40) NOT NULL,
                used BOOLEAN NOT NULL DEFAULT FALSE,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMP NOT NULL,
                INDEX idx_phone (phone),
                INDEX idx_purpose (purpose),
                INDEX idx_expires (expires_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        try {
            await pool.execute('ALTER TABLE verification_codes MODIFY COLUMN purpose VARCHAR(40) NOT NULL');
        } catch (e) {
            // Ignore if already compatible or lacking privileges.
        }
    })();

    return ensureSchemaOnce._promise;
}

async function logAction({ userId, action, detail, ip }) {
    try {
        await pool.execute(
            'INSERT INTO agent_logs (user_id, action, detail, ip) VALUES (?, ?, ?, ?)',
            [userId || null, action, detail ? String(detail) : null, ip || null]
        );
    } catch (e) {
        // keep silent; logging must not break core flows
    }
}

function authenticateAgent(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ success: false, message: '未提供认证令牌' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ success: false, message: '令牌无效或已过期' });
        }
        req.agent = user;
        next();
    });
}

router.use(async (req, res, next) => {
    try {
        await ensureSchemaOnce();
    } catch (e) {
        console.error('[agent] ensure schema failed:', e.message);
        return res.status(500).json({ success: false, message: '数据库初始化失败' });
    }
    next();
});

// Debug incoming
router.use((req, res, next) => {
    try {
        console.log('[agent] incoming', req.method, req.url, req.headers['content-type']);
    } catch (e) {}
    next();
});

/**
 * POST /api/agent/send-code
 * Body: { phone: string, purpose: 'login'|'reset_password'|'register' }
 */
router.post(
    '/send-code',
    [
        body('phone')
            .customSanitizer(v => {
                const s = String(v || '').replace(/\s+/g, '');
                return s.replace(/^\+?86/, '');
            })
            .isMobilePhone('zh-CN').withMessage('请输入正确的手机号'),
        body('purpose')
            .customSanitizer(v => String(v || '').trim().toLowerCase())
            .isIn(['login', 'reset_password', 'register']).withMessage('用途参数错误')
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const { phone, purpose } = req.body;
        try {
            const [recent] = await pool.execute(
                'SELECT id FROM verification_codes WHERE phone = ? AND created_at > DATE_SUB(NOW(), INTERVAL 1 MINUTE) ORDER BY created_at DESC LIMIT 1',
                [phone]
            );
            if (recent.length > 0) {
                return res.status(429).json({ success: false, message: '验证码发送过于频繁，请稍后再试' });
            }

            // login must have existing account
            if (purpose === 'login') {
                const [u] = await pool.execute('SELECT id FROM agent_users WHERE phone = ? AND status = "active" LIMIT 1', [phone]);
                if (u.length === 0) {
                    return res.status(404).json({ success: false, message: '该手机号未注册代理账号' });
                }
            }

            // register must NOT have existing account
            if (purpose === 'register') {
                const [u] = await pool.execute('SELECT id FROM agent_users WHERE phone = ? LIMIT 1', [phone]);
                if (u.length > 0) {
                    return res.status(400).json({ success: false, message: '该手机号已存在账号' });
                }
            }

            const code = generateVerificationCode();
            await pool.execute(
                'INSERT INTO verification_codes (phone, code, purpose, expires_at) VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 5 MINUTE))',
                [phone, code, `agent_${purpose}`]
            );

            const smsSent = await sendSMS(phone, code);
            if (!smsSent) {
                await logAction({ action: 'send_code_failed', detail: JSON.stringify({ phone: maskPhone(phone), purpose }), ip: req.ip });
                return res.status(500).json({ success: false, message: '短信发送失败，请稍后重试' });
            }

            await logAction({ action: 'send_code_ok', detail: JSON.stringify({ phone: maskPhone(phone), purpose }), ip: req.ip });
            return res.json({ success: true, message: '验证码已发送', expiresIn: 300 });
        } catch (e) {
            console.error('[agent] send-code error:', e);
            return res.status(500).json({ success: false, message: '服务器错误', ...(IS_PROD ? {} : { error: e.message }) });
        }
    }
);

/**
 * POST /api/agent/login/password
 * Body: { phone, password }
 */
router.post(
    '/login/password',
    [
        body('phone')
            .customSanitizer(v => {
                const s = String(v || '').replace(/\s+/g, '');
                return s.replace(/^\+?86/, '');
            })
            .isMobilePhone('zh-CN'),
        body('password').notEmpty().withMessage('请输入密码')
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const { phone, password } = req.body;
        try {
            const [rows] = await pool.execute('SELECT * FROM agent_users WHERE phone = ? AND status = "active" LIMIT 1', [phone]);
            if (rows.length === 0) {
                await logAction({ action: 'login_password_not_found', detail: JSON.stringify({ phone: maskPhone(phone) }), ip: req.ip });
                return res.status(401).json({ success: false, message: '账号或密码错误' });
            }

            const user = rows[0];
            const ok = await bcrypt.compare(password, user.password_hash);
            if (!ok) {
                await logAction({ userId: user.id, action: 'login_password_wrong', detail: null, ip: req.ip });
                return res.status(401).json({ success: false, message: '账号或密码错误' });
            }

            const token = jwt.sign(
                { id: user.id, phone: user.phone, role: user.role, parentId: user.parent_id || null },
                JWT_SECRET,
                { expiresIn: '7d' }
            );

            await logAction({ userId: user.id, action: 'login_password_ok', detail: null, ip: req.ip });
            return res.json({
                success: true,
                message: '登录成功',
                token,
                user: { id: user.id, phone: user.phone, role: user.role, parentId: user.parent_id || null }
            });
        } catch (e) {
            console.error('[agent] login/password error:', e);
            return res.status(500).json({ success: false, message: '服务器错误', ...(IS_PROD ? {} : { error: e.message }) });
        }
    }
);

/**
 * POST /api/agent/login/code
 * Body: { phone, code }
 */
router.post(
    '/login/code',
    [
        body('phone')
            .customSanitizer(v => {
                const s = String(v || '').replace(/\s+/g, '');
                return s.replace(/^\+?86/, '');
            })
            .isMobilePhone('zh-CN'),
        body('code').isLength({ min: 6, max: 6 }).isNumeric()
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const { phone, code } = req.body;
        try {
            const [codeRows] = await pool.execute(
                'SELECT * FROM verification_codes WHERE phone = ? AND code = ? AND purpose = ? AND expires_at > NOW() AND used = FALSE ORDER BY created_at DESC LIMIT 1',
                [phone, code, 'agent_login']
            );
            if (codeRows.length === 0) {
                await logAction({ action: 'login_code_invalid', detail: JSON.stringify({ phone: maskPhone(phone) }), ip: req.ip });
                return res.status(401).json({ success: false, message: '验证码无效或已过期' });
            }

            const [rows] = await pool.execute('SELECT * FROM agent_users WHERE phone = ? AND status = "active" LIMIT 1', [phone]);
            if (rows.length === 0) {
                await logAction({ action: 'login_code_user_not_found', detail: JSON.stringify({ phone: maskPhone(phone) }), ip: req.ip });
                return res.status(404).json({ success: false, message: '该手机号未注册代理账号' });
            }

            await pool.execute('UPDATE verification_codes SET used = TRUE WHERE id = ?', [codeRows[0].id]);

            const user = rows[0];
            const token = jwt.sign(
                { id: user.id, phone: user.phone, role: user.role, parentId: user.parent_id || null },
                JWT_SECRET,
                { expiresIn: '7d' }
            );

            await logAction({ userId: user.id, action: 'login_code_ok', detail: null, ip: req.ip });
            return res.json({
                success: true,
                message: '登录成功',
                token,
                user: { id: user.id, phone: user.phone, role: user.role, parentId: user.parent_id || null }
            });
        } catch (e) {
            console.error('[agent] login/code error:', e);
            return res.status(500).json({ success: false, message: '服务器错误', ...(IS_PROD ? {} : { error: e.message }) });
        }
    }
);

/**
 * POST /api/agent/reset-password
 * Body: { phone, code, newPassword }
 */
router.post(
    '/reset-password',
    [
        body('phone')
            .customSanitizer(v => {
                const s = String(v || '').replace(/\s+/g, '');
                return s.replace(/^\+?86/, '');
            })
            .isMobilePhone('zh-CN'),
        body('code').isLength({ min: 6, max: 6 }).isNumeric(),
        body('newPassword').isLength({ min: 6 }).withMessage('新密码至少 6 位')
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const { phone, code, newPassword } = req.body;
        try {
            const [codeRows] = await pool.execute(
                'SELECT * FROM verification_codes WHERE phone = ? AND code = ? AND purpose = ? AND expires_at > NOW() AND used = FALSE ORDER BY created_at DESC LIMIT 1',
                [phone, code, 'agent_reset_password']
            );
            if (codeRows.length === 0) {
                return res.status(400).json({ success: false, message: '验证码无效或已过期' });
            }

            const [users] = await pool.execute('SELECT id FROM agent_users WHERE phone = ? AND status = "active" LIMIT 1', [phone]);
            if (users.length === 0) {
                return res.status(404).json({ success: false, message: '该手机号未注册代理账号' });
            }

            const passwordHash = await bcrypt.hash(newPassword, 10);
            await pool.execute('UPDATE agent_users SET password_hash = ? WHERE id = ?', [passwordHash, users[0].id]);
            await pool.execute('UPDATE verification_codes SET used = TRUE WHERE id = ?', [codeRows[0].id]);

            await logAction({ userId: users[0].id, action: 'reset_password_ok', detail: null, ip: req.ip });
            return res.json({ success: true, message: '密码重置成功' });
        } catch (e) {
            console.error('[agent] reset-password error:', e);
            return res.status(500).json({ success: false, message: '服务器错误', ...(IS_PROD ? {} : { error: e.message }) });
        }
    }
);

/**
 * GET /api/agent/me
 */
router.get('/me', authenticateAgent, async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT id, phone, role, parent_id AS parentId, status, created_at AS createdAt FROM agent_users WHERE id = ? LIMIT 1', [req.agent.id]);
        if (rows.length === 0) return res.status(404).json({ success: false, message: '用户不存在' });
        res.json({ success: true, user: rows[0] });
    } catch (e) {
        res.status(500).json({ success: false, message: '服务器错误', ...(IS_PROD ? {} : { error: e.message }) });
    }
});

/**
 * POST /api/agent/register
 * 仅登录后可创建下级账号
 * Body: { phone, password, role, code, idCard, idCardName }
 */
router.post(
    '/register',
    authenticateAgent,
    [
        body('phone')
            .customSanitizer(v => {
                const s = String(v || '').replace(/\s+/g, '');
                return s.replace(/^\+?86/, '');
            })
            .isMobilePhone('zh-CN'),
        body('password').isLength({ min: 6 }).withMessage('密码至少 6 位'),
        body('code').customSanitizer(v => String(v || '').trim()).isLength({ min: 6, max: 6 }).isNumeric().withMessage('验证码格式错误'),
        body('role').customSanitizer(v => String(v || '').trim()).isIn(['consultant', 'agent1', 'agent2', 'agent3', 'agent4'])
        ,
        body('idCard').customSanitizer(v => String(v || '').trim()).isLength({ min: 18, max: 18 }).withMessage('身份证号码格式错误'),
        body('idCardName').customSanitizer(v => String(v || '').trim()).notEmpty().withMessage('姓名不能为空')
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

    const { phone, password, role, code, idCard, idCardName } = req.body;
        try {
            const [meRows] = await pool.execute('SELECT id, role, status FROM agent_users WHERE id = ? LIMIT 1', [req.agent.id]);
            if (meRows.length === 0 || meRows[0].status !== 'active') {
                return res.status(403).json({ success: false, message: '当前账号不可用' });
            }

            const myRole = meRows[0].role;
            if (!canCreateChild(myRole, role)) {
                return res.status(403).json({ success: false, message: '无权限创建该级别账号' });
            }

            const [exists] = await pool.execute('SELECT id FROM agent_users WHERE phone = ? LIMIT 1', [phone]);
            if (exists.length > 0) {
                return res.status(409).json({ success: false, message: '该手机号已存在账号' });
            }

            // 验证短信验证码（发送用途: register -> purpose: agent_register）
            const [codeRows] = await pool.execute(
                'SELECT id FROM verification_codes WHERE phone = ? AND code = ? AND purpose = ? AND expires_at > NOW() AND used = FALSE ORDER BY created_at DESC LIMIT 1',
                [phone, code, 'agent_register']
            );
            if (codeRows.length === 0) {
                return res.status(400).json({ success: false, message: '验证码错误或已过期' });
            }

            // 身份证二要素验证
            const idResult = await verifyIDCard(idCard, idCardName);
            if (!idResult.valid) {
                return res.status(400).json({ success: false, message: idResult.message || '身份证验证失败' });
            }

            const passwordHash = await bcrypt.hash(password, 10);
            const [result] = await pool.execute(
                'INSERT INTO agent_users (phone, password_hash, role, parent_id) VALUES (?, ?, ?, ?)',
                [phone, passwordHash, role, req.agent.id]
            );

            await pool.execute('UPDATE verification_codes SET used = TRUE WHERE id = ?', [codeRows[0].id]);

            await logAction({ userId: req.agent.id, action: 'create_subaccount', detail: JSON.stringify({ childRole: role, childPhone: maskPhone(phone) }), ip: req.ip });
            return res.json({ success: true, message: '创建成功', userId: result.insertId });
        } catch (e) {
            console.error('[agent] register error:', e);
            return res.status(500).json({ success: false, message: '服务器错误', ...(IS_PROD ? {} : { error: e.message }) });
        }
    }
);

/**
 * GET /api/agent/users
 * 查看我直接下级
 */
router.get('/users', authenticateAgent, async (req, res) => {
    try {
        const [rows] = await pool.execute(
            'SELECT id, phone, role, parent_id AS parentId, status, created_at AS createdAt FROM agent_users WHERE parent_id = ? ORDER BY created_at DESC LIMIT 200',
            [req.agent.id]
        );
        res.json({ success: true, data: rows });
    } catch (e) {
        res.status(500).json({ success: false, message: '服务器错误', ...(IS_PROD ? {} : { error: e.message }) });
    }
});

/**
 * POST /api/agent/orders
 * Body: { title, amount }
 */
router.post(
    '/orders',
    authenticateAgent,
    [body('title').notEmpty().withMessage('请输入订单标题'), body('amount').isFloat({ min: 0 }).withMessage('金额必须为数字')],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const { title, amount } = req.body;
        try {
            const orderNo = `AORD-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
            const [result] = await pool.execute(
                'INSERT INTO agent_orders (user_id, order_no, title, amount) VALUES (?, ?, ?, ?)',
                [req.agent.id, orderNo, String(title), Number(amount)]
            );
            await logAction({ userId: req.agent.id, action: 'create_order', detail: JSON.stringify({ orderNo, title, amount }), ip: req.ip });
            res.json({ success: true, message: '创建订单成功', orderId: result.insertId, orderNo });
        } catch (e) {
            console.error('[agent] create order error:', e);
            res.status(500).json({ success: false, message: '服务器错误', ...(IS_PROD ? {} : { error: e.message }) });
        }
    }
);

/**
 * GET /api/agent/orders
 */
router.get('/orders', authenticateAgent, async (req, res) => {
    try {
        const [rows] = await pool.execute(
            'SELECT id, order_no AS orderNo, title, amount, status, created_at AS createdAt FROM agent_orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 200',
            [req.agent.id]
        );
        res.json({ success: true, data: rows });
    } catch (e) {
        res.status(500).json({ success: false, message: '服务器错误', ...(IS_PROD ? {} : { error: e.message }) });
    }
});

/**
 * GET /api/agent/logs
 */
router.get('/logs', authenticateAgent, async (req, res) => {
    try {
        const [rows] = await pool.execute(
            'SELECT id, action, detail, ip, created_at AS createdAt FROM agent_logs WHERE user_id = ? OR user_id IS NULL ORDER BY created_at DESC LIMIT 200',
            [req.agent.id]
        );
        res.json({ success: true, data: rows });
    } catch (e) {
        res.status(500).json({ success: false, message: '服务器错误', ...(IS_PROD ? {} : { error: e.message }) });
    }
});

module.exports = router;
