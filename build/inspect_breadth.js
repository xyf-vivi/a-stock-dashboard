const fs = require('fs');
const html = fs.readFileSync('output/fused_dashboard_v2.html', 'utf8');
const m = html.match(/var DASHBOARD_DATA = (\{[\s\S]*?\});\nvar CURRENT_DATE/);
const data = JSON.parse(m[1]);
const e = data.data['2026-07-06'];

console.log('=== entry.themeBreadth 是否存在 ===');
console.log('themeBreadth =', e.themeBreadth ? 'EXISTS' : 'NULL/UNDEFINED');
if (e.themeBreadth) {
  console.log('  keys =', Object.keys(e.themeBreadth));
  const themes = e.themeBreadth.themes || e.themeBreadth;
  const arr = Array.isArray(themes) ? themes : Object.values(themes);
  console.log('  子主题数 =', arr.length);
  arr.forEach(t => {
    const b = t.breadth || {};
    const up = b.upCount, dn = b.downCount, tot = b.totalCount;
    const ratio = (up != null && tot != null && tot > 0) ? (up / tot * 100).toFixed(1) + '%' : '--';
    console.log('   ', (t.name||'?').padEnd(12), 'up='+(up??'-'), 'down='+(dn??'-'), 'total='+(tot??'-'), '=>', ratio);
  });
}
console.log('\n=== etfTheme 顶层是否也有 breadth ===');
console.log('etfTheme.breadth =', e.etfTheme && e.etfTheme.breadth ? 'EXISTS' : 'none');
