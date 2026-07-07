// 把 HTML 内联的 avgEtfUpRatio 替换为成分股优先版本（不重跑 _regen，保住 07-06 patch）
const fs = require('fs');
const HTML = __dirname + '/output/fused_dashboard_v2.html';
let html = fs.readFileSync(HTML, 'utf8');

const i = html.indexOf('function avgEtfUpRatio');
if (i < 0) { console.error('未找到 avgEtfUpRatio'); process.exit(1); }
const tailMarker = 'return n > 0 ? s / n : null;';
const tm = html.indexOf(tailMarker, i);
const end = html.indexOf('}', tm); // 函数结束的 }
const oldFn = html.substring(i, end + 1);

const newFn = `function avgEtfUpRatio(entry, themeNames) {
  // 优先：entry.themeBreadth 真实「成分股涨跌家数」口径（Wind 指数成分股）
  if (entry && entry.themeBreadth && Array.isArray(entry.themeBreadth.themes)) {
    var bmap = {};
    entry.themeBreadth.themes.forEach(function (t) { if (t && t.name && t.upRatio != null) bmap[t.name] = t.upRatio; });
    var bs = [];
    themeNames.forEach(function (nm) { if (bmap[nm] != null) bs.push(bmap[nm]); });
    if (bs.length > 0) { var sb = 0; bs.forEach(function (v) { sb += v; }); return sb / bs.length; }
  }
  // fallback：ETF 级口径
  if (!entry || !entry.etfTheme || !entry.etfTheme.categories || themeNames.length === 0) return null;
  var s = 0, n = 0;
  for (var ck in entry.etfTheme.categories) {
    var cat = entry.etfTheme.categories[ck];
    if (!cat || !cat.themes) continue;
    for (var tk in cat.themes) {
      if (themeNames.indexOf(tk) >= 0) {
        var t = cat.themes[tk];
        var ratio = null;
        if (t.upRatio != null) ratio = t.upRatio;
        else if (t.breadth && t.breadth.upCount != null && t.breadth.totalCount != null && t.breadth.totalCount > 0) {
          ratio = t.breadth.upCount / t.breadth.totalCount;
        }
        if (ratio != null) { s += ratio; n++; }
      }
    }
  }
  return n > 0 ? s / n : null;
}`;

if (html.indexOf(oldFn) < 0) { console.error('oldFn 精确匹配失败'); process.exit(1); }
html = html.replace(oldFn, newFn);
fs.writeFileSync(HTML, html, 'utf8');
console.log('HTML avgEtfUpRatio 已替换为成分股优先版本');
