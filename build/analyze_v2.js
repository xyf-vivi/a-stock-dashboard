const fs = require('fs');
const R = require('./src/render.js');
const html = fs.readFileSync('output/fused_dashboard_v2.html', 'utf8');
const m = html.match(/var DASHBOARD_DATA = (\{[\s\S]*?\});\nvar CURRENT_DATE/);
const data = JSON.parse(m[1]);
const e = data.data['2026-07-06'];
const wma = data.weeklyMA34;

// 成分股口径（改后 render.js）
const lb = R.buildThemeLeaderBoard(e, data, '2026-07-06', wma);

// ETF 池口径（原始 bucket upRatio，不覆盖）
const buckets = R.buildIndustryEtfBuckets(e);
const innov = R.buildInnovativeDrugBucket(e);
const allB = [];
if (innov && innov.etfCount > 0) allB.push(innov);
Object.keys(buckets).forEach(k => {
  if (k === '医药生物' && innov) return;
  if (buckets[k] && buckets[k].etfs.length > 0) allB.push(buckets[k]);
});
const etfUp = {};
allB.forEach(b => { etfUp[b.name] = b.upRatio; });

console.log('排名  主题                成分股upRatio  ETF池upRatio  flowDay(亿)  medianChg%  score   类型');
console.log('-'.repeat(96));
lb.forEach((x, i) => {
  const eu = etfUp[x.name] != null ? (etfUp[x.name] * 100).toFixed(0) + '%' : '  - ';
  const cu = x.upRatio != null ? (x.upRatio * 100).toFixed(0) + '%' : '  - ';
  const fd = x.flowDay != null ? x.flowDay.toFixed(2) : '-';
  const mc = x.medianChg != null ? x.medianChg.toFixed(2) : '-';
  const top = i < 3 ? '  <== TOP3' : '';
  console.log(
    String(i + 1).padEnd(4),
    x.name.padEnd(18),
    cu.padEnd(12),
    eu.padEnd(12),
    String(fd).padEnd(10),
    String(mc).padEnd(10),
    String(x.score).padEnd(7),
    x.leaderType + top
  );
});
