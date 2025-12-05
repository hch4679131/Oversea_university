"""
HKU 爬虫定时运行器
每 60 分钟检测一次 HKU 文学院新闻，有更新则爬取
"""

import time
import subprocess
import sys
import logging
from pathlib import Path
from datetime import datetime

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] %(levelname)s: %(message)s'
)
logger = logging.getLogger(__name__)


def run_spider():
    """运行 Scrapy 爬虫"""
    logger.info('=' * 60)
    logger.info(f'[Spider Run] 开始爬虫任务 ({datetime.now().strftime("%Y-%m-%d %H:%M:%S")})')
    logger.info('=' * 60)
    
    try:
        # 运行 Scrapy 爬虫
        # Run scrapy crawl for the spider name. No need to pass start_urls as spider defines it.
        cmd = [
            sys.executable, '-m', 'scrapy.cmdline', 'crawl', 'hku_arts_news',
            '--loglevel=INFO'
        ]
        
        result = subprocess.run(cmd, cwd=Path(__file__).parent)
        
        if result.returncode == 0:
            logger.info('[Spider Success] 爬虫运行完成')
        else:
            logger.error(f'[Spider Error] 爬虫运行失败 (code: {result.returncode})')
            
    except Exception as e:
        logger.error(f'[Spider Exception] {e}')


def main():
    """主函数：定时运行爬虫"""
    logger.info('[HKU Arts Scraper Runner] 启动...')
    logger.info('[Config] 检测间隔: 60分钟')
    
    interval = 60 * 60  # 60分钟 = 3600秒
    
    try:
        while True:
            run_spider()
            
            logger.info(f'[Wait] 等待 {interval // 60} 分钟后下次检测...\n')
            time.sleep(interval)
            
    except KeyboardInterrupt:
        logger.info('[Shutdown] 爬虫已停止')
        sys.exit(0)


if __name__ == '__main__':
    main()
