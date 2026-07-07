const fs = require('fs');
const h = fs.readFileSync('output/fused_dashboard_v2.html', 'utf8');
// 1) 主线候选表行（static structural tab）
const start = h.indexOf('<div id="tab-structural"');
const seg = h.slice(start, start + 8000);
const trs = seg.match(/<tr[\s\S]*?<\/tr>/g) || [];
console.log('=== 主线候选表行（含主题名） ===');
let n = 0;
trs.forEach(tr => {
  const txt = tr.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  if (/科技成长|证券金融|红利防御|创新药|化工|有色资源/.test(txt)) { console.log(txt.slice(0, 150)); n++; }
});
console.log('matched rows:', n);
// 2) 86% 上下文
const i = h.indexOf('86%');
if (i >= 0) console.log('\n=== 86% 上下文 ===\n', h.slice(i - 80, i + 25).replace(/\s+/g, ' '));
else console.log('\n无 86%');
