const fs = require('fs');
const path = require('path');
const BUILD = 'D:/workboddy/2026-07-06-20-08-50/build';

const htmlPath = path.join(BUILD, 'output/fused_dashboard_v2.html');
let html = fs.readFileSync(htmlPath, 'utf8');
const m = html.match(/var DASHBOARD_DATA = (\{[\s\S]*?\});\nvar CURRENT_DATE/);
if (!m) { console.error('未找到 DASHBOARD_DATA'); process.exit(1); }
const data = JSON.parse(m[1]);
const dt = '2026-07-06';

// 真实 07-06 指数 chg(%) — 来自 westock index quote
const idxChg = {
  "上证50": 0.91, "沪深300": 0.00, "中证500": -1.08, "中证1000": -1.72,
  "中证A500": -0.33, "科创50": 1.04, "创业板指": -1.77, "创业板50": -1.91,
  "中证2000": -1.87, "科创100": -2.36, "深证100": -0.92
};
// 真实 07-06 指数 flow(亿): 上证50/沪深300/科创50=指数级主力净流入; 其余=对应ETF聚合主力净流入
const idxFlow = {
  "上证50": -22.96, "沪深300": -246.88, "科创50": 16.66,
  "中证500": -0.97, "中证1000": 1.02, "中证A500": -0.58
};

// 1) market.indices
const mk = data.data[dt].market;
let miOk = 0;
(mk.indices || []).forEach(it => {
  if (idxChg[it.name] !== undefined) { it.chg = idxChg[it.name]; miOk++; }
  if (idxFlow[it.name] !== undefined) { it.flow = idxFlow[it.name]; }
});
mk.source = 'westock 指数行情+资金流 (实测 2026-07-06)';
console.log('market.indices 更新:', miOk, '项');
console.log(mk.indices.map(i => i.name + ' chg=' + i.chg + ' flow=' + i.flow).join('\n'));

// 2) etfWide.items[].chg (宽基指数涨跌)
const ew = data.data[dt].etfWide;
let ewOk = 0;
ew.items.forEach(it => {
  if (idxChg[it.name] !== undefined) { it.chg = idxChg[it.name]; ewOk++; }
});
console.log('etfWide.items chg 更新:', ewOk, '项');

// 写回
html = html.replace(/var DASHBOARD_DATA = \{[\s\S]*?\};\nvar CURRENT_DATE/, 'var DASHBOARD_DATA = ' + JSON.stringify(data) + ';\nvar CURRENT_DATE');
fs.writeFileSync(htmlPath, html, 'utf8');
console.log('已写回 HTML');
