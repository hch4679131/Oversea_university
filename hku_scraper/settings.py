"""
Scrapy settings for hku_scraper project
"""

BOT_NAME = 'hku_scraper'

SPIDER_MODULES = ['hku_scraper.spiders']
NEWSPIDER_MODULE = 'hku_scraper.spiders'

# Obey robots.txt rules
ROBOTSTXT_OBEY = False

# Configure maximum concurrent requests per domain
CONCURRENT_REQUESTS = 4

# Configure a delay for requests for the same website
DOWNLOAD_DELAY = 2

# The download delay setting will honor only one of:
CONCURRENT_REQUESTS_PER_DOMAIN = 4

# Disable cookies
COOKIES_ENABLED = True

# User agent
USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'

# Obey Allow/Disallow rules in robots.txt
ROBOTSTXT_OBEY = False

# Disable Telnet Console
TELNETCONSOLE_ENABLED = False

# Override the default request headers
DEFAULT_REQUEST_HEADERS = {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Accept-Encoding': 'gzip, deflate',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1'
}

# Configure item pipelines
import os
IMAGES_STORE = os.path.join(os.getenv('USERPROFILE') or os.getenv('HOME') or '.', 'Desktop', 'hku_news_data', 'images')

ITEM_PIPELINES = {
    'scrapy.pipelines.images.ImagesPipeline': 100,
    'hku_scraper.pipelines.SaveJsonPipeline': 200,
}

# Enable and configure HTTP caching
HTTPCACHE_ENABLED = True
HTTPCACHE_EXPIRATION_SECS = 3600
HTTPCACHE_DIR = 'httpcache'
