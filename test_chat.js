/**
 * 测试 AI 聊天功能
 */
const jwt = require('jsonwebtoken');
const axios = require('axios');

const JWT_SECRET = 'hksd_club_secret_2025';
const API_URL = 'http://localhost:3000/api/chat';

// 生成测试 token
const token = jwt.sign({ phone: 'test_user', userId: 999 }, JWT_SECRET, { expiresIn: '1h' });

console.log('生成的 Token:', token.substring(0, 50) + '...\n');

// 测试聊天
async function testChat() {
    try {
        console.log('发送消息: "你好，介绍一下HKSD Club"');
        const response = await axios.post(API_URL, {
            message: '你好，介绍一下HKSD Club'
        }, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log('\n✅ 聊天成功！');
        console.log('AI 回复:', response.data.reply);
    } catch (error) {
        console.error('\n❌ 聊天失败！');
        if (error.response) {
            console.error('状态码:', error.response.status);
            console.error('错误信息:', error.response.data);
        } else {
            console.error('错误:', error.message);
        }
    }
}

testChat();
