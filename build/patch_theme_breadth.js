// 用 Wind 刚拉的 07-06 真实成分股涨跌家数，覆盖 entry.themeBreadth（替换历史克隆值）
const fs = require('fs');
const WRITE = process.env.WRITE === '1';
const html = fs.readFileSync('output/fused_dashboard_v2.html', 'utf8');
const m = html.match(/var DASHBOARD_DATA = (\{[\s\S]*?\});\nvar CURRENT_DATE/);
const data = JSON.parse(m[1]);
const wind = JSON.parse(fs.readFileSync('cache/breadth_margin_wind_0706.json', 'utf8'));
const windMap = {};
wind.breadth.forEach(b => { windMap[b.name] = b; });

// 07-06 全市场上涨占比（westock 真实值）
const MARKET_UP = 0.3394;

const e = data.data['2026-07-06'];
const tb = e.themeBreadth;
if (!tb || !Array.isArray(tb.themes)) throw new Error('entry.themeBreadth 不存在');

tb.date = '2026-07-06';
tb.label = '2026-07-06';

tb.themes.forEach(t => {
  const w = windMap[t.name];
  if (!w) { console.log('  WARN 无 Wind 数据:', t.name); return; }
  const old = t.upRatio;
  t.upCount = w.upCount;
  t.downCount = w.downCount;
  t.flatCount = w.flatCount;
  t.totalCount = w.totalCount;
  t.upRatio = w.upRatio;
  t.source = 'wind-index';
  t.dataStatus = 'confirmed';
  t.sourceNote = '跟踪指数 ' + w.indexCode;
  t.excessReturn = (w.upRatio != null && MARKET_UP != null) ? +(w.upRatio - MARKET_UP).toFixed(4) : null;
  console.log(`  ${t.name.padEnd(8)} upRatio ${old != null ? old.toFixed(3) : 'null'} -> ${w.upRatio.toFixed(3)}  (${w.upCount}涨/${w.downCount}跌/${w.flatCount}平, 共${w.totalCount})`);
});

if (WRITE) {
  const newJson = JSON.stringify(data);
  const newHtml = html.replace(m[1], newJson);
  fs.writeFileSync('output/fused_dashboard_v2.html', newHtml);
  console.log('\n✓ 已写入 07-06 真实成分股广度数据');
} else {
  console.log('\n[DRY-RUN] 设置 WRITE=1 应用');
}
