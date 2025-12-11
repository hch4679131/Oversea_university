"""
HKU Business School News Spider
监控香港大学商学院最新动态，检测新闻更新并抓取详情页内容（文字+图片）
"""

import scrapy
import json
import os
from datetime import datetime
from pathlib import Path
from urllib.parse import urljoin


class HKUBusinessNewsSpider(scrapy.Spider):
    """HKU 商学院新闻爬虫"""
    
    name = 'hku_business_news'
    allowed_domains = ['hkubs.hku.hk']
    start_urls = ['https://www.hkubs.hku.hk/tc/media/school-news/']
    
    # 爬虫配置
    custom_settings = {
        'USER_AGENT': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'ROBOTSTXT_OBEY': False,
        'CONCURRENT_REQUESTS': 4,
        'DOWNLOAD_DELAY': 2,
        'COOKIES_ENABLED': True,
    }
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # 初始化数据存储路径
        self.data_dir = Path('/root/hku_news_data')
        self.data_dir.mkdir(exist_ok=True)
        
        self.news_index_file = self.data_dir / 'business_news_index.json'
        self.existing_news = self._load_existing_news()
        
        self.logger.info(f'[HKU Business Spider] 初始化完成，数据目录: {self.data_dir}')
    
    def _load_existing_news(self):
        """加载已抓取的新闻索引"""
        if self.news_index_file.exists():
            try:
                with open(self.news_index_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except:
                return {}
        return {}
    
    def _save_news_index(self):
        """保存新闻索引"""
        with open(self.news_index_file, 'w', encoding='utf-8') as f:
            json.dump(self.existing_news, f, ensure_ascii=False, indent=2)
    
    def parse(self, response):
        """解析新闻列表页，提取新闻项"""
        self.logger.info('[Parse News List Page] 开始解析 HKU Business 新闻列表')
        
        # 根据提供的 HTML 结构，新闻项在 div.wgl_col-12.item 内
        news_items = response.css('div.wgl_col-12.item')
        self.logger.info(f'[News Found] 发现 {len(news_items)} 条新闻项')
        
        new_news_count = 0
        
        for idx, item in enumerate(news_items):
            # 提取新闻链接（优先使用图片链接，其次使用标题链接）
            news_link = item.css('a.blog-post_feature-link::attr(href)').get()
            if not news_link:
                news_link = item.css('div.blog-post_title a::attr(href)').get()
            
            if not news_link:
                continue
            
            # 规范化链接
            full_url = urljoin(response.url, news_link.strip())
            news_key = full_url
            
            # 提取标题
            news_title = item.css('div.blog-post_title a::text').get()
            news_title = news_title.strip() if news_title else '未命名'
            
            # 提取日期（从 span.post_date）
            date_day = item.css('span.post_date span::text').get()
            date_month = item.css('span.post_date span:nth-child(1)::text').getall()
            # 简单处理日期：从 post_date 中提取"17 Nov"等格式
            pub_time = item.css('span.post_date::text').get()
            pub_time = pub_time.strip() if pub_time else '未知日期'
            
            # 提取描述
            description = item.css('div.article-content::text').get()
            description = description.strip() if description else ''
            
            # 提取预览图片（支持 src 和 data-src）
            preview_img = item.css('img::attr(src)').get() or item.css('img::attr(data-src)').get()
            preview_img = urljoin(response.url, preview_img.strip()) if preview_img else None
            
            self.logger.info(f'[News Item {idx+1}] {news_title[:50]}... | 时间: {pub_time}')
            
            # 检查是否已抓取过
            if news_key in self.existing_news:
                self.logger.info(f'  → 已存在，跳过')
                continue
            
            # 新闻未抓取，标记为新增并爬取详情页
            self.logger.info(f'  → 新增！准备爬取详情页...')
            new_news_count += 1
            
            # 爬取详情页
            yield scrapy.Request(
                full_url,
                callback=self.parse_article,
                meta={
                    'title': news_title,
                    'url': full_url,
                    'pub_time': pub_time,
                    'description': description,
                    'preview_img': preview_img
                }
            )
        
        self.logger.info(f'[Summary] 发现 {new_news_count} 条新增新闻')
    
    def parse_article(self, response):
        """解析文章详情页，抓取完整内容和所有图片"""
        title = response.meta['title']
        url = response.meta['url']
        pub_time = response.meta['pub_time']
        description = response.meta['description']
        preview_img = response.meta['preview_img']
        
        self.logger.info(f'[Parsing Article] {title}')
        
        # 只抓取 article.blog-post-single-item 内的正文内容（排除广告等）
        content_container = response.css('article.blog-post-single-item')
        
        if not content_container:
            self.logger.warning(f'  未找到内容容器，使用全文')
            content_container = response.css('body')
        
        # 提取所有文本（只从容器内提取）
        article_text = ' '.join(content_container.css('::text').getall())
        article_text = ' '.join(article_text.split())  # 清理多余空格
        
        # 提取所有图片链接（从 photo-gallary-item 或 article-content 中）
        # 优先使用高分辨率 data-src，其次使用 src
        images = content_container.css('img')
        image_urls = []
        
        for img in images:
            # 优先取 data-src（懒加载的高分辨率），否则取 src
            img_url = img.css('::attr(data-src)').get() or img.css('::attr(src)').get()
            if img_url and not img_url.strip().endswith('.svg'):
                image_urls.append(img_url.strip())
        
        # 转换为绝对路径
        image_urls = [urljoin(response.url, img) for img in image_urls]
        
        # 去重并保持顺序
        seen = set()
        unique_images = []
        for img in image_urls:
            if img not in seen:
                seen.add(img)
                unique_images.append(img)
        image_urls = unique_images
        
        self.logger.info(f'  文本长度: {len(article_text)} 字符')
        self.logger.info(f'  图片数量: {len(image_urls)}')
        
        # 如果预览图不在列表中，加入
        if preview_img and preview_img not in image_urls:
            image_urls.insert(0, preview_img)
        
        # 构造 item 并交给 pipeline（ImagesPipeline + SaveJsonPipeline）处理
        item = {
            'title': title,
            'url': url,
            'published': pub_time,
            'description': description,
            'text': article_text[:5000],  # 限制文本长度
            'image_urls': image_urls[:10],  # Scrapy ImagesPipeline 使用字段名 image_urls
            'source': 'hku_business',  # 标识来源
            'scraped_at': datetime.now().isoformat(),
            'status': 'completed'
        }
        
        # 记录新闻到索引
        self.existing_news[item['url']] = {
            'title': item['title'],
            'scraped_at': item['scraped_at']
        }
        self._save_news_index()

        yield item
