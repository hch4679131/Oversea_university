const fs = require('fs');
const path = require('path');
const vm = require('vm');

const siteDir = path.join(__dirname, '..', 'sites', 'sdlvhk.com');
const sourceIndexPath = path.join(siteDir, 'index.html');
const i18nSourcePath = path.join(siteDir, 'assets', 'i18n.js');
const appSourcePath = path.join(siteDir, 'assets', 'app.js');
const siteBaseUrl = 'https://sdlvhk.com';
const siteName = 'SDLV';
const defaultOgImage = 'https://static.sdlvhk.com/%E5%9B%BE%E7%89%87%E7%B4%A0%E6%9D%90/other/WImage%202.2%20About%20SDLV%20on%20Frontpage.webp';

const langSegments = {
  sc: 'zh-CN',
  tc: 'zh-HK',
  en: 'en'
};

const pageSlugs = {
  home: '',
  about: 'about',
  study: 'study',
  career: 'career',
  apartments: 'apartments',
  achievements: 'achievements',
  contact: 'contact',
  'apartment-ymt': 'apartments/ymt',
  'apartment-csw': 'apartments/csw',
  'apartment-tst': 'apartments/tst',
  'apartment-oy': 'apartments/oy',
  'apartment-syp1': 'apartments/syp1',
  'apartment-syp2': 'apartments/syp2',
  'apartment-syp3': 'apartments/syp3',
  'apartment-pfl': 'apartments/pfl'
};

const pageMeta = {
  home: {
    sc: {
      title: '汇生会 SDLV | Global Education & Career Elite',
      description: '汇生会 SDLV 提供香港及全球留学申请、学生公寓与职涯规划一站式服务。'
    },
    tc: {
      title: '滙生會 SDLV | Global Education & Career Elite',
      description: '滙生會 SDLV 提供香港及全球留學申請、學生公寓與職涯規劃一站式服務。'
    },
    en: {
      title: 'SDLV | Global Education & Career Elite',
      description: 'SDLV provides one-stop global education, student accommodation, and career planning services from Hong Kong.'
    }
  },
  about: {
    sc: { title: '关于汇生会 SDLV | 汇生会 SDLV', description: '了解汇生会 SDLV 的品牌背景、企业历程、团队与合作网络。' },
    tc: { title: '關於滙生會 SDLV | 滙生會 SDLV', description: '了解滙生會 SDLV 的品牌背景、企業歷程、團隊與合作網絡。' },
    en: { title: 'About SDLV | SDLV', description: 'Learn about SDLV, our brand story, milestones, team, and partnership network.' }
  },
  study: {
    sc: { title: '留学服务 | 汇生会 SDLV', description: '查看汇生会 SDLV 留学服务范围、申请流程、合作院校与成功案例。' },
    tc: { title: '留學服務 | 滙生會 SDLV', description: '查看滙生會 SDLV 留學服務範圍、申請流程、合作院校與成功案例。' },
    en: { title: 'Study Abroad Services | SDLV', description: 'Explore SDLV study abroad services, admissions support, partner institutions, and success stories.' }
  },
  career: {
    sc: { title: '职涯规划 | 汇生会 SDLV', description: '查看汇生会 SDLV 职涯规划、名企实习、培训课程与学员成果。' },
    tc: { title: '職涯規劃 | 滙生會 SDLV', description: '查看滙生會 SDLV 職涯規劃、名企實習、培訓課程與學員成果。' },
    en: { title: 'Career Planning | SDLV', description: 'Discover SDLV career planning, internships, training programs, and student outcomes.' }
  },
  apartments: {
    sc: { title: '学生公寓 | 汇生会 SDLV', description: '查看汇生会 SDLV 学生公寓分布、配套设施、公寓展示与住户评价。' },
    tc: { title: '學生公寓 | 滙生會 SDLV', description: '查看滙生會 SDLV 學生公寓分布、配套設施、公寓展示與住戶評價。' },
    en: { title: 'Student Accommodation | SDLV', description: 'Browse SDLV student accommodation options, amenities, locations, and resident reviews.' }
  },
  achievements: {
    sc: { title: '成就与反馈 | 汇生会 SDLV', description: '查看汇生会 SDLV 录取成果、好评反馈、品牌荣誉与合作资源。' },
    tc: { title: '成就與反饋 | 滙生會 SDLV', description: '查看滙生會 SDLV 錄取成果、好評反饋、品牌榮譽與合作資源。' },
    en: { title: 'Achievements | SDLV', description: 'See SDLV admissions results, testimonials, honors, and strategic partnerships.' }
  },
  contact: {
    sc: { title: '商业合作 | 汇生会 SDLV', description: '查看汇生会 SDLV 商业合作流程、合作模式、价值与联系入口。' },
    tc: { title: '商業合作 | 滙生會 SDLV', description: '查看滙生會 SDLV 商業合作流程、合作模式、價值與聯繫入口。' },
    en: { title: 'Contact & Partnerships | SDLV', description: 'Contact SDLV for partnerships, service collaboration, and business inquiries.' }
  },
  'apartment-ymt': {
    sc: { title: '汇生会社（油麻地） | 汇生会 SDLV', description: '查看汇生会社油麻地学生公寓的户型、配套与环境。' },
    tc: { title: '滙生会社（油麻地） | 滙生會 SDLV', description: '查看滙生会社油麻地學生公寓的戶型、配套與環境。' },
    en: { title: 'Yau Ma Tei Residence | SDLV', description: 'Explore SDLV Yau Ma Tei student accommodation, room layout, amenities, and environment.' }
  },
  'apartment-csw': {
    sc: { title: '汇生会社（长沙湾） | 汇生会 SDLV', description: '查看汇生会社长沙湾学生公寓的户型、配套与环境。' },
    tc: { title: '滙生会社（長沙灣） | 滙生會 SDLV', description: '查看滙生会社長沙灣學生公寓的戶型、配套與環境。' },
    en: { title: 'Cheung Sha Wan Residence | SDLV', description: 'Explore SDLV Cheung Sha Wan student accommodation, room layout, amenities, and environment.' }
  },
  'apartment-tst': {
    sc: { title: '汇生会社（尖沙咀） | 汇生会 SDLV', description: '查看汇生会社尖沙咀学生公寓的户型、配套与环境。' },
    tc: { title: '滙生会社（尖沙咀） | 滙生會 SDLV', description: '查看滙生会社尖沙咀學生公寓的戶型、配套與環境。' },
    en: { title: 'Tsim Sha Tsui Residence | SDLV', description: 'Explore SDLV Tsim Sha Tsui student accommodation, room layout, amenities, and environment.' }
  },
  'apartment-oy': {
    sc: { title: '汇生会社（奥运） | 汇生会 SDLV', description: '查看汇生会社奥运学生公寓的户型、配套与环境。' },
    tc: { title: '滙生会社（奧運） | 滙生會 SDLV', description: '查看滙生会社奧運學生公寓的戶型、配套與環境。' },
    en: { title: 'Olympic Residence | SDLV', description: 'Explore SDLV Olympic student accommodation, room layout, amenities, and environment.' }
  },
  'apartment-syp1': {
    sc: { title: '汇生会社（西营盘一期） | 汇生会 SDLV', description: '查看汇生会社西营盘一期学生公寓的户型、配套与环境。' },
    tc: { title: '滙生会社（西營盤一期） | 滙生會 SDLV', description: '查看滙生会社西營盤一期學生公寓的戶型、配套與環境。' },
    en: { title: 'Sai Ying Pun Phase 1 Residence | SDLV', description: 'Explore SDLV Sai Ying Pun Phase 1 student accommodation, room layout, amenities, and environment.' }
  },
  'apartment-syp2': {
    sc: { title: '汇生会社（西营盘二期） | 汇生会 SDLV', description: '查看汇生会社西营盘二期学生公寓的户型、配套与环境。' },
    tc: { title: '滙生会社（西營盤二期） | 滙生會 SDLV', description: '查看滙生会社西營盤二期學生公寓的戶型、配套與環境。' },
    en: { title: 'Sai Ying Pun Phase 2 Residence | SDLV', description: 'Explore SDLV Sai Ying Pun Phase 2 student accommodation, room layout, amenities, and environment.' }
  },
  'apartment-syp3': {
    sc: { title: '汇生会社（西营盘三期） | 汇生会 SDLV', description: '查看汇生会社西营盘三期学生公寓的户型、配套与环境。' },
    tc: { title: '滙生会社（西營盤三期） | 滙生會 SDLV', description: '查看滙生会社西營盤三期學生公寓的戶型、配套與環境。' },
    en: { title: 'Sai Ying Pun Phase 3 Residence | SDLV', description: 'Explore SDLV Sai Ying Pun Phase 3 student accommodation, room layout, amenities, and environment.' }
  },
  'apartment-pfl': {
    sc: { title: '汇生会社（薄扶林） | 汇生会 SDLV', description: '查看汇生会社薄扶林学生公寓的户型、配套与环境。' },
    tc: { title: '滙生会社（薄扶林） | 滙生會 SDLV', description: '查看滙生会社薄扶林學生公寓的戶型、配套與環境。' },
    en: { title: 'Pok Fu Lam Residence | SDLV', description: 'Explore SDLV Pok Fu Lam student accommodation, room layout, amenities, and environment.' }
  }
};

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeXml(value) {
  return escapeHtml(value).replace(/'/g, '&apos;');
}

function loadTranslations() {
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(i18nSourcePath, 'utf8'), sandbox);
  return sandbox.window.SDLV_I18N || {};
}

function loadAppConfig() {
  const appSource = fs.readFileSync(appSourcePath, 'utf8');
  const wechatIdMatch = appSource.match(/wechatId:\s*'([^']+)'/);

  return {
    wechatId: wechatIdMatch ? wechatIdMatch[1] : ''
  };
}

function buildRoutePath(langKey, pageKey) {
  const langSegment = langSegments[langKey];
  const slug = pageSlugs[pageKey];
  return `/${langSegment}${slug ? `/${slug}` : ''}`;
}

function splitDocument(sourceHtml) {
  const mainStart = sourceHtml.indexOf('<main ');
  const mainOpenEnd = sourceHtml.indexOf('>', mainStart) + 1;
  const mainCloseStart = sourceHtml.lastIndexOf('</main>');

  if (mainStart === -1 || mainOpenEnd === 0 || mainCloseStart === -1) {
    throw new Error('Unable to locate <main> wrapper in source HTML');
  }

  return {
    beforeMain: sourceHtml.slice(0, mainOpenEnd),
    mainInner: sourceHtml.slice(mainOpenEnd, mainCloseStart),
    afterMain: sourceHtml.slice(mainCloseStart)
  };
}

function findMatchingDivEnd(html, openStart) {
  const divTagPattern = /<\/??div\b[^>]*>/g;
  divTagPattern.lastIndex = openStart;

  let depth = 0;
  let match;

  while ((match = divTagPattern.exec(html))) {
    const tag = match[0];
    const isClosing = tag.startsWith('</');
    const isSelfClosing = tag.endsWith('/>');

    if (!isClosing) {
      depth += 1;
      if (isSelfClosing) {
        depth -= 1;
      }
    } else {
      depth -= 1;
    }

    if (depth === 0) {
      return match.index + tag.length;
    }
  }

  throw new Error(`Unable to find closing </div> for block starting at ${openStart}`);
}

function findMatchingTemplateEnd(html, openStart) {
  const templateTagPattern = /<\/?template\b[^>]*>/g;
  templateTagPattern.lastIndex = openStart;

  let depth = 0;
  let match;

  while ((match = templateTagPattern.exec(html))) {
    const tag = match[0];
    const isClosing = tag.startsWith('</');

    if (!isClosing) {
      depth += 1;
    } else {
      depth -= 1;
    }

    if (depth === 0) {
      return match.index + tag.length;
    }
  }

  throw new Error(`Unable to find closing </template> for block starting at ${openStart}`);
}

function findMatchingElementEnd(html, openStart, tagName) {
  const tagPattern = new RegExp(`<\\/?${tagName}\\b[^>]*>`, 'g');
  tagPattern.lastIndex = openStart;

  let depth = 0;
  let match;

  while ((match = tagPattern.exec(html))) {
    const tag = match[0];
    const isClosing = tag.startsWith('</');
    const isSelfClosing = !isClosing && /\/>$/.test(tag);

    if (!isClosing) {
      depth += 1;
      if (isSelfClosing) {
        depth -= 1;
      }
    } else {
      depth -= 1;
    }

    if (depth === 0) {
      return match.index + tag.length;
    }
  }

  throw new Error(`Unable to find closing </${tagName}> for block starting at ${openStart}`);
}

function extractPageBlocks(mainInner) {
  const blocks = {};

  Object.keys(pageSlugs).forEach((pageKey) => {
    const marker = `x-show="page === '${pageKey}'"`;
    const markerIndex = mainInner.indexOf(marker);
    if (markerIndex === -1) {
      throw new Error(`Unable to find page block for ${pageKey}`);
    }

    const blockStart = mainInner.lastIndexOf('<div', markerIndex);
    if (blockStart === -1) {
      throw new Error(`Unable to find opening <div> for ${pageKey}`);
    }

    const blockEnd = findMatchingDivEnd(mainInner, blockStart);
    blocks[pageKey] = mainInner.slice(blockStart, blockEnd);
  });

  return blocks;
}

function stripPageWrapperDirectives(blockHtml) {
  return blockHtml
    .replace(/\s+x-show="[^"]*"/, '')
    .replace(/\s+x-transition:[^=]+="[^"]*"/g, '');
}

function splitArgs(argString) {
  const args = [];
  let current = '';
  let quote = null;
  let depth = 0;

  for (let i = 0; i < argString.length; i += 1) {
    const char = argString[i];

    if (quote) {
      current += char;
      if (char === quote && argString[i - 1] !== '\\') {
        quote = null;
      }
      continue;
    }

    if (char === '\'' || char === '"') {
      quote = char;
      current += char;
      continue;
    }

    if (char === '(') {
      depth += 1;
      current += char;
      continue;
    }

    if (char === ')') {
      depth -= 1;
      current += char;
      continue;
    }

    if (char === ',' && depth === 0) {
      args.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  if (current.trim()) {
    args.push(current.trim());
  }

  return args;
}

function normalizeQuotedValue(value) {
  const singleQuoted = value.match(/^'([^']*)'$/);
  if (singleQuoted) return singleQuoted[1];

  const doubleQuoted = value.match(/^"([^"]*)"$/);
  if (doubleQuoted) return doubleQuoted[1];

  return value;
}

function resolveRouteArg(arg, currentLangKey, currentPageKey) {
  const normalizedArg = String(arg || '').trim();
  if (!normalizedArg || normalizedArg === 'null') return null;

  if (normalizedArg === 'page' || normalizedArg === 'this.page') return currentPageKey;
  if (normalizedArg === 'lang' || normalizedArg === 'this.lang') return currentLangKey;
  if (normalizedArg === 'anchorId' || normalizedArg === 'getCurrentAnchorId()') return null;

  return normalizeQuotedValue(normalizedArg);
}

function buildExportHref(argString, currentLangKey, currentPageKey) {
  const args = splitArgs(argString);
  const pageArg = resolveRouteArg(args[0], currentLangKey, currentPageKey) || currentPageKey;
  const anchorArg = resolveRouteArg(args[1], currentLangKey, currentPageKey);
  const langArg = resolveRouteArg(args[2], currentLangKey, currentPageKey) || currentLangKey;

  const pageKey = Object.prototype.hasOwnProperty.call(pageSlugs, pageArg) ? pageArg : currentPageKey;
  const langKey = Object.prototype.hasOwnProperty.call(langSegments, langArg) ? langArg : currentLangKey;

  return `${buildRoutePath(langKey, pageKey)}${anchorArg ? `#${encodeURIComponent(anchorArg)}` : ''}`;
}

function replaceDynamicHrefs(html, langKey, pageKey) {
  return html.replace(/:href="routeHref\(([^\"]+)\)"/g, (_, args) => {
    return `href="${buildExportHref(args, langKey, pageKey)}"`;
  });
}

function evaluateExpression(expr, context) {
  try {
    return vm.runInNewContext(expr, {
      ...context,
      Math,
      Number,
      String,
      Boolean,
      Array,
      Object,
      JSON
    }, { timeout: 50 });
  } catch {
    return undefined;
  }
}

function replaceSimpleXText(html, context) {
  return html.replace(/<([a-zA-Z][\w:-]*)([^>]*)\s+x-text="([^"]+)"([^>]*)>([\s\S]*?)<\/\1>/g, (match, tagName, beforeAttrs, expr, afterAttrs, innerHtml) => {
    if (innerHtml.trim() && /</.test(innerHtml)) {
      return match;
    }

    const resolvedText = evaluateExpression(expr.trim(), context);
    if (resolvedText == null) {
      return match;
    }

    return `<${tagName}${beforeAttrs}${afterAttrs}>${escapeHtml(resolvedText)}</${tagName}>`;
  });
}

function replaceBoundAttributes(html, context) {
  return html.replace(/\s:([a-zA-Z-]+)="([^"]+)"/g, (match, attributeName, expr) => {
    if (!['src', 'alt', 'title', 'aria-label'].includes(attributeName)) {
      return match;
    }

    const resolvedValue = evaluateExpression(expr.trim(), context);
    if (typeof resolvedValue === 'undefined') {
      return match;
    }

    if (resolvedValue == null || resolvedValue === false) {
      return '';
    }

    return ` ${attributeName}="${escapeHtml(resolvedValue)}"`;
  });
}

function parseForExpression(expr) {
  const match = expr.trim().match(/^(?:\(([^)]+)\)|([A-Za-z_$][\w$]*))\s+in\s+([\s\S]+)$/);
  if (!match) {
    return null;
  }

  const loopVars = (match[1] || match[2]).split(',').map((entry) => entry.trim()).filter(Boolean);
  return {
    loopVars,
    iterableExpr: match[3].trim()
  };
}

function renderLoopTemplates(html, context) {
  let cursor = 0;

  while (cursor < html.length) {
    const markerIndex = html.indexOf('x-for="', cursor);
    if (markerIndex === -1) {
      break;
    }

    const templateStart = html.lastIndexOf('<template', markerIndex);
    if (templateStart === -1) {
      cursor = markerIndex + 7;
      continue;
    }

    const templateOpenEnd = html.indexOf('>', markerIndex);
    if (templateOpenEnd === -1) {
      break;
    }

    const templateEnd = findMatchingTemplateEnd(html, templateStart);
    const openingTag = html.slice(templateStart, templateOpenEnd + 1);
    const exprMatch = openingTag.match(/x-for="([^"]+)"/);
    const parsedExpression = exprMatch ? parseForExpression(exprMatch[1]) : null;
    const iterableValue = parsedExpression ? evaluateExpression(parsedExpression.iterableExpr, context) : undefined;

    if (!parsedExpression || !iterableValue || typeof iterableValue[Symbol.iterator] !== 'function') {
      cursor = templateEnd;
      continue;
    }

    const innerHtml = html.slice(templateOpenEnd + 1, templateEnd - '</template>'.length);
    const rendered = Array.from(iterableValue).map((item, index) => {
      const childContext = {
        ...context,
        [parsedExpression.loopVars[0]]: item
      };

      if (parsedExpression.loopVars[1]) {
        childContext[parsedExpression.loopVars[1]] = index;
      }

      return renderFragment(innerHtml, childContext);
    }).join('');

    html = `${html.slice(0, templateStart)}${rendered}${html.slice(templateEnd)}`;
    cursor = templateStart + rendered.length;
  }

  return html;
}

function renderConditionalTemplates(html, context) {
  let cursor = 0;

  while (cursor < html.length) {
    const markerIndex = html.indexOf('x-if="', cursor);
    if (markerIndex === -1) {
      break;
    }

    const templateStart = html.lastIndexOf('<template', markerIndex);
    if (templateStart === -1) {
      cursor = markerIndex + 6;
      continue;
    }

    const templateOpenEnd = html.indexOf('>', markerIndex);
    if (templateOpenEnd === -1) {
      break;
    }

    const templateEnd = findMatchingTemplateEnd(html, templateStart);
    const openingTag = html.slice(templateStart, templateOpenEnd + 1);
    const exprMatch = openingTag.match(/x-if="([^"]+)"/);
    const shouldRender = exprMatch ? evaluateExpression(exprMatch[1], context) : undefined;

    if (typeof shouldRender === 'undefined') {
      cursor = templateEnd;
      continue;
    }

    const innerHtml = html.slice(templateOpenEnd + 1, templateEnd - '</template>'.length);
    const replacement = shouldRender ? renderFragment(innerHtml, context) : '';
    html = `${html.slice(0, templateStart)}${replacement}${html.slice(templateEnd)}`;
    cursor = templateStart + replacement.length;
  }

  return html;
}

function renderShownElements(html, context) {
  let cursor = 0;

  while (cursor < html.length) {
    const markerIndex = html.indexOf('x-show="', cursor);
    if (markerIndex === -1) {
      break;
    }

    const openStart = html.lastIndexOf('<', markerIndex);
    if (openStart === -1) {
      cursor = markerIndex + 7;
      continue;
    }

    const openingTagMatch = html.slice(openStart).match(/^<([a-zA-Z][\w:-]*)\b[^>]*>/);
    if (!openingTagMatch) {
      cursor = markerIndex + 7;
      continue;
    }

    const tagName = openingTagMatch[1];
    const openingTag = openingTagMatch[0];
    const exprMatch = openingTag.match(/x-show="([^"]+)"/);
    const openEnd = openStart + openingTag.length;
    const elementEnd = findMatchingElementEnd(html, openStart, tagName);
    const shouldRender = exprMatch ? evaluateExpression(exprMatch[1], context) : undefined;

    if (typeof shouldRender === 'undefined') {
      cursor = elementEnd;
      continue;
    }

    if (!shouldRender) {
      html = `${html.slice(0, openStart)}${html.slice(elementEnd)}`;
      cursor = openStart;
      continue;
    }

    const closingTag = `</${tagName}>`;
    const innerHtml = html.slice(openEnd, elementEnd - closingTag.length);
    const strippedOpeningTag = openingTag.replace(/\s+x-show="[^"]*"/, '');
    const replacement = `${strippedOpeningTag}${renderFragment(innerHtml, context)}${closingTag}`;
    html = `${html.slice(0, openStart)}${replacement}${html.slice(elementEnd)}`;
    cursor = openStart + replacement.length;
  }

  return html;
}

function renderFragment(html, context) {
  let renderedHtml = html;
  renderedHtml = renderLoopTemplates(renderedHtml, context);
  renderedHtml = renderConditionalTemplates(renderedHtml, context);
  renderedHtml = renderShownElements(renderedHtml, context);
  renderedHtml = replaceBoundAttributes(renderedHtml, context);
  renderedHtml = replaceSimpleXText(renderedHtml, context);
  return renderedHtml;
}

function buildAlternateLinks(pageKey) {
  const lines = Object.entries(langSegments).map(([langKey, langSegment]) => {
    return `    <link id="alternate-link-${langKey}" rel="alternate" hreflang="${langSegment}" href="${siteBaseUrl}${buildRoutePath(langKey, pageKey)}">`;
  });
  lines.push(`    <link id="alternate-link-x-default" rel="alternate" hreflang="x-default" href="${siteBaseUrl}${buildRoutePath('sc', pageKey)}">`);
  return lines.join('\n');
}

function buildMetaHead(meta, canonicalHref, pageKey, langKey) {
  return `<title>${escapeHtml(meta.title)}</title>
    <meta name="description" content="${escapeHtml(meta.description)}">
    <meta name="robots" content="index,follow">
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="${escapeHtml(siteName)}">
    <meta property="og:title" content="${escapeHtml(meta.title)}">
    <meta property="og:description" content="${escapeHtml(meta.description)}">
    <meta property="og:url" content="${canonicalHref}">
    <meta property="og:image" content="${defaultOgImage}">
    <meta property="og:locale" content="${langSegments[langKey]}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeHtml(meta.title)}">
    <meta name="twitter:description" content="${escapeHtml(meta.description)}">
    <meta name="twitter:image" content="${defaultOgImage}">
    <link id="canonical-link" rel="canonical" href="${canonicalHref}">
${buildAlternateLinks(pageKey)}`;
}

function renderHtml(template, langKey, pageKey) {
  const { shell, blocks, translations, appConfig } = template;
  const meta = pageMeta[pageKey][langKey];
  const routePath = buildRoutePath(langKey, pageKey);
  const canonicalHref = `${siteBaseUrl}${routePath}`;
  const renderContext = {
    t: { lang: translations[langKey] },
    lang: 'lang',
    wechatId: appConfig.wechatId,
    wechatCopied: false
  };

  let html = `${shell.beforeMain}\n${stripPageWrapperDirectives(blocks[pageKey])}\n${shell.afterMain}`;

  html = html.replace(
    /<html lang="[^"]+"/,
    `<html lang="${langSegments[langKey]}" data-static-export="true" data-static-page="${pageKey}" data-static-lang="${langSegments[langKey]}"`
  );

  html = html.replace(
    /<title>[\s\S]*?<\/title>/,
    buildMetaHead(meta, canonicalHref, pageKey, langKey)
  );

  html = replaceDynamicHrefs(html, langKey, pageKey);
  html = renderFragment(html, renderContext);

  return html;
}

function writeRouteFile(langKey, pageKey, sourceHtml) {
  const routePath = buildRoutePath(langKey, pageKey);
  const targetDir = path.join(siteDir, routePath.replace(/^\//, ''));
  fs.mkdirSync(targetDir, { recursive: true });
  fs.writeFileSync(path.join(targetDir, 'index.html'), renderHtml(sourceHtml, langKey, pageKey), 'utf8');
}

function removeGeneratedRoots() {
  Object.values(langSegments).forEach((langSegment) => {
    const dir = path.join(siteDir, langSegment);
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
}

function writeSitemapFiles() {
  const urls = [];

  Object.keys(langSegments).forEach((langKey) => {
    Object.keys(pageSlugs).forEach((pageKey) => {
      urls.push(`${siteBaseUrl}${buildRoutePath(langKey, pageKey)}`);
    });
  });

  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((url) => `  <url><loc>${escapeXml(url)}</loc></url>`).join('\n')}
</urlset>
`;

  const robotsTxt = `User-agent: *
Allow: /

Sitemap: ${siteBaseUrl}/sitemap.xml
`;

  fs.writeFileSync(path.join(siteDir, 'sitemap.xml'), sitemapXml, 'utf8');
  fs.writeFileSync(path.join(siteDir, 'robots.txt'), robotsTxt, 'utf8');
}

function main() {
  const sourceHtml = fs.readFileSync(sourceIndexPath, 'utf8');
  const shell = splitDocument(sourceHtml);
  const blocks = extractPageBlocks(shell.mainInner);
  const translations = loadTranslations();
  const appConfig = loadAppConfig();

  removeGeneratedRoots();

  Object.keys(langSegments).forEach((langKey) => {
    Object.keys(pageSlugs).forEach((pageKey) => {
      writeRouteFile(langKey, pageKey, { shell, blocks, translations, appConfig });
    });
  });

  writeSitemapFiles();

  console.log('Generated static route HTML under sites/sdlvhk.com/{zh-CN,zh-HK,en}/ with sitemap.xml and robots.txt.');
}

main();