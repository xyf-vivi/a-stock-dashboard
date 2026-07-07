/**
 * _regen.js — 在工作区目录执行，用绝对路径加载项目模块
 * 只预渲染 00 structural，其他 tab 按需渲染
 */
const fs = require('fs');
const path = require('path');

// 项目根目录（源码所在）
const PROJ = 'D:/workboddy/2026-06-19-22-12-59';

// 用绝对路径加载项目模块
const { normalizeData } = require(path.join(PROJ, 'src/normalize'));
const { computeAll } = require(path.join(PROJ, 'src/metrics'));
const { getStyles } = require(path.join(PROJ, 'src/styles'));
const { renderTopbar, renderReview, renderCapital, renderEtf, renderValidate, renderQuality, renderStructuralReview, renderStructure, renderCapitalEmotion, renderValidationQuality } = require(path.join(PROJ, 'src/render'));

const readJson = (p) => JSON.parse(fs.readFileSync(path.join(PROJ, p),'utf8'));

const rawEtf = readJson('rawData.json');
// 优先用本地扩展的 theme_etf_data（含 8 只创新药 + 6 只半导体设备 ETF 池）
const EXTENDED_THEME = path.join('D:/workboddy/2026-07-03-11-32-09', 'theme_etf_data_extended.json');
const rawTheme = fs.existsSync(EXTENDED_THEME) ? JSON.parse(fs.readFileSync(EXTENDED_THEME, 'utf8')) : readJson('theme_etf_data.json');
if (fs.existsSync(EXTENDED_THEME)) console.log('✓ 使用本地扩展 theme_etf_data_extended.json（创新药 8 只 + 半导体设备 6 只）');
const conc = readJson('conc_data.json');
const margin = readJson('margin_data.json');
const breadth = readJson('market_breadth_data.json');
const themeBreadth = readJson('theme_breadth_data.json');

const normData = normalizeData(rawEtf, rawTheme, conc, margin, null, breadth, themeBreadth);
let computedData = computeAll(normData, null);

// 注入 kline 摘要 — 优先用本地扩展文件（含 22 只 ETF），回退到项目原始文件
const fsLocal = require('fs');
const LOCAL_EXTENDED = path.join('D:/workboddy/2026-07-03-11-32-09', 'kline_data_extended.json');
let klineRaw;
if (fsLocal.existsSync(LOCAL_EXTENDED)) {
  console.log('✓ 使用本地扩展 kline_data_extended.json');
  klineRaw = JSON.parse(fsLocal.readFileSync(LOCAL_EXTENDED, 'utf8'));
} else {
  klineRaw = readJson('kline_data.json');
}
const ks = {};
function ss(s){ if(!s) return null; const k=Object.keys(s).sort(); if(!k.length) return null; const l=s[k[k.length-1]]; if(!l||l.close==null) return null; const rawLatest=k[k.length-1]; const latestDate=rawLatest.length===8?rawLatest.slice(0,4)+'-'+rawLatest.slice(4,6)+'-'+rawLatest.slice(6,8):rawLatest; return { latestDate: latestDate, latestDateRaw: rawLatest, chg1d: k.length>=2 ? (l.close/s[k[k.length-2]].close-1)*100 : null, chg5d: k.length>=6 ? (l.close/s[k[k.length-6]].close-1)*100 : null, chg20d: k.length>=21 ? (l.close/s[k[k.length-21]].close-1)*100 : null, lastClose: l.close }; }
Object.keys(klineRaw.indices||{}).forEach(c=>{ const i=klineRaw.indices[c]; const x=ss(i.series); if(x) ks[c]={code:c,name:i.name,type:'index',...x}; });
Object.keys(klineRaw.etfs||{}).forEach(c=>{ const i=klineRaw.etfs[c]; const x=ss(i.series); if(x) ks[c]={code:c,name:i.name,type:'etf',...x}; });
computedData.klineSummary = ks;

// 为每个 entry 单独计算当日的 idxChg1d / prevChg1d（节奏形态需要历史日期的指数涨跌）
// 策略：优先中证A股 930903.CSI；缺失时用沪深300/中证1000/创业板指等权
// kline series 的 key 是 YYYYMMDD（无横线），而 entry date 是 YYYY-MM-DD（有横线），需转换
const dtKey = (s) => s.replace(/-/g, '');
const calcIdxChgFor = (targetDt) => {
  const target = dtKey(targetDt);
  const calcSeries = (series, d) => {
    const cur = series && series[d];
    if (!cur || cur.close == null) return null;
    const keys = Object.keys(series).sort();
    const idx = keys.indexOf(d);
    if (idx <= 0) return null;
    const prev = series[keys[idx - 1]];
    if (!prev || prev.close == null) return null;
    return (cur.close / prev.close - 1) * 100;
  };
  let v = calcSeries(klineRaw.indices && klineRaw.indices['930903.CSI'] && klineRaw.indices['930903.CSI'].series, target);
  if (v != null) return v;
  const codes = ['000300.SH', '000852.SH', '399006.SZ'];
  let s = 0, n = 0;
  codes.forEach(c => {
    const x = calcSeries(klineRaw.indices && klineRaw.indices[c] && klineRaw.indices[c].series, target);
    if (x != null) { s += x; n++; }
  });
  return n > 0 ? s / n : null;
};

Object.keys(computedData.data).forEach(function(dt) {
  const e = computedData.data[dt];
  e.klineSummary = ks;
  const perEntryIdxChg = calcIdxChgFor(dt);
  let perEntryPrevChg = null;
  const i = computedData.dates.indexOf(dt);
  if (i > 0) perEntryPrevChg = calcIdxChgFor(computedData.dates[i - 1]);
  e.idxChgSeries = { idxChg1d: perEntryIdxChg, prevChg1d: perEntryPrevChg };
});

const lastDt = computedData.dates[computedData.dates.length - 1];
const lastEntry = computedData.data[lastDt];
if (lastEntry && lastEntry.market && lastEntry.market.indices) {
  lastEntry.market.indices.forEach(function(idx) {
    if (idx.name) {
      const matched = Object.keys(ks).find(function(code) {
        return ks[code].name === idx.name;
      });
      if (matched && ks[matched].chg20d != null) {
        idx.vs20d = ks[matched].chg20d;
      }
    }
  });
}

// === 注入 34 周线（从 kline_data.json 日K聚合） ===
// 计算逻辑：按 ISO 周聚合，每周取最后交易日收盘价；最近34周收盘价平均 = ma34w
// distance = (latestClose - ma34w) / ma34w * 100
// slope = ma34w(本周) - ma34w(4周前)
// status: 强势上方/回踩观察/趋势争夺/反抽不过/中期弱势
function isoWeekOf(dtStr) {
  // dtStr 形如 '20260702'
  const y = +dtStr.slice(0,4), m = +dtStr.slice(4,6), d = +dtStr.slice(6,8);
  const date = new Date(Date.UTC(y, m-1, d));
  const day = date.getUTCDay() || 7;
  const thursday = new Date(date);
  thursday.setUTCDate(date.getUTCDate() + (4 - day));
  const isoY = thursday.getUTCFullYear();
  const jan1 = new Date(Date.UTC(isoY, 0, 1));
  const week = Math.ceil(((thursday - jan1) / 86400000 + 1) / 7);
  return isoY + '-W' + String(week).padStart(2,'0');
}
function calcWeeklyMA34(series) {
  if (!series) return null;
  const dates = Object.keys(series).sort();
  if (dates.length < 34) return null; // 至少 34 个交易日（粗略判断）
  // 按周聚合
  const weekMap = {};
  dates.forEach(function(dt){
    if (!series[dt] || series[dt].close == null) return;
    const wk = isoWeekOf(dt);
    weekMap[wk] = { lastDt: dt, close: series[dt].close };
  });
  const weekKeys = Object.keys(weekMap).sort();
  if (weekKeys.length < 34) return null;
  // 本周 ma34w
  const last34 = weekKeys.slice(-34);
  const ma34w = last34.reduce(function(s,k){return s + weekMap[k].close;},0) / 34;
  // 4 周前 ma34w
  let ma34w4wAgo = null, slope = null;
  if (weekKeys.length >= 38) {
    const past34 = weekKeys.slice(-38, -4);
    if (past34.length === 34) {
      ma34w4wAgo = past34.reduce(function(s,k){return s + weekMap[k].close;},0) / 34;
      slope = ma34w - ma34w4wAgo;
    }
  }
  const latestClose = weekMap[weekKeys[weekKeys.length-1]].close;
  const distance = (latestClose - ma34w) / ma34w * 100;
  // 状态判定
  let status;
  if (latestClose > ma34w && slope != null && slope > 0 && distance > 3) status = '强势上方';
  else if (latestClose > ma34w && distance >= 0 && distance <= 3) status = '回踩观察';
  else if (Math.abs(distance) <= 2) status = '趋势争夺';
  else if (latestClose < ma34w && slope != null && slope > 0) status = '反抽不过';
  else if (latestClose < ma34w && slope != null && slope < 0) status = '中期弱势';
  else status = latestClose > ma34w ? '偏强' : '偏弱';
  return {
    close: +latestClose.toFixed(2),
    ma34w: +ma34w.toFixed(2),
    distance: +distance.toFixed(2),
    slope: slope != null ? +slope.toFixed(2) : null,
    slopeDir: slope != null ? (slope > 0 ? '向上' : slope < 0 ? '向下' : '走平') : '待确认',
    status: status,
    weekCount: weekKeys.length
  };
}
const wma = {};
Object.keys(klineRaw.indices||{}).forEach(function(c){
  const r = calcWeeklyMA34(klineRaw.indices[c].series);
  if (r) wma[c] = Object.assign({code: c, name: klineRaw.indices[c].name}, r);
});
Object.keys(klineRaw.etfs||{}).forEach(function(c){
  const r = calcWeeklyMA34(klineRaw.etfs[c].series);
  if (r) wma[c] = Object.assign({code: c, name: klineRaw.etfs[c].name}, r);
});
computedData.weeklyMA34 = wma;
console.log('✓ 34周线已注入:', Object.keys(wma).length, '个标的');

const currentDate = normData.dates[normData.dates.length-1];
const styles = getStyles();

// === 关键改动：只渲染 structural（00决策总览），其他 tab 留空 div 占位 ===
const pageTopbar = renderTopbar(computedData, currentDate);
const pageStructural = renderStructuralReview(computedData, currentDate);
const placeholderReview = '<div class="page tab-content" id="tab-review"></div>';
const placeholderStructure = '<div class="tab-content" id="tab-structure"></div>';
const placeholderCapitalEmo = '<div class="tab-content" id="tab-capital-emo"></div>';
const placeholderValidateQ = '<div class="tab-content" id="tab-validate-q"></div>';

// 加载 bundle（bundle.js 内部用 __dirname 定位 src，需要 hack）
// 直接内联实现 bundle 逻辑，避免 __dirname 问题
function bundleInline() {
  const SRC_DIR = path.join(PROJ, 'src');
  const files = ['normalize.js', 'metrics.js', 'states.js', 'render.js'];
  const parts = [];
  const varName = 'DMod';
  parts.push(`var ${varName} = {};`);
  for (const file of files) {
    const filePath = path.join(SRC_DIR, file);
    let code = fs.readFileSync(filePath, 'utf-8');
    code = code.replace(/^'use strict';?\s*\n/m, '');
    code = code.replace(
      /const\s+(\{[^}]+\})\s*=\s*require\(['"][^'"]+['"]\)\s*;?/g,
      (match, destructure) => `const ${destructure} = ${varName};`
    );
    code = code.replace(
      /const\s+(\w+)\s*=\s*require\(['"][^'"]+['"]\)\s*;?/g,
      (match, name) => `const ${name} = ${varName};`
    );
    if (code.includes('module.exports')) {
      const exportIdx = code.indexOf('module.exports');
      if (exportIdx !== -1) {
        const before = code.substring(0, exportIdx);
        const from = code.indexOf('{', exportIdx);
        if (from !== -1) {
          let depth = 0;
          let end = -1;
          for (let i = from; i < code.length; i++) {
            if (code[i] === '{') depth++;
            if (code[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
          }
          if (end !== -1) {
            const exportBlock = code.substring(from, end + 1);
            const after = code.substring(end + 1);
            code = before + `Object.assign(${varName}, ${exportBlock});` + after;
          }
        }
      }
    }
    parts.push(`\n(function(DMod) {`);
    parts.push(code);
    parts.push(`})(${varName});`);
  }
  return parts.join('\n');
}

// 加载 Chart.js 库 + 图表渲染函数（renderCapitalCharts/renderEtfCharts/renderQuadChart/drawQuadChart/getChartOptions）
// 这些函数定义在 build.js 的 IIFE 内，需要提取出来注入到 fused 文件
const CHART_JS_PATH = path.join(PROJ, 'chart.umd.min.js');
let chartJsCode = '';
try {
  chartJsCode = fs.readFileSync(CHART_JS_PATH, 'utf-8');
  console.log('✓ Chart.js 加载', (chartJsCode.length/1024).toFixed(0), 'KB');
} catch (e) {
  console.log('⚠ Chart.js 未找到，图表将不可用');
}

// 从 build.js 提取图表函数（490-868 行，包含 toggleCollapse/jumpTo/renderCapitalCharts/renderEtfCharts/renderQuadChart/drawQuadChart/getChartOptions）
const buildJsPath = path.join(PROJ, 'build.js');
const buildJsContent = fs.readFileSync(buildJsPath, 'utf-8');
const buildLines = buildJsContent.split('\n');
// 从 'function toggleCollapse' 开始，到 'getChartOptions' 函数结束（即 '// --- 事件绑定 ---' 之前）
const toggleCollapseLine = buildLines.findIndex(l => l.includes('function toggleCollapse(id) {'));
const eventBindLine = buildLines.findIndex(l => l.includes('// --- 事件绑定 ---'));
if (toggleCollapseLine < 0 || eventBindLine < 0 || eventBindLine <= toggleCollapseLine) {
  throw new Error('无法在 build.js 中定位图表函数边界: toggleCollapse=' + toggleCollapseLine + ' eventBind=' + eventBindLine);
}
// 提取 toggleCollapseLine 到 eventBindLine-1（去掉结尾空行）
const chartFunctionsCode = buildLines.slice(toggleCollapseLine, eventBindLine).join('\n').replace(/\s+$/, '\n');
console.log('✓ 图表函数提取: 行', toggleCollapseLine + 1, '-', eventBindLine, '（', chartFunctionsCode.split('\n').length, '行）');

// 过滤不参与判断的港股主题数据，避免页面口径说明虽已删除但数据载荷仍出现"恒生科技"造成误解
function stripHstech(obj) {
  if (obj == null) return obj;
  if (Array.isArray(obj)) {
    return obj.map(stripHstech);
  }
  if (typeof obj === 'object') {
    const out = {};
    for (const key of Object.keys(obj)) {
      if (key === '恒生科技') continue;
      out[key] = stripHstech(obj[key]);
    }
    return out;
  }
  return obj;
}

const bundleCode = bundleInline();
const dataForBrowser = JSON.stringify(stripHstech(computedData));

const tabs = '<div class="tabs-bar" id="tabsBar">' +
  '<button class="tab-btn active" data-tab="structural">00 决策总览</button>' +
  '<button class="tab-btn" data-tab="review">01 今日证据</button>' +
  '<button class="tab-btn" data-tab="structure">02 结构承载</button>' +
  '<button class="tab-btn" data-tab="capital-emo">03 资金与情绪</button>' +
  '<button class="tab-btn" data-tab="validate-q">04 验证与数据质量</button>' +
'</div>';

// === 交互 JS — 按需渲染 ===
// 图表函数（renderCapitalCharts/renderEtfCharts 等）与 interactiveJs 共享 `charts` 变量，
// 所以把图表函数内联到 interactiveJs IIFE 内部
const interactiveJs = `
(function() {
  var currentTab = 'structural';
  var charts = {};
  var renderedTabs = { structural: true };

  var TAB_RENDERERS = {
    structural: DMod.renderStructuralReview,
    review: DMod.renderReview,
    'structure': DMod.renderStructure,
    'capital-emo': DMod.renderCapitalEmotion,
    'validate-q': DMod.renderValidationQuality
  };

  // === 图表函数（从 build.js 提取，共享本 IIFE 的 charts 变量） ===
${chartFunctionsCode.split('\n').map(l => '  ' + l).join('\n')}

  function renderTab(tab, dt) {
    if (!DASHBOARD_DATA.data[dt]) { console.warn('No data for date', dt); return false; }
    var fn = TAB_RENDERERS[tab];
    if (!fn) return false;
    var html = fn(DASHBOARD_DATA, dt);
    var el = document.getElementById('tab-' + tab);
    if (!el) return false;
    el.outerHTML = html;
    renderedTabs[tab] = true;
    return true;
  }

  function switchTab(tab, skipRender) {
    // 1. 先按需渲染（如果还没渲染过）— outerHTML 替换会创建新 DOM 节点
    //    必须在 toggle active 之前，否则新节点不带 active class
    if (!renderedTabs[tab]) {
      renderTab(tab, CURRENT_DATE);
    }

    // 2. 然后切换 active（此时所有 DOM 节点都已存在）
    document.querySelectorAll('.tab-btn').forEach(function(b) {
      b.classList.toggle('active', b.dataset.tab === tab);
    });
    document.querySelectorAll('.tab-content').forEach(function(c) {
      c.classList.toggle('active', c.id === 'tab-' + tab);
    });
    currentTab = tab;

    // 3. 图表渲染（新 IA 无 Chart.js 图表，保留空逻辑兼容）
    if (!skipRender) {
      setTimeout(function() {}, 50);
    }
  }

  function switchDate(dt) {
    if (!DASHBOARD_DATA.data[dt]) { console.warn('No data for date', dt); return; }
    CURRENT_DATE = dt;
    renderedTabs = {};
    renderTab(currentTab, dt);
    Object.keys(charts).forEach(function(k) {
      if (charts[k]) { try { charts[k].destroy(); } catch(e){} delete charts[k]; }
    });
    ['quadChart', 'themeQuadChart'].forEach(function(id) {
      var quad = document.getElementById(id);
      if (quad) { delete quad.dataset.rendered; }
    });
    switchTab(currentTab, true);
    updateTopbar(dt);
  }

  function updateTopbar(dt) {
    var entry = DASHBOARD_DATA.data[dt];
    if (!entry) return;
    var meta = entry.meta;
    if (!meta) return;
    var phaseLabels = { realtime:'盘中估算', preliminary:'盘后初版', confirmed:'盘后确认', partial:'数据不完整', stale:'数据过期', failed:'取数失败', pending:'待确认' };
    var pill = document.querySelector('.phase-pill');
    if (pill) {
      pill.textContent = phaseLabels[meta.phase] || meta.phase;
      pill.className = 'phase-pill ' + meta.phase;
    }
    // 三段式数据健康 pill：重新计算 dataQualityGate
    var healthPill = document.getElementById('topHealthPill');
    if (healthPill && DMod && DMod.buildDecisionState) {
      try {
        var ds = DMod.buildDecisionState(entry, DASHBOARD_DATA, dt);
        if (ds && ds.dataQualityGate) {
          var gate = ds.dataQualityGate;
          var coreTxt = gate.coreDataStatus === '完整' ? '核心完整' : (gate.coreDataStatus === '部分缺失' ? '核心部分缺失' : '核心不可用');
          var structTxt = gate.structureCoverageStatus === '完整' ? '结构全覆盖' : (gate.structureCoverageStatus === '部分缺口' ? '结构部分缺口' : '结构严重不足');
          var confTxt = '置信度' + (gate.decisionConfidence || '中');
          healthPill.innerHTML = coreTxt + ' <span class="dh-sep">｜</span> ' + structTxt + ' <span class="dh-sep">｜</span> ' + confTxt;
          healthPill.className = 'data-health-pill ' + (gate.decisionConfidence === '高' && gate.coreDataStatus === '完整' ? 'confirmed' : (gate.decisionConfidence === '低' ? 'error' : 'partial'));
        }
      } catch(e) { console.warn('topbar health refresh failed', e); }
    }
  }

  document.addEventListener('click', function(e) {
    var btn = e.target.closest('.tab-btn');
    if (btn) { switchTab(btn.dataset.tab); return; }
    var jumpBtn = e.target.closest('.tab-jump-btn');
    if (jumpBtn) { switchTab(jumpBtn.dataset.tab); return; }
    var dBtn = e.target.closest('[data-date]');
    if (dBtn) { switchDate(dBtn.dataset.date); return; }
  });

  var dateSel = document.getElementById('dateSelect');
  if (dateSel) dateSel.addEventListener('change', function() { switchDate(this.value); });

  // 初始化：structural 已在 HTML 预渲染，标记为已渲染；
  // 不调用 renderAllPages，其他 tab 按需渲染
  // 关键：补一次 switchTab(structural) 确保 active class 正确（应对预渲染 DOM 状态）
  switchTab('structural', true);
})();
`;

const html = '<!DOCTYPE html>\n<html lang="zh-CN" data-theme="dark">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n<title>A股资金面观察台 · 决策总览 v5</title>\n<style>' + styles + '</style>\n</head>\n<body>\n' + pageTopbar + '\n' + tabs + '\n<div id="pageHost">\n' + pageStructural + '\n' + placeholderReview + '\n' + placeholderStructure + '\n' + placeholderCapitalEmo + '\n' + placeholderValidateQ + '\n</div>\n<script>\nvar DASHBOARD_DATA = ' + dataForBrowser + ';\nvar CURRENT_DATE = "' + currentDate + '";\n' + bundleCode + '\n</script>\n<script>\n' + chartJsCode + '\n</script>\n<script>\n' + interactiveJs + '\n</script>\n</body>\n</html>';

const outPath = 'D:/workboddy/2026-07-03-11-32-09/fused_dashboard_v2.html';
fs.writeFileSync(outPath, html, 'utf8');
console.log('✓ 输出:', outPath, (html.length/1024).toFixed(0), 'KB');
console.log('✓ 预渲染: 仅 structural；其他 tab 按需渲染');
console.log('✓ switchTab 按需渲染逻辑:', html.indexOf('renderedTabs') >= 0 ? 'OK' : 'MISSING');

// 自检
const hasOldContent = html.indexOf('专业复盘摘要') >= 0 || html.indexOf('renderVerdict') >= 0;
console.log('  - 老看板内容是否已清除:', !hasOldContent ? '✓' : '✗ 仍存在');
// structure 占位 div 应该为空（按需渲染）
const structMatch = html.match(/id="tab-structure"[^>]*>([^<]*)</);
console.log('  - structure 占位是否为空:', structMatch && structMatch[1].trim() === '' ? '✓' : '内容: ' + (structMatch ? structMatch[1] : 'N/A'));
