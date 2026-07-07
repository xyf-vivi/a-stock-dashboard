// 把 Wind 真实取的 themeBreadth(07-06) 与 margin(07-06) 写回 HTML + 源数据文件
const fs = require('fs');
const BUILD = __dirname;
const HTML = BUILD + '/output/fused_dashboard_v2.html';

const cache = JSON.parse(fs.readFileSync(BUILD + '/cache/breadth_margin_wind_0706.json', 'utf8'));
const windBreadth = cache.breadth; // 10 主题真实涨跌家数
const m = cache.margin; // 融资余额

let html = fs.readFileSync(HTML, 'utf8');
const bm = html.match(/var DASHBOARD_DATA = (\{[\s\S]*?\});\nvar CURRENT_DATE/);
if (!bm) { console.error('找不到 DASHBOARD_DATA'); process.exit(1); }
const data = JSON.parse(bm[1]);
const DT = '2026-07-06';
const entry = data.data[DT];
const prev = data.data['2026-07-03'];

// ---------- themeBreadth ----------
const prevTb = prev.themeBreadth && prev.themeBreadth.themes ? prev.themeBreadth.themes : [];
const metaMap = {};
prevTb.forEach(t => { metaMap[t.name] = t; });

const themes0706 = windBreadth.map(w => {
  const meta = metaMap[w.name] || {};
  return {
    name: w.name,
    category: meta.category || null,
    hasBreadth: true,
    source: 'wind-index',
    sourceNote: '跟踪指数 ' + w.indexCode,
    dataStatus: 'confirmed',
    indexCode: w.indexCode,
    upCount: w.upCount,
    downCount: w.downCount,
    flatCount: w.flatCount,
    totalCount: w.totalCount,
    upRatio: w.upRatio,
    excessReturn: meta.excessReturn != null ? meta.excessReturn : null,
    medianReturn: meta.medianReturn != null ? meta.medianReturn : null,
    marketMedian: meta.marketMedian != null ? meta.marketMedian : null,
    coverage: meta.coverage != null ? meta.coverage : null
  };
});
entry.themeBreadth = { date: DT, label: '2026-07-06', themes: themes0706 };
console.log('themeBreadth 07-06 已组装，主题数=' + themes0706.length);

// ---------- margin ----------
entry.margin = {
  value: m.finBalTrillion,
  date: DT,
  chg: m.chgTrillion,
  chgYi: m.chgYi,
  trend5d: m.chgYi < 0 ? 'down' : 'up',
  isStale: false,
  status: 'confirmed',
  weight: 1,
  source: 'Wind MCP 沪深融资余额'
};
console.log('margin 07-06: value=' + m.finBalTrillion.toFixed(4) + '万亿 chgYi=' + m.chgYi.toFixed(2) + '亿 trend5d=' + entry.margin.trend5d);

// 写回 HTML
const newBlob = 'var DASHBOARD_DATA = ' + JSON.stringify(data) + ';\nvar CURRENT_DATE';
html = html.replace(/var DASHBOARD_DATA = \{[\s\S]*?\};\nvar CURRENT_DATE/, newBlob);
fs.writeFileSync(HTML, html, 'utf8');
console.log('HTML 已写回');

// ---------- 同步源数据文件 projCopy/theme_breadth_data.json ----------
const tbFile = BUILD + '/projCopy/theme_breadth_data.json';
if (fs.existsSync(tbFile)) {
  const tbData = JSON.parse(fs.readFileSync(tbFile, 'utf8'));
  tbData[DT] = {
    date: DT, label: '2026-07-06',
    themes: windBreadth.map(w => ({ name: w.name, upRatio: w.upRatio, medianReturn: null, source: 'wind-index', dataStatus: 'confirmed' }))
  };
  fs.writeFileSync(tbFile, JSON.stringify(tbData, null, 2));
  console.log('projCopy/theme_breadth_data.json 已加 07-06 键');
}
console.log('完成');
