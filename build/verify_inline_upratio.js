// 运行时校验：从 HTML 抽出 DASHBOARD_DATA / BREADTH_ALIAS / componentUpRatioByNorm，
// 调用 componentUpRatioByNorm 验证其返回的是真实"成分股口径"上涨比。
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const HTML = path.join(__dirname, 'output', 'fused_dashboard_v2.html');
const html = fs.readFileSync(HTML, 'utf8');

function extractBalanced(s, startIndex) {
  // startIndex 指向首个 '{'
  let depth = 0;
  for (let i = startIndex; i < s.length; i++) {
    const c = s[i];
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return s.slice(startIndex, i + 1); }
  }
  return null;
}

// 1) DASHBOARD_DATA
const ddStart = html.indexOf('var DASHBOARD_DATA =');
if (ddStart < 0) { console.error('ABORT: 找不到 DASHBOARD_DATA'); process.exit(1); }
const ddBrace = html.indexOf('{', ddStart);
const ddObj = extractBalanced(html, ddBrace);
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext('var DASHBOARD_DATA = ' + ddObj + ';', sandbox);
const entry = sandbox.DASHBOARD_DATA.data['2026-07-06'];
if (!entry) { console.error('ABORT: 无 2026-07-06 entry'); process.exit(1); }

// 2) BREADTH_ALIAS
const baStart = html.indexOf('var BREADTH_ALIAS =');
const baBrace = html.indexOf('{', baStart);
const baObj = extractBalanced(html, baBrace);
vm.runInContext('var BREADTH_ALIAS = ' + baObj + ';', sandbox);

// 3) componentUpRatioByNorm
const fnStart = html.indexOf('function componentUpRatioByNorm');
const fnBrace = html.indexOf('{', fnStart);
const fnBody = html.slice(fnStart, fnBrace) + extractBalanced(html, fnBrace);
vm.runInContext(fnBody + '\nthis.componentUpRatioByNorm = componentUpRatioByNorm;', sandbox);

const fn = sandbox.componentUpRatioByNorm;

console.log('themeBreadth.date =', entry.themeBreadth && entry.themeBreadth.date);
const norms = ['科技成长', '证券金融', '红利防御', '有色资源', '化工', '创新药/医药成长'];
norms.forEach(function (n) {
  const r = fn(entry, n);
  console.log(n.padEnd(16), '成分股上涨比 =', r == null ? 'null' : (r * 100).toFixed(1) + '%');
});

// 与 Wind 真实值对照（07-06）
const EXPECT = {
  '科技成长': (2 + 21 + 18 + 15) / (29 + 50 + 50 + 50),
  '证券金融': 1 / 49,
  '红利防御': 21 / 100,
  '有色资源': (4 + 14) / (50 + 50),
  '化工': 7 / 50,
  '创新药/医药成长': 3 / 50
};
let ok = true;
norms.forEach(function (n) {
  const r = fn(entry, n);
  const e = EXPECT[n];
  const pass = r != null && Math.abs(r - e) < 1e-6;
  if (!pass) ok = false;
  console.log((pass ? '  OK  ' : ' FAIL ') + n + '  实测=' + (r == null ? 'null' : (r * 100).toFixed(2) + '%') + '  期望=' + (e * 100).toFixed(2) + '%');
});
console.log(ok ? '\n[PASS] 内联副本 componentUpRatioByNorm 与 Wind 真实成分股口径一致' : '\n[FAIL] 口径不一致');
process.exit(ok ? 0 : 1);
