/**
 * _regen_local.js — 本地工作区版本
 * 与 _regen.js 逻辑一致，但所有路径指向 build/ 工作区，避免写入只读沙箱。
 */
const fs = require('fs');
const path = require('path');

const BUILD = __dirname;
const SRC_DIR = path.join(BUILD, 'src');            // 已修改的源码模块
const DAT = path.join(BUILD, 'projCopy');           // 原始项目数据（只读引用）
const DATA = path.join(BUILD, 'data');              // 本地重建数据

const { normalizeData } = require(path.join(SRC_DIR, 'normalize'));
const { computeAll } = require(path.join(SRC_DIR, 'metrics'));
const { getStyles } = require(path.join(SRC_DIR, 'styles'));
const { renderTopbar, renderReview, renderCapital, renderEtf, renderValidate, renderQuality, renderStructuralReview, renderStructure, renderCapitalEmotion, renderValidationQuality } = require(path.join(SRC_DIR, 'render'));

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

// 07-06 宽池：etfTheme 用本地重建的扩展文件；其余市场背景用克隆的 07-03 快照
const rawEtf = readJson(path.join(DATA, 'rawData_local.json'));
const EXTENDED_THEME = path.join(DATA, 'theme_etf_data_extended.json');
const rawTheme = fs.existsSync(EXTENDED_THEME) ? readJson(EXTENDED_THEME) : readJson(path.join(DAT, 'theme_etf_data.json'));
const conc = readJson(path.join(DAT, 'conc_data.json'));
const margin = readJson(path.join(DAT, 'margin_data.json'));
const breadth = readJson(path.join(DATA, 'breadth_local.json'));
const themeBreadth = readJson(path.join(DAT, 'theme_breadth_data.json'));

const normData = normalizeData(rawEtf, rawTheme, conc, margin, null, breadth, themeBreadth);
let computedData = computeAll(normData, null);

// === kline 摘要（用本地克隆的 07-06 序列）===
const klineRaw = readJson(path.join(DATA, 'kline_local.json'));
const ks = {};
function ss(s){ if(!s) return null; const k=Object.keys(s).sort(); if(!k.length) return null; const l=s[k[k.length-1]]; if(!l||l.close==null) return null; const rawLatest=k[k.length-1]; const latestDate=rawLatest.length===8?rawLatest.slice(0,4)+'-'+rawLatest.slice(4,6)+'-'+rawLatest.slice(6,8):rawLatest; return { latestDate: latestDate, latestDateRaw: rawLatest, chg1d: k.length>=2 ? (l.close/s[k[k.length-2]].close-1)*100 : null, chg5d: k.length>=6 ? (l.close/s[k[k.length-6]].close-1)*100 : null, chg20d: k.length>=21 ? (l.close/s[k[k.length-21]].close-1)*100 : null, lastClose: l.close }; }
Object.keys(klineRaw.indices||{}).forEach(c=>{ const i=klineRaw.indices[c]; const x=ss(i.series); if(x) ks[c]={code:c,name:i.name,type:'index',...x}; });
Object.keys(klineRaw.etfs||{}).forEach(c=>{ const i=klineRaw.etfs[c]; const x=ss(i.series); if(x) ks[c]={code:c,name:i.name,type:'etf',...x}; });
computedData.klineSummary = ks;

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
      const matched = Object.keys(ks).find(function(code) { return ks[code].name === idx.name; });
      if (matched && ks[matched].chg20d != null) idx.vs20d = ks[matched].chg20d;
    }
  });
}

// === 34 周线（与 _regen.js 同逻辑）===
function isoWeekOf(dtStr) {
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
  if (dates.length < 34) return null;
  const weekMap = {};
  dates.forEach(function(dt){ if (!series[dt] || series[dt].close == null) return; const wk = isoWeekOf(dt); weekMap[wk] = { lastDt: dt, close: series[dt].close }; });
  const weekKeys = Object.keys(weekMap).sort();
  if (weekKeys.length < 34) return null;
  const last34 = weekKeys.slice(-34);
  const ma34w = last34.reduce(function(s,k){return s + weekMap[k].close;},0) / 34;
  let ma34w4wAgo = null, slope = null;
  if (weekKeys.length >= 38) { const past34 = weekKeys.slice(-38, -4); if (past34.length === 34) { ma34w4wAgo = past34.reduce(function(s,k){return s + weekMap[k].close;},0) / 34; slope = ma34w - ma34w4wAgo; } }
  const latestClose = weekMap[weekKeys[weekKeys.length-1]].close;
  const distance = (latestClose - ma34w) / ma34w * 100;
  let status;
  if (latestClose > ma34w && slope != null && slope > 0 && distance > 3) status = '强势上方';
  else if (latestClose > ma34w && distance >= 0 && distance <= 3) status = '回踩观察';
  else if (Math.abs(distance) <= 2) status = '趋势争夺';
  else if (latestClose < ma34w && slope != null && slope > 0) status = '反抽不过';
  else if (latestClose < ma34w && slope != null && slope < 0) status = '中期弱势';
  else status = latestClose > ma34w ? '偏强' : '偏弱';
  return { close: +latestClose.toFixed(2), ma34w: +ma34w.toFixed(2), distance: +distance.toFixed(2), slope: slope != null ? +slope.toFixed(2) : null, slopeDir: slope != null ? (slope > 0 ? '向上' : slope < 0 ? '向下' : '走平') : '待确认', status: status, weekCount: weekKeys.length };
}
const wma = {};
Object.keys(klineRaw.indices||{}).forEach(function(c){ const r = calcWeeklyMA34(klineRaw.indices[c].series); if (r) wma[c] = Object.assign({code: c, name: klineRaw.indices[c].name}, r); });
Object.keys(klineRaw.etfs||{}).forEach(function(c){ const r = calcWeeklyMA34(klineRaw.etfs[c].series); if (r) wma[c] = Object.assign({code: c, name: klineRaw.etfs[c].name}, r); });
computedData.weeklyMA34 = wma;
console.log('✓ 34周线已注入:', Object.keys(wma).length, '个标的');

const currentDate = normData.dates[normData.dates.length-1];
const styles = getStyles();

const pageTopbar = renderTopbar(computedData, currentDate);
const pageStructural = renderStructuralReview(computedData, currentDate);
const placeholderReview = '<div class="page tab-content" id="tab-review"></div>';
const placeholderStructure = '<div class="tab-content" id="tab-structure"></div>';
const placeholderCapitalEmo = '<div class="tab-content" id="tab-capital-emo"></div>';
const placeholderValidateQ = '<div class="tab-content" id="tab-validate-q"></div>';

function bundleInline() {
  const files = ['normalize.js', 'metrics.js', 'states.js', 'render.js'];
  const parts = [];
  const varName = 'DMod';
  parts.push(`var ${varName} = {};`);
  for (const file of files) {
    const filePath = path.join(SRC_DIR, file);
    let code = fs.readFileSync(filePath, 'utf-8');
    code = code.replace(/^'use strict';?\s*\n/m, '');
    code = code.replace(/const\s+(\{[^}]+\})\s*=\s*require\(['"][^'"]+['"]\)\s*;?/g, (match, destructure) => `const ${destructure} = ${varName};`);
    code = code.replace(/const\s+(\w+)\s*=\s*require\(['"][^'"]+['"]\)\s*;?/g, (match, name) => `const ${name} = ${varName};`);
    if (code.includes('module.exports')) {
      const exportIdx = code.indexOf('module.exports');
      if (exportIdx !== -1) {
        const before = code.substring(0, exportIdx);
        const from = code.indexOf('{', exportIdx);
        if (from !== -1) {
          let depth = 0, end = -1;
          for (let i = from; i < code.length; i++) { if (code[i] === '{') depth++; if (code[i] === '}') { depth--; if (depth === 0) { end = i; break; } } }
          if (end !== -1) { const exportBlock = code.substring(from, end + 1); const after = code.substring(end + 1); code = before + `Object.assign(${varName}, ${exportBlock});` + after; }
        }
      }
    }
    parts.push(`\n(function(DMod) {`);
    parts.push(code);
    parts.push(`})(${varName});`);
  }
  return parts.join('\n');
}

const CHART_JS_PATH = path.join(DAT, 'chart.umd.min.js');
let chartJsCode = '';
try { chartJsCode = fs.readFileSync(CHART_JS_PATH, 'utf-8'); console.log('✓ Chart.js 加载', (chartJsCode.length/1024).toFixed(0), 'KB'); } catch (e) { console.log('⚠ Chart.js 未找到'); }

const buildJsPath = path.join(DAT, 'build.js');
const buildJsContent = fs.readFileSync(buildJsPath, 'utf-8');
const buildLines = buildJsContent.split('\n');
const toggleCollapseLine = buildLines.findIndex(l => l.includes('function toggleCollapse(id) {'));
const eventBindLine = buildLines.findIndex(l => l.includes('// --- 事件绑定 ---'));
if (toggleCollapseLine < 0 || eventBindLine < 0 || eventBindLine <= toggleCollapseLine) throw new Error('无法在 build.js 中定位图表函数边界');
const chartFunctionsCode = buildLines.slice(toggleCollapseLine, eventBindLine).join('\n').replace(/\s+$/, '\n');
console.log('✓ 图表函数提取: 行', toggleCollapseLine + 1, '-', eventBindLine);

function stripHstech(obj) {
  if (obj == null) return obj;
  if (Array.isArray(obj)) return obj.map(stripHstech);
  if (typeof obj === 'object') { const out = {}; for (const key of Object.keys(obj)) { if (key === '恒生科技') continue; out[key] = stripHstech(obj[key]); } return out; }
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
    if (!renderedTabs[tab]) { renderTab(tab, CURRENT_DATE); }
    document.querySelectorAll('.tab-btn').forEach(function(b) { b.classList.toggle('active', b.dataset.tab === tab); });
    document.querySelectorAll('.tab-content').forEach(function(c) { c.classList.toggle('active', c.id === 'tab-' + tab); });
    currentTab = tab;
    if (!skipRender) { setTimeout(function() {}, 50); }
  }
  function switchDate(dt) {
    if (!DASHBOARD_DATA.data[dt]) { console.warn('No data for date', dt); return; }
    CURRENT_DATE = dt;
    renderedTabs = {};
    renderTab(currentTab, dt);
    Object.keys(charts).forEach(function(k) { if (charts[k]) { try { charts[k].destroy(); } catch(e){} delete charts[k]; } });
    ['quadChart', 'themeQuadChart'].forEach(function(id) { var quad = document.getElementById(id); if (quad) { delete quad.dataset.rendered; } });
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
    if (pill) { pill.textContent = phaseLabels[meta.phase] || meta.phase; pill.className = 'phase-pill ' + meta.phase; }
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
  switchTab('structural', true);
})();
`;

const html = '<!DOCTYPE html>\n<html lang="zh-CN" data-theme="dark">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n<title>A股资金面观察台 · 决策总览 v5</title>\n<style>' + styles + '</style>\n</head>\n<body>\n' + pageTopbar + '\n' + tabs + '\n<div id="pageHost">\n' + pageStructural + '\n' + placeholderReview + '\n' + placeholderStructure + '\n' + placeholderCapitalEmo + '\n' + placeholderValidateQ + '\n</div>\n<script>\nvar DASHBOARD_DATA = ' + dataForBrowser + ';\nvar CURRENT_DATE = "' + currentDate + '";\n' + bundleCode + '\n</script>\n<script>\n' + chartJsCode + '\n</script>\n<script>\n' + interactiveJs + '\n</script>\n</body>\n</html>';

const outPath = path.join(BUILD, 'output/fused_dashboard_v2.html');
fs.writeFileSync(outPath, html, 'utf8');
console.log('✓ 输出:', outPath, (html.length/1024).toFixed(0), 'KB');
console.log('✓ 预渲染: 仅 structural；其他 tab 按需渲染');
console.log('✓ currentDate:', currentDate, '| dates:', computedData.dates.join(','));
const hasOldContent = html.indexOf('专业复盘摘要') >= 0 || html.indexOf('renderVerdict') >= 0;
console.log('  - 老看板内容是否已清除:', !hasOldContent ? '✓' : '✗ 仍存在');
