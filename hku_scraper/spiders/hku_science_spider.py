"""
HKU Science Faculty News Spider
监控香港大学理学院最新动态，检测新闻更新并抓取详情页内容（文字+图片）
"""

import scrapy
import json
import os
from datetime import datetime
from pathlib import Path
from urllib.parse import urljoin


class HKUScienceNewsSpider(scrapy.Spider):
    """HKU 理学院新闻爬虫"""
    
    name = 'hku_science_news'
    allowed_domains = ['scifac.hku.hk']
    start_urls = ['https://www.scifac.hku.hk/news']
    
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
        
        self.news_index_file = self.data_dir / 'science_news_index.json'
        self.existing_news = self._load_existing_news()
        
        self.logger.info(f'[HKU Science Spider] 初始化完成，数据目录: {self.data_dir}')
    
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
        self.logger.info('[Parse News List Page] 开始解析 HKU Science 新闻列表')
        
        # 根据提供的 HTML 结构，新闻项在 div.story 内
        # 主要新闻项: div.story__main > a.story__item--main
        # 子新闻项: div.story__sub > a.story__item--sub
        news_items = response.css('div.story a.story__item')
        self.logger.info(f'[News Found] 发现 {len(news_items)} 条新闻项')
        
        new_news_count = 0
        
        for idx, item in enumerate(news_items):
            # 提取新闻链接
            news_link = item.css('::attr(href)').get()
            if not news_link:
                continue
            
            # 规范化链接（相对路径转为绝对路径）
            full_url = urljoin(response.url, news_link.strip())
            
            # 提取标题（从 h2.story__title）
            news_title = item.css('h2.story__title::attr(title)').get()
            if not news_title:
                news_title = item.css('h2.story__title::text').get()
            news_title = news_title.strip() if news_title else '未命名'
            
            # 提取发布时间（从 time.story__time）
            pub_time = item.css('time.story__time::text').get()
            pub_time = pub_time.strip() if pub_time else '未知日期'
            
            # 提取描述（从 p.story__desc）
            description = item.css('p.story__desc::attr(title)').get()
            if not description:
                description = item.css('p.story__desc::text').get()
            description = description.strip() if description else ''
            
            # 提取预览图片
            preview_img = item.css('div.story__img-c img::attr(src)').get()
            preview_img = urljoin(response.url, preview_img.strip()) if preview_img else None
            
            self.logger.info(f'[News Item {idx+1}] {news_title[:50]}... | 时间: {pub_time}')
            
            news_key = full_url  # 以 URL 为唯一键
            
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
        
        # 检查是否有分页（可选，如有需要后续添加）
        # next_page = response.css('a.next::attr(href)').get()
        # if next_page:
        #     yield scrapy.Request(urljoin(response.url, next_page), self.parse)
    
    def parse_article(self, response):
        """解析文章详情页，抓取完整内容和所有图片"""
        title = response.meta['title']
        url = response.meta['url']
        pub_time = response.meta['pub_time']
        description = response.meta['description']
        preview_img = response.meta['preview_img']
        
        self.logger.info(f'[Parsing Article] {title}')
        
        # 只抓取 div.container 内的正文内容（排除广告等）
        # 优先使用 div.pressd__content（正文区域），fallback 到 div.container
        content_container = response.css('div.pressd__content, div.container')
        
        if not content_container:
            self.logger.warning(f'  未找到内容容器，使用全文')
            content_container = response.css('body')
        
        # 提取所有文本（只从容器内提取）
        article_text = ' '.join(content_container.css('::text').getall())
        article_text = ' '.join(article_text.split())  # 清理多余空格
        
        # 提取所有图片链接（优先使用高分辨率原图 data-img-ori，其次使用 src）
        # 先取 data-img-ori（高分辨率），如果没有则用 src
        images = content_container.css('img')
        image_urls = []
        
        for img in images:
            # 优先取 data-img-ori（原始高分辨率），否则取 src
            img_url = img.css('::attr(data-img-ori)').get() or img.css('::attr(src)').get()
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
            'source': 'hku_science',  # 标识来源
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
