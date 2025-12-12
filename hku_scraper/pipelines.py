import base64
import hashlib
import json
import os
import time
from datetime import datetime
from pathlib import Path

import requests


class SaveJsonPipeline:
    """保存文章 JSON，翻译摘要后发送到企业微信。"""

    def open_spider(self, spider):
        # 统一数据目录，与爬虫保持一致，避免索引不一致导致重复发送
        # 优先使用服务器目录 /root/hku_news_data；本地环境则回退到 Desktop/hku_news_data
        server_dir = Path('/root/hku_news_data')
        if server_dir.exists() or os.getenv('SERVER_ENV') == '1':
            self.data_dir = server_dir
            self.data_dir.mkdir(parents=True, exist_ok=True)
        else:
            self.data_dir = (
                Path(os.getenv("USERPROFILE") or os.getenv("HOME") or ".")
                / "Desktop"
                / "hku_news_data"
            )
            self.data_dir.mkdir(parents=True, exist_ok=True)
        
        # 根据爬虫名使用不同的索引文件
        spider_name = spider.name
        if spider_name == "hku_science_news":
            self.index_file = self.data_dir / "science_news_index.json"
        elif spider_name == "hku_business_news":
            self.index_file = self.data_dir / "business_news_index.json"
        else:  # hku_arts_news 或其他
            self.index_file = self.data_dir / "news_index.json"
        
        if self.index_file.exists():
            try:
                with open(self.index_file, "r", encoding="utf-8") as f:
                    self.index = json.load(f)
            except Exception:
                self.index = {}
        else:
            self.index = {}

    def process_item(self, item, spider):
        # 提取图片路径
        images_meta = item.get("images", [])
        local_image_paths = []
        for im in images_meta:
            if "path" in im:
                local_image_paths.append(str(Path(im["path"]).as_posix()))

        # 调用 DeepSeek 翻译和摘要
        zh = self.translate_and_summarize(
            item.get("title") or "", item.get("text") or "", spider
        )

        # 构建输出对象
        out = {
            "title": item.get("title"),
            "url": item.get("url"),
            "text": item.get("text"),
            "images": local_image_paths,
            "scraped_at": item.get("scraped_at"),
            "status": item.get("status", "completed"),
        }

        # 添加翻译和摘要字段
        if zh:
            out.update(
                {
                    "title_zh": zh.get("title_zh"),
                    "summary_zh": zh.get("summary_zh"),
                    "full_text_zh": zh.get("full_text_zh"),
                    "translation_model": zh.get("model"),
                    "translation_at": zh.get("timestamp"),
                }
            )

        # 保存 JSON 文件
        idx = len(self.index) + 1
        filename = f"{idx}_article.json"
        outfile = self.data_dir / filename
        with open(outfile, "w", encoding="utf-8") as f:
            json.dump(out, f, ensure_ascii=False, indent=2)

        # 更新索引
        url = item.get("url")
        self.index[url] = {
            "title": item.get("title"),
            "file": filename,
            "scraped_at": item.get("scraped_at"),
        }
        with open(self.index_file, "w", encoding="utf-8") as f:
            json.dump(self.index, f, ensure_ascii=False, indent=2)

        spider.logger.info(f"[SaveJsonPipeline] saved {outfile}")

        # 发送到企业微信（使用翻译后的标题和摘要）
        self.send_to_wechat(out, spider)

        # 文章之间延迟，避免频率限制
        spider.logger.info(
            "[Rate Limit] 等待 40 秒后处理下一篇文章（避免 API 频率限制）..."
        )
        time.sleep(40)

        return item

    def _load_deepseek_key(self):
        """加载 DeepSeek API Key，优先 config/deepseek.json，其次环境变量"""
        cfg_path = Path(__file__).parent.parent / "config" / "deepseek.json"
        if cfg_path.exists():
            try:
                with open(cfg_path, "r", encoding="utf-8") as f:
                    cfg = json.load(f)
                    if cfg.get("apiKey"):
                        return cfg.get("apiKey")
            except Exception:
                pass
        return os.getenv("DEEPSEEK_API_KEY")

    def translate_and_summarize(self, title, text, spider, retry=3):
        """调用 DeepSeek 翻译标题并生成摘要，失败时重试"""
        api_key = self._load_deepseek_key()
        if not api_key:
            spider.logger.warning("[DeepSeek] 未配置 API Key，跳过翻译/摘要")
            return None
        if not text:
            spider.logger.warning("[DeepSeek] 文本为空，跳过翻译/摘要")
            return None

        for attempt in range(1, retry + 1):
            try:
                if attempt > 1:
                    wait_time = 10 * attempt
                    spider.logger.info(f"[DeepSeek] 第 {attempt}/{retry} 次重试，等待 {wait_time} 秒...")
                    time.sleep(wait_time)
                    
                spider.logger.info(f"[DeepSeek] 开始翻译 (标题长度: {len(title)}, 正文长度: {len(text)})")
                
                prompt = (
                    "你是中英文翻译和新闻摘要助手。\n"
                    "请完成以下任务：\n"
                    "1. 把标题翻译为中文\n"
                    "2. 基于正文生成 2 句左右的中文概述（每句<=120字，口径客观，避免夸张）\n"
                    "3. 把整篇正文完整翻译为中文\n"
                    "严格输出 JSON，对象包含 title_zh、summary_zh、full_text_zh 三个字段。不要输出额外文本。\n"
                    f"Title:\n{title}\n\nBody:\n{text}"
                )

                payload = {
                    "model": "deepseek-chat",
                    "messages": [
                        {
                            "role": "system",
                            "content": "You are a concise translator and summarizer. Output only valid JSON.",
                        },
                        {"role": "user", "content": prompt},
                    ],
                    "temperature": 0.3,
                    "max_tokens": 4000,
                }

                headers = {
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                }

                spider.logger.info("[DeepSeek] 正在调用 API...")
                resp = requests.post(
                    "https://api.deepseek.com/v1/chat/completions",
                    headers=headers,
                    json=payload,
                    timeout=60,
                )
                resp.raise_for_status()
                body = resp.json()
                spider.logger.info(f"[DeepSeek] API 响应: {body.get('choices', [{}])[0].get('message', {}).get('content', '')[:100]}")

                content = body["choices"][0]["message"]["content"].strip()
                
                # 处理 DeepSeek 可能返回的 markdown 代码块格式
                if content.startswith("```json"):
                    content = content[7:]  # 去掉 ```json
                if content.startswith("```"):
                    content = content[3:]  # 去掉 ```
                if content.endswith("```"):
                    content = content[:-3]  # 去掉结尾的 ```
                content = content.strip()
                
                data = json.loads(content)
                model = (
                    body.get("model")
                    or body["choices"][0].get("model")
                    or "deepseek-chat"
                )

                result = {
                    "title_zh": data.get("title_zh"),
                    "summary_zh": data.get("summary_zh"),
                    "full_text_zh": data.get("full_text_zh"),
                    "model": model,
                    "timestamp": datetime.utcnow().isoformat() + "Z",
                }
                spider.logger.info(f"[DeepSeek] 翻译成功: {result['title_zh']}")
                return result
                
            except requests.exceptions.RequestException as e:
                spider.logger.error(f"[DeepSeek] HTTP 请求失败 (第{attempt}次): {type(e).__name__}: {e}")
                if attempt == retry:
                    return None
                continue
            except json.JSONDecodeError as e:
                spider.logger.error(f"[DeepSeek] JSON 解析失败 (第{attempt}次): {e} (原始响应: {content[:200] if 'content' in locals() else 'N/A'})")
                if attempt == retry:
                    return None
                continue
            except Exception as e:
                spider.logger.error(f"[DeepSeek] 未知错误 (第{attempt}次): {type(e).__name__}: {e}")
                if attempt == retry:
                    return None
                continue
        
        return None

    def send_to_wechat(self, article_data, spider):
        """发送文章到企业微信机器人（使用翻译后的标题和摘要）"""
        try:
            # 加载 webhook 配置
            webhook_url = None
            config_file = Path(__file__).parent.parent / "config" / "wechat.json"
            if config_file.exists():
                with open(config_file, "r", encoding="utf-8") as f:
                    cfg = json.load(f)
                    webhook_url = cfg.get("webhookUrl")

            if not webhook_url:
                webhook_url = os.getenv("WECHAT_WEBHOOK")

            if not webhook_url:
                spider.logger.info("[WeChat] 未配置 webhook，跳过发送")
                return

            # 优先使用翻译后的标题，如果没有则用英文原标题
            title = (
                article_data.get("title_zh")
                or article_data.get("title")
                or "（无标题）"
            )
            summary = article_data.get("summary_zh", "")
            full_text = article_data.get("full_text_zh", "")
            url = article_data.get("url", "")
            scraped_at = article_data.get("scraped_at", "")
            
            # 识别来源学院
            source_label = ""
            if "arts" in spider.name.lower():
                source_label = "🎨 HKU Arts"
            elif "business" in spider.name.lower():
                source_label = "💼 HKU Business"
            elif "science" in spider.name.lower():
                source_label = "🔬 HKU Science"
            
            # 如果没有中文翻译，使用英文原文作为降级方案
            if not full_text:
                spider.logger.warning("[WeChat] 无中文翻译，使用英文原文发送")
                title = article_data.get("title", "（无标题）")
                full_text = article_data.get("text", "")
                if not full_text:
                    spider.logger.warning("[WeChat] 无任何内容可发送，跳过")
                    return

            # 先发送概述（如果有）
            if summary:
                summary_content = f"**{title}**\n\n{source_label} | 📝 **概述**\n{summary.strip()}\n\n[阅读原文]({url})\n\n_抓取时间: {scraped_at}_"
                summary_bytes = len(summary_content.encode("utf-8"))
                spider.logger.info(f"[WeChat] 发送概述: {summary_bytes} 字节")
                
                payload = {"msgtype": "markdown", "markdown": {"content": summary_content}}
                resp = requests.post(webhook_url, json=payload, timeout=10)
                spider.logger.info(f"[WeChat] 概述已发送: {resp.json()}")
                time.sleep(1)
            else:
                spider.logger.info("[WeChat] 无概述，直接发送全文")
            
            # 发送全文（中文翻译或英文原文）
            text = full_text
            content_label = "全文翻译" if article_data.get("full_text_zh") else "原文内容"

            # 构建 Markdown 消息
            plain_text = text.replace("\n", " ").strip()
            md_template_prefix = f"**{title}**\n\n{source_label} | 📄 **{content_label}**\n\n"
            md_template_suffix = f"\n\n[阅读原文]({url})\n\n_抓取时间: {scraped_at}_"
            full_content = md_template_prefix + plain_text + md_template_suffix
            full_bytes = len(full_content.encode("utf-8"))
            max_segment_bytes = 4050

            if full_bytes > max_segment_bytes:
                # 文章过长，需要分段发送
                segments = []
                remaining_text = plain_text
                segment_num = 1

                while remaining_text:
                    if segment_num == 1:
                        segment_header = md_template_prefix
                    else:
                        segment_header = (
                            f"**{title}（续{segment_num}）**\n\n"
                        )

                    header_bytes = len(segment_header.encode("utf-8"))
                    suffix_continue = "\n\n_（内容较长，续见下条）_"
                    suffix_continue_bytes = len(
                        suffix_continue.encode("utf-8")
                    )
                    suffix_final_bytes = len(
                        md_template_suffix.encode("utf-8")
                    )
                    available_bytes = (
                        max_segment_bytes
                        - header_bytes
                        - suffix_continue_bytes
                    )

                    # 二分查找最大可容纳字符数
                    low, high = 0, len(remaining_text)
                    best_chars = 0
                    while low <= high:
                        mid = (low + high) // 2
                        test_segment = remaining_text[:mid]
                        test_bytes = len(test_segment.encode("utf-8"))
                        if test_bytes <= available_bytes:
                            best_chars = mid
                            low = mid + 1
                        else:
                            high = mid - 1

                    segment_text = remaining_text[:best_chars]
                    remaining_after = remaining_text[best_chars:].strip()
                    is_last = len(remaining_after) < 100

                    if is_last:
                        full_segment = (
                            segment_header + segment_text + md_template_suffix
                        )
                        if (
                            len(full_segment.encode("utf-8"))
                            > max_segment_bytes
                        ):
                            available_bytes_final = (
                                max_segment_bytes
                                - header_bytes
                                - suffix_final_bytes
                            )
                            low, high = 0, len(remaining_text)
                            best_chars = 0
                            while low <= high:
                                mid = (low + high) // 2
                                test_segment = remaining_text[:mid]
                                if (
                                    len(test_segment.encode("utf-8"))
                                    <= available_bytes_final
                                ):
                                    best_chars = mid
                                    low = mid + 1
                                else:
                                    high = mid - 1
                            segment_text = remaining_text[:best_chars]
                        segment_md = (
                            segment_header + segment_text + md_template_suffix
                        )
                    else:
                        segment_md = (
                            segment_header + segment_text + suffix_continue
                        )

                    segments.append(segment_md)
                    remaining_text = remaining_text[len(segment_text) :].strip()
                    segment_num += 1

                spider.logger.info(
                    f"[WeChat] 文章过长，分{len(segments)}段发送: 原文{full_bytes}字节"
                )
                for idx, segment_md in enumerate(segments, 1):
                    payload = {
                        "msgtype": "markdown",
                        "markdown": {"content": segment_md},
                    }
                    resp = requests.post(webhook_url, json=payload, timeout=10)
                    spider.logger.info(
                        f"[WeChat] 已发送第{idx}/{len(segments)}段: {resp.json()}"
                    )
                    if idx < len(segments):
                        time.sleep(0.5)
            else:
                # 文章长度适中，直接发送
                payload = {
                    "msgtype": "markdown",
                    "markdown": {"content": full_content},
                }
                resp = requests.post(webhook_url, json=payload, timeout=10)
                spider.logger.info(f"[WeChat] 已发送文本消息: {resp.json()}")

            # 发送图片
            images = article_data.get("images", [])
            if images:
                settings_obj = getattr(spider, "settings", None) or getattr(
                    getattr(spider, "crawler", None), "settings", None
                )
                images_store = (
                    settings_obj.get("IMAGES_STORE") if settings_obj else None
                )
                images_dir = (
                    Path(images_store)
                    if images_store
                    else (self.data_dir / "images")
                )

                for idx, img_rel_path in enumerate(images, 1):
                    img_path = images_dir / img_rel_path
                    if not img_path.exists():
                        continue
                    try:
                        with open(img_path, "rb") as f:
                            img_data = f.read()

                        b64 = base64.b64encode(img_data).decode("utf-8")
                        md5 = hashlib.md5(img_data).hexdigest()

                        img_payload = {
                            "msgtype": "image",
                            "image": {"base64": b64, "md5": md5},
                        }

                        max_retries = 3
                        for retry in range(max_retries):
                            img_resp = requests.post(
                                webhook_url, json=img_payload, timeout=10
                            )
                            resp_data = img_resp.json()
                            if (
                                resp_data.get("errcode") == 45009
                                and retry < max_retries - 1
                            ):
                                wait_time = 5 * (retry + 1)
                                spider.logger.warning(
                                    f"[WeChat] 图片 {idx}/{len(images)} 频率超限，等待 {wait_time}s 后重试 ({retry+1}/{max_retries})"
                                )
                                time.sleep(wait_time)
                            else:
                                spider.logger.info(
                                    f"[WeChat] 已发送图片 {idx}/{len(images)}: {img_rel_path} - {resp_data}"
                                )
                                break

                        if idx < len(images):
                            time.sleep(1)
                    except Exception as e:
                        spider.logger.error(
                            f"[WeChat] 发送图片失败 {img_rel_path}: {e}"
                        )
        except Exception as e:
            spider.logger.error(f"[WeChat] 发送失败: {e}")
