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


def run_spider(spider_name):
    """运行单个 Scrapy 爬虫"""
    logger.info(f'[Spider Start] 启动爬虫: {spider_name}')
    
    try:
        cmd = [
            sys.executable, '-m', 'scrapy.cmdline', 'crawl', spider_name,
            '--loglevel=INFO'
        ]
        
        result = subprocess.run(cmd, cwd=Path(__file__).parent)
        
        if result.returncode == 0:
            logger.info(f'[Spider Success] {spider_name} 运行完成')
        else:
            logger.error(f'[Spider Error] {spider_name} 运行失败 (code: {result.returncode})')
            
    except Exception as e:
        logger.error(f'[Spider Exception] {spider_name}: {e}')


def main():
    """主函数：定时运行所有爬虫"""
    logger.info('[HKU Scraper Runner] 启动...')
    logger.info('[Config] 检测间隔: 60分钟')
    logger.info('[Spiders] hku_arts_news, hku_science_news, hku_business_news, hku_grad_news, hku_architecture_news')
    
    spiders = ['hku_arts_news', 'hku_science_news', 'hku_business_news', 'hku_grad_news', 'hku_architecture_news']  # 要运行的所有爬虫
    interval = 60 * 60  # 60分钟 = 3600秒
    
    try:
        while True:
            logger.info('=' * 60)
            logger.info(f'[Cycle Start] 开始爬虫任务 ({datetime.now().strftime("%Y-%m-%d %H:%M:%S")})')
            logger.info('=' * 60)
            
            # 依次运行所有爬虫
            for spider in spiders:
                run_spider(spider)
            
            logger.info('=' * 60)
            logger.info(f'[Cycle Complete] 本轮任务完成，等待 {interval // 60} 分钟后下次检测...')
            logger.info('=' * 60 + '\n')
            time.sleep(interval)
            
    except KeyboardInterrupt:
        logger.info('[Shutdown] 爬虫已停止')
        sys.exit(0)


if __name__ == '__main__':
    main()
