# HKU Arts Scraper - Scrapy 爬虫

## 功能
- 监控香港大学文学院（https://arts.hku.hk/）最新动态
- 每 30 秒检测一次新闻更新
- 自动检测新增新闻并爬取详情页
- 保存文章文本和图片链接
- 维护新闻索引避免重复爬取

## 项目结构
```
hku_scraper/
├── __init__.py
├── settings.py                      # Scrapy 配置
├── spiders/
│   ├── __init__.py
│   ├── hku_arts_spider.py          # 文学院
│   ├── hku_business_spider.py      # 商学院
│   ├── hku_science_spider.py       # 理学院
│   └── hku_grad_spider.py          # 研究学院（News & Events）
hku_scraper_runner.py               # 定时运行器（30秒检测一次）
scrapy.cfg                           # Scrapy 配置文件
```

## 安装依赖
```bash
pip install scrapy selenium pillow
```

## 使用方式

### 方式1: 定时运行（推荐）
每 30 秒自动检测并爬取新闻：
```bash
python hku_scraper_runner.py
```

### 方式2: 单次运行爬虫
```bash
scrapy crawl hku_arts_news
```

## 数据存储
爬取结果保存在 `%USERPROFILE%/Desktop/hku_news_data/` 目录：
- `news_index.json` - 新闻索引（已爬取的 URL 列表）
- `1_article.json` - 第1篇文章详情
- `2_article.json` - 第2篇文章详情
- ...以此类推

每个文章文件包含：
- `title` - 文章标题
- `url` - 文章链接
- `text` - 文章文本内容
- `images` - 文章中的图片 URL 列表
- `scraped_at` - 爬取时间

## 与 Node.js 服务器集成
可通过 Node.js API 端点查询爬取结果：
- `GET /api/hku-news` - 获取最新爬取的新闻列表
- `GET /api/hku-news/:id` - 获取指定新闻详情
- `POST /api/hku-scrape` - 手动触发爬虫运行

## 日志输出示例
```
[2025-12-03 10:30:45,123] INFO: [HKU Arts Spider] 初始化完成
[2025-12-03 10:30:46,456] INFO: [Parse Main Page] 开始解析 HKU 主页
[2025-12-03 10:30:47,789] INFO: [News Found] 发现 12 条新闻项
[2025-12-03 10:30:48,012] INFO: [News Item 1] 新闻标题... | https://...
[2025-12-03 10:30:49,345] INFO: [Parsing Article] 新闻标题
[2025-12-03 10:30:50,678] INFO: ✓ 已保存: 1_article.json
```

## 性能优化
- 使用缓存避免重复请求
- 限制并发数为 4
- 请求间隔 2 秒
- 文章文本限制 5000 字符
- 图片限制 10 张

## 故障排查
1. **爬虫无法连接 HKU**: 检查网络连接和代理设置
2. **新闻列表为空**: 检查 CSS 选择器是否与当前网页结构匹配
3. **重复爬取**: 检查 `news_index.json` 文件是否正常保存

## 下一步扩展
- 添加代理池支持
- 集成动态渲染（Selenium/Playwright）处理 JavaScript 加载的内容
- 添加数据库存储替代 JSON 文件
- 支持多个学院爬虫并发
