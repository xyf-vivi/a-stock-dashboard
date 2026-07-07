const fs = require('fs');
const html = fs.readFileSync('output/fused_dashboard_v2.html', 'utf8');
const m = html.match(/var DASHBOARD_DATA = (\{[\s\S]*?\});\nvar CURRENT_DATE/);
const data = JSON.parse(m[1]);
const DMod = require('./src/render');
const dt = '2026-07-06';

const h0 = DMod.renderStructuralReview(data, dt);
const h2 = DMod.renderStructure(data, dt);
const h4 = DMod.renderValidationQuality(data, dt);
const all = h0 + h2 + h4;

console.log('=== 验收 #1: 样本覆盖不足 触发条件 ===');
const ds = DMod.buildDecisionState(data.data[dt], data, dt);
const tq = ds.themeQualityMap;
console.log('各主题 valid数 / coverageRatio / 是否提示不足:');
for (const name of Object.keys(tq)) {
  const q = tq[name];
  const flagged = q.coverageRatio < 0.6;
  console.log('  ' + name + ': valid=' + q.sampleCount + ' ratio=' + q.coverageRatio + ' 提示不足=' + flagged);
}
const strongClueBad = (ds.mainLineCandidates.filter(c => c.slot === 'strongClue').map(c => c.name + '[' + (c.reason||[]).join(',') + ']'));
console.log('强线索待确认:', JSON.stringify(strongClueBad));
console.log('正式主线:', JSON.stringify(ds.mainLineCandidates.filter(c => c.slot === 'formal').map(c => c.name)));

console.log('\n=== 验收 #9: 异常字符检查 ===');
console.log('可见 "NaN" 次数:', (all.match(/>[^<]*NaN[^<]*</g) || []).length);
console.log('可见 "undefined" 次数:', (all.match(/>[^<]*undefined[^<]*</g) || []).length);
console.log('可见 "null" 次数:', (all.match(/>[^<]*null[^<]*</g) || []).length);
console.log('可见 "++" 次数:', (all.match(/\+\+/g) || []).length);
console.log('"样本覆盖不足" 总次数(全三页):', (all.match(/样本覆盖不足/g) || []).length);
console.log('"数据缺口" 总次数(全三页):', (all.match(/数据缺口/g) || []).length);

// 核对：只有当 valid<3 才应出现"样本覆盖不足"
let violation = false;
for (const name of Object.keys(tq)) {
  if (tq[name].coverageRatio < 0.6 && tq[name].sampleCount >= 3) {
    console.log('  ⚠ 违规: ' + name + ' ratio<0.6 但 valid=' + tq[name].sampleCount);
    violation = true;
  }
}
console.log('门控违规(有效≥3却被标不足):', violation ? '存在!!' : '无 ✓');
