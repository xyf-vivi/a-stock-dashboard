const fs = require('fs');
const html = fs.readFileSync('output/fused_dashboard_v2.html', 'utf8');
const DMod = require('./src/render');
const dt = '2026-07-06';

// 1) 渲染全部页面，捕获异常
const pages = {
  review: () => DMod.renderReview(html ? null : null, dt), // placeholder
};
// 直接调用各导出渲染函数（传入 (data, dt) 或 (entry)）
const data = (function () {
  const m = html.match(/var DASHBOARD_DATA = (\{[\s\S]*?\});\nvar CURRENT_DATE/);
  return JSON.parse(m[1]);
})();

let allHtml = '';
const calls = [
  ['renderReview', DMod.renderReview],
  ['renderCapital', DMod.renderCapital],
  ['renderEtf', DMod.renderEtf],
  ['renderStructuralReview', DMod.renderStructuralReview],
  ['renderStructure', DMod.renderStructure],
  ['renderCapitalEmotion', DMod.renderCapitalEmotion],
  ['renderValidationQuality', DMod.renderValidationQuality],
  ['renderValidate', DMod.renderValidate],
  ['renderQuality', DMod.renderQuality],
];
let errCount = 0;
for (const [name, fn] of calls) {
  try {
    const h = fn(data, dt);
    allHtml += (h || '') + '\n';
    console.log('  ✓ ' + name + ' 渲染成功 (' + ((h || '').length) + ' 字符)');
  } catch (e) {
    errCount++;
    console.log('  ✗ ' + name + ' 渲染抛错: ' + e.message);
  }
}
console.log('\n渲染异常数: ' + errCount + (errCount === 0 ? ' ✓' : ' !!'));

// 2) 主题广度(成分股) 是否出现在 02 页
const hasBreadthLabel = allHtml.includes('主题广度(成分股)');
const hasCounts = /\((\d+)涨\/(\d+)跌\/(\d+)平\)/.test(allHtml);
console.log('\n=== 02 页主题广度验收 ===');
console.log('出现 "主题广度(成分股)" 标签:', hasBreadthLabel ? '是 ✓' : '否 !!');
console.log('出现 "(X涨/Y跌/Z平)" 家数:', hasCounts ? '是 ✓' : '否 !!');

// 3) 抽验半导体真实值（Wind: 15涨/13跌/1平 upRatio=0.517）
const m2 = allHtml.match(/半导体[\s\S]*?主题广度\(成分股\)[\s\S]*?>(\d+)%[\s\S]*?\((\d+)涨\/(\d+)跌\/(\d+)平\)/);
if (m2) {
  console.log('半导体卡: 比例=' + m2[1] + '% 家数=' + m2[2] + '涨/' + m2[3] + '跌/' + m2[4] + '平');
  const ok = m2[2] === '15' && m2[3] === '13' && m2[4] === '1' && m2[1] === '52';
  console.log('  与 Wind 真实值(15/13/1, 52%)一致:', ok ? '是 ✓' : '否 !!');
} else {
  console.log('  ⚠ 未能从渲染结果中定位半导体卡（标签可能分处不同文本节点）');
}

// 4) HTML 内 DASHBOARD_DATA 的 margin / themeBreadth 真实性
const entry = data.data[dt];
console.log('\n=== 数据真实性验收 (HTML DASHBOARD_DATA) ===');
const mg = entry.margin;
console.log('margin.value(万亿):', mg && mg.value, '| isStale:', mg && mg.isStale, '| source:', mg && mg.source);
console.log('  → 真实 Wind 融资余额(2.9610万亿, isStale=false):', (mg && mg.value === 2.961 && mg.isStale === false && /Wind/.test(mg.source || '')) ? '是 ✓' : '否 !!');
const tb = entry.themeBreadth;
console.log('themeBreadth.themes 数量:', tb && Array.isArray(tb.themes) ? tb.themes.length : '缺失');
if (tb && tb.themes) {
  const semi = tb.themes.find(t => t.name === '半导体');
  console.log('  半导体 themeBreadth: up=' + (semi && semi.upCount) + ' down=' + (semi && semi.downCount) + ' flat=' + (semi && semi.flatCount) + ' source=' + (semi && semi.source));
  const allWind = tb.themes.every(t => /wind/i.test(t.source || ''));
  console.log('  全部 10 主题 source 含 wind:', allWind ? '是 ✓' : '否 !!');
}

// 5) 异常字符
console.log('\n=== 异常字符 ===');
console.log('NaN/undefined/null/++:', (allHtml.match(/>[^<]*NaN[^<]*</g)||[]).length, (allHtml.match(/>[^<]*undefined[^<]*</g)||[]).length, (allHtml.match(/>[^<]*null[^<]*</g)||[]).length, (allHtml.match(/\+\+/g)||[]).length);
