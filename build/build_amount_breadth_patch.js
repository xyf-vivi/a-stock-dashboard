// 用 westock 真实市场总览(2026-07-06)补齐：全市场成交额 + 真实市场宽度(涨跌家数/upRatio)
// 数据来源: mcp__westock-mcp__data_market_overview date=2026-07-06 / 2026-07-03
const fs = require('fs');
const htmlPath = 'output/fused_dashboard_v2.html';
let html = fs.readFileSync(htmlPath, 'utf8');
const re = /var DASHBOARD_DATA = ([\s\S]*?\});\nvar CURRENT_DATE/;
const m = html.match(re);
if (!m) { console.error('未找到 DASHBOARD_DATA'); process.exit(1); }
const data = JSON.parse(m[1]);
const dt = '2026-07-06';
const e = data.data[dt];

// —— westock 真实值 ——
const TOTAL = 30911.24;   // 07-06 两市成交额(亿)  MONEY
const PREV  = 31824.54;   // 07-03 两市成交额(亿)  MONEY
const AMT5D = 33315.782;  // 07-06 5日均值(亿)      MONEY_5DAVG
const UP = 1876, DOWN = 3541, FLAT = 110, TOT = 5527; // 真实涨跌分布
const UPR = +(UP / TOT).toFixed(4);                    // 0.3394
const chgPct = +((TOTAL - PREV) / PREV).toFixed(4);    // -0.0287
const vs5d   = +((TOTAL - AMT5D) / AMT5D).toFixed(4);  // -0.0721

// market: 真实宽度 + 成交额
e.market.totalAmount = TOTAL;
e.market.upCount = UP; e.market.downCount = DOWN; e.market.flatCount = FLAT; e.market.totalCount = TOT;
e.market.upRatio = UPR;
e.market.breadthStatus = 'confirmed';
e.market.breadthSource = 'westock';
e.market.source = 'westock 市场总览 (实测 2026-07-06)';
e.market.amountPrev = PREV;
e.market.amountChgPct = chgPct;
e.market.amountVs5d = vs5d;
e.market.amountPctile20d = null; // 需20日序列, westock 未提供逐日,暂缺

// concentration: 渲染层主读 concentration.totalAmount
e.concentration.totalAmount = TOTAL;

// computed: 02模块/01模块衍生指标
e.computed = e.computed || {};
e.computed.upRatio = UPR;
e.computed.breadthProxy = false;
e.computed.amountChgPct = chgPct;
e.computed.amountVs5d = vs5d;
e.computed.amountPctile20d = null;

const newBlock = 'var DASHBOARD_DATA = ' + JSON.stringify(data) + ';\nvar CURRENT_DATE';
html = html.replace(re, newBlock);
fs.writeFileSync(htmlPath, html);

// 同步 projCopy 源数据(若存在)
const pcPath = 'projCopy/theme_etf_data_extended.json';
if (fs.existsSync(pcPath)) {
  const pc = JSON.parse(fs.readFileSync(pcPath, 'utf8'));
  if (pc.data && pc.data[dt]) {
    const pe = pc.data[dt];
    pe.market = Object.assign(pe.market || {}, {
      totalAmount: TOTAL, upCount: UP, downCount: DOWN, flatCount: FLAT, totalCount: TOT,
      upRatio: UPR, medianReturn: null, breadthStatus: 'confirmed', breadthSource: 'westock',
      source: 'westock 市场总览 (实测 2026-07-06)',
      amountPrev: PREV, amountChgPct: chgPct, amountVs5d: vs5d, amountPctile20d: null
    });
    pe.concentration = Object.assign(pe.concentration || {}, { totalAmount: TOTAL });
    pe.computed = Object.assign(pe.computed || {}, { amountChgPct: chgPct, amountVs5d: vs5d, amountPctile20d: null });
    fs.writeFileSync(pcPath, JSON.stringify(pc, null, 1));
    console.log('projCopy 同步完成');
  }
}
console.log('patched OK: total=' + TOTAL + '亿 upRatio=' + UPR + ' chgPct=' + (chgPct * 100).toFixed(2) + '% vs5d=' + (vs5d * 100).toFixed(2) + '%');
