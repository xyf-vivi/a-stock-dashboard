/**
 * build_wide_pool.js — 重建 07-06 宽样本池
 *
 * 输入：
 *   universe_20260706.json  (98 只统一宇宙 + 11 规范桶 + role)
 *   cache/quote.json        (westock data_quote: change_percent/amount/chg_5d/total_market_cap)
 *   cache/flow.json         (westock data_fund_flow: MainNetFlow/MainNetFlow5D，元)
 *   data/theme_etf_data_extended.json (旧文件，保留历史日期)
 *   projCopy/rawData.json, kline_data_extended.json, market_breadth_data.json (克隆 07-03 作为 07-06 市场背景)
 *
 * 输出：
 *   data/theme_etf_data_extended.json       (追加 20260706 键)
 *   data/rawData_local.json                 (追加 2026-07-06，克隆最新日)
 *   data/kline_local.json                   (series 追加 20260706)
 *   data/breadth_local.json                 (追加 20260706，克隆最新日)
 *
 * 字段单位：
 *   flow/flow5d/volume/fundSize → 亿元；chg/chg_5d → %
 *   MainNetFlow(元)/1e8 = 亿；amount(元)/1e8 = 亿；total_market_cap 已是亿
 */
const fs = require('fs');
const path = require('path');

const BUILD = __dirname;
const read = (p) => JSON.parse(fs.readFileSync(path.join(BUILD, p), 'utf8'));

const uni = read('universe_20260706.json');
const quote = read('cache/quote.json');
const flow = read('cache/flow.json');

const NEW_DATE = '20260706';
const NEW_DATE_DASH = '2026-07-06';

// codeWs("sz159206") -> "159206.SZ"
function toCodeSh(codeWs) {
  const m = /^([a-z]{2})(\d{6})$/.exec(codeWs);
  if (!m) return codeWs;
  const exch = m[1] === 'sh' ? 'SH' : 'SZ';
  return m[2] + '.' + exch;
}

// 按规范桶 + ETF 名称，分配到 (category, theme)，theme 名需与 STRUCTURE_DEFS.etfThemes 对应
function assignCatTheme(bucket, name) {
  const nm = (name || '').toLowerCase();
  switch (bucket) {
    case '科技成长': {
      if (/半导体设备|设备/.test(name)) return ['科技成长', '半导体设备'];
      if (/芯片|半导体/.test(name)) return ['科技成长', '半导体'];
      if (/人工智能|ai/.test(nm)) return ['科技成长', 'AI'];
      if (/通信/.test(name)) return ['科技成长', '通信'];
      if (/机器人/.test(name)) return ['科技成长', '机器人'];
      return ['科技成长', '半导体设备']; // 卫星/电网/创科技 等兜底
    }
    case '创新药核心': return ['医药生物', '创新药'];
    case '医药成长扩展': return ['医药生物', '医药成长'];
    case '证券金融': return ['券商金融', '证券'];
    case '红利防御': return ['红利防御', '红利'];
    case '消费价值': return ['消费价值', '消费价值'];
    case '有色资源': return ['有色资源', nm.includes('黄金') ? '黄金' : '有色金属'];
    case '化工': return ['化工', '化工'];
    case '新能源': return ['新能源', '新能源'];
    case '军工': return ['军工', '军工'];
    case '传媒游戏': return ['传媒游戏', '传媒游戏'];
    case '微盘小票': return ['微盘小票', '微盘小票'];
    default: return ['其他', bucket];
  }
}

function median(arr) {
  if (!arr.length) return null;
  const s = arr.slice().sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

const catThemeMap = {}; // category -> theme -> [etfDetail]
let missingMetrics = 0;

uni.universe.forEach((e) => {
  const q = quote[e.codeWs];
  const f = flow[e.codeWs];
  if (!q) { missingMetrics++; return; }
  const [cat, theme] = assignCatTheme(e.bucket, q.name);
  const flowYi = f ? Number(f.MainNetFlow) / 1e8 : null;
  const flow5dYi = f ? Number(f.MainNetFlow5D) / 1e8 : null;
  const fundSize = q.total_market_cap != null ? q.total_market_cap : null;
  const chg = q.change_percent != null ? q.change_percent : null;
  const volume = q.amount != null ? q.amount / 1e8 : null;

  const detail = {
    code: toCodeSh(e.codeWs),
    name: q.name,
    trackIndex: '',
    manager: '',
    included: true,
    flow: flowYi,
    flow5d: flow5dYi,
    fundSize: fundSize,
    volume: volume,
    turnover: null,
    chg: chg,
    shareChange: 0,
    sharePending: false,
    nav: null
  };
  catThemeMap[cat] = catThemeMap[cat] || {};
  catThemeMap[cat][theme] = catThemeMap[cat][theme] || [];
  catThemeMap[cat][theme].push(detail);
});

// 计算每个 theme 的聚合字段
function buildThemeObj(details) {
  const flows = details.map(d => d.flow).filter(v => v != null);
  const flows5d = details.map(d => d.flow5d).filter(v => v != null);
  const sizes = details.map(d => d.fundSize).filter(v => v != null);
  const chgs = details.map(d => d.chg).filter(v => v != null);
  const vols = details.map(d => d.volume).filter(v => v != null);
  const n = details.length;
  const up = chgs.filter(c => c > 0).length;
  const med = median(chgs);
  return {
    flow: flows.reduce((a, b) => a + b, 0),
    flow5d: flows5d.reduce((a, b) => a + b, 0),
    scaleRatio: null,
    volume: vols.reduce((a, b) => a + b, 0),
    turnover: null,
    chg: med,
    premium: null,
    sampleCount: n,
    coverage: 1,
    confirmedCount: n,
    fundSize: sizes.reduce((a, b) => a + b, 0),
    pctChg: med,
    upRatio: chgs.length ? up / chgs.length : null,
    etfDetails: details
  };
}

const themeEtf = {};
let totalEtfs = 0;
for (const cat of Object.keys(catThemeMap)) {
  themeEtf[cat] = { themes: {} };
  for (const theme of Object.keys(catThemeMap[cat])) {
    themeEtf[cat].themes[theme] = buildThemeObj(catThemeMap[cat][theme]);
    totalEtfs += catThemeMap[cat][theme].length;
  }
}

console.log('[wide-pool] 主题池构建完成，分类桶数:', Object.keys(themeEtf).length, 'ETF总数:', totalEtfs, '缺失行情:', missingMetrics);
for (const cat of Object.keys(themeEtf)) {
  const ts = Object.keys(themeEtf[cat].themes);
  console.log('  [' + cat + ']', ts.map(t => t + '=' + themeEtf[cat].themes[t].sampleCount).join(', '));
}

// === 1) 合并进 theme_etf_data_extended.json ===
const themePath = path.join(BUILD, 'data/theme_etf_data_extended.json');
const themeData = JSON.parse(fs.readFileSync(themePath, 'utf8'));
const newEntry = { date: NEW_DATE, label: NEW_DATE_DASH, themeEtf, stats: null };
themeData.dates[NEW_DATE] = newEntry;
themeData.caliberVersion = themeData.caliberVersion || 'v3';
// 把 07-06 作为最新日期移到末尾（保持日期升序）
const sorted = Object.keys(themeData.dates).sort();
const reordered = {};
sorted.forEach(k => { reordered[k] = themeData.dates[k]; });
themeData.dates = reordered;
fs.writeFileSync(themePath, JSON.stringify(themeData, null, 0), 'utf8');
console.log('[wide-pool] theme_etf_data_extended.json 已更新，日期数:', Object.keys(themeData.dates).length, '最新:', sorted[sorted.length - 1]);

// === 2) 克隆 rawData 最新日 -> 2026-07-06 ===
function cloneLatestDate(srcObj, dashDate) {
  const keys = Object.keys(srcObj).filter(k => /^\d{4}-\d{2}-\d{2}$/.test(k)).sort();
  const latest = keys[keys.length - 1];
  const out = JSON.parse(JSON.stringify(srcObj));
  out[dashDate] = JSON.parse(JSON.stringify(srcObj[latest]));
  return out;
}
const rawData2 = JSON.parse(fs.readFileSync(path.join(BUILD, 'projCopy/rawData.json'), 'utf8'));
const rawLocal = cloneLatestDate(rawData2, NEW_DATE_DASH);
fs.writeFileSync(path.join(BUILD, 'data/rawData_local.json'), JSON.stringify(rawLocal), 'utf8');
console.log('[wide-pool] rawData_local.json 已生成，最新日:', NEW_DATE_DASH);

// === 3) 克隆 kline series 20260703 -> 20260706 ===
const kline = JSON.parse(fs.readFileSync(path.join(BUILD, 'projCopy/kline_data_extended.json'), 'utf8'));
let cloned = 0;
['indices', 'etfs'].forEach(sec => {
  const grp = kline[sec];
  if (!grp) return;
  Object.keys(grp).forEach(code => {
    const series = grp[code] && grp[code].series;
    if (series && series['20260703'] && !series['20260706']) {
      series['20260706'] = JSON.parse(JSON.stringify(series['20260703']));
      cloned++;
    }
  });
});
fs.writeFileSync(path.join(BUILD, 'data/kline_local.json'), JSON.stringify(kline), 'utf8');
console.log('[wide-pool] kline_local.json 已生成，克隆序列数:', cloned);

// === 4) 克隆 breadth 最新日 -> 20260706 ===
const breadth = JSON.parse(fs.readFileSync(path.join(BUILD, 'projCopy/market_breadth_data.json'), 'utf8'));
const bkeys = Object.keys(breadth).filter(k => /^\d{8}$/.test(k)).sort();
const blatest = bkeys[bkeys.length - 1];
breadth['20260706'] = JSON.parse(JSON.stringify(breadth[blatest]));
fs.writeFileSync(path.join(BUILD, 'data/breadth_local.json'), JSON.stringify(breadth), 'utf8');
console.log('[wide-pool] breadth_local.json 已生成，克隆日:', blatest, '-> 20260706');

console.log('[wide-pool] DONE');
