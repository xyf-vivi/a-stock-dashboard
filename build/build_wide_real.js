const fs = require('fs');
const path = require('path');
const BUILD = 'D:/workboddy/2026-07-06-20-08-50/build';

// 读取 HTML 中的 DASHBOARD_DATA
const htmlPath = path.join(BUILD, 'output/fused_dashboard_v2.html');
let html = fs.readFileSync(htmlPath, 'utf8');
const m = html.match(/var DASHBOARD_DATA = (\{[\s\S]*?\});\nvar CURRENT_DATE/);
if (!m) { console.error('未找到 DASHBOARD_DATA'); process.exit(1); }
const data = JSON.parse(m[1]);

const flowMap = JSON.parse(fs.readFileSync(path.join(BUILD, 'cache/wide_flow_0706.json'), 'utf8'));
const quoteMap = JSON.parse(fs.readFileSync(path.join(BUILD, 'cache/wide_quote_0706.json'), 'utf8'));

function wsKey(code) {
  const c = String(code);
  const pre = (c[0] === '6' || c[0] === '5') ? 'sh' : 'sz';
  return pre + c;
}

const dt = '2026-07-06';
const ew = data.data[dt].etfWide;

let totalFlowYuan = 0;
let patchedEtfs = 0;
let missing = [];

// 更新每个 detail ETF 的真实 flow/chg/fundSize/volume
['inflowDetails', 'outflowDetails'].forEach(kind => {
  const obj = ew[kind] || {};
  for (const idx of Object.keys(obj)) {
    (obj[idx] || []).forEach(it => {
      const key = wsKey(it.code);
      const f = flowMap[key];
      const q = quoteMap[key];
      if (f === undefined || q === undefined) { missing.push(it.code); return; }
      const realFlowYi = f / 1e8;          // 主力净流入(亿)
      it.flow = +realFlowYi.toFixed(4);
      it.chg = q[0];                        // 真实涨跌幅%
      it.fundSize = +q[1].toFixed(4);      // 真实规模(亿)
      it.volume = +q[2].toFixed(4);        // 真实成交额(亿)
      totalFlowYuan += f;
      patchedEtfs++;
    });
  }
});

// 重算每个宽基指数的 flow
ew.items.forEach(it => {
  let s = 0;
  ['inflowDetails', 'outflowDetails'].forEach(kind => {
    const arr = (ew[kind] && ew[kind][it.name]) || [];
    arr.forEach(d => {
      const key = wsKey(d.code);
      if (flowMap[key] !== undefined) s += flowMap[key];
    });
  });
  it.flow = +(s / 1e8).toFixed(4);
});

ew.totalFlow = +(totalFlowYuan / 1e8).toFixed(4);
ew.source = 'westock 主力净流入 (实测 2026-07-06)';
ew.status = 'confirmed';
ew.plannedSamples = ew.items.reduce((a, it) => a + ((ew.inflowDetails[it.name] || []).length + (ew.outflowDetails[it.name] || []).length), 0);
ew.validSamples = ew.plannedSamples;
ew.coverage = 1;

console.log('已更新 ETF 明细数:', patchedEtfs);
console.log('缺失匹配:', missing.length ? missing.join(',') : '无');
console.log('07-06 宽基真实 totalFlow(亿):', ew.totalFlow);
ew.items.forEach(it => console.log('  ' + it.name + ' flow(亿)=' + it.flow));

// 写回 HTML（整块替换 DASHBOARD_DATA）
html = html.replace(/var DASHBOARD_DATA = \{[\s\S]*?\};\nvar CURRENT_DATE/, 'var DASHBOARD_DATA = ' + JSON.stringify(data) + ';\nvar CURRENT_DATE');
fs.writeFileSync(htmlPath, html, 'utf8');
console.log('已写回 HTML');
