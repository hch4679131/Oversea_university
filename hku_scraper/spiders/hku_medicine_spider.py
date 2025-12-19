"""
HKU Medicine Faculty News Spider
监控香港大学医学院最新动态，检测新闻更新并抓取详情页内容（文字+图片）
"""

import scrapy
import json
from datetime import datetime
from pathlib import Path
from urllib.parse import urljoin


class HKUMedicineNewsSpider(scrapy.Spider):
    """HKU 医学院新闻爬虫"""
    
    name = 'hku_medicine_news'
    allowed_domains = ['med.hku.hk']
    start_urls = ['https://www.med.hku.hk/zh-hk/']
    
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
        
        self.news_index_file = self.data_dir / 'medicine_news_index.json'
        self.existing_news = self._load_existing_news()
        
        self.logger.info(f'[HKU Medicine Spider] 初始化完成，数据目录: {self.data_dir}')
    
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
        self.logger.info('[Parse News List Page] 开始解析 HKU Medicine 新闻列表')
        
        # 从 section 里的新闻列表中提取新闻项
        # primary-row: 主要新闻（1条）
        # secondary-row: 次要新闻（多条）
        primary_items = response.css('div.primary-row a.news-box')
        secondary_items = response.css('div.secondary-row a.normal-news-box-wrapper')
        
        news_items = primary_items + secondary_items
        self.logger.info(f'[News Found] 发现 {len(news_items)} 条新闻项')
        
        new_news_count = 0
        
        for idx, item in enumerate(news_items, 1):
            # 提取新闻链接
            news_link = item.css('::attr(href)').get()
            if not news_link:
                continue
            
            # 规范化链接（相对路径转为绝对路径）
            full_url = urljoin(response.url, news_link.strip())
            self.logger.info(f'[Debug] Raw link: {news_link}, Full URL: {full_url}')
            
            # 提取标题（从 h4.title 或 p.title）
            news_title = item.css('h4.title::text').get()
            if not news_title:
                news_title = item.css('p.title::text').get()
            news_title = news_title.strip() if news_title else '未命名'
            
            # 提取发布时间（从 p.date）
            pub_time = item.css('p.date::text').get()
            pub_time = pub_time.strip() if pub_time else '未知日期'
            
            # 提取描述（暂无）
            description = ''
            
            # 提取预览图片（从 img src）
            preview_img = item.css('img::attr(src)').get()
            preview_img = urljoin(response.url, preview_img.strip()) if preview_img else None
            
            self.logger.info(f'[News Item {idx}] {news_title[:50]}... | 时间: {pub_time}')
            
            news_key = full_url  # 以 URL 为唯一键
            
            # 检查是否已存在
            if news_key in self.existing_news:
                self.logger.info(f'  → 已存在，跳过')
                continue
            
            new_news_count += 1
            self.logger.info(f'  → 新增！准备爬取详情页...')
            
            # 发送请求爬取详情页
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
        """解析详情页，提取文本与图片"""
        title = response.meta['title']
        url = response.meta['url']
        pub_time = response.meta['pub_time']
        description = response.meta['description']
        preview_img = response.meta['preview_img']
        
        self.logger.info(f'[Parsing Article] {title}')
        
        # 提取正文（从 div.main-content 或类似的内容容器）
        content_container = response.css('div.main-content, div.content, article, div.post-content')
        
        if not content_container:
            self.logger.warning('[Parsing Article] 未找到正文容器，跳过')
            return
        
        # 提取文本内容
        text_nodes = content_container.xpath('.//text()[normalize-space()]').getall()
        article_text = ' '.join([t.strip() for t in text_nodes if t.strip()])
        
        # 提取图片
        images = content_container.css('img')
        image_urls = []
        for img in images:
            img_url = (
                img.css('::attr(data-src)').get()
                or img.css('::attr(src)').get()
            )
            if img_url and not img_url.strip().endswith('.svg'):
                image_urls.append(img_url.strip())
        
        image_urls = [urljoin(response.url, i) for i in image_urls]
        
        # 去重保持顺序
        seen = set()
        unique_images = []
        for img in image_urls:
            if img not in seen:
                seen.add(img)
                unique_images.append(img)
        image_urls = unique_images
        
        # 插入预览图
        if preview_img and preview_img not in image_urls:
            image_urls.insert(0, preview_img)
        
        self.logger.info(f'  文本长度: {len(article_text)} 字符 | 图片数量: {len(image_urls)}')
        
        # 构建爬虫项
        item = {
            'title': title,
            'url': url,
            'published': pub_time,
            'description': description,
            'text': article_text,
            'image_urls': image_urls[:10],
            'source': 'hku_medicine',
            'scraped_at': datetime.now().isoformat(),
            'status': 'completed'
        }
        
        # 保存到索引
        self.existing_news[item['url']] = {
            'title': item['title'],
            'scraped_at': item['scraped_at']
        }
        self._save_news_index()
        
        yield item
