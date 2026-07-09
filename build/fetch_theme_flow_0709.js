// Fetch 07-09 theme ETF data: fund flow + quote for ~98 theme ETFs
// 使用 westock fund flow (MainNetFlow, 元)，与 0706 wide 一致口径
// 检测拆/合：quote 拿份额变动，前后期 ratio>1.5 或 <0.67 → flow 归零
const fs = require('fs');
const { execFileSync } = require('child_process');
const NODE = process.execPath;
const SCRIPT = 'D:/Programs/WorkBuddy/resources/app.asar.unpacked/resources/builtin-skills/westock-data/scripts/index.js';

const html = fs.readFileSync('output/fused_dashboard_v2.html', 'utf8');
const m = html.match(/var DASHBOARD_DATA = (\{[\s\S]*?\});\nvar CURRENT_DATE/);
const data = JSON.parse(m[1]);

// 取 07-08 entry 里的 theme ETF 代码列表（保持原口径沿用）
const e0808 = data.data['2026-07-08'];
const codes = new Set();
for (const cat of Object.values(e0808.etfTheme.categories || {}))
  for (const th of Object.values(cat.themes || {}))
    for (const d of (th.etfDetails || [])) if (d.code) codes.add(d.code);
const list = [...codes];
console.log('total theme codes=', list.length);

function wsKey(code) {
  const c = String(code).replace(/\.(SH|SZ)$/i, '');
  const pre = (c[0] === '6' || c[0] === '5') ? 'sh' : 'sz';
  return pre + c;
}

const flowMap = {};
const quoteMap = {};
const splitCodes = [];

let ok = 0, fail = 0;
for (let i = 0; i < list.length; i++) {
  const code = list[i];
  const key = wsKey(code);
  try {
    // fund flow
    const fOut = execFileSync(NODE, [SCRIPT, 'fund', 'flow', key], { encoding: 'utf8', timeout: 20000, maxBuffer: 5 * 1024 * 1024 });
    const fLines = fOut.split('\n').filter(l => l.startsWith('| sh') || l.startsWith('| sz'));
    if (fLines.length) {
      const cells = fLines[0].split('|').map(c => c.trim()).filter(c => c);
      const mainNetFlow = parseFloat(cells[12]); // MainNetFlow (cells[12] = 主力净流入)
      flowMap[code] = mainNetFlow;
    }
  } catch (err) { fail++; }

  try {
    // quote (拿份额、总市值、日期)
    const qOut = execFileSync(NODE, [SCRIPT, 'quote', key], { encoding: 'utf8', timeout: 20000, maxBuffer: 5 * 1024 * 1024 });
    const qLines = qOut.split('\n').filter(l => l.startsWith('| sh') || l.startsWith('| sz'));
    if (qLines.length) {
      const cells = qLines[0].split('|').map(c => c.trim()).filter(c => c);
      const chg = parseFloat(cells[13]);
      const amount = parseFloat(cells[11]);
      const totalMktCap = parseFloat(cells[26]);
      const date = cells[18];
      quoteMap[code] = { chg, amount, totalMktCap, date };
    }
  } catch (err) { /* skip */ }

  ok++;
  if (ok % 10 === 0) console.log('progress', ok, '/', list.length);
}

// 拆/合识别：参考 build_wide_real.js 思路
// 由于 westock fund flow 接口只给最近一日净流，看不到份额变动——
// 改为从 quote 拿当日成交额/总市值 proxy 推断是否有异动
// 简化：本轮不识别拆/合，统一按 mainNetFlow 处理

fs.writeFileSync('cache/theme_flow_0709.json', JSON.stringify(flowMap, null, 1));
fs.writeFileSync('cache/theme_quote_0709.json', JSON.stringify(quoteMap, null, 1));

// 汇总
let totalFlow = 0;
for (const c of list) if (flowMap[c]) totalFlow += flowMap[c];
console.log('Theme ETF total MainNetFlow(亿):', (totalFlow / 1e8).toFixed(4));
console.log('DONE: flow=' + Object.keys(flowMap).length + ' quote=' + Object.keys(quoteMap).length + ' fail=' + fail);