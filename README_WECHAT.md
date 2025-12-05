获取并配置企业微信机器人 webhook

1) 在企业微信后台获取 webhook
- 登录管理后台: https://work.weixin.qq.com
- 进入“应用与小程序”或“机器人管理”页面，找到你要的机器人（你之前发的链接是机器人配置页）
- 在机器人设置中找到“Webhook”或“机器人地址”，点击“复制 webhook”按钮
- webhook 示例格式：
  https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=YOUR_KEY

2) 在本地或服务器上保存 webhook
- 临时（当前 PowerShell 会话）：
```powershell
$env:WECHAT_WEBHOOK = 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=YOUR_KEY'
```
- 永久（Windows）：在管理员 PowerShell 中运行（针对当前用户）：
```powershell
setx WECHAT_WEBHOOK "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=YOUR_KEY"
```
请注意 `setx` 在当前已打开的终端不会立即生效，需要打开新终端窗口。

3) 使用服务器 API 保存 webhook（安全便捷）
- 将 webhook POST 到服务器（推荐）：
```powershell
$body = @{ webhookUrl = 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=YOUR_KEY' } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri 'http://localhost:3000/api/config/wechat' -ContentType 'application/json' -Body $body
```
- 查看已保存（会返回已掩码的 webhook）：
```powershell
Invoke-RestMethod -Method Get -Uri 'http://localhost:3000/api/config/wechat'
```
- 发送一次测试消息（若已保存或直接在 body 中提供 webhookUrl）：
```powershell
# 使用已保存的 webhook
Invoke-RestMethod -Method Post -Uri 'http://localhost:3000/api/config/wechat/test' -ContentType 'application/json' -Body '{}' 

# 或直接在 body 中传递 webhookUrl（不保存）
$body = @{ webhookUrl = 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=YOUR_KEY' } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri 'http://localhost:3000/api/config/wechat/test' -ContentType 'application/json' -Body $body
```

4) 通过抓取结果发送文章
- 发送已抓取文章（例如 id=1）：
```powershell
Invoke-RestMethod -Method Post -Uri 'http://localhost:3000/api/hku-news/1/send' -ContentType 'application/json' -Body '{}' 
```
或在 body 中提供 `webhookUrl` 字段覆盖保存值：
```powershell
$body = @{ webhookUrl = 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=YOUR_KEY' } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri 'http://localhost:3000/api/hku-news/1/send' -ContentType 'application/json' -Body $body
```

安全与注意事项
- webhook 相当于密钥，勿提交到公共仓库或在公共聊天中分享。
- 如果 webhook 泄露，请在企业微信后台删除或重新生成 key。
- 若需发送图片或更复杂富媒体，机器人要求额外处理（图片需要上传并提供 md5/base64），如需我可继续实现。

如需我代为测试：请把 webhook 通过私密方式给我（或直接 POST 到 `/api/config/wechat/test`），我将帮你发一次验证消息并返回结果。

注意：如果你暂时找不到企业微信后台的真实 webhook，请在企业微信后台按前面步骤生成真实 webhook 并保存到本服务；占位 webhook 功能已移除以减少代码量。

关于爬虫与图片
- 当前 Scrapy 爬虫已支持图片下载：爬虫会把图片下载到 `Desktop/hku_news_data/images`，并在文章 JSON 的 `images` 字段里包含本地图片路径（相对于 images 存储）。
- 如果你仍看到旧格式的 JSON（只有图片 URL），说明你运行的是旧版爬虫，请按下面步骤更新并重新运行爬虫：
  1. 确认 `hku_scraper/settings.py` 中启用了 `ImagesPipeline` 并设置了 `IMAGES_STORE`（默认是 `Desktop/hku_news_data/images`）。
  2. 使用 `scrapy crawl hku_arts_news` 运行爬虫，或触发服务器上的 `POST /api/hku-scrape`。
  3. 成功后，文章 JSON 的 `images` 字段会包含下载后的本地文件路径，图片文件保存在 `Desktop/hku_news_data/images` 下。

如需我把图片直接嵌入到发送的微信消息（例如上传图片到企业微信并发送图片消息），我也可以继续实现该功能（需要对图片做 base64 编码并按企业微信机器人图片消息规范发送）。