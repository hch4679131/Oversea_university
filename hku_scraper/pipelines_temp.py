import json
import os
from pathlib import Path
import requests
import hashlib
import time

class SaveJsonPipeline:
    """Save item JSON after images are downloaded by ImagesPipeline.
    This pipeline expects item to contain fields: title, url, text, images (list from ImagesPipeline), scraped_at
    It will save a file like `N_article.json` into Desktop/hku_news_data and update news_index.json.
    """

    def open_spider(self, spider):
        self.data_dir = Path(os.getenv('USERPROFILE') or os.getenv('HOME') or '.') / 'Desktop' / 'hku_news_data'
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.index_file = self.data_dir / 'news_index.json'
        # load index
        if self.index_file.exists():
            try:
                with open(self.index_file, 'r', encoding='utf-8') as f:
                    self.index = json.load(f)
            except Exception:
                self.index = {}
        else:
            self.index = {}

    def process_item(self, item, spider):
        # images field from ImagesPipeline contains dicts with 'path'
        images_meta = item.get('images', [])
        local_image_paths = []
        for im in images_meta:
            # path is relative to IMAGES_STORE
            if 'path' in im:
                local_image_paths.append(str(Path(im['path']).as_posix()))

        out = {
            'title': item.get('title'),
            'url': item.get('url'),
            'text': item.get('text'),
            'images': local_image_paths,
            'scraped_at': item.get('scraped_at'),
            'status': item.get('status', 'completed')
        }

        # generate filename index
        idx = len(self.index) + 1
        filename = f"{idx}_article.json"
        outfile = self.data_dir / filename
        with open(outfile, 'w', encoding='utf-8') as f:
            json.dump(out, f, ensure_ascii=False, indent=2)

        # update index (keyed by url)
        url = item.get('url')
        self.index[url] = {
            'title': item.get('title'),
            'file': filename,
            'scraped_at': item.get('scraped_at')
        }
        with open(self.index_file, 'w', encoding='utf-8') as f:
            json.dump(self.index, f, ensure_ascii=False, indent=2)

        spider.logger.info(f'[SaveJsonPipeline] saved {outfile}')
        
        # 发送到企业微信
        self.send_to_wechat(out, spider)
        
        return item
    
    def send_to_wechat(self, article_data, spider):
        """发送文章到企业微信机器人"""
        try:
            # 读取 webhook 配置
            webhook_url = None
            config_file = Path(__file__).parent.parent / 'config' / 'wechat.json'
            if config_file.exists():
                with open(config_file, 'r', encoding='utf-8') as f:
                    cfg = json.load(f)
                    webhook_url = cfg.get('webhookUrl')
            
            if not webhook_url:
                webhook_url = os.getenv('WECHAT_WEBHOOK')
            
            if not webhook_url:
                spider.logger.info('[WeChat] 未配置 webhook，跳过发送')
                return
            
            # 构建文本消息
            title = article_data.get('title', '（无标题）')
            text = article_data.get('text', '')
            url = article_data.get('url', '')
            scraped_at = article_data.get('scraped_at', '')
            
            # 企业微信 markdown 消息长度限制是 4096 字节（不是字符！）
            plain_text = text.replace('\n', ' ').strip()
            
            # 构建 markdown 模板（不含正文）
            md_template_prefix = f"**{title}**\n\n"
            md_template_suffix = f"\n\n[阅读原文]({url})\n\n_抓取时间: {scraped_at}_"
            
            # 先构建完整消息，检查字节数
            full_content = md_template_prefix + plain_text + md_template_suffix
            full_bytes = len(full_content.encode('utf-8'))
            
            # 企业微信限制 4096 字节，需要分段发送长文本
            # 模板（标题+链接+时间）字节数
            template_bytes = len((md_template_prefix + md_template_suffix).encode('utf-8'))
            # 每段可用于正文的字节数（安全目标 3950 字节）
            max_segment_bytes = 3950
            available_bytes_per_segment = max_segment_bytes - template_bytes
            
