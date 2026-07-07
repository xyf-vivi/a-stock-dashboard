// 端到端校验：在带 DOM 桩的 vm 中运行 HTML 内联脚本#1，然后直接调用 buildThemeLeaderBoard，
// 确认各主题桶的 upRatio 已被覆盖为"成分股口径"。
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const HTML = path.join(__dirname, 'output', 'fused_dashboard_v2.html');
const html = fs.readFileSync(HTML, 'utf8');

// 抽取所有 <script> 块
const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
let m, scripts = [];
while ((m = re.exec(html)) !== null) {
  if (/\bsrc\s*=/.test(m[1])) continue;
  scripts.push(m[2]);
}
const big = scripts[0]; // 1.7MB 主脚本

// 伪 DOM（Proxy 兜底，任何属性/方法都返回可链式调用的伪元素）
function fakeEl() {
  const el = function () { return fakeEl(); };
  return new Proxy(el, {
    get(t, p) {
      if (p === 'innerHTML' || p === 'textContent' || p === 'value') return '';
      if (p === 'classList') return { add() {}, remove() {}, toggle() {}, contains() { return false; } };
      if (p === 'style') return {};
      if (p === 'dataset') return {};
      if (p === 'length') return 0;
      if (p === 'children') return [];
      if (p === 'appendChild' || p === 'removeChild' || p === 'setAttribute' || p === 'addEventListener' || p === 'removeEventListener' || p === 'querySelector' || p === 'querySelectorAll' || p === 'getElementById' || p === 'cloneNode' || p === 'insertBefore') return function () { return fakeEl(); };
      return fakeEl();
    },
    set() { return true; },
    apply() { return fakeEl(); }
  });
}
const documentStub = new Proxy({}, {
  get(t, p) {
    if (p === 'addEventListener' || p === 'removeEventListener') return function () {};
    if (p === 'getElementById' || p === 'querySelector' || p === 'createElement' || p === 'body') return function () { return fakeEl(); };
    if (p === 'querySelectorAll') return function () { return []; };
    return fakeEl();
  }
});
const sandbox = {
  document: documentStub,
  window: { addEventListener() {}, removeEventListener() {} },
  console: console,
  setTimeout: function () {}, clearTimeout: function () {},
  setInterval: function () {}, clearInterval: function () {},
  fetch: function () { return Promise.resolve({ json: function () { return {}; } }); },
  localStorage: { getItem() { return null; }, setItem() {} },
  navigator: { userAgent: 'node' }
};
sandbox.window.document = documentStub;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

// 依次运行所有内联脚本（含 DASHBOARD_DATA 与 render 函数），共享同一 sandbox
scripts.forEach(function (code, i) {
  try {
    vm.runInContext(code, sandbox, { filename: 'inline-script-' + (i + 1) + '.js' });
  } catch (e) {
    console.log('[note] 内联脚本#' + (i + 1) + ' 顶层执行抛出（函数声明已提升，可继续）: ' + e.message);
  }
});

if (typeof sandbox.buildThemeLeaderBoard !== 'function') {
  console.error('ABORT: buildThemeLeaderBoard 未在全局定义，无法端到端校验');
  process.exit(2);
}
if (typeof sandbox.componentUpRatioByNorm !== 'function') {
  console.error('ABORT: componentUpRatioByNorm 未在全局定义');
  process.exit(2);
}

const data = sandbox.DASHBOARD_DATA;
const entry = data.data['2026-07-06'];
const wma = data.weeklyMA34 || null;
const board = sandbox.buildThemeLeaderBoard(entry, data, '2026-07-06', wma);

console.log('buildThemeLeaderBoard 返回桶数:', board.length);
const EXPECT = {
  '科技成长': (2 + 21 + 18 + 15) / (29 + 50 + 50 + 50),
  '证券金融': 1 / 49,
  '红利防御': 21 / 100,
  '有色资源': (4 + 14) / (50 + 50),
  '化工': 7 / 50,
  '创新药/医药成长': 3 / 50
};
let ok = true;
board.forEach(function (b) {
  const e = EXPECT[b.name];
  const r = b.upRatio;
  if (e == null) {
    console.log(b.name.padEnd(16), 'upRatio =', r == null ? 'null' : (r * 100).toFixed(1) + '%', '(无成分股对照，回退ETF池属正常)');
    return;
  }
  const pass = r != null && Math.abs(r - e) < 1e-6;
  if (!pass) ok = false;
  console.log((pass ? '  OK  ' : ' FAIL ') + b.name.padEnd(16) + ' upRatio = ' + (r == null ? 'null' : (r * 100).toFixed(2) + '%') + '  期望(成分股) = ' + (e * 100).toFixed(2) + '%');
});
console.log(ok ? '\n[PASS] 端到端：JS tab 渲染路径已使用成分股口径上涨比' : '\n[FAIL] 存在不一致');
process.exit(ok ? 0 : 1);
