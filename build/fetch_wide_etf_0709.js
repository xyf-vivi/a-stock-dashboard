// Fetch 07-09 wide ETF data: quote + fund flow for 55 ETFs
const fs = require('fs');
const { execFileSync } = require('child_process');
const NODE = process.execPath;
const SCRIPT = 'D:/Programs/WorkBuddy/resources/app.asar.unpacked/resources/builtin-skills/westock-data/scripts/index.js';

const codes = JSON.parse(fs.readFileSync('cache/wide_codes_078.json', 'utf8'));
const quoteMap = {};
const flowMap = {};

function wsKey(code) {
  const c = String(code);
  const pre = (c[0] === '6' || c[0] === '5') ? 'sh' : 'sz';
  return pre + c;
}

let ok = 0, fail = 0;
for (const code of codes) {
  const key = wsKey(code);
  try {
    // quote
    const qOut = execFileSync(NODE, [SCRIPT, 'quote', key], { encoding: 'utf8', timeout: 20000 });
    const qLines = qOut.split('\n').filter(l => l.startsWith('| sh') || l.startsWith('| sz'));
    if (qLines.length) {
      const cells = qLines[0].split('|').map(c => c.trim()).filter(c => c);
      const chg = parseFloat(cells[13]);
      const totalMktCap = parseFloat(cells[26]); // total_market_cap in 亿-ish
      const amount = parseFloat(cells[11]); // amount
      const date = cells[18];
      quoteMap[code] = { chg, fundSize: totalMktCap ? totalMktCap / 1e8 : null, volume: amount ? amount / 1e8 : null, date };
    }
  } catch (e) { fail++; }

  try {
    // fund flow
    const fOut = execFileSync(NODE, [SCRIPT, 'fund', 'flow', key], { encoding: 'utf8', timeout: 20000 });
    const fLines = fOut.split('\n').filter(l => l.startsWith('| sh') || l.startsWith('| sz'));
    if (fLines.length) {
      const cells = fLines[0].split('|').map(c => c.trim()).filter(c => c);
      const mainNetFlow = parseFloat(cells[11]);
      flowMap[code] = mainNetFlow;
    }
  } catch (e) { /* skip */ }

  ok++;
  if (ok % 10 === 0) console.log('progress', ok, '/', codes.length);
}

fs.writeFileSync('cache/wide_quote_0709.json', JSON.stringify(quoteMap, null, 1));
fs.writeFileSync('cache/wide_flow_0709.json', JSON.stringify(flowMap, null, 1));
console.log('DONE: quote=' + Object.keys(quoteMap).length + ' flow=' + Object.keys(flowMap).length + ' fail=' + fail);

// Show summary
let totalFlow = 0;
for (const c of codes) { if (flowMap[c]) totalFlow += flowMap[c]; }
console.log('Wide ETF total MainNetFlow(亿):', (totalFlow / 1e8).toFixed(4));
