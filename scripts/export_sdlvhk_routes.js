const fs = require('fs');
const path = require('path');
const vm = require('vm');

const siteDir = path.join(__dirname, '..', 'sites', 'sdlvhk.com');
const sourceIndexPath = path.join(siteDir, 'index.html');
const i18nSourcePath = path.join(siteDir, 'assets', 'i18n.js');

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

function loadTranslations() {
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(i18nSourcePath, 'utf8'), sandbox);
  return sandbox.window.SDLV_I18N || {};
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

function resolveTextExpression(expr, translations, langKey) {
  const directMatch = expr.match(/^t\[lang\]\.([A-Za-z0-9_]+)$/);
  if (directMatch) {
    return translations[langKey]?.[directMatch[1]] ?? null;
  }

  const fallbackMatch = expr.match(/^t\[lang\]\.([A-Za-z0-9_]+)\s*\|\|\s*'([^']*)'$/);
  if (fallbackMatch) {
    return translations[langKey]?.[fallbackMatch[1]] ?? fallbackMatch[2];
  }

  return null;
}

function replaceSimpleXText(html, translations, langKey) {
  return html.replace(/<([a-zA-Z][\w:-]*)([^>]*)\s+x-text="([^"]+)"([^>]*)>([\s\S]*?)<\/\1>/g, (match, tagName, beforeAttrs, expr, afterAttrs, innerHtml) => {
    if (innerHtml.trim() && /</.test(innerHtml)) {
      return match;
    }

    const resolvedText = resolveTextExpression(expr.trim(), translations, langKey);
    if (resolvedText == null) {
      return match;
    }

    return `<${tagName}${beforeAttrs}${afterAttrs}>${escapeHtml(resolvedText)}</${tagName}>`;
  });
}

function buildAlternateLinks(pageKey) {
  const lines = Object.entries(langSegments).map(([langKey, langSegment]) => {
    return `    <link id="alternate-link-${langKey}" rel="alternate" hreflang="${langSegment}" href="https://sdlvhk.com${buildRoutePath(langKey, pageKey)}">`;
  });
  lines.push(`    <link id="alternate-link-x-default" rel="alternate" hreflang="x-default" href="https://sdlvhk.com${buildRoutePath('sc', pageKey)}">`);
  return lines.join('\n');
}

function renderHtml(template, langKey, pageKey) {
  const { shell, blocks, translations } = template;
  const meta = pageMeta[pageKey][langKey];
  const routePath = buildRoutePath(langKey, pageKey);
  const canonicalHref = `https://sdlvhk.com${routePath}`;

  let html = `${shell.beforeMain}\n${stripPageWrapperDirectives(blocks[pageKey])}\n${shell.afterMain}`;

  html = html.replace(
    /<html lang="[^"]+"/,
    `<html lang="${langSegments[langKey]}" data-static-export="true" data-static-page="${pageKey}" data-static-lang="${langSegments[langKey]}"`
  );

  html = html.replace(
    /<title>[\s\S]*?<\/title>/,
    `<title>${escapeHtml(meta.title)}</title>\n    <meta name="description" content="${escapeHtml(meta.description)}">\n    <meta name="robots" content="index,follow">\n    <link id="canonical-link" rel="canonical" href="${canonicalHref}">\n${buildAlternateLinks(pageKey)}`
  );

  html = replaceDynamicHrefs(html, langKey, pageKey);
  html = replaceSimpleXText(html, translations, langKey);

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

function main() {
  const sourceHtml = fs.readFileSync(sourceIndexPath, 'utf8');
  const shell = splitDocument(sourceHtml);
  const blocks = extractPageBlocks(shell.mainInner);
  const translations = loadTranslations();

  removeGeneratedRoots();

  Object.keys(langSegments).forEach((langKey) => {
    Object.keys(pageSlugs).forEach((pageKey) => {
      writeRouteFile(langKey, pageKey, { shell, blocks, translations });
    });
  });

  console.log('Generated static route HTML under sites/sdlvhk.com/{zh-CN,zh-HK,en}/');
}

main();