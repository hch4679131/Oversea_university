# Scrapy settings for hku_scraper project
BOT_NAME = 'hku_scraper'
SPIDER_MODULES = ['hku_scraper.spiders']
NEWSPIDER_MODULE = 'hku_scraper.spiders'

# 数据保存目录（Linux 路径）
DATA_DIR = '/root/hku_news_data'

# Obey robots.txt rules
ROBOTSTXT_OBEY = False

# Configure item pipelines
ITEM_PIPELINES = {
    'hku_scraper.pipelines.SaveJsonPipeline': 300,
}

# Set settings whose default value is deprecated to a future-proof value
REQUEST_FINGERPRINTER_IMPLEMENTATION = '2.7'
TWISTED_REACTOR = 'twisted.internet.asyncioreactor.AsyncioSelectorReactor'
