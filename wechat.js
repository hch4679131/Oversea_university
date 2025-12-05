const https = require('https');
const fs = require('fs');
const crypto = require('crypto');

/**
 * Send payload to Enterprise WeChat robot webhook URL
 * payload should follow WeChat Work robot format, e.g.:
 * { msgtype: 'text', text: { content: '...' } }
 * or { msgtype: 'markdown', markdown: { content: '...' } }
 */
function sendWeChatWebhook(webhookUrl, payload) {
    return new Promise((resolve, reject) => {
        try {
            const url = new URL(webhookUrl);
            const data = JSON.stringify(payload || {});

            const options = {
                hostname: url.hostname,
                path: url.pathname + (url.search || ''),
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(data)
                }
            };

            const req = https.request(options, (res) => {
                let body = '';
                res.on('data', (chunk) => (body += chunk));
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(body || '{}');
                        resolve(parsed);
                    } catch (err) {
                        resolve(body);
                    }
                });
            });

            req.on('error', (err) => reject(err));
            req.write(data);
            req.end();
        } catch (err) {
            reject(err);
        }
    });
}

module.exports = { sendWeChatWebhook };

/**
 * Send an image message to WeChat Work robot webhook.
 * imagePath should be a local file path to the image.
 * Robot expects base64 + md5.
 */
async function sendWeChatImage(webhookUrl, imagePath) {
    return new Promise((resolve, reject) => {
        try {
            const img = fs.readFileSync(imagePath);
            const base64 = img.toString('base64');
            const md5 = crypto.createHash('md5').update(img).digest('hex');

            const payload = {
                msgtype: 'image',
                image: {
                    base64: base64,
                    md5: md5
                }
            };

            const url = new URL(webhookUrl);
            const data = JSON.stringify(payload || {});

            const options = {
                hostname: url.hostname,
                path: url.pathname + (url.search || ''),
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(data)
                }
            };

            const req = https.request(options, (res) => {
                let body = '';
                res.on('data', (chunk) => (body += chunk));
                res.on('end', () => {
                    try { resolve(JSON.parse(body || '{}')); } catch (err) { resolve(body); }
                });
            });
            req.on('error', (err) => reject(err));
            req.write(data);
            req.end();
        } catch (err) { reject(err); }
    });
}

module.exports.sendWeChatImage = sendWeChatImage;
