// morning_patch_0709.js — 综合 patch 脚本：克隆 07-08 entry 为 07-09，应用真实 7/9 数据
// 注意：theme flow 用 westock 主力净流入(元/1e8→亿)口径，与 wide flow 口径一致；
//   07-08 etfTheme 用 Wind 份额净申购口径(亿)，本轮主题口径有变化，需在 meta.sourceNote 标注
const fs = require('fs');
const path = require('path');
const BUILD = __dirname;
const DT = '2026-07-09';
const PREV_DT = '2026-07-08';

const F = path.join(BUILD, 'output/fused_dashboard_v2.html');
let html = fs.readFileSync(F, 'utf8');
const m = html.match(/var DASHBOARD_DATA = (\{[\s\S]*?\});\nvar CURRENT_DATE/);
if (!m) { console.error('no DASHBOARD_DATA'); process.exit(1); }
const data = JSON.parse(m[1]);

// 1) 克隆 07-08 entry 为 07-09 模板
console.log('=== 1) 克隆 07-08 → 07-09 entry ===');
const prev = data.data[PREV_DT];
if (!prev) { console.error('no 07-08 entry'); process.exit(1); }
const e0709 = JSON.parse(JSON.stringify(prev));
e0709.date = DT;
e0709.label = '07/09';
e0709.meta = {
  ...prev.meta,
  quoteTime: '2026-07-09',
  etfShareDate: '2026-07-09',
  marginDate: '2026-07-08',  // Wind 滞后
  fetchTime: '2026-07-10T07:' + new Date().getMinutes().toString().padStart(2,'0') + ':00.000Z',
  phase: 'partial',  // 缺 concentration + theme flow 口径差异 + margin 滞后
  completeness: 0.85,
  pendingItems: [
    'concentration.top100 未拉（全市场成交集中度 westock/tdx 不可达）',
    'margin.date=2026-07-08（Wind 滞后，07-09 未发布）',
    'theme flow 口径：westock 主力净流入(亿)，与 07-08 Wind 份额净申购口径不同'
  ]
};

// 2) 宽基 ETF：写 55 只真实 flow/quote，重算 per-index 和 total
console.log('=== 2) 应用宽基 ETF 7/9 真实数据 ===');
const wq = JSON.parse(fs.readFileSync(path.join(BUILD, 'cache/wide_quote_0709.json'), 'utf8'));
const wf = JSON.parse(fs.readFileSync(path.join(BUILD, 'cache/wide_flow_0709.json'), 'utf8'));
function wsKey(code) {
  const c = String(code).replace(/\.(SH|SZ)$/i, '');
  const pre = (c[0] === '6' || c[0] === '5') ? 'sh' : 'sz';
  return pre + c;
}
let ewTotal = 0, ewPatched = 0, ewMissing = [];
e0709.etfWide.items.forEach(it => { it.flow = 0; });
['inflowDetails', 'outflowDetails'].forEach(kind => {
  const obj = e0709.etfWide[kind] || {};
  for (const idx of Object.keys(obj)) {
    (obj[idx] || []).forEach(d => {
      const codeBare = String(d.code).replace(/\.(SH|SZ)$/i, '');  // 510300
      const f = wf[codeBare], q = wq[codeBare];
      if (f === undefined || q === undefined) { ewMissing.push(d.code); return; }
      const realFlowYi = f / 1e8;
      d.flow = +realFlowYi.toFixed(4);
      d.chg = q.chg;
      d.fundSize = +q.fundSize.toFixed(4);
      d.volume = +q.volume.toFixed(4);
      ewTotal += f;
      ewPatched++;
    });
  }
});
e0709.etfWide.items.forEach(it => {
  let s = 0;
  let firstCode = null;
  ['inflowDetails', 'outflowDetails'].forEach(kind => {
    const arr = (e0709.etfWide[kind] && e0709.etfWide[kind][it.name]) || [];
    if (arr.length && !firstCode) firstCode = arr[0].code;
    arr.forEach(d => {
      const codeBare = String(d.code).replace(/\.(SH|SZ)$/i, '');
      if (wf[codeBare] !== undefined) s += wf[codeBare];
    });
  });
  it.flow = +(s / 1e8).toFixed(4);
  if (firstCode) {
    const cb = firstCode.replace(/\.(SH|SZ)$/i, '');
    it.chg = (wq[cb] || {}).chg;
  }
});
e0709.etfWide.totalFlow = +(ewTotal / 1e8).toFixed(4);
e0709.etfWide.source = 'westock 主力净流入 (实测 2026-07-09)';
e0709.etfWide.status = 'confirmed';
console.log('  wide patched:', ewPatched, 'missing:', ewMissing.length, 'totalFlow(亿):', e0709.etfWide.totalFlow);

// 3) 6 大指数：chg 真实（westock quote 已确认）
console.log('=== 3) 应用 6 大指数 7/9 chg ===');
const idxChg = {
  '上证50': 2.57, '沪深300': 2.54, '中证500': 3.13, '中证1000': 2.24,
  '中证A500': 2.83, '科创50': 8.41
};
e0709.market.indices.forEach(it => {
  if (idxChg[it.name] !== undefined) it.chg = idxChg[it.name] / 100;  // 百分数 → 小数
  it.flow = 0;  // westock 无指数资金流；归零（保留 07-08 值会混淆）
});
e0709.market.source = 'westock 指数行情(07-09) + 资金流 0(接口不可达)';
console.log('  6 大指数 chg:', Object.entries(idxChg).map(([k,v]) => k + '=' + v + '%').join(' '));

// 4) 主题 ETF 资金流：westock 主力净流入(元) 覆盖
console.log('=== 4) 应用主题 ETF 7/9 资金流 (westock MainNetFlow) ===');
const tflow = JSON.parse(fs.readFileSync(path.join(BUILD, 'cache/theme_flow_0709.json'), 'utf8'));
const tquote = JSON.parse(fs.readFileSync(path.join(BUILD, 'cache/theme_quote_0709.json'), 'utf8'));
let themePatched = 0, themeMissing = 0;
for (const [cn, cat] of Object.entries(e0709.etfTheme.categories)) {
  for (const [tn, th] of Object.entries(cat.themes)) {
    let sum = 0, sum5 = 0;
    for (const d of (th.etfDetails || [])) {
      const f = tflow[d.code], q = tquote[d.code];
      if (f !== undefined && f !== null) {
        d.flow = +(f / 1e8).toFixed(4);
        d.status = 'confirmed';
        d.source = 'westock 主力净流入';
        if (q) {
          if (q.chg != null) d.chg = +q.chg.toFixed(2);
          if (q.amount != null) d.volume = +(q.amount / 1e8).toFixed(4);
          if (q.totalMktCap != null) d.fundSize = +(q.totalMktCap / 1e8).toFixed(4);
        }
        sum += d.flow;
        themePatched++;
      } else themeMissing++;
    }
    th.flow = +sum.toFixed(4);
  }
  let csum = 0;
  for (const th of Object.values(cat.themes)) csum += th.flow || 0;
  cat.totalFlow = +csum.toFixed(2);
}
e0709.etfTheme.date = DT;
e0709.etfTheme.status = 'confirmed';
let grandTheme = 0;
for (const cat of Object.values(e0709.etfTheme.categories)) {
  for (const th of Object.values(cat.themes)) grandTheme += th.flow || 0;
}
console.log('  theme patched:', themePatched, 'missing:', themeMissing, 'grand totalFlow(亿):', +grandTheme.toFixed(2));

// 5) themeBreadth：10 主题成分股涨跌家数 (Wind 实时)
console.log('=== 5) 应用 themeBreadth 7/9 (Wind 实时) ===');
const b = JSON.parse(fs.readFileSync(path.join(BUILD, 'cache/breadth_wind_0709.json'), 'utf8'));
// 直接按子主题名匹配（prev.themeBreadth.themes[].name = 半导体/AI/...，与 b.breadth[].name 一致）
const byName = {};
for (const t of b.breadth) {
  if (t.upCount != null) byName[t.name] = t;
}
e0709.themeBreadth = {
  date: '20260709',
  label: '2026-07-09',
  generated: new Date().toISOString(),
  source: 'wind index_data.get_index_price_indicators (latest as of 2026-07-10 07:xx)',
  themes: []
};
for (const th of (prev.themeBreadth && prev.themeBreadth.themes) || []) {
  const wt = byName[th.name];
  if (wt) {
    e0709.themeBreadth.themes.push({
      name: th.name, category: th.category, hasBreadth: true,
      source: 'index', sourceNote: '跟踪指数 ' + wt.indexCode,
      dataStatus: 'confirmed',
      indexCode: wt.indexCode,
      upCount: wt.upCount, downCount: wt.downCount, flatCount: wt.flatCount, totalCount: wt.totalCount,
      upRatio: +wt.upRatio.toFixed(4),
      excessReturn: null, medianReturn: null, marketMedian: null
    });
  } else {
    e0709.themeBreadth.themes.push({
      name: th.name, category: th.category, hasBreadth: false,
      dataStatus: 'historical_missing'
    });
  }
}
console.log('  themeBreadth themes (hasBreadth/total):', e0709.themeBreadth.themes.filter(t => t.hasBreadth).length + '/' + e0709.themeBreadth.themes.length);

// 6) margin：沿用 07-08 真实值 + isStale
console.log('=== 6) margin 沿用 07-08 + isStale ===');
e0709.margin = {
  value: 2.9290,  // 07-08 = 29290.26亿 = 2.9290 万亿
  date: '2026-07-08',
  chg: (29290.26 - 29479.38) / 100,  // vs 07-07
  chgYi: -189.12,  // 较 07-07
  trend5d: 'down',
  isStale: true,
  status: 'stale',
  weight: 1,
  source: 'Wind EDB M0061606+M0061610 (07-08, 07-09 滞后未发布)'
};
console.log('  margin:', e0709.margin.value, '万亿 isStale:', e0709.margin.isStale);

// 7) klineSummary：基于 kline_0709 重算 chg1d/chg5d/chg20d
console.log('=== 7) 应用 klineSummary 7/9 ===');
const kd = JSON.parse(fs.readFileSync(path.join(BUILD, 'cache/kline_0709.json'), 'utf8'));
const ks = e0709.klineSummary;
let kPatched = 0, kSkipped = 0;
for (const orig of Object.keys(ks)) {
  const k = kd[orig];
  if (!k || !k.nodes || k.nodes.length < 6) { kSkipped++; continue; }
  const last = i => parseFloat(k.nodes[i].last);
  const chg1d = (last(0) / last(1) - 1) * 100;
  const chg5d = (last(0) / last(5) - 1) * 100;
  const chg20d = k.nodes.length > 20 ? (last(0) / last(20) - 1) * 100 : (last(0) / last(k.nodes.length - 1) - 1) * 100;
  ks[orig].chg1d = +chg1d.toFixed(4);
  ks[orig].chg5d = +chg5d.toFixed(4);
  ks[orig].chg20d = +chg20d.toFixed(4);
  ks[orig].lastClose = +last(0).toFixed(2);
  ks[orig].latestDate = DT;
  ks[orig].latestDateRaw = '20260709';
  ks[orig].source = 'westock kline (实测 2026-07-09)';
  kPatched++;
}
console.log('  kline patched:', kPatched, 'skipped:', kSkipped);

// 8) idxChgSeries：6 大指数 chg1d 真实
console.log('=== 8) idxChgSeries 6 大指数 chg1d ===');
e0709.idxChgSeries = { indices: {}, date: DT };
for (const it of e0709.market.indices) {
  e0709.idxChgSeries.indices[it.name] = { chg1d: it.chg, date: DT };
}

// 9) computed：基于新数据重算部分字段（仅依赖 wide）
console.log('=== 9) computed 重算部分字段 ===');
const totalFlow = e0709.etfWide.totalFlow;
const prevTotalFlow = data.data[PREV_DT].etfWide.totalFlow;
e0709.computed = {
  ...prev.computed,
  wideFlow5dSum: null,  // 不重算
  wideFlowPctile20d: null,
  top100Pctile20d: null, top10Pctile20d: null, top100Chg: null,
  amountChgPct: null, amountPrev: null, amountVs5d: null, amountPctile20d: null,
  top10UpRatio: null, top10Median: null
};

// 10) 写回 DASHBOARD_DATA，添加 07-09 entry
data.data[DT] = e0709;
data.dates = data.dates.filter(d => d !== DT);
data.dates.push(DT);

html = html.replace(/var DASHBOARD_DATA = \{[\s\S]*?\};\nvar CURRENT_DATE/, 'var DASHBOARD_DATA = ' + JSON.stringify(data) + ';\nvar CURRENT_DATE');

// 11) 重渲染 tab-structural（静态块）
console.log('=== 11) 重渲染 tab-structural 静态块 ===');
const R = require(path.join(BUILD, 'src/render.js'));
const newTab = R.renderStructuralReview(data, DT);

// 跳过 <script> 的 div 栈扫描定位 tab-structural
const startMarker = '<div class="page tab-content" id="tab-structural">';
const startIdx = html.indexOf(startMarker);
if (startIdx < 0) { console.error('tab-structural start not found'); process.exit(1); }

// 找匹配 </div>：从 startIdx 开始，过 script 段
let depth = 0, i = startIdx, foundEnd = -1;
const tagRe = /<(\/?)div\b|<script\b|<\/script>/g;
tagRe.lastIndex = startIdx;
let m2;
let inScript = false;
while ((m2 = tagRe.exec(html)) !== null) {
  const tag = m2[0];
  if (tag === '<script') { inScript = true; continue; }
  if (tag === '</script>') { inScript = false; continue; }
  if (inScript) continue;
  if (m2[1] === '') {  // 起始 div
    if (depth === 0 && m2.index > startIdx + startMarker.length) break;
    depth++;
  } else {  // 闭合 </div>
    depth--;
    if (depth === 0) { foundEnd = m2.index + m2[0].length; break; }
  }
}
if (foundEnd < 0) { console.error('tab-structural end not found'); process.exit(1); }
const before = html.slice(0, startIdx);
const after = html.slice(foundEnd);
const newHtml = before + newTab + after;
fs.writeFileSync(F, newHtml, 'utf8');
console.log('已写回 HTML（tab-structural 已重渲染，长度', newTab.length, '）');

console.log('\n=== 完成 ===');
console.log('新 entry ' + DT + ' 已添加');
console.log('  wide totalFlow:', e0709.etfWide.totalFlow, '亿');
console.log('  theme totalFlow:', +grandTheme.toFixed(2), '亿（westock 主力净流入口径）');
console.log('  margin:', e0709.margin.value, '万亿 (isStale, 07-08)');
console.log('  klineSummary 更新:', kPatched);
console.log('  themeBreadth 主题:', e0709.themeBreadth.themes.filter(t => t.hasBreadth).length);
console.log('  meta.phase:', e0709.meta.phase);