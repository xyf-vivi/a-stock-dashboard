const fs = require('fs');
const h = fs.readFileSync('output/fused_dashboard_v2.html', 'utf8');
const start = h.indexOf('<div id="tab-structural"');
const seg = h.slice(start, start + 8000);
['科技成长', '证券金融', '红利防御', '创新药/医药成长', '化工'].forEach(name => {
  let idx = seg.indexOf(name);
  let c = 0;
  while (idx >= 0 && c < 2) {
    const ctx = seg.slice(idx - 25, idx + 110).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    console.log('[' + name + ']', ctx.slice(0, 130));
    idx = seg.indexOf(name, idx + name.length); c++;
  }
});
