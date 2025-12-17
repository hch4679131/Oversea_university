/**
 * AI 聊天模块 - 使用 DeepSeek
 * 提供 /api/chat 接口，需要 JWT 认证
 */

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const JWT_SECRET = process.env.JWT_SECRET || 'hksd_club_secret_2025';

/**
 * JWT 中间件：验证 Token（测试模式下允许test_token）
 */
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ success: false, message: '未提供认证令牌' });
    }
    
    // 测试模式：允许 test_token 通过
    if (token === 'test_token') {
        req.user = { phone: 'test_user', userId: 999 };
        return next();
    }
    
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ success: false, message: '令牌无效或已过期' });
        }
        req.user = user;
        next();
    });
}

/**
 * 加载 DeepSeek API Key
 */
function loadDeepSeekKey() {
    const configPath = path.join(__dirname, 'config', 'deepseek.json');
    if (fs.existsSync(configPath)) {
        try {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
            if (config.apiKey) return config.apiKey;
        } catch (e) {
            console.error('[Chat] 读取 DeepSeek 配置失败:', e.message);
        }
    }
    return process.env.DEEPSEEK_API_KEY;
}

/**
 * POST /api/chat
 * 发送消息给 AI，获取回复
 * Body: { message: string, history?: Array<{role, content}> }
 * Response: { success: boolean, reply?: string, error?: string }
 */
router.post('/chat', authenticateToken, async (req, res) => {
    const { message, history = [] } = req.body;
    
    if (!message || typeof message !== 'string') {
        return res.status(400).json({ success: false, message: '消息内容不能为空' });
    }
    
    const apiKey = loadDeepSeekKey();
    if (!apiKey) {
        return res.status(500).json({ success: false, message: 'AI 服务未配置' });
    }
    
    try {
        console.log(`[Chat] 用户 ${req.user.phone} 发送消息: ${message.substring(0, 50)}...`);
        
        // 构建对话历史（最多保留最近 10 轮）
        const messages = [
            {
                role: 'system',
                content: '你是 HKSD Club（汇生会）的专属 AI 助手，专注于留学咨询、职业规划和生活服务。请用专业、友好的语气回答用户问题。回答要简洁明了，中文输出。'
            },
            ...history.slice(-10),
            { role: 'user', content: message }
        ];
        
        const response = await axios.post(
            'https://api.deepseek.com/v1/chat/completions',
            {
                model: 'deepseek-chat',
                messages,
                temperature: 0.7,
                max_tokens: 1000
            },
            {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 30000
            }
        );
        
        const reply = response.data.choices[0].message.content;
        console.log(`[Chat] AI 回复: ${reply.substring(0, 50)}...`);
        
        res.json({ success: true, reply });
        
    } catch (error) {
        console.error('[Chat] 调用 DeepSeek 失败:', error.message);
        res.status(500).json({ 
            success: false, 
            message: 'AI 服务暂时不可用，请稍后重试' 
        });
    }
});

module.exports = router;
