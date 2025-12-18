"""
HKU Graduate School News & Events Spider
监控香港大学研究学院新闻/活动列表，抓取详情页文本与图片。
"""

import scrapy
import json
from datetime import datetime
from pathlib import Path
from urllib.parse import urljoin


class HKUGradNewsSpider(scrapy.Spider):
    """HKU 研究学院新闻爬虫"""

    name = 'hku_grad_news'
    allowed_domains = ['gradsch.hku.hk']
    start_urls = ['https://gradsch.hku.hk/news_and_events/news_and_future_events']

    custom_settings = {
        'USER_AGENT': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'ROBOTSTXT_OBEY': False,
        'CONCURRENT_REQUESTS': 4,
        'DOWNLOAD_DELAY': 2,
        'COOKIES_ENABLED': True,
    }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.data_dir = Path('/root/hku_news_data')
        self.data_dir.mkdir(exist_ok=True)
        self.news_index_file = self.data_dir / 'grad_news_index.json'
        self.existing_news = self._load_existing_news()
        self.logger.info(f'[HKU Grad Spider] 初始化完成，数据目录: {self.data_dir}')

    def _load_existing_news(self):
        if self.news_index_file.exists():
            try:
                with open(self.news_index_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception:
                return {}
        return {}

    def _save_news_index(self):
        with open(self.news_index_file, 'w', encoding='utf-8') as f:
            json.dump(self.existing_news, f, ensure_ascii=False, indent=2)

    def parse(self, response):
        """解析研究学院新闻/活动列表"""
        self.logger.info('[Parse List] 开始解析 HKU Grad 新闻列表')

        # 尽量兼容多种结构：views-row / news-item / article
        news_items = response.css('div.views-row, li.news-item, div.news-item, article')
        self.logger.info(f'[News Found] 发现 {len(news_items)} 条新闻项')

        new_news_count = 0

        for idx, item in enumerate(news_items):
            link = item.css('a::attr(href)').get()
            if not link:
                continue

            full_url = urljoin(response.url, link.strip())
            news_key = full_url

            title = item.css('h3 a::text, h2 a::text, a::text').get()
            title = title.strip() if title else '未命名'

            pub_time = item.css('time::text, span.date::text, div.date::text').get()
            pub_time = pub_time.strip() if pub_time else '未知日期'

            description = item.css('p::text').get()
            description = description.strip() if description else ''

            preview_img = item.css('img::attr(data-src), img::attr(data-original), img::attr(src)').get()
            preview_img = urljoin(response.url, preview_img.strip()) if preview_img else None

            self.logger.info(f'[News Item {idx+1}] {title[:50]}... | {pub_time}')

            if news_key in self.existing_news:
                self.logger.info('  → 已存在，跳过')
                continue

            new_news_count += 1
            self.logger.info('  → 新增！准备爬取详情页...')

            yield scrapy.Request(
                full_url,
                callback=self.parse_article,
                meta={
                    'title': title,
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

        # 兼容多种正文容器
        content_container = response.css(
            'div.region-content, div.node-content, article, main, div.page-content, div.content'
        )
        if not content_container:
            content_container = response.css('body')

        article_text = ' '.join(content_container.css('::text').getall())
        article_text = ' '.join(article_text.split())

        images = content_container.css('img')
        image_urls = []
        for img in images:
            img_url = (
                img.css('::attr(data-src)').get()
                or img.css('::attr(data-original)').get()
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

        if preview_img and preview_img not in image_urls:
            image_urls.insert(0, preview_img)

        self.logger.info(f'  文本长度: {len(article_text)} 字符 | 图片数量: {len(image_urls)}')

        item = {
            'title': title,
            'url': url,
            'published': pub_time,
            'description': description,
            'text': article_text,
            'image_urls': image_urls[:10],
            'source': 'hku_grad',
            'scraped_at': datetime.now().isoformat(),
            'status': 'completed'
        }

        self.existing_news[item['url']] = {
            'title': item['title'],
            'scraped_at': item['scraped_at']
        }
        self._save_news_index()

        yield item