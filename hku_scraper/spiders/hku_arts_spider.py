"""
HKU Arts Faculty News Spider
监控香港大学文学院最新动态，检测新闻更新并抓取详情页内容（文字+图片）
"""

import scrapy
import json
import os
from datetime import datetime
from pathlib import Path
from urllib.parse import urljoin


class HKUArtsNewsSpider(scrapy.Spider):
    """HKU 文学院新闻爬虫"""
    
    name = 'hku_arts_news'
    allowed_domains = ['arts.hku.hk']
    start_urls = ['https://arts.hku.hk/']
    
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
        
        self.news_index_file = self.data_dir / 'news_index.json'
        self.existing_news = self._load_existing_news()
        
        self.logger.info(f'[HKU Arts Spider] 初始化完成，数据目录: {self.data_dir}')
    
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
        """解析主页，提取新闻列表"""
        self.logger.info('[Parse Main Page] 开始解析 HKU 主页')
        
        # 查找 News 区块中的新闻列表
        news_items = response.css('div.inner-box ul.news li')
        self.logger.info(f'[News Found] 发现 {len(news_items)} 条新闻项')
        
        new_news_count = 0
        
        for idx, item in enumerate(news_items):
            # 提取新闻链接和标题123
            news_link = item.css('a::attr(href)').get()
            news_title = item.css('a::text').get()
            
            if not news_link or not news_title:
                continue
            
            # 规范化链接
            full_url = urljoin(response.url, news_link.strip())
            news_key = full_url  # 以 URL 为唯一键
            news_title = news_title.strip()
            
            self.logger.info(f'[News Item {idx+1}] {news_title[:50]}... | {full_url}')
            
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
                meta={'title': news_title, 'url': full_url}
            )
        
        self.logger.info(f'[Summary] 发现 {new_news_count} 条新增新闻')
    
    def parse_article(self, response):
        """解析文章详情页，抓取文字和图片"""
        title = response.meta['title']
        url = response.meta['url']
        
        self.logger.info(f'[Parsing Article] {title}')
        
        # 抓取文章主体内容
        article_body = response.css('div.content-container div.content, div.article-content, main, article').get()
        if not article_body:
            article_body = response.css('body').get()
        
        # 提取所有文本
        article_text = ' '.join(response.css('div.content-container ::text').getall()).strip()
        article_text = ' '.join(article_text.split())  # 清理多余空格
        
        # 提取所有图片链接
        image_urls = response.css('div.content-container img::attr(src), div.content-container img::attr(data-src)').getall()
        image_urls = [urljoin(response.url, img.strip()) for img in image_urls if img]
        
        self.logger.info(f'  文本长度: {len(article_text)} 字符')
        self.logger.info(f'  图片数量: {len(image_urls)}')
        
        # 构造 item 并交给 pipeline（ImagesPipeline + SaveJsonPipeline）处理
        item = {
            'title': title,
            'url': url,
            'text': article_text[:5000],  # 限制文本长度
            'image_urls': image_urls[:10],    # Scrapy ImagesPipeline 使用字段名 image_urls
            'scraped_at': datetime.now().isoformat(),
            'status': 'completed'
        }

        yield item
