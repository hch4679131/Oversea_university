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

function normalizePhone(v) {
    const s = String(v || '').trim();
    // keep only digits; strip leading country code 86
    const digits = s.replace(/[^\d]/g, '');
    return digits.replace(/^86/, '');
}

function orderPrefixFromServiceName(serviceName) {
    const name = String(serviceName || '').trim().toUpperCase();
    if (!name) return null;
    const c = name[0];
    if (c === 'E' || c === 'A') return c;
    return null;
}

function twoDigit(n) {
    const s = String(n);
    return s.length >= 2 ? s.slice(-2) : `0${s}`;
}

function threeDigit(n) {
    const s = String(n);
    if (s.length >= 3) return s.slice(-3);
    return s.padStart(3, '0');
}

async function nextOrderNo({ conn, prefix }) {
    const now = new Date();
    const yy = twoDigit(now.getFullYear() % 100);
    const mm = twoDigit(now.getMonth() + 1);

    const [rows] = await conn.execute(
        'SELECT seq FROM agent_order_sequences WHERE prefix = ? AND yy = ? AND mm = ? FOR UPDATE',
        [prefix, yy, mm]
    );

    let seq = 1;
    if (rows.length === 0) {
        await conn.execute(
            'INSERT INTO agent_order_sequences (prefix, yy, mm, seq) VALUES (?, ?, ?, ?)',
            [prefix, yy, mm, seq]
        );
    } else {
        seq = Number(rows[0].seq || 0) + 1;
        await conn.execute(
            'UPDATE agent_order_sequences SET seq = ? WHERE prefix = ? AND yy = ? AND mm = ?',
            [seq, prefix, yy, mm]
        );
    }

    return `${prefix}${yy}${mm}${threeDigit(seq)}`;
}

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
            return { ok: true, skipped: true, providerCode: 'SKIPPED', providerMessage: 'SMS not configured' };
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
        const providerCode = response.body?.code || 'unknown';
        const providerMessage = response.body?.message || 'no message';
        console.log(`[agent][短信] 发送到 ${phone}，结果代码: ${providerCode}，消息: ${providerMessage}`);
        return { ok: providerCode === 'OK', providerCode, providerMessage };
    } catch (error) {
        const providerCode = error?.code || error?.name || 'exception';
        const providerMessage = error?.message || 'unknown';
        console.error('[agent][短信发送失败]', providerMessage, providerCode);
        return { ok: false, providerCode, providerMessage };
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
                id_card VARCHAR(18) NULL,
                id_card_name VARCHAR(50) NULL,
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
                user_id BIGINT NOT NULL COMMENT '绑定账号ID（归属账号）',
                created_by_user_id BIGINT NULL COMMENT '创单账号ID',
                order_no VARCHAR(16) NOT NULL UNIQUE COMMENT '订单号（8位：E/A + YY + MM + 3位序号）',
                title VARCHAR(32) NOT NULL COMMENT '服务名：EAC/AEC/EC/EA/AE/AC/E/A',
                amount DECIMAL(12,2) NOT NULL,
                status VARCHAR(20) NOT NULL DEFAULT '已创单' COMMENT '已创单/已签单/已完结',
                parent_name VARCHAR(50) NULL,
                parent_gender VARCHAR(10) NULL,
                parent_phone VARCHAR(20) NULL,
                student_name VARCHAR(50) NOT NULL,
                student_gender VARCHAR(10) NOT NULL,
                student_phone VARCHAR(20) NOT NULL,
                extra_service_weight VARCHAR(10) NULL COMMENT 'ECA/EAC/CEA/CAE/AEC/ACE',
                student_id_card VARCHAR(32) NULL,
                signed_at TIMESTAMP NULL,
                finished_at TIMESTAMP NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_user (user_id),
                INDEX idx_created_by (created_by_user_id),
                INDEX idx_status (status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        await pool.execute(`
            CREATE TABLE IF NOT EXISTS agent_order_sequences (
                prefix CHAR(1) NOT NULL,
                yy CHAR(2) NOT NULL,
                mm CHAR(2) NOT NULL,
                seq INT NOT NULL,
                PRIMARY KEY (prefix, yy, mm)
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

        // Schema migrations for older agent_orders
        const alter = async (sql) => {
            try {
                await pool.execute(sql);
            } catch (e) {
                // ignore "Duplicate column" etc.
            }
        };

        // Schema migrations for older agent_users (store verified ID-card identity)
        await alter("ALTER TABLE agent_users ADD COLUMN id_card VARCHAR(18) NULL");
        await alter("ALTER TABLE agent_users ADD COLUMN id_card_name VARCHAR(50) NULL");

        await alter('ALTER TABLE agent_orders MODIFY COLUMN order_no VARCHAR(16) NOT NULL');
        await alter("ALTER TABLE agent_orders MODIFY COLUMN title VARCHAR(32) NOT NULL");
        await alter("ALTER TABLE agent_orders MODIFY COLUMN status VARCHAR(20) NOT NULL DEFAULT '已创单'");
        await alter("ALTER TABLE agent_orders ADD COLUMN created_by_user_id BIGINT NULL COMMENT '创单账号ID'");
        await alter("ALTER TABLE agent_orders ADD COLUMN parent_name VARCHAR(50) NULL");
        await alter("ALTER TABLE agent_orders ADD COLUMN parent_gender VARCHAR(10) NULL");
        await alter("ALTER TABLE agent_orders ADD COLUMN parent_phone VARCHAR(20) NULL");
        await alter("ALTER TABLE agent_orders ADD COLUMN student_name VARCHAR(50) NULL");
        await alter("ALTER TABLE agent_orders ADD COLUMN student_gender VARCHAR(10) NULL");
        await alter("ALTER TABLE agent_orders ADD COLUMN student_phone VARCHAR(20) NULL");
        await alter("ALTER TABLE agent_orders ADD COLUMN extra_service_weight VARCHAR(10) NULL");
        await alter("ALTER TABLE agent_orders ADD COLUMN student_id_card VARCHAR(32) NULL");
        await alter("ALTER TABLE agent_orders ADD COLUMN signed_at TIMESTAMP NULL");
        await alter("ALTER TABLE agent_orders ADD COLUMN finished_at TIMESTAMP NULL");

        try {
            await pool.execute('UPDATE agent_orders SET created_by_user_id = user_id WHERE created_by_user_id IS NULL');
        } catch (e) {
            // ignore
        }

        // Ensure required student_* columns are non-null on new installs; keep old rows compatible.
        try {
            await pool.execute("ALTER TABLE agent_orders MODIFY COLUMN student_name VARCHAR(50) NOT NULL");
            await pool.execute("ALTER TABLE agent_orders MODIFY COLUMN student_gender VARCHAR(10) NOT NULL");
            await pool.execute("ALTER TABLE agent_orders MODIFY COLUMN student_phone VARCHAR(20) NOT NULL");
        } catch (e) {
            // ignore if table is old and has NULL rows; app validation prevents new NULLs.
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
                const s = String(v || '').replace(/[^\d]/g, '');
                return s.replace(/^86/, '');
            })
            .isMobilePhone('zh-CN').withMessage('请输入正确的手机号'),
        body('purpose')
            .customSanitizer(v => String(v || '').trim().toLowerCase())
            .isIn(['login', 'reset_password', 'register']).withMessage('用途参数错误')
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, message: '参数错误', errors: errors.array() });
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

            const sms = await sendSMS(phone, code);
            if (!sms.ok) {
                await logAction({
                    action: 'send_code_failed',
                    detail: JSON.stringify({ phone: maskPhone(phone), purpose, providerCode: sms.providerCode, providerMessage: sms.providerMessage }),
                    ip: req.ip
                });

                if (sms.providerCode === 'isv.BUSINESS_LIMIT_CONTROL') {
                    return res.status(429).json({
                        success: false,
                        message: '短信触发运营商/平台限流（该号码当天发送次数已达上限），请稍后再试或更换手机号',
                        code: sms.providerCode
                    });
                }

                return res.status(500).json({ success: false, message: '短信发送失败，请稍后重试', code: sms.providerCode });
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
                user: { id: user.id, phone: user.phone, role: user.role, parentId: user.parent_id || null, idCardName: user.id_card_name || null }
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
                user: { id: user.id, phone: user.phone, role: user.role, parentId: user.parent_id || null, idCardName: user.id_card_name || null }
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
        const [rows] = await pool.execute(
            'SELECT id, phone, role, parent_id AS parentId, status, created_at AS createdAt, id_card_name AS idCardName FROM agent_users WHERE id = ? LIMIT 1',
            [req.agent.id]
        );
        if (rows.length === 0) return res.status(404).json({ success: false, message: '用户不存在' });
        res.json({ success: true, user: rows[0] });
    } catch (e) {
        res.status(500).json({ success: false, message: '服务器错误', ...(IS_PROD ? {} : { error: e.message }) });
    }
});

/**
 * POST /api/agent/change-password
 * Body: { oldPassword, newPassword }
 */
router.post(
    '/change-password',
    authenticateAgent,
    [
        body('oldPassword').customSanitizer(v => String(v || '')).isLength({ min: 1 }).withMessage('旧密码不能为空'),
        body('newPassword').customSanitizer(v => String(v || '')).isLength({ min: 6 }).withMessage('新密码至少 6 位')
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, message: '参数错误', errors: errors.array() });
        }

        const oldPassword = String(req.body.oldPassword || '');
        const newPassword = String(req.body.newPassword || '');

        try {
            const [rows] = await pool.execute(
                'SELECT id, password_hash AS passwordHash, status FROM agent_users WHERE id = ? LIMIT 1',
                [req.agent.id]
            );
            if (rows.length === 0) {
                return res.status(404).json({ success: false, message: '用户不存在' });
            }
            if (String(rows[0].status) !== 'active') {
                return res.status(403).json({ success: false, message: '当前账号不可用' });
            }

            const ok = await bcrypt.compare(oldPassword, String(rows[0].passwordHash || ''));
            if (!ok) {
                return res.status(400).json({ success: false, message: '旧密码不正确' });
            }

            const passwordHash = await bcrypt.hash(newPassword, 10);
            await pool.execute('UPDATE agent_users SET password_hash = ? WHERE id = ? LIMIT 1', [passwordHash, req.agent.id]);
            await logAction({ userId: req.agent.id, action: 'change_password_ok', detail: null, ip: req.ip });
            return res.json({ success: true, message: '密码修改成功' });
        } catch (e) {
            console.error('[agent] change-password error:', e);
            return res.status(500).json({ success: false, message: '服务器错误', ...(IS_PROD ? {} : { error: e.message }) });
        }
    }
);

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
                'INSERT INTO agent_users (phone, password_hash, id_card, id_card_name, role, parent_id) VALUES (?, ?, ?, ?, ?, ?)',
                [phone, passwordHash, String(idCard).trim(), String(idCardName).trim(), role, req.agent.id]
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
 * GET /api/agent/users-all
 * 顾问/管理员：获取所有账号（用于“创单代理人”下拉选择）
 */
router.get('/users-all', authenticateAgent, async (req, res) => {
    try {
        const role = String(req.agent.role || '');
        if (role !== 'consultant') {
            return res.status(403).json({ success: false, message: '无权限查看账号列表' });
        }

        const [rows] = await pool.execute(
            'SELECT id, phone, role, parent_id AS parentId, status, created_at AS createdAt FROM agent_users WHERE status = "active" ORDER BY created_at DESC LIMIT 1000'
        );
        res.json({ success: true, data: rows });
    } catch (e) {
        res.status(500).json({ success: false, message: '服务器错误', ...(IS_PROD ? {} : { error: e.message }) });
    }
});

/**
 * POST /api/agent/orders
 * 顾问可创单（也允许 admin）
 * Body: {
 *   bindUserId?: number,
 *   serviceName: 'EAC'|'AEC'|'EC'|'EA'|'AE'|'AC'|'E'|'A',
 *   amount: number,
 *   status: '已创单'|'已签单'|'已完结',
 *   parentName?: string,
 *   parentGender?: '男'|'女',
 *   parentPhone?: string,
 *   studentName: string,
 *   studentGender: '男'|'女',
 *   studentPhone: string,
 *   extraServiceWeight?: 'ECA'|'EAC'|'CEA'|'CAE'|'AEC'|'ACE',
 *   studentIdCard?: string,
 *   signedAt?: string,
 *   finishedAt?: string
 * }
 */
router.post(
    '/orders',
    authenticateAgent,
    [
        body('bindUserId').optional().isInt({ min: 1 }).withMessage('绑定账号参数错误'),
        body('serviceName')
            .customSanitizer(v => String(v || '').trim().toUpperCase())
            .isIn(['EAC', 'AEC', 'EC', 'EA', 'AE', 'AC', 'E', 'A'])
            .withMessage('服务名参数错误'),
        body('amount').isFloat({ min: 0 }).withMessage('金额不能为空且必须为数字'),
        body('status')
            .customSanitizer(v => String(v || '').trim())
            .isIn(['已创单', '已签单', '已完结'])
            .withMessage('状态参数错误'),

        body('parentName').optional({ nullable: true }).customSanitizer(v => String(v || '').trim()),
        body('parentGender').optional({ nullable: true }).customSanitizer(v => String(v || '').trim()).isIn(['男', '女']).withMessage('家长性别参数错误'),
        body('parentPhone')
            .optional({ nullable: true })
            .customSanitizer(normalizePhone)
            .custom((v) => {
                if (!v) return true;
                // allow non-mobile if needed, but keep length guard
                return String(v).length >= 6 && String(v).length <= 20;
            })
            .withMessage('家长电话参数错误'),

        body('studentName').customSanitizer(v => String(v || '').trim()).notEmpty().withMessage('学生名字不能为空'),
        body('studentGender').customSanitizer(v => String(v || '').trim()).isIn(['男', '女']).withMessage('学生性别参数错误'),
        body('studentPhone')
            .customSanitizer(normalizePhone)
            .custom((v) => {
                if (!v) return false;
                return String(v).length >= 6 && String(v).length <= 20;
            })
            .withMessage('学生电话需为 6-20 位数字'),

        body('extraServiceWeight')
            .optional({ nullable: true })
            .customSanitizer(v => String(v || '').trim().toUpperCase())
            .isIn(['ECA', 'EAC', 'CEA', 'CAE', 'AEC', 'ACE'])
            .withMessage('扩展服务权重参数错误'),
        body('studentIdCard').optional({ nullable: true }).customSanitizer(v => String(v || '').trim()),

        body('signedAt').optional({ nullable: true }).customSanitizer(v => String(v || '').trim()),
        body('finishedAt').optional({ nullable: true }).customSanitizer(v => String(v || '').trim())
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            try {
                console.warn('[agent] create order validation failed', {
                    agentId: req.agent?.id,
                    agentRole: req.agent?.role,
                    errors: errors.array()
                });
            } catch (e) {}
            return res.status(400).json({ success: false, message: '参数错误', errors: errors.array() });
        }

        const {
            bindUserId,
            serviceName,
            amount,
            status,
            parentName,
            parentGender,
            parentPhone,
            studentName,
            studentGender,
            studentPhone,
            extraServiceWeight,
            studentIdCard,
            signedAt,
            finishedAt
        } = req.body;

        try {
            const myRole = String(req.agent.role || '');
            const canCreate = myRole === 'consultant';
            if (!canCreate) {
                return res.status(403).json({ success: false, message: '无权限创建订单' });
            }

            const boundUserId = bindUserId ? Number(bindUserId) : Number(req.agent.id);

            // 按需求：顾问可选择“所有账号”作为创单代理人（即订单绑定账号 user_id）
            const [exists] = await pool.execute('SELECT id FROM agent_users WHERE id = ? AND status = "active" LIMIT 1', [boundUserId]);
            if (exists.length === 0) {
                return res.status(404).json({ success: false, message: '创单代理人账号不存在或不可用' });
            }

            const prefix = orderPrefixFromServiceName(serviceName);
            if (!prefix) {
                return res.status(400).json({ success: false, message: '服务名不合法，无法生成订单号' });
            }

            const signedAtValue = (status === '已签单' || status === '已完结')
                ? (signedAt ? new Date(String(signedAt)) : new Date())
                : (signedAt ? new Date(String(signedAt)) : null);
            const finishedAtValue = (status === '已完结')
                ? (finishedAt ? new Date(String(finishedAt)) : new Date())
                : (finishedAt ? new Date(String(finishedAt)) : null);

            const conn = await pool.getConnection();
            try {
                await conn.beginTransaction();

                let orderNo = null;
                for (let i = 0; i < 3; i++) {
                    orderNo = await nextOrderNo({ conn, prefix });
                    try {
                        const [result] = await conn.execute(
                            `INSERT INTO agent_orders (
                                user_id,
                                created_by_user_id,
                                order_no,
                                title,
                                amount,
                                status,
                                parent_name,
                                parent_gender,
                                parent_phone,
                                student_name,
                                student_gender,
                                student_phone,
                                extra_service_weight,
                                student_id_card,
                                signed_at,
                                finished_at
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                            [
                                boundUserId,
                                req.agent.id,
                                orderNo,
                                String(serviceName),
                                Number(amount),
                                String(status),
                                parentName ? String(parentName) : null,
                                parentGender ? String(parentGender) : null,
                                parentPhone ? String(parentPhone) : null,
                                String(studentName),
                                String(studentGender),
                                String(studentPhone),
                                extraServiceWeight ? String(extraServiceWeight) : null,
                                studentIdCard ? String(studentIdCard) : null,
                                signedAtValue instanceof Date && !Number.isNaN(signedAtValue.getTime()) ? signedAtValue : null,
                                finishedAtValue instanceof Date && !Number.isNaN(finishedAtValue.getTime()) ? finishedAtValue : null
                            ]
                        );

                        await conn.commit();

                        await logAction({
                            userId: req.agent.id,
                            action: 'create_order',
                            detail: JSON.stringify({ orderNo, serviceName, amount, status, boundUserId }),
                            ip: req.ip
                        });

                        return res.json({ success: true, message: '创建订单成功', orderId: result.insertId, orderNo });
                    } catch (e) {
                        // Duplicate order_no: retry
                        if (String(e?.code || '').toUpperCase() === 'ER_DUP_ENTRY') continue;
                        throw e;
                    }
                }

                throw new Error('订单号生成失败，请重试');
            } finally {
                try {
                    conn.release();
                } catch (e) {}
            }
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
        const roleToLevel = (role) => {
            const r = String(role || '').trim();
            if (r === 'agent1') return 1;
            if (r === 'agent2') return 2;
            if (r === 'agent3') return 3;
            if (r === 'agent4') return 4;
            return null;
        };

        const calcSelfCommissionRate = (level) => {
            if (level === 1) return 0.13;
            if (level === 2 || level === 3 || level === 4) return 0.08;
            return 0;
        };

        const roundMoney = (v) => {
            const n = Number(v);
            if (!Number.isFinite(n)) return 0;
            return Math.round(n * 100) / 100;
        };

        const role = String(req.agent.role || '');
        const isConsultant = role === 'consultant';
        const whereSql = isConsultant
            ? 'COALESCE(o.created_by_user_id, o.user_id) = ?'
            : 'o.user_id = ?';

        const selfLevel = roleToLevel(req.agent.role);
        const commissionRateForMe = calcSelfCommissionRate(selfLevel);

        const [rows] = await pool.execute(
            `SELECT
                o.id,
                o.order_no AS orderNo,
                o.title AS serviceName,
                o.amount,
                o.status,
                o.parent_name AS parentName,
                o.parent_gender AS parentGender,
                o.parent_phone AS parentPhone,
                o.student_name AS studentName,
                o.student_gender AS studentGender,
                o.student_phone AS studentPhone,
                o.extra_service_weight AS extraServiceWeight,
                o.student_id_card AS studentIdCard,
                o.signed_at AS signedAt,
                o.finished_at AS finishedAt,
                o.created_at AS createdAt,
                o.user_id AS boundUserId,
                bu.phone AS boundUserPhone,
                bu.role AS boundUserRole,
                COALESCE(o.created_by_user_id, o.user_id) AS createdByUserId,
                cb.phone AS createdByUserPhone,
                cb.role AS createdByUserRole
            FROM agent_orders o
            LEFT JOIN agent_users bu ON bu.id = o.user_id
            LEFT JOIN agent_users cb ON cb.id = COALESCE(o.created_by_user_id, o.user_id)
            WHERE ${whereSql}
            ORDER BY o.created_at DESC
            LIMIT 200`,
            [req.agent.id]
        );

        const data = (rows || []).map(r => {
            const amount = Number(r?.amount || 0);
            const commissionForMe = roundMoney(amount * commissionRateForMe);
            return {
                ...r,
                commissionRateForMe,
                commissionForMe
            };
        });

        res.json({ success: true, data });
    } catch (e) {
        res.status(500).json({ success: false, message: '服务器错误', ...(IS_PROD ? {} : { error: e.message }) });
    }
});

/**
 * GET /api/agent/orders-downline
 * 返回“我直接下级（agent_users.parent_id = me）”相关订单（按绑定账号 user_id 计算）
 */
router.get('/orders-downline', authenticateAgent, async (req, res) => {
    try {
        const roleToLevel = (role) => {
            const r = String(role || '').trim();
            if (r === 'agent1') return 1;
            if (r === 'agent2') return 2;
            if (r === 'agent3') return 3;
            if (r === 'agent4') return 4;
            return null;
        };

        // Calculate the commission rate for the *current* agent on a descendant order.
        // Rules (descendant agent level -> upline share):
        // - level2: parent(level1) gets 5%
        // - level3: parent(level2) gets 3%, grandparent(level1) gets 2%
        // - level4: parent(level3) gets 3%, grandparent(level2) gets 2%, great-grandparent(level1) gets 0%
        const calcUplineCommissionRate = (descendantLevel, distanceToDescendant) => {
            const d = Number(distanceToDescendant);
            if (!Number.isFinite(d) || d <= 0) return 0;
            if (descendantLevel === 2) {
                return d === 1 ? 0.05 : 0;
            }
            if (descendantLevel === 3) {
                if (d === 1) return 0.03;
                if (d === 2) return 0.02;
                return 0;
            }
            if (descendantLevel === 4) {
                if (d === 1) return 0.03;
                if (d === 2) return 0.02;
                if (d === 3) return 0;
                return 0;
            }
            return 0;
        };

        const roundMoney = (v) => {
            const n = Number(v);
            if (!Number.isFinite(n)) return 0;
            return Math.round(n * 100) / 100;
        };

        const q = String(req.query.q || '').trim();
        const status = String(req.query.status || '').trim();
        const role = String(req.query.role || '').trim();
        const startDate = String(req.query.startDate || '').trim();
        const endDate = String(req.query.endDate || '').trim();

        const isYmd = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));
        if (startDate && !isYmd(startDate)) {
            return res.status(400).json({ success: false, message: '开始日期格式错误（YYYY-MM-DD）' });
        }
        if (endDate && !isYmd(endDate)) {
            return res.status(400).json({ success: false, message: '结束日期格式错误（YYYY-MM-DD）' });
        }
        if (startDate && endDate && startDate > endDate) {
            return res.status(400).json({ success: false, message: '开始日期不能大于结束日期' });
        }

        const limitRaw = Number.parseInt(String(req.query.limit || ''), 10);
        const offsetRaw = Number.parseInt(String(req.query.offset || ''), 10);
        const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 1000) : 200;
        const offset = Number.isFinite(offsetRaw) ? Math.max(offsetRaw, 0) : 0;

        const makePlaceholders = (arr) => {
            const values = Array.isArray(arr) ? arr.filter(v => Number.isFinite(Number(v)) && Number(v) > 0).map(v => Number(v)) : [];
            return {
                placeholders: values.map(() => '?').join(','),
                values
            };
        };

        // Collect all descendants (children, grandchildren, ...) by BFS.
        const visited = new Set([Number(req.agent.id)]);
        let frontier = [Number(req.agent.id)];
        const descendantIds = [];
        const depthMap = new Map([[Number(req.agent.id), 0]]);

        for (let depth = 0; depth < 10; depth += 1) {
            if (!frontier.length) break;
            const { placeholders, values } = makePlaceholders(frontier);
            if (!placeholders) break;

            const [rows] = await pool.execute(
                `SELECT id FROM agent_users WHERE parent_id IN (${placeholders}) AND status = "active" ORDER BY id ASC LIMIT 5000`,
                values
            );

            if (!rows || rows.length === 0) break;
            const next = [];
            for (const r of rows) {
                const id = Number(r.id);
                if (!Number.isFinite(id) || id <= 0) continue;
                if (visited.has(id)) continue;
                visited.add(id);
                descendantIds.push(id);
                depthMap.set(id, depth + 1);
                next.push(id);
            }
            frontier = next;
        }

        if (descendantIds.length === 0) {
            return res.json({ success: true, data: [] });
        }

        const { placeholders, values } = makePlaceholders(descendantIds);
        if (!placeholders) {
            return res.json({ success: true, data: [] });
        }

        const where = [`o.user_id IN (${placeholders})`];
        const params = [...values];

        if (status) {
            where.push('o.status = ?');
            params.push(status);
        }

        if (role) {
            where.push('bu.role = ?');
            params.push(role);
        }

        if (startDate) {
            where.push('o.created_at >= ?');
            params.push(`${startDate} 00:00:00`);
        }

        if (endDate) {
            where.push('o.created_at <= ?');
            params.push(`${endDate} 23:59:59`);
        }

        if (q) {
            const like = `%${q}%`;
            where.push(`(
                o.order_no LIKE ?
                OR o.title LIKE ?
                OR o.status LIKE ?
                OR IFNULL(o.student_name, "") LIKE ?
                OR IFNULL(o.student_phone, "") LIKE ?
                OR IFNULL(o.parent_phone, "") LIKE ?
                OR IFNULL(bu.phone, "") LIKE ?
                OR IFNULL(cb.phone, "") LIKE ?
            )`);
            params.push(like, like, like, like, like, like, like, like);
        }

        params.push(limit, offset);

        const [rows] = await pool.execute(
            `SELECT
                o.id,
                o.order_no AS orderNo,
                o.title AS serviceName,
                o.amount,
                o.status,
                o.student_name AS studentName,
                o.student_gender AS studentGender,
                o.student_phone AS studentPhone,
                o.parent_name AS parentName,
                o.parent_gender AS parentGender,
                o.parent_phone AS parentPhone,
                o.extra_service_weight AS extraServiceWeight,
                o.signed_at AS signedAt,
                o.finished_at AS finishedAt,
                o.created_at AS createdAt,
                o.user_id AS boundUserId,
                bu.phone AS boundUserPhone,
                bu.role AS boundUserRole,
                COALESCE(o.created_by_user_id, o.user_id) AS createdByUserId,
                cb.phone AS createdByUserPhone,
                cb.role AS createdByUserRole
            FROM agent_orders o
            LEFT JOIN agent_users bu ON bu.id = o.user_id
            LEFT JOIN agent_users cb ON cb.id = COALESCE(o.created_by_user_id, o.user_id)
            WHERE ${where.join(' AND ')}
            ORDER BY o.created_at DESC
            LIMIT ? OFFSET ?`,
            params
        );

        const data = (rows || []).map(r => {
            const boundUserId = Number(r?.boundUserId);
            const distance = depthMap.get(boundUserId);
            const descendantLevel = roleToLevel(r?.boundUserRole);
            const commissionRateForMe = calcUplineCommissionRate(descendantLevel, distance);
            const amount = Number(r?.amount || 0);
            const commissionForMe = roundMoney(amount * commissionRateForMe);
            return {
                ...r,
                commissionRateForMe,
                commissionForMe
            };
        });

        return res.json({ success: true, data });
    } catch (e) {
        console.error('[agent] orders-downline error:', e);
        return res.status(500).json({ success: false, message: '服务器错误', ...(IS_PROD ? {} : { error: e.message }) });
    }
});

/**
 * DELETE /api/agent/orders/:id
 * 顾问删除自己创建的订单
 */
router.delete('/orders/:id', authenticateAgent, async (req, res) => {
    const role = String(req.agent.role || '');
    if (role !== 'consultant') {
        return res.status(403).json({ success: false, message: '无权限删除订单' });
    }

    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
        return res.status(400).json({ success: false, message: '订单ID参数错误' });
    }

    try {
        const [rows] = await pool.execute(
            'SELECT id, order_no AS orderNo, title AS serviceName, status, COALESCE(created_by_user_id, user_id) AS createdByUserId FROM agent_orders WHERE id = ? LIMIT 1',
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: '订单不存在' });
        }

        const order = rows[0];
        if (Number(order.createdByUserId) !== Number(req.agent.id)) {
            return res.status(403).json({ success: false, message: '无权限删除该订单' });
        }

        await pool.execute('DELETE FROM agent_orders WHERE id = ? LIMIT 1', [id]);

        await logAction({
            userId: req.agent.id,
            action: 'delete_order',
            detail: JSON.stringify({ orderId: id, orderNo: order.orderNo, serviceName: order.serviceName, status: order.status }),
            ip: req.ip
        });

        return res.json({ success: true, message: '删除成功' });
    } catch (e) {
        console.error('[agent] delete order error:', e);
        return res.status(500).json({ success: false, message: '服务器错误', ...(IS_PROD ? {} : { error: e.message }) });
    }
});

/**
 * POST /api/agent/orders/:id/advance
 * 顾问：将订单状态推进到下一项，并记录签单/完结时间
 * - 已创单 -> 已签单 (signed_at = NOW())
 * - 已签单 -> 已完结 (finished_at = NOW(); 若 signed_at 为空则一并补上)
 * - 已完结 -> 不允许
 */
router.post('/orders/:id/advance', authenticateAgent, async (req, res) => {
    const role = String(req.agent.role || '');
    if (role !== 'consultant') {
        return res.status(403).json({ success: false, message: '无权限更新订单状态' });
    }

    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
        return res.status(400).json({ success: false, message: '订单ID参数错误' });
    }

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const [rows] = await conn.execute(
            `SELECT
                id,
                order_no AS orderNo,
                title AS serviceName,
                status,
                signed_at AS signedAt,
                finished_at AS finishedAt,
                COALESCE(created_by_user_id, user_id) AS createdByUserId
            FROM agent_orders
            WHERE id = ?
            FOR UPDATE`,
            [id]
        );

        if (rows.length === 0) {
            await conn.rollback();
            return res.status(404).json({ success: false, message: '订单不存在' });
        }

        const order = rows[0];
        if (Number(order.createdByUserId) !== Number(req.agent.id)) {
            await conn.rollback();
            return res.status(403).json({ success: false, message: '无权限更新该订单' });
        }

        const cur = String(order.status || '');
        let nextStatus = null;
        let setSignedAt = false;
        let setFinishedAt = false;

        if (cur === '已创单') {
            nextStatus = '已签单';
            setSignedAt = true;
        } else if (cur === '已签单') {
            nextStatus = '已完结';
            setFinishedAt = true;
            if (!order.signedAt) setSignedAt = true;
        } else if (cur === '已完结') {
            await conn.rollback();
            return res.status(400).json({ success: false, message: '订单已完结，无法更新' });
        } else {
            await conn.rollback();
            return res.status(400).json({ success: false, message: '订单状态异常，无法更新' });
        }

        await conn.execute(
            `UPDATE agent_orders
             SET status = ?,
                 signed_at = CASE WHEN ? THEN COALESCE(signed_at, NOW()) ELSE signed_at END,
                 finished_at = CASE WHEN ? THEN COALESCE(finished_at, NOW()) ELSE finished_at END
             WHERE id = ?
             LIMIT 1`,
            [nextStatus, setSignedAt ? 1 : 0, setFinishedAt ? 1 : 0, id]
        );

        await conn.commit();

        await logAction({
            userId: req.agent.id,
            action: 'advance_order',
            detail: JSON.stringify({ orderId: id, orderNo: order.orderNo, from: cur, to: nextStatus }),
            ip: req.ip
        });

        return res.json({ success: true, message: '更新成功', status: nextStatus });
    } catch (e) {
        try { await conn.rollback(); } catch (e2) {}
        console.error('[agent] advance order error:', e);
        return res.status(500).json({ success: false, message: '服务器错误', ...(IS_PROD ? {} : { error: e.message }) });
    } finally {
        try { conn.release(); } catch (e) {}
    }
});

/**
 * PUT /api/agent/orders/:id
 * 顾问修改订单所有信息（除订单号）。
 * 规则：当状态变更时，自动清除“未到达阶段”的时间字段。
 * - 已创单：signed_at/finished_at -> NULL
 * - 已签单：finished_at -> NULL；signed_at 若为空则补 NOW()
 * - 已完结：signed_at/finished_at 若为空则补 NOW()
 */
router.put(
    '/orders/:id',
    authenticateAgent,
    [
        body('bindUserId').optional().isInt({ min: 1 }).withMessage('绑定账号参数错误'),
        body('serviceName')
            .customSanitizer(v => String(v || '').trim().toUpperCase())
            .isIn(['EAC', 'AEC', 'EC', 'EA', 'AE', 'AC', 'E', 'A'])
            .withMessage('服务名参数错误'),
        body('amount').isFloat({ min: 0 }).withMessage('金额不能为空且必须为数字'),
        body('status')
            .customSanitizer(v => String(v || '').trim())
            .isIn(['已创单', '已签单', '已完结'])
            .withMessage('状态参数错误'),

        body('parentName').optional({ nullable: true }).customSanitizer(v => String(v || '').trim()),
        body('parentGender').optional({ nullable: true }).customSanitizer(v => String(v || '').trim()).isIn(['男', '女']).withMessage('家长性别参数错误'),
        body('parentPhone')
            .optional({ nullable: true })
            .customSanitizer(normalizePhone)
            .custom((v) => {
                if (!v) return true;
                return String(v).length >= 6 && String(v).length <= 20;
            })
            .withMessage('家长电话参数错误'),

        body('studentName').customSanitizer(v => String(v || '').trim()).notEmpty().withMessage('学生名字不能为空'),
        body('studentGender').customSanitizer(v => String(v || '').trim()).isIn(['男', '女']).withMessage('学生性别参数错误'),
        body('studentPhone')
            .customSanitizer(normalizePhone)
            .custom((v) => {
                if (!v) return false;
                return String(v).length >= 6 && String(v).length <= 20;
            })
            .withMessage('学生电话需为 6-20 位数字'),

        body('extraServiceWeight')
            .optional({ nullable: true })
            .customSanitizer(v => String(v || '').trim().toUpperCase())
            .isIn(['ECA', 'EAC', 'CEA', 'CAE', 'AEC', 'ACE'])
            .withMessage('扩展服务权重参数错误'),
        body('studentIdCard').optional({ nullable: true }).customSanitizer(v => String(v || '').trim())
    ],
    async (req, res) => {
        const role = String(req.agent.role || '');
        if (role !== 'consultant') {
            return res.status(403).json({ success: false, message: '无权限修改订单' });
        }

        const id = Number(req.params.id);
        if (!Number.isFinite(id) || id <= 0) {
            return res.status(400).json({ success: false, message: '订单ID参数错误' });
        }

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, message: '参数错误', errors: errors.array() });
        }

        const {
            bindUserId,
            serviceName,
            amount,
            status,
            parentName,
            parentGender,
            parentPhone,
            studentName,
            studentGender,
            studentPhone,
            extraServiceWeight,
            studentIdCard
        } = req.body;

        const boundUserId = bindUserId ? Number(bindUserId) : undefined;

        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();

            const [rows] = await conn.execute(
                `SELECT
                    id,
                    order_no AS orderNo,
                    status,
                    signed_at AS signedAt,
                    finished_at AS finishedAt,
                    user_id AS boundUserId,
                    COALESCE(created_by_user_id, user_id) AS createdByUserId
                 FROM agent_orders
                 WHERE id = ?
                 FOR UPDATE`,
                [id]
            );

            if (rows.length === 0) {
                await conn.rollback();
                return res.status(404).json({ success: false, message: '订单不存在' });
            }

            const curOrder = rows[0];
            if (Number(curOrder.createdByUserId) !== Number(req.agent.id)) {
                await conn.rollback();
                return res.status(403).json({ success: false, message: '无权限修改该订单' });
            }

            const nextBoundUserId = Number.isFinite(boundUserId) ? boundUserId : Number(curOrder.boundUserId);
            const [exists] = await conn.execute(
                'SELECT id FROM agent_users WHERE id = ? AND status = "active" LIMIT 1',
                [nextBoundUserId]
            );
            if (exists.length === 0) {
                await conn.rollback();
                return res.status(404).json({ success: false, message: '创单代理人账号不存在或不可用' });
            }

            // Status -> timestamps normalization
            let nextSignedAt = curOrder.signedAt;
            let nextFinishedAt = curOrder.finishedAt;
            if (status === '已创单') {
                nextSignedAt = null;
                nextFinishedAt = null;
            } else if (status === '已签单') {
                nextFinishedAt = null;
                nextSignedAt = nextSignedAt ? nextSignedAt : new Date();
            } else if (status === '已完结') {
                nextSignedAt = nextSignedAt ? nextSignedAt : new Date();
                nextFinishedAt = nextFinishedAt ? nextFinishedAt : new Date();
            }

            await conn.execute(
                `UPDATE agent_orders
                 SET
                    user_id = ?,
                    title = ?,
                    amount = ?,
                    status = ?,
                    parent_name = ?,
                    parent_gender = ?,
                    parent_phone = ?,
                    student_name = ?,
                    student_gender = ?,
                    student_phone = ?,
                    extra_service_weight = ?,
                    student_id_card = ?,
                    signed_at = ?,
                    finished_at = ?
                 WHERE id = ?
                 LIMIT 1`,
                [
                    nextBoundUserId,
                    String(serviceName),
                    Number(amount),
                    String(status),
                    parentName ? String(parentName) : null,
                    parentGender ? String(parentGender) : null,
                    parentPhone ? String(parentPhone) : null,
                    String(studentName),
                    String(studentGender),
                    String(studentPhone),
                    extraServiceWeight ? String(extraServiceWeight) : null,
                    studentIdCard ? String(studentIdCard) : null,
                    nextSignedAt,
                    nextFinishedAt,
                    id
                ]
            );

            await conn.commit();

            await logAction({
                userId: req.agent.id,
                action: 'update_order',
                detail: JSON.stringify({ orderId: id, orderNo: curOrder.orderNo, status }),
                ip: req.ip
            });

            return res.json({ success: true, message: '修改成功' });
        } catch (e) {
            try { await conn.rollback(); } catch (e2) {}
            console.error('[agent] update order error:', e);
            return res.status(500).json({ success: false, message: '服务器错误', ...(IS_PROD ? {} : { error: e.message }) });
        } finally {
            try { conn.release(); } catch (e) {}
        }
    }
);

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

/**
 * GET /api/agent/sales-summary
 * 汇总“我的销售金额 vs 所有下级销售金额”（按订单绑定账号 user_id）
 * Query: startDate=YYYY-MM-DD, endDate=YYYY-MM-DD
 * 时间字段：created_at
 */
router.get('/sales-summary', authenticateAgent, async (req, res) => {
    try {
        const startDate = String(req.query.startDate || '').trim();
        const endDate = String(req.query.endDate || '').trim();

        const isYmd = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));
        if (startDate && !isYmd(startDate)) {
            return res.status(400).json({ success: false, message: '开始日期格式错误（YYYY-MM-DD）' });
        }
        if (endDate && !isYmd(endDate)) {
            return res.status(400).json({ success: false, message: '结束日期格式错误（YYYY-MM-DD）' });
        }
        if (startDate && endDate && startDate > endDate) {
            return res.status(400).json({ success: false, message: '开始日期不能大于结束日期' });
        }

        // Default: this month in Asia/Shanghai
        const getShanghaiYmd = (date) => {
            try {
                return new Intl.DateTimeFormat('en-CA', {
                    timeZone: 'Asia/Shanghai',
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit'
                }).format(date);
            } catch (e) {
                const d = date instanceof Date ? date : new Date(date);
                const yyyy = d.getFullYear();
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                const dd = String(d.getDate()).padStart(2, '0');
                return `${yyyy}-${mm}-${dd}`;
            }
        };
        const getShanghaiYearMonth = (date) => {
            try {
                const parts = new Intl.DateTimeFormat('en-CA', {
                    timeZone: 'Asia/Shanghai',
                    year: 'numeric',
                    month: '2-digit'
                }).formatToParts(date);
                const map = {};
                for (const p of parts) {
                    if (p.type !== 'literal') map[p.type] = p.value;
                }
                return { year: map.year, month: map.month };
            } catch (e) {
                const d = date instanceof Date ? date : new Date(date);
                return { year: String(d.getFullYear()), month: String(d.getMonth() + 1).padStart(2, '0') };
            }
        };

        const now = new Date();
        const { year, month } = getShanghaiYearMonth(now);
        const defStart = `${year}-${month}-01`;
        const defEnd = getShanghaiYmd(now);
        const s = startDate || defStart;
        const e = endDate || defEnd;

        // Helpers
        const makePlaceholders = (arr) => {
            const values = Array.isArray(arr) ? arr.filter(v => Number.isFinite(Number(v)) && Number(v) > 0).map(v => Number(v)) : [];
            return {
                placeholders: values.map(() => '?').join(','),
                values
            };
        };

        // Collect descendants (active) by BFS
        const visited = new Set([Number(req.agent.id)]);
        let frontier = [Number(req.agent.id)];
        const descendantIds = [];

        for (let depth = 0; depth < 10; depth += 1) {
            if (!frontier.length) break;
            const { placeholders, values } = makePlaceholders(frontier);
            if (!placeholders) break;

            const [rows] = await pool.execute(
                `SELECT id FROM agent_users WHERE parent_id IN (${placeholders}) AND status = "active" ORDER BY id ASC LIMIT 5000`,
                values
            );

            if (!rows || rows.length === 0) break;
            const next = [];
            for (const r of rows) {
                const id = Number(r.id);
                if (!Number.isFinite(id) || id <= 0) continue;
                if (visited.has(id)) continue;
                visited.add(id);
                descendantIds.push(id);
                next.push(id);
            }
            frontier = next;
        }

        const rangeStart = `${s} 00:00:00`;
        const rangeEnd = `${e} 23:59:59`;

        const [myRows] = await pool.execute(
            'SELECT COALESCE(SUM(amount), 0) AS total FROM agent_orders WHERE user_id = ? AND created_at >= ? AND created_at <= ?',
            [Number(req.agent.id), rangeStart, rangeEnd]
        );
        const myAmount = Number(myRows?.[0]?.total || 0) || 0;

        let downlineAmount = 0;
        if (descendantIds.length > 0) {
            const { placeholders, values } = makePlaceholders(descendantIds);
            if (placeholders) {
                const [downRows] = await pool.execute(
                    `SELECT COALESCE(SUM(amount), 0) AS total FROM agent_orders WHERE user_id IN (${placeholders}) AND created_at >= ? AND created_at <= ?`,
                    [...values, rangeStart, rangeEnd]
                );
                downlineAmount = Number(downRows?.[0]?.total || 0) || 0;
            }
        }

        return res.json({
            success: true,
            startDate: s,
            endDate: e,
            myAmount,
            downlineAmount
        });
    } catch (e) {
        res.status(500).json({ success: false, message: '服务器错误', ...(IS_PROD ? {} : { error: e.message }) });
    }
});

/**
 * GET /api/agent/sales-trend
 * 按“日”返回销售金额折线图数据（我的 vs 所有下级），按订单绑定账号 user_id
 * Query: startDate=YYYY-MM-DD, endDate=YYYY-MM-DD
 * 返回：labels(YYYY-MM-DD[]), myAmounts(number[]), downlineAmounts(number[])
 */
router.get('/sales-trend', authenticateAgent, async (req, res) => {
    try {
        const startDate = String(req.query.startDate || '').trim();
        const endDate = String(req.query.endDate || '').trim();

        const isYmd = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));
        if (startDate && !isYmd(startDate)) {
            return res.status(400).json({ success: false, message: '开始日期格式错误（YYYY-MM-DD）' });
        }
        if (endDate && !isYmd(endDate)) {
            return res.status(400).json({ success: false, message: '结束日期格式错误（YYYY-MM-DD）' });
        }
        if (startDate && endDate && startDate > endDate) {
            return res.status(400).json({ success: false, message: '开始日期不能大于结束日期' });
        }

        // Default: this month in Asia/Shanghai
        const getShanghaiYmd = (date) => {
            try {
                return new Intl.DateTimeFormat('en-CA', {
                    timeZone: 'Asia/Shanghai',
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit'
                }).format(date);
            } catch (e) {
                const d = date instanceof Date ? date : new Date(date);
                const yyyy = d.getFullYear();
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                const dd = String(d.getDate()).padStart(2, '0');
                return `${yyyy}-${mm}-${dd}`;
            }
        };
        const getShanghaiYearMonth = (date) => {
            try {
                const parts = new Intl.DateTimeFormat('en-CA', {
                    timeZone: 'Asia/Shanghai',
                    year: 'numeric',
                    month: '2-digit'
                }).formatToParts(date);
                const map = {};
                for (const p of parts) {
                    if (p.type !== 'literal') map[p.type] = p.value;
                }
                return { year: map.year, month: map.month };
            } catch (e) {
                const d = date instanceof Date ? date : new Date(date);
                return { year: String(d.getFullYear()), month: String(d.getMonth() + 1).padStart(2, '0') };
            }
        };

        const now = new Date();
        const { year, month } = getShanghaiYearMonth(now);
        const defStart = `${year}-${month}-01`;
        const defEnd = getShanghaiYmd(now);
        const s = startDate || defStart;
        const e = endDate || defEnd;

        const makePlaceholders = (arr) => {
            const values = Array.isArray(arr) ? arr.filter(v => Number.isFinite(Number(v)) && Number(v) > 0).map(v => Number(v)) : [];
            return {
                placeholders: values.map(() => '?').join(','),
                values
            };
        };

        // Collect descendants (active) by BFS
        const visited = new Set([Number(req.agent.id)]);
        let frontier = [Number(req.agent.id)];
        const descendantIds = [];

        for (let depth = 0; depth < 10; depth += 1) {
            if (!frontier.length) break;
            const { placeholders, values } = makePlaceholders(frontier);
            if (!placeholders) break;

            const [rows] = await pool.execute(
                `SELECT id FROM agent_users WHERE parent_id IN (${placeholders}) AND status = "active" ORDER BY id ASC LIMIT 5000`,
                values
            );

            if (!rows || rows.length === 0) break;
            const next = [];
            for (const r of rows) {
                const id = Number(r.id);
                if (!Number.isFinite(id) || id <= 0) continue;
                if (visited.has(id)) continue;
                visited.add(id);
                descendantIds.push(id);
                next.push(id);
            }
            frontier = next;
        }

        const rangeStart = `${s} 00:00:00`;
        const rangeEnd = `${e} 23:59:59`;

        const [myRows] = await pool.execute(
            "SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS d, COALESCE(SUM(amount), 0) AS total FROM agent_orders WHERE user_id = ? AND created_at >= ? AND created_at <= ? GROUP BY d ORDER BY d ASC",
            [Number(req.agent.id), rangeStart, rangeEnd]
        );
        const myMap = new Map();
        for (const r of (myRows || [])) {
            if (!r) continue;
            const d = String(r.d || '').trim();
            if (!d) continue;
            myMap.set(d, Number(r.total || 0) || 0);
        }

        const downMap = new Map();
        if (descendantIds.length > 0) {
            const { placeholders, values } = makePlaceholders(descendantIds);
            if (placeholders) {
                const [downRows] = await pool.execute(
                    `SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS d, COALESCE(SUM(amount), 0) AS total FROM agent_orders WHERE user_id IN (${placeholders}) AND created_at >= ? AND created_at <= ? GROUP BY d ORDER BY d ASC`,
                    [...values, rangeStart, rangeEnd]
                );
                for (const r of (downRows || [])) {
                    if (!r) continue;
                    const d = String(r.d || '').trim();
                    if (!d) continue;
                    downMap.set(d, Number(r.total || 0) || 0);
                }
            }
        }

        const pad2 = (n) => String(n).padStart(2, '0');
        const parseYmdUtc = (ymd) => {
            const parts = String(ymd || '').split('-').map((x) => Number(x));
            const y = parts[0];
            const m = parts[1];
            const d = parts[2];
            if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
            return new Date(Date.UTC(y, m - 1, d));
        };
        const formatYmdUtc = (dt) => {
            return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
        };

        const startDt = parseYmdUtc(s);
        const endDt = parseYmdUtc(e);
        if (!startDt || !endDt) {
            return res.status(400).json({ success: false, message: '日期解析失败' });
        }

        const labels = [];
        const myAmounts = [];
        const downlineAmounts = [];

        const cur = new Date(startDt.getTime());
        while (cur.getTime() <= endDt.getTime()) {
            const ymd = formatYmdUtc(cur);
            labels.push(ymd);
            myAmounts.push(myMap.get(ymd) || 0);
            downlineAmounts.push(downMap.get(ymd) || 0);
            cur.setUTCDate(cur.getUTCDate() + 1);
        }

        return res.json({
            success: true,
            startDate: s,
            endDate: e,
            labels,
            myAmounts,
            downlineAmounts
        });
    } catch (e) {
        res.status(500).json({ success: false, message: '服务器错误', ...(IS_PROD ? {} : { error: e.message }) });
    }
});

module.exports = router;
