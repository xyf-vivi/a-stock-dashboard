// 将 src/render.js 中"上涨比改成分股口径"的修改同步进 HTML 内联浏览器版 render 副本
// 只注入两处：(1) componentUpRatioByNorm 函数定义 (2) buildThemeLeaderBoard 中的覆盖循环
// 不触碰其它任何逻辑，确保静态 tab 与 6 个 JS 渲染 tab 口径一致。
const fs = require('fs');
const path = require('path');

const HTML = path.join(__dirname, 'output', 'fused_dashboard_v2.html');
const WRITE = process.env.WRITE === '1';

const FN = `function componentUpRatioByNorm(entry, normName) {
  if (!entry || !entry.themeBreadth || !Array.isArray(entry.themeBreadth.themes)) return null;
  var u = 0, t = 0, has = false;
  entry.themeBreadth.themes.forEach(function (tb) {
    if (BREADTH_ALIAS[tb.name] !== normName) return;
    var up = (tb.upCount != null) ? tb.upCount : (tb.breadth && tb.breadth.upCount != null ? tb.breadth.upCount : null);
    var tot = (tb.totalCount != null) ? tb.totalCount : (tb.breadth && tb.breadth.totalCount != null ? tb.breadth.totalCount : null);
    if (up != null && tot != null && tot > 0) { u += up; t += tot; has = true; }
  });
  return has ? u / t : null;
}

`;

const ANCHOR_FN = 'function buildThemeLeaderBoard(entry, data, currentDt, wma) {';

const OVERRIDE = `  // 上涨比改用真实成分股口径（Wind 指数成分股家数）：优先 themeBreadth，缺失时回退 ETF 池
  allBuckets.forEach(function (b) {
    var comp = componentUpRatioByNorm(entry, b.name);
    if (comp != null) b.upRatio = comp;
  });

`;

const ANCHOR_OVERRIDE = "  if (allBuckets.length === 0) return [];\n\n  // 2) 计算每个桶在所有桶中的位次（用于评分归一化）";

let html = fs.readFileSync(HTML, 'utf8');

// 安全断言：注入前不应已存在该函数
const beforeCount = (html.match(/componentUpRatioByNorm/g) || []).length;
if (beforeCount !== 0) {
  console.error('[ABORT] 已存在 componentUpRatioByNorm，计数=' + beforeCount + '，疑似重复注入。');
  process.exit(1);
}

// 注入 1：函数定义
if (!html.includes(ANCHOR_FN)) {
  console.error('[ABORT] 找不到 buildThemeLeaderBoard 锚点');
  process.exit(1);
}
if (html.indexOf(ANCHOR_FN) !== html.lastIndexOf(ANCHOR_FN)) {
  console.error('[ABORT] buildThemeLeaderBoard 锚点不唯一');
  process.exit(1);
}
html = html.replace(ANCHOR_FN, FN + ANCHOR_FN);

// 注入 2：覆盖循环
if (!html.includes(ANCHOR_OVERRIDE)) {
  console.error('[ABORT] 找不到 override 锚点');
  process.exit(1);
}
if (html.indexOf(ANCHOR_OVERRIDE) !== html.lastIndexOf(ANCHOR_OVERRIDE)) {
  console.error('[ABORT] override 锚点不唯一');
  process.exit(1);
}
html = html.replace(ANCHOR_OVERRIDE, "  if (allBuckets.length === 0) return [];\n\n" + OVERRIDE + "  // 2) 计算每个桶在所有桶中的位次（用于评分归一化）");

const afterCount = (html.match(/componentUpRatioByNorm/g) || []).length;
console.log('componentUpRatioByNorm 计数(注入后预期=2):', afterCount);
console.log('override 循环出现次数(预期>=1):', (html.match(/var comp = componentUpRatioByNorm/g) || []).length);

// 语法粗检：抽取内联脚本里 buildThemeLeaderBoard 附近是否平衡（仅做字符串存在性）
if (!html.includes('allBuckets.forEach(function (b) {') && !html.includes('allBuckets.forEach(function(b)')) {
  console.error('[WARN] 未检测到 allBuckets.forEach 覆盖');
}

if (WRITE) {
  fs.writeFileSync(HTML, html, 'utf8');
  console.log('[WRITE] 已写回', HTML);
} else {
  console.log('[DRYRUN] 未写盘（设置 WRITE=1 执行）');
}
