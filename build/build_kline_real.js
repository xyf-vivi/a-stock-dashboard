const fs = require('fs');
const path = require('path');
const BUILD = 'D:/workboddy/2026-07-06-20-08-50/build';
const KLINE_FILE = 'C:/Users/xyf31/.workbuddy/projects/d-workboddy-2026-07-06-20-08-50/070f2f53-98cb-47b3-9b09-e7874d4ca42f/tool-results/mcp-connector-proxy-westock-mcp_data_kline-1783384113475-123f9e.txt';

const map = JSON.parse(fs.readFileSync(path.join(BUILD, 'build_kline_codes.json'), 'utf8'));
const wsToOrig = {};
map.codes.forEach((c, i) => { wsToOrig[map.ws[i]] = c; });

const kj = JSON.parse(fs.readFileSync(KLINE_FILE, 'utf8'));
const kdata = kj.data.data; // array of {symbol, data:{nodes:[...]}}

const htmlPath = path.join(BUILD, 'output/fused_dashboard_v2.html');
let html = fs.readFileSync(htmlPath, 'utf8');
const m = html.match(/var DASHBOARD_DATA = (\{[\s\S]*?\});\nvar CURRENT_DATE/);
const data = JSON.parse(m[1]);
const dt = '2026-07-06';
const ks = data.data[dt].klineSummary;

let updated = 0, skipped = 0;
kdata.forEach(entry => {
  const ws = entry.symbol;
  const orig = wsToOrig[ws];
  if (!orig || !ks[orig]) { skipped++; return; }
  const nodes = (entry.data && entry.data.nodes) || [];
  if (nodes.length < 6) { skipped++; return; }
  // nodes 降序: index0=today
  const last = i => parseFloat(nodes[i].last);
  const chg1d = (last(0) / last(1) - 1) * 100;
  const chg5d = (last(0) / last(5) - 1) * 100;
  const chg20d = nodes.length > 20 ? (last(0) / last(20) - 1) * 100 : (last(0) / last(nodes.length - 1) - 1) * 100;
  ks[orig].chg1d = +chg1d.toFixed(4);
  ks[orig].chg5d = +chg5d.toFixed(4);
  ks[orig].chg20d = +chg20d.toFixed(4);
  ks[orig].lastClose = +last(0).toFixed(2);
  ks[orig].latestDate = '2026-07-06';
  ks[orig].latestDateRaw = '20260706';
  ks[orig].source = 'westock kline (实测 2026-07-06)';
  updated++;
});

console.log('klineSummary 更新:', updated, '项; 跳过:', skipped);
// 抽查
['000016.SH', '000300.SH', '000688.SH', '512480.SH', '518880.SH'].forEach(c => {
  const k = ks[c];
  console.log('  ' + c + ' ' + (k ? k.name : '?') + ' chg1d=' + (k && k.chg1d) + ' chg5d=' + (k && k.chg5d) + ' chg20d=' + (k && k.chg20d));
});

html = html.replace(/var DASHBOARD_DATA = \{[\s\S]*?\};\nvar CURRENT_DATE/, 'var DASHBOARD_DATA = ' + JSON.stringify(data) + ';\nvar CURRENT_DATE');
fs.writeFileSync(htmlPath, html, 'utf8');
console.log('已写回 HTML');
