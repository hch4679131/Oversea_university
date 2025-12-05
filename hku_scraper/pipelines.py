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
            # 每段最大字节数（接近限制值，最大化利用空间）
            max_segment_bytes = 4050
            
            if full_bytes > 4050:
                # 需要分段发送
                segments = []
                remaining_text = plain_text
                segment_num = 1
                
                while remaining_text:
                    # 计算当前段的头部字节数（第一段用标题模板，续段用"续N"格式）
                    if segment_num == 1:
                        segment_header = md_template_prefix
                    else:
                        segment_header = f"**{title}（续{segment_num}）**\n\n"
                    
                    # 直接基于字节硬截断，不用字符估算
                    header_bytes = len(segment_header.encode('utf-8'))
                    suffix_continue = "\n\n_（内容较长，续见下条）_"
                    suffix_continue_bytes = len(suffix_continue.encode('utf-8'))
                    suffix_final_bytes = len(md_template_suffix.encode('utf-8'))
                    
                    # 先假设用续段后缀，计算可用字节
                    available_bytes = max_segment_bytes - header_bytes - suffix_continue_bytes
                    
                    # 从剩余文本开始，逐字节截取直到不超限
                    low, high = 0, len(remaining_text)
                    best_chars = 0
                    
                    # 二分查找最大可容纳字符数
                    while low <= high:
                        mid = (low + high) // 2
                        test_segment = remaining_text[:mid]
                        test_bytes = len(test_segment.encode('utf-8'))
                        
                        if test_bytes <= available_bytes:
                            best_chars = mid
                            low = mid + 1
                        else:
                            high = mid - 1
                    
                    segment_text = remaining_text[:best_chars]
                    
                    # 判断是否是最后一段
                    remaining_after = remaining_text[best_chars:].strip()
                    is_last = len(remaining_after) < 100
                    
                    # 如果是最后一段，用完整后缀并重新验证
                    if is_last:
                        full_segment = segment_header + segment_text + md_template_suffix
                        if len(full_segment.encode('utf-8')) > max_segment_bytes:
                            # 最后一段超限，重新计算
                            available_bytes_final = max_segment_bytes - header_bytes - suffix_final_bytes
                            low, high = 0, len(remaining_text)
                            best_chars = 0
                            while low <= high:
                                mid = (low + high) // 2
                                test_segment = remaining_text[:mid]
                                if len(test_segment.encode('utf-8')) <= available_bytes_final:
                                    best_chars = mid
                                    low = mid + 1
                                else:
                                    high = mid - 1
                            segment_text = remaining_text[:best_chars]
                        segment_md = segment_header + segment_text + md_template_suffix
                    else:
                        segment_md = segment_header + segment_text + suffix_continue
                    
                    test_bytes = len(segment_md.encode('utf-8'))
                    
                    segments.append((segment_md, test_bytes, len(segment_text)))
                    remaining_text = remaining_text[len(segment_text):].strip()
                    segment_num += 1
                
                spider.logger.info(f'[WeChat] 文章过长，分{len(segments)}段发送: 原文{full_bytes}字节')
                for idx, (segment_md, segment_bytes, segment_chars) in enumerate(segments, 1):
                    payload = {'msgtype': 'markdown', 'markdown': {'content': segment_md}}
                    resp = requests.post(webhook_url, json=payload, timeout=10)
                    spider.logger.info(f'[WeChat] 已发送第{idx}/{len(segments)}段: {segment_bytes}字节 ({segment_chars}字符) - {resp.json()}')
                    if idx < len(segments):
                        time.sleep(0.5)
            else:
                spider.logger.info(f'[WeChat] 文章长度适中: {len(plain_text)}字符, {full_bytes}字节，单条发送')
                payload = {'msgtype': 'markdown', 'markdown': {'content': full_content}}
                resp = requests.post(webhook_url, json=payload, timeout=10)
                spider.logger.info(f'[WeChat] 已发送文本消息: {resp.json()}')
            
            spider.logger.info(f'[WeChat] 已发送文本消息: {resp.json()}')
            
            # 发送图片
            images = article_data.get('images', [])
            if images:
                images_dir = self.data_dir / 'images'
                for img_rel_path in images:
                    img_path = images_dir / img_rel_path
                    if img_path.exists():
                        try:
                            with open(img_path, 'rb') as f:
                                img_data = f.read()
                            
                            import base64
                            b64 = base64.b64encode(img_data).decode('utf-8')
                            md5 = hashlib.md5(img_data).hexdigest()
                            
                            img_payload = {
                                'msgtype': 'image',
                                'image': {'base64': b64, 'md5': md5}
                            }
                            
                            img_resp = requests.post(webhook_url, json=img_payload, timeout=10)
                            spider.logger.info(f'[WeChat] 已发送图片: {img_rel_path} - {img_resp.json()}')
                        except Exception as e:
                            spider.logger.error(f'[WeChat] 发送图片失败 {img_rel_path}: {e}')
        except Exception as e:
            spider.logger.error(f'[WeChat] 发送失败: {e}')
