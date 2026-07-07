const fs = require('fs');
const path = require('path');
const BUILD = 'D:/workboddy/2026-07-06-20-08-50/build';
const htmlPath = path.join(BUILD, 'output/fused_dashboard_v2.html');
let html = fs.readFileSync(htmlPath, 'utf8');
const m = html.match(/var DASHBOARD_DATA = (\{[\s\S]*?\});\nvar CURRENT_DATE/);
const data = JSON.parse(m[1]);
const dt = '2026-07-06';

// idxChgSeries: idxChg1d = 真实 07-06 市场日涨幅(用沪深300真实chg); prevChg1d = 07-03 当日涨幅(原值0.2114)
const hs300 = data.data[dt].klineSummary['000300.SH'];
const idxChg1d = hs300 ? hs300.chg1d : 0;
data.data[dt].idxChgSeries = { idxChg1d: +idxChg1d.toFixed(4), prevChg1d: 0.2114 };
console.log('idxChgSeries.idxChg1d(真实07-06)=', idxChg1d);

// 写回
html = html.replace(/var DASHBOARD_DATA = \{[\s\S]*?\};\nvar CURRENT_DATE/, 'var DASHBOARD_DATA = ' + JSON.stringify(data) + ';\nvar CURRENT_DATE');
fs.writeFileSync(htmlPath, html, 'utf8');

// === 全量比对 07-06 vs 07-03 ===
const a = data.data['2026-07-03'], b = data.data['2026-07-06'];
function isReal(bVal, aVal) {
  if (JSON.stringify(bVal) === JSON.stringify(aVal)) return '克隆(==07-03)';
  return '已更新(≠07-03)';
}
const rows = ['etfWide', 'market', 'concentration', 'margin', 'shareData', 'themeBreadth', 'computed', 'klineSummary', 'idxChgSeries'];
console.log('\n=== 07-06 各字段 vs 07-03 比对 ===');
rows.forEach(k => {
  const same = JSON.stringify(a[k]) === JSON.stringify(b[k]);
  let note = '';
  if (k === 'etfWide') note = 'totalFlow=' + b.etfWide.totalFlow + '亿(原-147.63)';
  if (k === 'margin') note = 'date=' + b.margin.date + ' isStale=' + b.margin.isStale + '(无法还原,Wind断开)';
  if (k === 'concentration') note = 'status=' + (b.concentration.status || '?') + '(无Wind无法还原)';
  if (k === 'themeBreadth') note = b.themeBreadth === null ? 'null(无Wind无法还原)' : '';
  if (k === 'shareData') note = b.shareData === null ? 'null' : '';
  console.log('  [' + (same ? '克隆' : '已更新') + '] ' + k + (note ? '  → ' + note : ''));
});
console.log('\n已写回 HTML');
