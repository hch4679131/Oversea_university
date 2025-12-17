/**
 * 认证系统模块
 * 功能：注册、登录、短信验证码、身份证验证、重置密码
 */

const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');

const router = express.Router();

// JWT 密钥（生产环境应该放在环境变量）
const JWT_SECRET = process.env.JWT_SECRET || 'HKSD_2025_Secret_Key_Change_In_Production';
const IS_PROD = process.env.NODE_ENV === 'production';

function maskPhone(p) {
    if (!p) return '';
    return String(p).replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2');
}

// 调试：记录进入 auth 路由的请求（便于定位 JSON 解析问题）
router.use((req, res, next) => {
    try {
        console.log('[auth] incoming', req.method, req.url, req.headers['content-type'], req.body);
    } catch (e) {}
    next();
});

// MySQL 连接池
const pool = mysql.createPool({
    host: process.env.MYSQL_HOST || '127.0.0.1',
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || 'Hksd2025!@#',
    database: process.env.MYSQL_DATABASE || 'hksd_auth',
    // Prefer socket if provided; otherwise default to known server port 3333
    port: process.env.MYSQL_SOCKET ? undefined : (process.env.MYSQL_PORT ? Number(process.env.MYSQL_PORT) : 3333),
    socketPath: process.env.MYSQL_SOCKET || undefined,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// 阿里云配置（生产环境需在服务器设置环境变量）
const ALIYUN_CONFIG = {
    // 短信服务
    accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID || '',
    accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET || '',
    smsSignName: process.env.SMS_SIGN_NAME || 'HKSD',  // 短信签名（需在阿里云控制台创建）
    smsTemplateCode: process.env.SMS_TEMPLATE_CODE || 'SMS_123456789',  // 短信模板代码（需在阿里云控制台创建）
    
    // 身份证实名认证服务
    idVerifyAppCode: process.env.ID_VERIFY_APP_CODE || ''
};

// ==================== 工具函数 ====================

/**
 * 生成 6 位随机验证码
 */
function generateVerificationCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * 发送短信验证码（阿里云）
 */
async function sendSMS(phone, code) {
    try {
        // 开发/未配置短信模板时，直接打印验证码并返回成功
        const isPlaceholder = !process.env.SMS_TEMPLATE_CODE || ALIYUN_CONFIG.smsTemplateCode === 'SMS_123456789';
        const isSignMissing = !process.env.SMS_SIGN_NAME || !ALIYUN_CONFIG.smsSignName;
        if (!IS_PROD || isPlaceholder || isSignMissing) {
            console.log(`[开发模式] 跳过真实短信发送 → 手机号: ${maskPhone(phone)} 验证码: ${code}`);
            return true;
        }

        const Dysmsapi20170525 = require('@alicloud/dysmsapi20170525');
        const OpenApi = require('@alicloud/openapi-client');
        
        const config = new OpenApi.Config({
            accessKeyId: ALIYUN_CONFIG.accessKeyId,
            accessKeySecret: ALIYUN_CONFIG.accessKeySecret,
            endpoint: 'dysmsapi.aliyuncs.com'
        });
        
        const client = new Dysmsapi20170525(config);
        const request = new Dysmsapi20170525.SendSmsRequest({
            phoneNumbers: phone,
            signName: ALIYUN_CONFIG.smsSignName,
            templateCode: ALIYUN_CONFIG.smsTemplateCode,
            templateParam: JSON.stringify({ code })
        });
        
        const response = await client.sendSms(request);
        console.log(`[短信] 发送到 ${phone}，结果: ${response.body.code}，消息: ${response.body.message}`);
        
        return response.body.code === 'OK';
    } catch (error) {
        console.error('[短信发送失败]', error.message);
        return false;
    }
}

/**
 * 验证身份证号码（阿里云实名认证 API）
 */
async function verifyIDCard(idCard, name) {
    // 基本格式验证
    const idCardRegex = /^[1-9]\d{5}(18|19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]$/;
    if (!idCardRegex.test(idCard)) {
        return { valid: false, message: '身份证号码格式不正确' };
    }
    
    try {
        const axios = require('axios');
        
        // 调用阿里云市场身份证实名认证 API
        const response = await axios.get('https://jisusfz.market.alicloudapi.com/idcard/query', {
            params: {
                idcard: idCard,
                name: name
            },
            headers: {
                'Authorization': `APPCODE ${ALIYUN_CONFIG.idVerifyAppCode}`
            },
            timeout: 10000
        });
        
        console.log(`[身份证验证] ${name} - ${idCard}，结果: ${response.data.status}`);
        
        if (response.data.status === '0' && response.data.result) {
            return { valid: true, message: '身份证验证通过' };
        } else {
            return { valid: false, message: response.data.msg || '身份证验证失败' };
        }
    } catch (error) {
        console.error('[身份证验证失败]', error.message);
        // 开发环境降级：只做格式验证
        if (process.env.NODE_ENV !== 'production') {
            console.log(`[开发模式] 跳过真实身份证验证`);
            return { valid: true, message: '开发模式：格式验证通过' };
        }
        return { valid: false, message: '身份证验证服务异常，请稍后重试' };
    }
}

/**
 * JWT 中间件：验证 Token
 */
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ success: false, message: '未提供认证令牌' });
    }
    
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ success: false, message: '令牌无效或已过期' });
        }
        req.user = user;
        next();
    });
}

// ==================== API 路由 ====================

/**
 * POST /api/auth/send-code
 * 发送短信验证码
 */
router.post('/send-code', [
    body('phone').isMobilePhone('zh-CN').withMessage('请输入正确的手机号'),
    body('purpose').isIn(['register', 'reset_password', 'login']).withMessage('用途参数错误')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }
    
    const { phone, purpose } = req.body;
    console.log(`[发送验证码] 收到请求 → 目的: ${purpose} 手机号: ${maskPhone(phone)} 环境: ${IS_PROD ? 'prod' : 'dev'}`);
    
    try {
        // 检查 1 分钟内是否已发送过
        const [recent] = await pool.execute(
            'SELECT * FROM verification_codes WHERE phone = ? AND created_at > DATE_SUB(NOW(), INTERVAL 1 MINUTE) ORDER BY created_at DESC LIMIT 1',
            [phone]
        );
        console.log(`[发送验证码] 近1分钟发送记录: ${recent.length}`);
        
        if (recent.length > 0) {
            return res.status(429).json({ success: false, message: '验证码发送过于频繁，请稍后再试' });
        }
        
        // 如果是注册，检查手机号是否已存在
        if (purpose === 'register') {
            const [existing] = await pool.execute('SELECT id FROM users WHERE phone = ?', [phone]);
            if (existing.length > 0) {
                return res.status(400).json({ success: false, message: '该手机号已注册' });
            }
        }
        
        // 生成并发送验证码（过期时间由 MySQL 计算，避免时区/类型问题）
        const code = generateVerificationCode();
        await pool.execute(
            'INSERT INTO verification_codes (phone, code, purpose, expires_at) VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 5 MINUTE))',
            [phone, code, purpose]
        );
        
        const smsSent = await sendSMS(phone, code);
        console.log(`[发送验证码] 短信发送状态: ${smsSent ? '成功' : '失败'}`);
        
        if (!smsSent) {
            return res.status(500).json({ success: false, message: '短信发送失败，请稍后重试' });
        }
        
        res.json({ success: true, message: '验证码已发送', expiresIn: 300 });
        
    } catch (error) {
        console.error('[发送验证码错误]', error);
        res.status(500).json({ success: false, message: '服务器错误', ...(IS_PROD ? {} : { error: error.message }) });
    }
});

/**
 * POST /api/auth/verify-code
 * 验证短信验证码
 */
router.post('/verify-code', [
    body('phone').isMobilePhone('zh-CN'),
    body('code').isLength({ min: 6, max: 6 }).isNumeric()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }
    
    const { phone, code } = req.body;
    
    try {
        const [rows] = await pool.execute(
            'SELECT * FROM verification_codes WHERE phone = ? AND code = ? AND expires_at > NOW() AND used = FALSE ORDER BY created_at DESC LIMIT 1',
            [phone, code]
        );
        
        if (rows.length === 0) {
            return res.status(400).json({ success: false, message: '验证码错误或已过期' });
        }
        
        // 标记为已使用
        await pool.execute('UPDATE verification_codes SET used = TRUE WHERE id = ?', [rows[0].id]);
        
        res.json({ success: true, message: '验证成功' });
        
    } catch (error) {
        console.error('[验证码验证错误]', error);
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

/**
 * POST /api/auth/verify-id-card
 * 验证身份证（支付宝实名认证）
 */
router.post('/verify-id-card', [
    body('idCard').isLength({ min: 18, max: 18 }),
    body('name').notEmpty().withMessage('请输入姓名')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }
    
    const { idCard, name } = req.body;
    
    try {
        const result = await verifyIDCard(idCard, name);
        
        if (!result.valid) {
            return res.status(400).json({ success: false, message: result.message });
        }
        
        res.json({ success: true, message: '身份证验证通过' });
        
    } catch (error) {
        console.error('[身份证验证错误]', error);
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

/**
 * POST /api/auth/register
 * 用户注册
 */
router.post('/register', [
    body('phone').isMobilePhone('zh-CN'),
    body('password').isLength({ min: 6 }).withMessage('密码至少 6 位'),
    body('code').isLength({ min: 6, max: 6 }).isNumeric(),
    body('idCard').optional().isLength({ min: 18, max: 18 }),
    body('idCardName').optional().notEmpty()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }
    
    const { phone, password, code, idCard, idCardName } = req.body;
    
    try {
        // 验证验证码
        const [codeRows] = await pool.execute(
            'SELECT * FROM verification_codes WHERE phone = ? AND code = ? AND purpose = "register" AND expires_at > NOW() AND used = FALSE ORDER BY created_at DESC LIMIT 1',
            [phone, code]
        );
        
        if (codeRows.length === 0) {
            return res.status(400).json({ success: false, message: '验证码错误或已过期' });
        }
        
        // 检查手机号是否已注册
        const [existing] = await pool.execute('SELECT id FROM users WHERE phone = ?', [phone]);
        if (existing.length > 0) {
            return res.status(400).json({ success: false, message: '该手机号已注册' });
        }
        
        // 加密密码
        const passwordHash = await bcrypt.hash(password, 10);
        
        // 创建用户
        await pool.execute(
            'INSERT INTO users (phone, password_hash, id_card, id_card_name, verified) VALUES (?, ?, ?, ?, ?)',
            [phone, passwordHash, idCard || null, idCardName || null, !!idCard]
        );
        
        // 标记验证码已使用
        await pool.execute('UPDATE verification_codes SET used = TRUE WHERE id = ?', [codeRows[0].id]);
        
        res.json({ success: true, message: '注册成功' });
        
    } catch (error) {
        console.error('[注册错误]', error);
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

/**
 * POST /api/auth/login
 * 用户登录
 */
router.post('/login', [
    body('phone').isMobilePhone('zh-CN'),
    body('password').notEmpty().withMessage('请输入密码')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }
    
    const { phone, password } = req.body;
    
    try {
        // 查询用户
        const [users] = await pool.execute('SELECT * FROM users WHERE phone = ?', [phone]);
        
        if (users.length === 0) {
            return res.status(401).json({ success: false, message: '手机号或密码错误' });
        }
        
        const user = users[0];
        
        // 验证密码
        const passwordMatch = await bcrypt.compare(password, user.password_hash);
        
        if (!passwordMatch) {
            return res.status(401).json({ success: false, message: '手机号或密码错误' });
        }
        
        // 生成 JWT Token
        const token = jwt.sign(
            { id: user.id, phone: user.phone, verified: user.verified },
            JWT_SECRET,
            { expiresIn: '7d' }
        );
        
        res.json({
            success: true,
            message: '登录成功',
            token,
            user: {
                id: user.id,
                phone: user.phone,
                verified: user.verified,
                idCardName: user.id_card_name
            }
        });
        
    } catch (error) {
        console.error('[登录错误]', error);
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

/**
 * POST /api/auth/reset-password
 * 重置密码
 */
router.post('/reset-password', [
    body('phone').isMobilePhone('zh-CN'),
    body('code').isLength({ min: 6, max: 6 }).isNumeric(),
    body('newPassword').isLength({ min: 6 }).withMessage('新密码至少 6 位')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }
    
    const { phone, code, newPassword } = req.body;
    
    try {
        // 验证验证码
        const [codeRows] = await pool.execute(
            'SELECT * FROM verification_codes WHERE phone = ? AND code = ? AND purpose = "reset_password" AND expires_at > NOW() AND used = FALSE ORDER BY created_at DESC LIMIT 1',
            [phone, code]
        );
        
        if (codeRows.length === 0) {
            return res.status(400).json({ success: false, message: '验证码错误或已过期' });
        }
        
        // 检查用户是否存在
        const [users] = await pool.execute('SELECT id FROM users WHERE phone = ?', [phone]);
        if (users.length === 0) {
            return res.status(404).json({ success: false, message: '用户不存在' });
        }
        
        // 更新密码
        const passwordHash = await bcrypt.hash(newPassword, 10);
        await pool.execute('UPDATE users SET password_hash = ? WHERE phone = ?', [passwordHash, phone]);
        
        // 标记验证码已使用
        await pool.execute('UPDATE verification_codes SET used = TRUE WHERE id = ?', [codeRows[0].id]);
        
        res.json({ success: true, message: '密码重置成功' });
        
    } catch (error) {
        console.error('[重置密码错误]', error);
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

/**
 * GET /api/auth/profile
 * 获取用户信息（需要登录）
 */
router.get('/profile', authenticateToken, async (req, res) => {
    try {
        const [users] = await pool.execute(
            'SELECT id, phone, id_card, id_card_name, verified, created_at FROM users WHERE id = ?',
            [req.user.id]
        );
        
        if (users.length === 0) {
            return res.status(404).json({ success: false, message: '用户不存在' });
        }
        
        res.json({ success: true, user: users[0] });
        
    } catch (error) {
        console.error('[获取用户信息错误]', error);
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

module.exports = router;
