"""
HKU Architecture School News Spider
监控香港大学建筑学院新闻列表，抓取详情页文本与图片。
"""

import scrapy
import json
from datetime import datetime
from pathlib import Path
from urllib.parse import urljoin


class HKUArchitectureNewsSpider(scrapy.Spider):
    """HKU 建筑学院新闻爬虫"""

    name = 'hku_architecture_news'
    allowed_domains = ['arch.hku.hk']
    start_urls = ['https://www.arch.hku.hk/about/news/']

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
        self.news_index_file = self.data_dir / 'architecture_news_index.json'
        self.existing_news = self._load_existing_news()
        self.logger.info(f'[HKU Architecture Spider] 初始化完成，数据目录: {self.data_dir}')

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
        """解析建筑学院新闻列表（只取 #events-wrapper 内的条目）"""
        self.logger.info('[Parse List] 开始解析 HKU Architecture 新闻列表')

        # 仅抓取 events-wrapper 下的条目，避免导航/分类区块
        news_items = response.css('#events-wrapper div.eventItem')

        self.logger.info(f'[News Found] 发现 {len(news_items)} 条新闻项')

        new_news_count = 0

        for idx, item in enumerate(news_items):
            # 链接：仅取包含标题 div.title 的 a；或标题下的 a；或显式指向 /about/news/ 的 a
            link = (
                item.xpath('(.//div[contains(@class, "title")]/a/@href | .//a[div[contains(@class, "title")]]/@href | .//a[contains(@href, "/about/news/")]/@href)[1]').get()
                or item.css('a::attr(href)').get()
            )
            if not link:
                continue

            full_url = urljoin(response.url, link.strip())

            # 仅保留 /about/news/ 详情页链接；并过滤分页、分类等
            if '/about/news/' not in full_url:
                continue
            if any(x in full_url for x in ['?cat=', '?page=', '/page/', '/category/', '/tag/']):
                continue

            news_key = full_url

            # 标题：eventItem 中的 div.title 文本优先
            title = (
                item.css('a div.title::text').get()
                or item.css('h2 a::text, h3 a::text, .title a::text').get()
                or item.css('a::text').get()
            )
            title = title.strip() if title else '未命名'

            # 日期：eventItem 的 div.postdate 优先
            pub_time = (
                item.css('div.postdate::text').get()
                or item.css('time::text, span.date::text, div.date::text, .published::text').get()
            )
            pub_time = pub_time.strip() if pub_time else '未知日期'

            # 摘要
            description = item.css('p::text, .excerpt::text, .summary::text').get()
            description = description.strip() if description else ''

            # 预览图：eventItem 的 thumbimg 优先
            preview_img = (
                item.css('img.thumbimg::attr(src)').get()
                or item.css('img::attr(data-src), img::attr(data-original), img::attr(src)').get()
            )
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

        # 1) 优先选择页面主内容块：innerContent（该站正文所在）
        content_container = response.xpath("//div[contains(@class, 'innerContent')]")
        # 2) 次选通用正文容器
        if not content_container:
            content_container = response.css(
                'div.entry-content, div.post-content, div.postcontent, div.article-content, div.content-area, div.content'
            )
        # 3) 以标题为锚点查找最近的 innerContent 或 content 容器
        if not content_container:
            title_text = title.strip()
            title_node = response.xpath("//h1[contains(@class,'pageTitle')] | //h1 | //h2")
            target = None
            if title_node:
                sib_inner = title_node.xpath("following::div[contains(@class,'innerContent')][1]")
                if sib_inner:
                    target = sib_inner[0]
                else:
                    sib_content = title_node.xpath(
                        "following::*[(self::div or self::section or self::article) and (contains(@class,'content') or contains(@class,'entry') or contains(@class,'post'))][1]"
                    )
                    if sib_content:
                        target = sib_content[0]
                if not target:
                    anc = title_node.xpath(
                        "ancestor::*[(self::article or self::div) and (contains(@class,'content') or contains(@class,'entry') or contains(@class,'post'))][1]"
                    )
                    if anc:
                        target = anc[0]
            if target is not None:
                content_container = target

        if not content_container:
            self.logger.warning('[Parsing Article] 未找到正文容器，跳过')
            return

        # 如果 content_container 不是 innerContent，则尽量缩小到其子级 innerContent
        inner = content_container.xpath('.//div[contains(@class, "innerContent")]')
        if inner:
            content_container = inner[0]

        # 仅提取正文常见标签文本，过滤掉面包屑、筛选器、上一页等
        text_nodes = content_container.xpath(
            './/p//text() | .//h2//text() | .//h3//text() | .//li//text() | .//br/preceding-sibling::text()'
        ).getall()

        article_text = ' '.join([t.strip() for t in text_nodes if t and t.strip()])

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
            'source': 'hku_architecture',
            'scraped_at': datetime.now().isoformat(),
            'status': 'completed'
        }

        self.existing_news[item['url']] = {
            'title': item['title'],
            'scraped_at': item['scraped_at']
        }
        self._save_news_index()

        yield item
