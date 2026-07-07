/**
 * render.js — 页面渲染层
 * 5个一级页面：今日复盘 / 资金结构 / ETF方向 / 主线验证 / 数据说明
 * 全部读取派生指标和状态判断结果
 */

'use strict';

const { DATA_STATUS, STATUS_LABEL, safeNum } = require('./normalize');
const { calcSignals, calcMarketPhase, calcConsistency, calcMainlineValidation, genWatchScenarios } = require('./states');

// ============ 格式化辅助 ============

function fmt(v, digits) {
  digits = digits == null ? 1 : digits;
  if (v === null || v === undefined || !isFinite(v)) return '--';
  if (Math.abs(v) >= 10000) return (v / 10000).toFixed(1) + '万';
  if (Math.abs(v) >= 100) return v.toFixed(0);
  return v.toFixed(digits);
}

// 成交额专用：totalAmount 单位为「亿」，需正确跨万亿阈值显示
function fmtAmountYi(v) {
  if (v == null || !isFinite(v)) return '--';
  if (Math.abs(v) >= 10000) return (v / 10000).toFixed(2) + '万亿';
  return v.toFixed(0) + '亿';
}

function fmtPct(v, digits) {
  digits = digits == null ? 2 : digits;
  if (v === null || v === undefined || !isFinite(v)) return '--';
  const sign = v > 0 ? '+' : '';
  return sign + v.toFixed(digits) + '%';
}

function fmtFlow(v) {
  if (v === null || v === undefined || !isFinite(v)) return '--';
  const sign = v > 0 ? '+' : '';
  if (Math.abs(v) >= 100) return sign + v.toFixed(0);
  return sign + v.toFixed(1);
}

// 统一带"亿"单位的资金格式：fmtFlow 已自带正号，调用方不应再手动加 '+'。
// 此函数用于"完整一行"场景：返回 '+6.7亿' / '-3.2亿' / '--'。
function fmtSignedFlowYi(v) {
  if (v === null || v === undefined || !isFinite(v)) return '--';
  return fmtFlow(v) + '亿';
}

function upDn(v) {
  if (v === null || v === undefined) return '';
  return v > 0 ? 'up' : (v < 0 ? 'dn' : '');
}

function colorNum(v, text) {
  return `<span class="${upDn(v)}">${text}</span>`;
}

function statusTag(status) {
  return `<span class="dstatus ${status}">${STATUS_LABEL[status] || status}</span>`;
}

// ============ 顶部全局栏 ============

function renderTopbar(data, currentDt) {
  const entry = data.data[currentDt];
  if (!entry) return '<div class="topbar">数据加载中...</div>';

  const meta = entry.meta;
  const phaseLabels = {
    realtime: '盘中估算', preliminary: '盘后初版', confirmed: '盘后确认',
    partial: '数据不完整', stale: '数据过期', failed: '取数失败', pending: '待确认'
  };

  // 日期选项
  const dateOpts = data.dates.slice().reverse().map(dt => {
    const e = data.data[dt];
    const phase = e.meta.phase;
    const label = e.label;
    const tags = [];
    if (e.concentration.top100.value != null) tags.push('集中度');
    if (e.etfWide.totalFlow != null) tags.push('ETF');
    const tagStr = tags.length > 0 ? ' [' + tags.join('/') + ']' : '';
    return `<option value="${dt}" ${dt === currentDt ? 'selected' : ''}>${label}${tagStr} ${phaseLabels[phase] || ''}</option>`;
  }).join('');

  // 市场宽度日期：有真实宽度数据(不论 wind/westock)即标记已采集
  const breadthDate = entry.market && entry.market.breadthStatus === 'confirmed'
    ? currentDt
    : null;

  // 主题宽度日期：优先查 entry.themeBreadth(顶层 Wind 成分股口径)，否则回退 etfTheme
  let themeBreadthDate = null;
  if (entry.themeBreadth && Array.isArray(entry.themeBreadth.themes) && entry.themeBreadth.themes.length) {
    themeBreadthDate = currentDt;
  } else if (entry.etfTheme && entry.etfTheme.categories) {
    for (const cat of Object.values(entry.etfTheme.categories)) {
      if (!cat.themes) continue;
      for (const t of Object.values(cat.themes)) {
        if (t.breadthStatus && t.breadthStatus !== 'historical_missing') {
          themeBreadthDate = currentDt;
          break;
        }
      }
      if (themeBreadthDate) break;
    }
  }

  // 日期颜色：正常=绿(ok)，缺失=灰(missing)，落后=黄(stale)
  function dotClass(has, isStale) {
    if (!has) return 'missing';
    if (isStale) return 'warn';
    return '';
  }

  // === 三段式数据健康文案（核心完整｜结构覆盖｜决策置信度）===
  // 直接从当前 entry 计算 dataQualityGate 摘要，避免"核心数据 100%"绝对值口径
  var dsForHealth;
  try {
    dsForHealth = buildDecisionState(entry, data, currentDt);
  } catch (e) {
    dsForHealth = null;
  }
  var healthSegs = ['核心数据--', '结构覆盖--', '置信度--'];
  var healthOverallClass = 'partial';
  if (dsForHealth && dsForHealth.dataQualityGate) {
    var gate = dsForHealth.dataQualityGate;
    var coreTxt = gate.coreDataStatus === '完整' ? '核心完整' : (gate.coreDataStatus === '部分缺失' ? '核心部分缺失' : '核心不可用');
    var structTxt = gate.structureCoverageStatus === '完整' ? '结构全覆盖' : (gate.structureCoverageStatus === '部分缺口' ? '结构部分缺口' : '结构严重不足');
    var confTxt = '置信度' + (gate.decisionConfidence || '中');
    healthSegs = [coreTxt, structTxt, confTxt];
    healthOverallClass = (gate.decisionConfidence === '高' && gate.coreDataStatus === '完整') ? 'confirmed' : (gate.decisionConfidence === '低' ? 'error' : 'partial');
  }

  return `
  <div class="topbar">
    <div class="topbar-brand">
      <div class="icon">A</div>
      <span>A股资金面观察台</span>
    </div>
    <div class="topbar-meta">
      <select class="tb-select" id="dateSelect" onchange="switchDate(this.value)">${dateOpts}</select>
      <span class="phase-pill ${meta.phase}">${phaseLabels[meta.phase] || meta.phase}</span>
      <span class="data-health-pill ${healthOverallClass}" id="topHealthPill">
        ${healthSegs.join(' <span class="dh-sep">｜</span> ')}
      </span>
    </div>
    <div class="topbar-actions">
      <button class="tb-btn" id="themeToggle" title="切换深色/浅色">
        <span id="themeIcon">🌙</span>
      </button>
      <button class="tb-btn" id="exportBtn" title="切换浅色模式并打印">🖨️ 打印/PDF</button>
    </div>
  </div>
  <div class="meta-row" id="metaRow">
    <span class="meta-item"><span id="metaQuoteDot" class="meta-dot ${dotClass(entry.concentration.top100.value != null, meta.phase === 'stale')}"></span>行情: <span id="metaQuoteDate">${currentDt}</span></span>
    <span class="meta-item"><span id="metaEtfDot" class="meta-dot ${dotClass(!!meta.etfShareDate, false)}"></span>ETF资金: <span id="metaEtfShareDate">${meta.etfShareDate || '未采集'}</span></span>
    <span class="meta-item"><span id="metaBreadthDot" class="meta-dot ${dotClass(!!breadthDate, false)}"></span>市场宽度: <span id="metaBreadthDate">${breadthDate || '未采集'}</span></span>
    <span class="meta-item"><span id="metaThemeBreadthDot" class="meta-dot ${dotClass(!!themeBreadthDate, false)}"></span>主题宽度: <span id="metaThemeBreadthDate">${themeBreadthDate || '未采集'}</span></span>
    <span class="meta-item"><span id="metaMarginDot" class="meta-dot ${dotClass(!!meta.marginDate, entry.margin.isStale)}"></span>融资余额: <span id="metaMarginDate">${meta.marginDate || '未采集'}</span></span>
  </div>
  `;
}



// --- 专业复盘首页摘要 ---
function getPrevDate(data, currentDt) {
  const idx = data.dates.indexOf(currentDt);
  return idx > 0 ? data.dates[idx - 1] : null;
}

function getAllThemeItems(entry) {
  const items = [];
  if (!entry || !entry.etfTheme || !entry.etfTheme.categories) return items;
  for (const [cat, catData] of Object.entries(entry.etfTheme.categories)) {
    for (const [theme, themeData] of Object.entries(catData.themes || {})) {
      items.push({ cat, theme, ...themeData });
    }
  }
  return items;
}

function sumThemeFlow(entry) {
  const items = getAllThemeItems(entry).filter(t => t.flow != null && isFinite(t.flow));
  if (items.length === 0) return null;
  return items.reduce((sum, t) => sum + t.flow, 0);
}

function calcFlowStreak(data, currentDt, getter, direction) {
  const idx = data.dates.indexOf(currentDt);
  let days = 0;
  let sum = 0;
  for (let i = idx; i >= 0; i--) {
    const v = getter(data.data[data.dates[i]]);
    if (v == null || !isFinite(v)) break;
    const ok = direction === 'positive' ? v > 0 : v < 0;
    if (!ok) break;
    days += 1;
    sum += v;
  }
  return { days, sum };
}


function calcWindowSum(data, currentDt, getter, windowDays) {
  const idx = data.dates.indexOf(currentDt);
  let days = 0;
  let sum = 0;
  for (let i = idx; i >= 0 && days < windowDays; i--) {
    const v = getter(data.data[data.dates[i]]);
    if (v == null || !isFinite(v)) continue;
    days += 1;
    sum += v;
  }
  return days > 0 ? { days, sum } : { days: 0, sum: null };
}

function calcWindowChange(data, currentDt, getter, windowDays) {
  const idx = data.dates.indexOf(currentDt);
  const cur = getter(data.data[currentDt]);
  if (cur == null || !isFinite(cur)) return null;
  let seen = 0;
  let base = null;
  for (let i = idx - 1; i >= 0; i--) {
    const v = getter(data.data[data.dates[i]]);
    if (v == null || !isFinite(v)) continue;
    seen += 1;
    base = v;
    if (seen >= windowDays) break;
  }
  return base == null ? null : cur - base;
}

function calcConditionStreak(data, currentDt, predicate) {
  const idx = data.dates.indexOf(currentDt);
  let days = 0;
  for (let i = idx; i >= 0; i--) {
    const entry = data.data[data.dates[i]];
    if (!predicate(entry)) break;
    days += 1;
  }
  return days;
}

function detectBreadthCacheSuspicion(data, currentDt) {
  const idx = data.dates.indexOf(currentDt);
  const recent = [];
  for (let i = idx; i >= 0 && recent.length < 3; i--) {
    const m = data.data[data.dates[i]].market;
    if (m && m.upCount != null && m.downCount != null && m.medianReturn != null) {
      recent.push({ up: m.upCount, down: m.downCount, median: m.medianReturn });
    }
  }
  if (recent.length < 3) return false;
  const sameCounts = recent.every(x => x.up === recent[0].up && x.down === recent[0].down);
  const medians = recent.map(x => x.median);
  const medianRange = Math.max(...medians) - Math.min(...medians);
  return sameCounts && medianRange > 0.3;
}

function renderSignalChip(label, value, tone, note) {
  return `<div class="pro-signal-chip ${tone || 'neutral'}"><span>${label}</span><strong>${value}</strong><em>${note || ''}</em></div>`;
}
function formatCount(v) {
  if (v == null || !isFinite(v)) return '--';
  return Math.round(v).toLocaleString('zh-CN');
}

function renderProfessionalReview(data, currentDt, phase) {
  const entry = data.data[currentDt];
  const prevDt = getPrevDate(data, currentDt);
  const prev = prevDt ? data.data[prevDt] : null;
  const c = entry.computed || {};
  const total = entry.concentration.totalAmount;
  const prevTotal = prev && prev.concentration ? prev.concentration.totalAmount : null;
  const amountDelta = total != null && prevTotal != null ? total - prevTotal : null;
  const amountStreak = calcFlowStreak(data, currentDt, e => e && e.concentration ? e.concentration.totalAmount : null, 'positive');
  const highAmountStreak = (() => {
    const idx = data.dates.indexOf(currentDt);
    let days = 0;
    for (let i = idx; i >= 0; i--) {
      const v = data.data[data.dates[i]].concentration.totalAmount;
      if (v == null || v < 30000) break;
      days += 1;
    }
    return days;
  })();

  const upCount = entry.market.upCount;
  const downCount = entry.market.downCount;
  const upRatio = entry.market.upRatio;
  const breadthText = upCount != null && downCount != null
    ? `${formatCount(upCount)}只上涨，${formatCount(downCount)}只下跌，上涨占比${upRatio != null ? (upRatio * 100).toFixed(1) + '%' : '--'}`
    : '市场宽度未采集，当前只能参考代理信号';
  const breadthTone = upRatio == null ? 'neutral' : (upRatio < 0.35 ? 'negative' : (upRatio > 0.6 ? 'positive' : 'neutral'));

  const wideFlow = entry.etfWide.totalFlow;
  const wideStreak = calcFlowStreak(data, currentDt, e => e && e.etfWide ? e.etfWide.totalFlow : null, wideFlow >= 0 ? 'positive' : 'negative');
  const themeFlow = sumThemeFlow(entry);
  const themeStreak = calcFlowStreak(data, currentDt, sumThemeFlow, themeFlow >= 0 ? 'positive' : 'negative');
  const wide5 = calcWindowSum(data, currentDt, e => e && e.etfWide ? e.etfWide.totalFlow : null, 5);
  const wide10 = calcWindowSum(data, currentDt, e => e && e.etfWide ? e.etfWide.totalFlow : null, 10);
  const theme5 = calcWindowSum(data, currentDt, sumThemeFlow, 5);
  const theme10 = calcWindowSum(data, currentDt, sumThemeFlow, 10);
  const margin5 = calcWindowChange(data, currentDt, e => e && e.margin ? e.margin.value : null, 5);
  const margin10 = calcWindowChange(data, currentDt, e => e && e.margin ? e.margin.value : null, 10);
  const weakBreadthStreak = calcConditionStreak(data, currentDt, e => e && e.market && e.market.upRatio != null && e.market.upRatio < 0.35);
  const highTurnoverStreak = calcConditionStreak(data, currentDt, e => e && e.concentration && e.concentration.totalAmount != null && e.concentration.totalAmount >= 30000);
  const breadthCacheSuspicious = detectBreadthCacheSuspicion(data, currentDt);

  const themes = getAllThemeItems(entry);
  const inflowThemes = themes.filter(t => t.flow != null).sort((a, b) => b.flow - a.flow).slice(0, 4);
  const outflowThemes = themes.filter(t => t.flow != null).sort((a, b) => a.flow - b.flow).slice(0, 3);
  const totalInflow = inflowThemes.reduce((s, t) => s + Math.max(0, t.flow || 0), 0);
  const leadTheme = inflowThemes[0] || null;
  const leadShare = leadTheme && totalInflow > 0 ? leadTheme.flow / totalInflow : null;

  const mainlines = calcMainlineValidation(entry);
  const mainPositive = mainlines.filter(m => m.label === '主线确认' || m.label === '潜在主线' || m.label === '防御配置').slice(0, 4);
  const heatLeaders = mainlines
    .filter(m => m.heatShare != null)
    .sort((a, b) => (b.heatShare || 0) - (a.heatShare || 0))
    .slice(0, 4);

  const milestones = [];
  if (entry.margin.value != null && entry.margin.value >= 3) {
    milestones.push({ level: 'strong', title: '融资余额突破3万亿', desc: `杠杆资金进入历史高水位，当前${entry.margin.value.toFixed(4)}万亿` });
  } else if (entry.margin.value != null && entry.margin.value >= 2.9) {
    milestones.push({ level: 'watch', title: '融资余额逼近3万亿', desc: `当前${entry.margin.value.toFixed(4)}万亿，观察加仓节奏是否继续放缓` });
  }
  if (highAmountStreak >= 2) {
    milestones.push({ level: 'strong', title: `成交额连续${highAmountStreak}日破3万亿`, desc: `当日成交${total != null ? fmt(total) + '亿' : '--'}，流动性处于高位` });
  }
  if (wideStreak.days >= 3 && wideFlow < 0) {
    milestones.push({ level: 'risk', title: `宽基ETF连续${wideStreak.days}日流出`, desc: `区间累计${fmtFlow(wideStreak.sum)}亿，权重资金仍在撤退` });
  }
  if (leadTheme && leadShare != null && leadShare >= 0.3) {
    milestones.push({ level: 'strong', title: `${leadTheme.theme}成为最一致流入方向`, desc: `在前四大流入主题中占${(leadShare * 100).toFixed(0)}%，当日${fmtFlow(leadTheme.flow)}亿` });
  }
  if (breadthTone === 'negative' && total != null && total >= 30000) {
    milestones.push({ level: 'risk', title: '放量但宽度较差', desc: '高成交并未扩散到多数股票，更像结构行情而非普涨' });
  }
  if (milestones.length === 0) {
    milestones.push({ level: 'watch', title: '暂无硬里程碑', desc: '今天更适合观察资金方向和主线验证，而不是下强结论' });
  }

  const headlineParts = [];
  if (total != null) headlineParts.push(`成交额${fmt(total)}亿`);
  if (amountDelta != null) headlineParts.push(`${amountDelta >= 0 ? '放量' : '缩量'}${Math.abs(amountDelta).toFixed(0)}亿`);
  if (highAmountStreak >= 2) headlineParts.push(`连续${highAmountStreak}日破3万亿`);
  if (upCount != null && downCount != null) headlineParts.push(`${formatCount(upCount)}涨/${formatCount(downCount)}跌`);
  const headline = headlineParts.join('，') || phase.description;

  const marketType = (() => {
    if (total != null && total >= 30000 && breadthTone === 'negative') return '高成交、弱宽度的结构行情';
    if (themeFlow != null && themeFlow > 0 && wideFlow != null && wideFlow < 0) return '宽基撤退、主题加仓的切换行情';
    if (wideFlow != null && wideFlow > 0 && breadthTone !== 'negative') return '权重承接、宽度尚可的修复行情';
    if (total != null && c.amountVs5d != null && c.amountVs5d < -10) return '缩量观察行情';
    return phase.label;
  })();

  const professionalNarrative = {
    market: (() => {
      if (breadthCacheSuspicious) return `今天先定性为${marketType}，但${colorNum(upCount, formatCount(upCount))}涨/${colorNum(downCount, formatCount(downCount))}跌连续多日完全相同，宽度数据疑似缓存，宽度证据需要降权。`;
      if (breadthTone === 'negative') return `今天是${marketType}：成交不低，但${colorNum(upCount, formatCount(upCount))}涨/${colorNum(downCount, formatCount(downCount))}跌，说明指数和少数方向不能代表全市场体感。`;
      if (breadthTone === 'positive') return `今天是${marketType}：宽度改善，资金扩散质量优于单纯指数上涨。`;
      return `今天是${marketType}：方向判断主要依赖成交额、ETF资金和TOP100热度（头部股票热度）。`;
    })(),
    flow: (() => {
      const wideText = wide5.sum != null ? `宽基ETF近${wide5.days}日累计${colorNum(wide5.sum, fmtFlow(wide5.sum))}亿` : '宽基ETF近5日数据不足';
      const themeText = theme5.sum != null ? `主题ETF近${theme5.days}日累计${colorNum(theme5.sum, fmtFlow(theme5.sum))}亿` : '主题ETF近5日数据不足';
      const leadText = leadTheme ? `当日最强流入是${leadTheme.theme}（${colorNum(leadTheme.flow, fmtFlow(leadTheme.flow))}亿）` : '当日暂无明确主题流入方向';
      return `${wideText}，${themeText}，${leadText}。这决定了今天更像资金在选择方向，而不是无差别扩散。`;
    })(),
    verify: (() => {
      const leader = heatLeaders[0];
      if (leader && leader.heatShare != null) {
        return `下一交易日优先验证${leader.themeName}：TOP100热度（头部股票热度）能否维持在${colorNum(leader.heatShare, (leader.heatShare * 100).toFixed(1) + '%')}附近，主题ETF是否继续净流入，同时市场宽度不能继续恶化。`;
      }
      return '下一交易日优先验证：主题ETF是否延续流入、宽基ETF是否止流出、市场宽度是否修复。';
    })()
  };

  const margin5Yi = margin5 != null ? margin5 * 10000 : null;
  const margin10Yi = margin10 != null ? margin10 * 10000 : null;
  const marginJumpSuspicious = (margin5Yi != null && Math.abs(margin5Yi) > 5000) || (margin10Yi != null && Math.abs(margin10Yi) > 8000);

  const signalChips = [];
  signalChips.push(renderSignalChip(
    '成交连续性',
    total != null ? (highAmountStreak >= 2 ? `高位且连续${highAmountStreak}日` : (total >= 30000 ? '高位' : '正常')) : '--',
    total != null && total >= 30000 ? 'strong' : 'neutral',
    total != null ? `当日${fmt(total)}亿` : ''
  ));
  signalChips.push(renderSignalChip(
    '宽度连续性',
    breadthTone === 'negative' ? '弱宽度' : (breadthTone === 'positive' ? '宽度改善' : '中性'),
    breadthTone === 'negative' ? 'risk' : (breadthTone === 'positive' ? 'strong' : 'neutral'),
    upRatio != null ? `上涨占比${colorNum(upRatio, (upRatio * 100).toFixed(1) + '%')}` : ''
  ));
  signalChips.push(renderSignalChip(
    '资金切换',
    `${wideFlow != null ? (wideFlow < 0 ? '宽基撤退' : '宽基承接') : '--'} / ${themeFlow != null ? (themeFlow > 0 ? '主题加仓' : '主题承压') : '--'}`,
    (wideFlow != null && wideFlow < 0 && themeFlow != null && themeFlow > 0) ? 'strong' : ((wideFlow != null && wideFlow > 0 && themeFlow != null && themeFlow < 0) ? 'risk' : 'neutral'),
    wide10.sum != null ? `宽基10日${colorNum(wide10.sum, fmtFlow(wide10.sum))}亿` : ''
  ));
  signalChips.push(renderSignalChip('融资节奏', marginJumpSuspicious ? '口径跳变待核验' : (margin5Yi != null ? `5日${colorNum(margin5Yi, fmtFlow(margin5Yi))}亿` : '--'), marginJumpSuspicious ? 'risk' : (margin5Yi != null && margin5Yi > 0 ? 'strong' : (margin5Yi != null && margin5Yi < 0 ? 'risk' : 'neutral')), marginJumpSuspicious ? '融资余额序列异常' : (margin10Yi != null ? `10日${colorNum(margin10Yi, fmtFlow(margin10Yi))}亿` : '')));
  if (breadthCacheSuspicious) signalChips.push(renderSignalChip('数据异常', '宽度疑似缓存', 'risk', '连续3日涨跌家数相同'));
  if (marginJumpSuspicious) signalChips.push(renderSignalChip('数据异常', '融资口径疑似跳变', 'risk', '连续变化不用于判断'));

  return `
  <div class="pro-review-card">
    <div class="pro-review-head">
      <div>
        <div class="pro-eyebrow">专业复盘摘要</div>
        <div class="pro-headline">${headline}</div>
        <div class="pro-narrative">
          <div><strong>市场定性：</strong>${professionalNarrative.market}</div>
          <div><strong>资金穿透：</strong>${professionalNarrative.flow}</div>
          <div><strong>明日验证：</strong>${professionalNarrative.verify}</div>
        </div>
      </div>
      <div class="pro-phase ${phase.phase}">${phase.label}</div>
    </div>

    <div class="pro-fact-grid">
      <div class="pro-fact">
        <div class="pro-fact-label">量能位置</div>
        <div class="pro-fact-value">${total != null ? (total >= 30000 ? '高位' : (total >= 20000 ? '中位' : '偏低')) : '--'}</div>
        <div class="pro-fact-note">${amountDelta != null ? (amountDelta >= 0 ? '放量 ' : '缩量 ') + Math.abs(amountDelta).toFixed(0) + '亿' : '--'}${highAmountStreak >= 2 ? ` · 连续${highAmountStreak}日站上3万亿` : ''}</div>
      </div>
      <div class="pro-fact ${breadthTone}">
        <div class="pro-fact-label">结构宽度</div>
        <div class="pro-fact-value">${upRatio != null ? (breadthTone === 'negative' ? '偏弱' : (breadthTone === 'positive' ? '改善' : '中性')) : '--'}</div>
        <div class="pro-fact-note">${breadthText}</div>
      </div>
      <div class="pro-fact ${upDn(wideFlow)}">
        <div class="pro-fact-label">宽基资金</div>
        <div class="pro-fact-value">${wideFlow != null ? (wideFlow >= 0 ? '流入' : '流出') : '--'}</div>
        <div class="pro-fact-note">${wideStreak.days >= 2 ? `连续${wideStreak.days}日${wideFlow >= 0 ? '流入' : '流出'}，累计${fmtFlow(wideStreak.sum)}亿` : '观察权重资金态度'}</div>
      </div>
      <div class="pro-fact ${upDn(themeFlow)}">
        <div class="pro-fact-label">主题资金</div>
        <div class="pro-fact-value">${themeFlow != null ? (themeFlow >= 0 ? '流入' : '流出') : '--'}</div>
        <div class="pro-fact-note">${themeStreak.days >= 2 ? `连续${themeStreak.days}日${themeFlow >= 0 ? '流入' : '流出'}，累计${fmtFlow(themeStreak.sum)}亿` : '观察主动加仓方向'}</div>
      </div>
    </div>

    <div class="pro-signal-tape">
      ${signalChips.join('')}
    </div>

    <div class="pro-columns">
      <div class="pro-panel">
        <div class="pro-panel-title">资金穿透方向</div>
        <div class="pro-flow-list">
          ${inflowThemes.map(t => `<div class="pro-flow-row"><span>${t.theme}</span><strong class="${upDn(t.flow)}">${fmtFlow(t.flow)}亿</strong><em>${t.flow5d != null ? '5日 ' + fmtFlow(t.flow5d) + '亿' : ''}</em></div>`).join('') || '<div class="pro-empty">暂无主题流入数据</div>'}
        </div>
        <div class="pro-sell-list">
          ${outflowThemes.map(t => `<span>${t.theme} ${fmtFlow(t.flow)}亿</span>`).join('') || '<span>暂无明显流出方向</span>'}
        </div>
      </div>
      <div class="pro-panel">
        <div class="pro-panel-title">主线候选与成交热度</div>
        <div style="font-size:11px;color:var(--t3);margin:0 0 8px 0;line-height:1.5">
          这里确认的是资金承接 + 相对强度主线，不等于当天价格必须收涨。TOP100热度 = 成交额前100只股票中的占比，数值越高，说明资金越集中。
        </div>
        <div class="pro-mainline-summary">
          ${mainPositive.length > 0
            ? `当前有 ${mainPositive.length} 个通过验证的主线候选。`
            : (heatLeaders[0]
              ? `当前暂无主线确认，先看热度最高的方向：${heatLeaders[0].themeName || heatLeaders[0].theme || '--'}（${(heatLeaders[0].heatShare * 100).toFixed(1)}%）。`
              : '当前没有足够数据形成主线候选。')}
        </div>
        <div class="pro-mainline-table">
          <div class="pro-mainline-head">
            <span>主线候选</span>
            <span>结论</span>
            <span>热度</span>
            <span>证据</span>
          </div>
          ${(mainPositive.length > 0 ? mainPositive : heatLeaders.slice(0, 4).map(m => ({
            ...m,
            label: '热度观察',
            signalAgreement: '证据不足'
          }))).map(m => `<div class="pro-mainline-row"><span>${m.themeName || m.theme || '--'}</span><strong>${m.label || '--'}</strong><em>${m.heatShare != null ? (m.heatShare * 100).toFixed(1) + '%' : '--'}</em><small>${m.signalAgreement || '--'}</small></div>`).join('') || '<div class="pro-empty">暂无通过验证的主线候选</div>'}
        </div>
      </div>
      <div class="pro-panel">
        <div class="pro-panel-title">里程碑信号</div>
        <div class="pro-milestones">
          ${milestones.slice(0, 4).map(m => `<div class="pro-milestone ${m.level}"><strong>${m.title}</strong><span>${m.desc}</span></div>`).join('')}
        </div>
      </div>
    </div>
  </div>`;
}
// ============ 页面1: 今日复盘 ============

function renderReview(data, currentDt) {
  var entry = data.data[currentDt];
  if (!entry) return '<div class="page tab-content" id="tab-review">无数据</div>';

  var c = entry.computed || {};
  var m = entry.margin || {};
  var idxChgToday = null;
  if (data && data.klineSummary && data.klineSummary['000300.SH']) {
    idxChgToday = data.klineSummary['000300.SH'].chg1d;
  }

  // ====== 01 市场概览 ======
  var indices = (entry.market && entry.market.indices && entry.market.indices.length > 0)
    ? entry.market.indices
    : (entry.etfWide && entry.etfWide.items ? entry.etfWide.items.slice(0, 6) : []);
  var idxCards = indices.map(function(idx) {
    var chg = idx.chg;
    return '<div class="idx-card">' +
      '<div class="idx-name">' + idx.name + '</div>' +
      '<div class="idx-chg ' + upDn(chg) + '">' + fmtPct(chg) + '</div>' +
      '<div class="idx-flow">' + (idx.flow != null ? '资金 ' + fmtFlow(idx.flow) + '亿' : '') + '</div>' +
    '</div>';
  }).join('');

  // 01 今日证据 = 证据页：只展示原始数据（行情/成交/资金/情绪）
  // 指数验证矩阵归 04 验证与数据质量页（避免重复）

  // ====== 02 成交与宽度 ======
  var totalAmount = entry.concentration ? entry.concentration.totalAmount : null;
  var top100 = entry.concentration && entry.concentration.top100 ? entry.concentration.top100.value : null;
  var top10 = entry.concentration && entry.concentration.top10 ? entry.concentration.top10.value : null;
  var upRatio = c.upRatio != null ? c.upRatio : (c.top10UpRatio != null ? c.top10UpRatio : null);

  // ====== 03 情绪数据 ======
  var fundingLayers = calculateFundingLayers(entry, data, currentDt);
  var emoLayer = fundingLayers.layers.find(function(f) { return f.layer === '情绪资金'; });
  var emoHtml = emoLayer
    ? '<div class="emo-data">' +
      '<div class="emo-item"><span>涨停</span><strong class="green">' + (emoLayer.limitUp != null ? emoLayer.limitUp + ' 家' : '--') + '</strong></div>' +
      '<div class="emo-item"><span>跌停</span><strong class="red">' + (emoLayer.limitDown != null ? emoLayer.limitDown + ' 家' : '--') + '</strong></div>' +
      '<div class="emo-item"><span>连板高度</span><strong>' + (emoLayer.limitHeight != null ? emoLayer.limitHeight + ' 板' : '待接入') + '</strong></div>' +
      '<div class="emo-item"><span>情绪状态</span><strong>' + (emoLayer.emoStatus || '--') + '</strong></div>' +
    '</div>'
    : '<div class="struct-missing">情绪数据待接入</div>';

  // ====== 05 资金明细 ======
  var wideFlow = entry.etfWide ? entry.etfWide.totalFlow : null;
  var wideItems = entry.etfWide && entry.etfWide.items ? entry.etfWide.items : [];
  var wideItemsHtml = wideItems.length > 0
    ? wideItems.filter(function(w) { return w.flow != null; }).sort(function(a, b) { return Math.abs(b.flow) - Math.abs(a.flow); }).slice(0, 8).map(function(w) {
        return '<tr><td>' + w.name + '</td><td>' + w.code + '</td>' +
          '<td class="' + upDn(w.flow) + '">' + (w.flow != null ? fmtSignedFlowYi(w.flow) : '--') + '</td>' +
          '<td>' + (w.fundSize != null ? w.fundSize.toFixed(0) + '亿' : '--') + '</td></tr>';
      }).join('')
    : '';

  // 融资数据
  var marginHtml = m.value != null
    ? '<div class="margin-data">' +
      '<span>余额：<strong>' + m.value.toFixed(4) + ' 万亿</strong></span>' +
      '<span>较前日：<strong class="' + upDn(m.chgYi) + '">' + (m.chgYi != null ? fmtSignedFlowYi(m.chgYi) : '--') + '</strong></span>' +
      (m.isStale ? '<span class="struct-stale-tag">T+1披露</span>' : '') +
    '</div>'
    : '<div class="struct-missing">融资数据待接入</div>';

  // ETF/主题明细归 02 结构承载页，01 不再重复计算（避免与 02 出现口径偏差）

  // ====== 08 数据源状态（用两层健康度，不写笼统的100%）======
  var meta = entry.meta || {};
  var phaseLabels = { realtime:'盘中估算', preliminary:'盘后初版', confirmed:'盘后确认', partial:'数据不完整', stale:'数据过期', failed:'取数失败', pending:'待确认' };
  var ds08 = buildDecisionState(entry, data, currentDt);
  var coreH08 = ds08 ? ds08.coreDataHealth : null;
  var structH08 = ds08 ? ds08.structureDataHealth : null;
  var dataSourceHtml = '<div class="data-source-list">' +
    '<div class="ds-item"><span>阶段</span><strong>' + (phaseLabels[meta.phase] || meta.phase || '--') + '</strong></div>' +
    '<div class="ds-item"><span>核心数据</span><strong>' + (coreH08 ? coreH08.ok + '/' + coreH08.total + ' · ' + coreH08.status : '--') + '</strong>' + (coreH08 && coreH08.missing.length > 0 ? '<em>缺 ' + coreH08.missing.join('、') + '</em>' : '') + '</div>' +
    '<div class="ds-item"><span>主题覆盖</span><strong>' + (structH08 ? structH08.ok + '/' + structH08.total + ' 主题 · ' + structH08.status : '--') + '</strong></div>' +
    '<div class="ds-item"><span>日期</span><strong>' + (entry.label || currentDt) + '</strong></div>' +
  '</div>';

  // 01 今日证据 = 当天事实摘要页（精简版）
  // 不展示完整 ETF 池 / 单只 ETF 明细 / 主题评分（这些在 02）
  return '<div class="page tab-content" id="tab-review">' +
    '<div class="wrap">' +

    // 顶部说明 + 跳转按钮
    '<div class="module-title"><span class="num">01</span><span class="title">今日证据 · 当日事实摘要</span><span class="subtitle">仅展示原始数据 · 主题明细/ETF池/评分请到 02 结构承载</span> <button class="tab-jump-btn" data-tab="structure">→ 查看主题ETF明细</button></div>' +

    // 01 指数表现
    '<div class="module-title"><span class="num">01</span><span class="title">指数表现</span><span class="subtitle">仅作背景参考</span></div>' +
    '<div class="grid grid-6" style="margin-bottom:var(--sp-2)">' + idxCards + '</div>' +

    // 02 成交与宽度
    '<div class="module-title"><span class="num">02</span><span class="title">成交与宽度</span><span class="subtitle">市场水位和赚钱效应</span></div>' +
    '<div class="grid grid-6">' +
      '<div class="kpi-card"><div class="kpi-label">全市场成交额</div><div class="kpi-value">' + (totalAmount != null ? fmtAmountYi(totalAmount) : '--') + '</div><div class="kpi-benchmark">' + (c.amountChgPct != null ? '较前日 ' + fmtPct(c.amountChgPct) : '--') + '</div></div>' +
      '<div class="kpi-card"><div class="kpi-label">较5日均值</div><div class="kpi-value ' + upDn(c.amountVs5d) + '">' + (c.amountVs5d != null ? fmtPct(c.amountVs5d) : '--') + '</div><div class="kpi-benchmark">' + (c.amountPctile20d != null ? '20日' + (c.amountPctile20d * 100).toFixed(0) + '%分位' : '--') + '</div></div>' +
      '<div class="kpi-card"><div class="kpi-label">上涨比例</div><div class="kpi-value ' + upDn(upRatio != null ? upRatio - 0.5 : null) + '">' + (upRatio != null ? (upRatio * 100).toFixed(0) + '%' : '--') + '</div><div class="kpi-benchmark">' + (c.breadthProxy ? 'TOP10代理' : '全市场') + '</div></div>' +
    '</div>' +

    // 03 涨跌停与情绪
    '<div class="module-title"><span class="num">03</span><span class="title">涨跌停与情绪</span><span class="subtitle">涨停/跌停/连板高度</span></div>' +
    emoHtml +

    // 04 融资变化
    '<div class="module-title"><span class="num">04</span><span class="title">融资变化</span><span class="subtitle">杠杆资金态度</span></div>' +
    marginHtml +

    // 05 宽基 + 主题合计（仅 1 行汇总，不展开单只）
    '<div class="module-title"><span class="num">05</span><span class="title">宽基与主题ETF合计</span><span class="subtitle">当日资金总览（单只明细与主题分类见 02）</span></div>' +
    '<div class="grid grid-3">' +
      '<div class="kpi-card"><div class="kpi-label">宽基ETF合计净流入</div><div class="kpi-value ' + upDn(wideFlow) + '">' + (wideFlow != null ? fmtSignedFlowYi(wideFlow) : '--') + '</div></div>' +
      '<div class="kpi-card"><div class="kpi-label">主题ETF合计净流入</div><div class="kpi-value">' + (() => {
        var tt = 0;
        if (entry.etfTheme && entry.etfTheme.categories) {
          Object.keys(entry.etfTheme.categories).forEach(ck => {
            var cat = entry.etfTheme.categories[ck];
            if (!cat || !cat.themes) return;
            Object.keys(cat.themes).forEach(tk => {
              var f = cat.themes[tk].flow;
              if (f != null && isFinite(f)) tt += f;
            });
          });
        }
        return fmtSignedFlowYi(tt);
      })() + '</div></div>' +
      '<div class="kpi-card"><div class="kpi-label">融资余额变化</div><div class="kpi-value ' + upDn(m.chgYi) + '">' + (m.chgYi != null ? fmtSignedFlowYi(m.chgYi) : '--') + '</div></div>' +
    '</div>' +

    // 06 数据源状态
    '<div class="module-title"><span class="num">06</span><span class="title">数据源状态</span></div>' +
    dataSourceHtml +

    '</div>' +
  '</div>';
}

// --- 市场速览 ---
function renderMarketOverview(entry) {
  // 第一行：4-6个指数卡
  const indices = entry.market.indices.length > 0
    ? entry.market.indices
    : (entry.etfWide.items || []).slice(0, 6);

  const idxCards = indices.map(idx => {
    const chg = idx.chg;
    return `
    <div class="idx-card">
      <div class="idx-name">${idx.name}</div>
      <div class="idx-chg ${upDn(chg)}">${fmtPct(chg)}</div>
      <div class="idx-flow">${idx.flow != null ? '资金 ' + fmtFlow(idx.flow) + '亿' : ''}</div>
    </div>`;
  }).join('');

  // 第二行：全市场指标
  const total = entry.concentration.totalAmount;
  const c = entry.computed || {};

  return `
  <div class="grid grid-6" style="margin-bottom:var(--sp-2)">${idxCards}</div>
  <div class="grid grid-6" style="margin-bottom:var(--sp-3)">
    <div class="kpi-card">
      <div class="kpi-label">全市场成交额</div>
      <div class="kpi-value">${total != null ? fmt(total) : '--'}<span class="unit">亿</span></div>
      <div class="kpi-benchmark">${c.amountChgPct != null ? '较前日 ' + fmtPct(c.amountChgPct) : '--'}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">较5日均值</div>
      <div class="kpi-value ${upDn(c.amountVs5d)}">${c.amountVs5d != null ? fmtPct(c.amountVs5d) : '--'}</div>
      <div class="kpi-benchmark">${c.amountPctile20d != null ? '20日' + (c.amountPctile20d * 100).toFixed(0) + '%分位' : '--'}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">TOP100集中度</div>
      <div class="kpi-value">${entry.concentration.top100.value != null ? entry.concentration.top100.value.toFixed(1) : '--'}<span class="unit">%</span></div>
      <div class="kpi-benchmark">${c.top100Pctile20d != null ? '近20个有效交易日' + (c.top100Pctile20d * 100).toFixed(0) + '%分位' : '--'} ${c.top100Chg != null ? (c.top100Chg > 0 ? '↑' : '↓') + Math.abs(c.top100Chg).toFixed(1) + 'pct' : ''}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">宽基ETF净流入</div>
      <div class="kpi-value ${upDn(entry.etfWide.totalFlow)}">${entry.etfWide.totalFlow != null ? fmtFlow(entry.etfWide.totalFlow) : '--'}<span class="unit">亿</span></div>
      <div class="kpi-benchmark">${c.wideFlowPctile20d != null ? '20日' + (c.wideFlowPctile20d * 100).toFixed(0) + '%分位' : '--'}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">融资余额</div>
      <div class="kpi-value">${entry.margin.value != null ? entry.margin.value.toFixed(0) : '--'}<span class="unit">万亿</span></div>
      <div class="kpi-benchmark">${entry.margin.chg != null ? '较前日 ' + fmtPct(entry.margin.chg) : '--'} ${entry.margin.isStale ? '(T+1)' : ''}</div>
    </div>
  </div>
  `;
}

// --- 核心判断 ---
function renderVerdict(phase, consistency, signals) {
  const evidenceList = phase.evidence.map(e => `<li>${e}</li>`).join('');
  const counterHtml = phase.counterEvidence
    ? `<div style="padding:10px 12px;border:1px solid var(--c-down);border-radius:8px;color:var(--t2);line-height:1.6"><strong style="color:var(--c-down)">需要小心：</strong>${phase.counterEvidence}</div>`
    : `<div style="padding:10px 12px;border:1px solid rgba(255,255,255,.08);border-radius:8px;color:var(--t3);line-height:1.6">暂时没有明显反证，但仍要看下一交易日能否延续。</div>`;

  const signalSummary = ['liquidity', 'breadth', 'support', 'structure'].map(key => {
    const s = signals[key];
    const directionLabel = s.strength > 0 ? '偏正' : (s.strength < 0 ? '偏负' : '中性');
    const directionClass = s.strength > 0 ? 'positive' : (s.strength < 0 ? 'negative' : 'neutral');
    return `<div style="padding:9px 0;border-top:1px solid rgba(255,255,255,.06)">
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:center">
        <span style="font-size:12px;color:var(--t2)">${s.label}</span>
        <strong class="${directionClass}" style="font-size:12px;white-space:nowrap">${directionLabel}</strong>
      </div>
      <div style="font-size:11px;color:var(--t4);line-height:1.45;margin-top:3px">${s.detail}</div>
    </div>`;
  }).join('');

  return `
  <div class="verdict-card" style="display:grid;grid-template-columns:1.3fr .9fr;gap:var(--sp-2)">
    <div>
      <div class="verdict-strap">先回答一个问题：今天更像哪种市场状态。</div>
      <div class="verdict-phase">
        <span class="verdict-phase-tag ${phase.phase}">当前结论：${phase.label}</span>
        <span class="verdict-confidence ${consistency.level}">信号一致度：${consistency.label}</span>
      </div>
      <div class="verdict-sentence">${phase.description}</div>
      <div style="margin-top:var(--sp-2);padding:12px 14px;border:1px solid rgba(255,255,255,.08);border-radius:8px;background:rgba(255,255,255,.02)">
        <div style="font-size:12px;color:var(--t3);font-weight:700;margin-bottom:6px">为什么这么判断</div>
        <ul style="margin:0;padding-left:18px;color:var(--t2);line-height:1.7;font-size:13px">${evidenceList || '<li>有效证据不足，先观察。</li>'}</ul>
      </div>
      <div style="margin-top:var(--sp-1)">${counterHtml}</div>
    </div>
    <div>
      <div style="padding:12px 14px;border:1px solid rgba(255,255,255,.08);border-radius:8px;background:rgba(255,255,255,.02);margin-bottom:var(--sp-1)">
        <div style="font-size:12px;color:var(--t3);font-weight:700;margin-bottom:8px">下一步看什么</div>
        <div style="font-size:13px;color:var(--t2);line-height:1.7">${phase.validateNext}</div>
      </div>
      <div style="padding:12px 14px;border:1px solid rgba(255,255,255,.08);border-radius:8px;background:rgba(255,255,255,.02)">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:6px">
          <div style="font-size:12px;color:var(--t3);font-weight:700">四个信号摘要</div>
          <div style="font-size:11px;color:var(--t4)">${(consistency.score * 100).toFixed(0)}%一致</div>
        </div>
        ${signalSummary}
      </div>
    </div>
  </div>
  `;
}

// --- 资金脉搏 ---
function renderPulse(entry) {
  const c = entry.computed || {};
  const m = entry.margin;
  const totalAmount = entry.concentration.totalAmount;
  const wideFlow = entry.etfWide.totalFlow;
  const top100 = entry.concentration.top100.value;
  const top10 = entry.concentration.top10.value;
  const upRatio = c.top10UpRatio;

  const amountTone = c.amountPctile20d != null && c.amountPctile20d >= 0.75
    ? '高成交'
    : (c.amountPctile20d != null && c.amountPctile20d <= 0.25 ? '低成交' : '中等成交');
  const moneyVerdict = (() => {
    if (totalAmount == null) return '成交额数据不足，先不判断市场水位。';
    if (c.amountPctile20d != null && c.amountPctile20d >= 0.75) return '市场不缺钱，但要继续看这些钱是在扩散还是抱团。';
    if (c.amountPctile20d != null && c.amountPctile20d <= 0.25) return '市场水位偏低，主线确认要更依赖持续性。';
    return '市场水位正常，重点看钱是否集中到少数方向。';
  })();
  const concentrationVerdict = (() => {
    if (c.top100Pctile20d != null && c.top100Pctile20d >= 0.75) return '钱明显偏集中，强方向可能继续强，但追高风险也更高。';
    if (c.top100Pctile20d != null && c.top100Pctile20d <= 0.25) return '钱相对分散，行情更容易扩散，但主线辨识度会下降。';
    return '集中度处在中间区间，暂时不是极端抱团。';
  })();

  const metric = (label, value, cls, note) => `
    <div style="padding:8px 0;border-top:1px solid rgba(255,255,255,.06)">
      <div style="display:flex;align-items:baseline;justify-content:space-between;gap:12px">
        <span style="font-size:12px;color:var(--t3)">${label}</span>
        <strong class="${cls || ''}" style="font-size:15px;color:var(--t1);white-space:nowrap">${value}</strong>
      </div>
      <div style="font-size:11px;color:var(--t4);margin-top:3px;line-height:1.5">${note || ''}</div>
    </div>`;

  const moneyMetrics = [
    metric('成交水位', totalAmount != null ? fmtAmountYi(totalAmount) : '--', '', `${amountTone} · ${c.amountVs5d != null ? '较5日均值' + fmtPct(c.amountVs5d) : '5日均值待确认'}`),
    metric('宽基ETF', wideFlow != null ? fmtFlow(wideFlow) + '亿' : '--', upDn(wideFlow), c.wideFlowPctile20d != null ? '20日' + (c.wideFlowPctile20d * 100).toFixed(0) + '%分位' : '分位待确认'),
    metric('融资余额', m.value != null ? m.value.toFixed(4) + '万亿' : '--', '', `${m.chg != null ? '较前日' + fmtPct(m.chg) : '--'} · ${m.isStale ? 'T+1披露' : (m.date || '--')}`)
  ].join('');

  const concentrationMetrics = [
    metric('TOP100占比', top100 != null ? top100.toFixed(1) + '%' : '--', '', `${c.top100Pctile20d != null ? '近20个有效交易日' + (c.top100Pctile20d * 100).toFixed(0) + '%分位' : '--'}${c.top100Chg != null ? ' · 较前日' + (c.top100Chg > 0 ? '+' : '') + c.top100Chg.toFixed(1) + 'pct' : ''}`),
    metric('TOP10占比', top10 != null ? top10.toFixed(1) + '%' : '--', '', `${c.top10Pctile20d != null ? '近20个有效交易日' + (c.top10Pctile20d * 100).toFixed(0) + '%分位' : '--'}`),
    metric('上涨覆盖面', upRatio != null ? (upRatio * 100).toFixed(1) + '%' : '--', upDn(upRatio != null ? upRatio - 0.5 : null), c.breadthProxy ? '当前为TOP10代理值' : '全市场宽度')
  ].join('');

  let flowRows = '';
  if (entry.etfTheme && entry.etfTheme.categories) {
    const allThemes = [];
    for (const [cat, catData] of Object.entries(entry.etfTheme.categories)) {
      for (const [theme, themeData] of Object.entries(catData.themes || {})) {
        allThemes.push({ cat, theme, ...themeData });
      }
    }
    const topInflow = allThemes.filter(t => t.flow != null).sort((a, b) => b.flow - a.flow).slice(0, 2);
    const topOutflow = allThemes.filter(t => t.flow != null).sort((a, b) => a.flow - b.flow).slice(0, 1);
    flowRows = [...topInflow, ...topOutflow].map(t => {
      const label = t.flow >= 0 ? '流入' : '流出';
      return `<div style="display:grid;grid-template-columns:80px 1fr auto;gap:10px;align-items:center;padding:8px 0;border-top:1px solid rgba(255,255,255,.06)">
        <span style="font-size:11px;color:var(--t4)">${label}</span>
        <strong style="font-size:13px;color:var(--t1)">${t.theme}</strong>
        <span class="${upDn(t.flow)}" style="font-size:13px;font-weight:700">${fmtFlow(t.flow)}亿</span>
        <span></span>
        <span style="grid-column:2/4;font-size:11px;color:var(--t4)">5日 ${t.flow5d != null ? fmtFlow(t.flow5d) + '亿' : '--'} · ${t.sampleCount != null ? t.sampleCount + '个样本' : '样本待确认'}</span>
      </div>`;
    }).join('');
  }
  if (!flowRows && entry.etfWide.items.length > 0) {
    const wideItems = entry.etfWide.items.filter(i => i.flow != null).sort((a, b) => Math.abs(b.flow) - Math.abs(a.flow)).slice(0, 3);
    flowRows = wideItems.map(w => `<div style="display:grid;grid-template-columns:80px 1fr auto;gap:10px;align-items:center;padding:8px 0;border-top:1px solid rgba(255,255,255,.06)">
      <span style="font-size:11px;color:var(--t4)">宽基</span>
      <strong style="font-size:13px;color:var(--t1)">${w.name}</strong>
      <span class="${upDn(w.flow)}" style="font-size:13px;font-weight:700">${fmtFlow(w.flow)}亿</span>
    </div>`).join('');
  }

  const destinationVerdict = flowRows
    ? '先看最强流入和最大流出，判断资金是在主动选择方向，还是只做指数托底。'
    : '方向数据不足，先不判断资金去向。';

  return `
  <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--sp-2);margin-bottom:var(--sp-3)">
    <div class="card" data-jump="capital" style="padding:14px 16px">
      <div style="font-size:11px;color:var(--c-link);font-weight:700;margin-bottom:6px">第一步 · 市场有没有钱</div>
      <div style="font-size:15px;font-weight:800;color:var(--t1);line-height:1.5;margin-bottom:8px">${moneyVerdict}</div>
      ${moneyMetrics}
    </div>
    <div class="card" data-jump="capital" style="padding:14px 16px">
      <div style="font-size:11px;color:var(--c-link);font-weight:700;margin-bottom:6px">第二步 · 钱是不是挤在少数地方</div>
      <div style="font-size:15px;font-weight:800;color:var(--t1);line-height:1.5;margin-bottom:8px">${concentrationVerdict}</div>
      ${concentrationMetrics}
    </div>
    <div class="card" data-jump="etf" style="padding:14px 16px">
      <div style="font-size:11px;color:var(--c-link);font-weight:700;margin-bottom:6px">第三步 · 钱流向哪里</div>
      <div style="font-size:15px;font-weight:800;color:var(--t1);line-height:1.5;margin-bottom:8px">${destinationVerdict}</div>
      ${flowRows || '<div style="font-size:12px;color:var(--t4);padding-top:8px">暂无可用方向数据</div>'}
    </div>
  </div>
  `;
}

// --- 主题结构地图 ---
function renderThemeMap(entry) {
  if (!entry.etfTheme || !entry.etfTheme.categories) {
    return `<div class="card" style="text-align:center;color:var(--t3)">主题ETF数据${statusTag(DATA_STATUS.PENDING)}</div>`;
  }

  const allThemes = [];
  for (const [cat, catData] of Object.entries(entry.etfTheme.categories)) {
    for (const [theme, themeData] of Object.entries(catData.themes || {})) {
      const status = entry.computed.themeStatus[theme] || {};
      allThemes.push({
        theme,
        cat,
        flow: themeData.flow,
        flow5d: themeData.flow5d,
        chg: themeData.chg,
        volume: themeData.volume,
        coverage: themeData.coverage,
        fundSize: themeData.fundSize,
        statusLabel: status.label || '--',
        statusType: status.type || 'unknown',
        statusConfidence: status.confidence || 'low'
      });
    }
  }

  // 按状态分组
  const groups = {
    sustained: [],
    spike: [],
    cooling: [],
    outflow: [],
    unknown: []
  };
  allThemes.forEach(t => { (groups[t.statusType] || groups.unknown).push(t); });

  // 优先级排序：持续流入 > 短线异动 > 今日降温 > 持续流出
  const order = ['sustained', 'spike', 'cooling', 'outflow', 'unknown'];
  let cards = [];
  for (const type of order) {
    const group = groups[type].sort((a, b) => (b.flow || 0) - (a.flow || 0));
    cards = cards.concat(group);
  }

  // 默认显示前8个
  const visible = cards.slice(0, 8);
  const hidden = cards.slice(8);

  const visibleHtml = visible.map(t => `
    <div class="theme-card" data-jump="etf">
      <div class="theme-card-header">
        <span class="theme-card-name">${t.theme}</span>
        <span class="theme-status-tag ${t.statusType}">${t.statusLabel}</span>
      </div>
      <div class="theme-card-flow ${upDn(t.flow)}">${t.statusLabel}</div>
      <div class="theme-card-coverage">只做结构分组，不再重复资金数字</div>
    </div>
  `).join('');

  const hiddenHtml = hidden.length > 0 ? `
    <div class="collapse-section" style="grid-column:1/-1;margin-top:var(--sp-1)">
      <div class="collapse-header" data-collapse="theme-more">
        <span style="font-size:var(--fs-small);color:var(--t2)">展开其余 ${hidden.length} 个方向</span>
        <span class="arrow">▶</span>
      </div>
      <div class="collapse-body" id="theme-more">
        <div class="theme-map" style="margin-top:var(--sp-1)">
          ${hidden.map(t => `
          <div class="theme-card" data-jump="etf">
            <div class="theme-card-header">
              <span class="theme-card-name">${t.theme}</span>
              <span class="theme-status-tag ${t.statusType}">${t.statusLabel}</span>
            </div>
            <div class="theme-card-flow ${upDn(t.flow)}">${t.statusLabel}</div>
            <div class="theme-card-coverage">只做结构分组，不再重复资金数字</div>
          </div>`).join('')}
        </div>
      </div>
    </div>` : '';

  return `<div class="theme-map">${visibleHtml}</div>${hiddenHtml}`;
}

// --- 明日观察 ---
function renderScenarios(scenarios) {
  return `
  <div class="grid grid-3">
    ${scenarios.map(s => `
    <div class="scenario-card">
      <div class="scenario-direction">🔍 ${s.direction}</div>
      <div class="scenario-current">${s.current}</div>
      <div class="scenario-condition">
        <span class="label" style="color:var(--c-confirm)">✓确认:</span>
        <span class="scenario-confirm">${s.confirm}</span>
      </div>
      <div class="scenario-condition">
        <span class="label" style="color:var(--c-warn)">✗失效:</span>
        <span class="scenario-invalid">${s.invalid}</span>
      </div>
      <div class="scenario-action">→ ${s.action}</div>
    </div>
    `).join('')}
  </div>`;
}

// ============ 模块级工具：主题/行业ETF分类与桶（renderEtf 与 renderStructuralReview 共享）============

// 单只 ETF 的 5 日涨跌幅（%）：优先 etf.chg5d；缺失时用 entry.klineSummary 回退
// klineSummary 是注入到 entry 上的 { code: { lastClose, chg1d, chg5d } }
// 返回：数字（含正负号，单位 %）或 null
function calcEtfChg5d(etf, entry) {
  if (!etf) return null;
  // 强制走 ks 路径优先（因为原始 etf.chg5d 在 normalize 里就被映射成 chg）
  const ks = entry && entry.klineSummary;
  if (ks) {
    const raw = String(etf.code || '');
    const candidates = [raw];
    if (!/\.(SH|SZ)$/i.test(raw)) {
      candidates.push(raw + '.SH');
      candidates.push(raw + '.SZ');
      candidates.push(raw.padStart(6, '0'));
    }
    for (const k of candidates) {
      if (!k) continue;
      if (ks[k] != null && ks[k].chg5d != null && isFinite(ks[k].chg5d)) return ks[k].chg5d;
    }
  }
  // 兜底：etf.chg5d 字段（如外部注入或旧数据）
  if (etf.chg5d != null && isFinite(etf.chg5d)) return etf.chg5d;
  // 末位兜底：当日涨幅
  if (etf.chg != null && isFinite(etf.chg)) return etf.chg;
  return null;
}

// 一组 ETF 的 5 日涨幅中位数（%）：剔除 |chg5d|>20 异常，回退到 chg1d
function medianChg5dOf(etfs, entry) {
  const arr = etfs.map(e => calcEtfChg5d(e, entry)).filter(v => v != null && isFinite(v) && Math.abs(v) <= 20);
  if (arr.length === 0) return null;
  return median(arr);
}

// 一组 ETF 的当日涨幅中位数（%）：剔除 |chg|>20 异常
function medianChgOf(etfs) {
  const arr = etfs.map(e => e && e.chg).filter(v => v != null && isFinite(v) && Math.abs(v) <= 20);
  if (arr.length === 0) return null;
  return median(arr);
}

// 一组 ETF 的上涨比例：chg > 0 的占比
function upRatioOf(etfs) {
  const arr = etfs.map(e => e && e.chg).filter(v => v != null && isFinite(v));
  if (arr.length === 0) return null;
  return arr.filter(v => v > 0).length / arr.length;
}

function buildIndustryEtfBuckets(entry) {
  const allEtfs = [];
  const seen = new Set();

  function push(etf, pool) {
    if (!etf || !etf.code) return;
    const c = String(etf.code).padStart(6, '0');
    const existing = allEtfs.find(e => e.code === c);
    const etfChg5d = calcEtfChg5d(etf, entry);
    if (existing) {
      if ((etf.fundSize || 0) > (existing.fundSize || 0)) existing.fundSize = etf.fundSize;
      if (existing.flow == null && etf.flow != null) existing.flow = etf.flow;
      if (existing.flow5d == null && etf.flow5d != null) existing.flow5d = etf.flow5d;
      if (existing.chg == null && etf.chg != null) existing.chg = etf.chg;
      if (existing.chg5d == null && etfChg5d != null) existing.chg5d = etfChg5d;
      if (etf.volume != null) existing.volume = etf.volume;
      existing.pool = existing.pool || pool;
      existing.pool = (existing.pool.includes(pool) ? existing.pool : existing.pool + ',' + pool);
      return;
    }
    seen.add(c);
    allEtfs.push({
      code: c,
      name: etf.name || '',
      flow: etf.flow != null && etf.flow !== 0 ? etf.flow : null,
      flow5d: etf.flow5d != null && etf.flow5d !== 0 ? etf.flow5d : null,
      chg: etf.chg != null ? etf.chg : null,
      chg5d: etfChg5d,
      fundSize: etf.fundSize != null ? etf.fundSize : null,
      volume: etf.volume != null ? etf.volume : null,
      trackIndex: etf.trackIndex || etf.index || '',
      pool: pool
    });
  }

  const wideCodes = new Set();
  if (entry.etfWide) {
    [entry.etfWide.inflowDetails, entry.etfWide.outflowDetails].forEach((detailMap) => {
      if (!detailMap) return;
      Object.values(detailMap).forEach(list => {
        if (Array.isArray(list)) {
          list.forEach(e => { if (e.code) wideCodes.add(String(e.code).padStart(6, '0')); });
        }
      });
    });
  }

  if (entry.etfTheme && entry.etfTheme.categories) {
    Object.values(entry.etfTheme.categories).forEach(cat => {
      Object.values(cat.themes || {}).forEach(t => {
        (t.etfDetails || []).forEach(e => push(e, 'themeEtf'));
      });
    });
  }

  const notWideEtfs = allEtfs.filter(e => !wideCodes.has(e.code));
  // 纳入全部非宽基ETF：原 e.fundSize != null 会静默丢弃 fundSize 为 null 的占位样本（如白名单ETF），导致主题样本缩水
  const sized = notWideEtfs;

  const buckets = {};
  function getBucket(name) {
    if (!buckets[name]) buckets[name] = { name, etfs: [], allEtfsFlag: true };
    return buckets[name];
  }
  const WHITELIST = {
    '159992.SZ': '医药生物', '515120.SH': '医药生物',
    '518880.SH': '有色资源', '159934.SZ': '有色资源'
  };
  const EXTRA_WIDE_CODES = new Set(['588200.SH', '588000.SH', '588080.SH', '159915.SZ', '159949.SZ']);

  sized.forEach(e => {
    if (EXTRA_WIDE_CODES.has(e.code)) return;
    const cls = classifyEtf(e);
    const b = getBucket(cls);
    b.etfs.push({ ...e, _whitelist: WHITELIST[e.code] ? true : false });
  });

  // === 异常数据剔除 ===
  // 单只ETF当日涨跌绝对值超过 20% 标记为数据异常（疑似价格/复权/单位/抓取字段错误）
  // 不参与涨跌中位数、上涨ETF比例、主题节奏判断
  const ABNORMAL_THRESHOLD = 20;
  Object.values(buckets).forEach(b => {
    b.abnormalEtfs = b.etfs.filter(e => e.chg != null && Math.abs(e.chg) > ABNORMAL_THRESHOLD);
    b.normalEtfs = b.etfs.filter(e => !(e.chg != null && Math.abs(e.chg) > ABNORMAL_THRESHOLD));
  });

  Object.values(buckets).forEach(b => {
    b.etfCount = b.etfs.length;
    b.normalCount = b.normalEtfs.length;
    b.abnormalCount = b.abnormalEtfs.length;
    b.totalSize = b.etfs.reduce((s, e) => s + (e.fundSize || 0), 0);
    // 净流入统计：异常样本的 flow 也剔除（防数据源字段污染）
    const flows = b.normalEtfs.map(e => e.flow).filter(f => f != null);
    b.flowDay = flows.reduce((s, f) => s + f, 0);
    const flows5d = b.normalEtfs.map(e => e.flow5d).filter(f => f != null);
    b.flow5d = flows5d.reduce((s, f) => s + f, 0);
    // 涨跌中位数、上涨比例、上行率：只用正常样本
    const chgs = b.normalEtfs.map(e => e.chg).filter(c => c != null);
    b.medianChg = median(chgs);
    // 5日涨幅中位数：优先 entry.klineSummary 回退（已在 push 阶段注入 ETF.chg5d）
    const chgs5d = b.normalEtfs.map(e => e.chg5d).filter(c => c != null);
    b.medianChg5d = chgs5d.length > 0 ? median(chgs5d) : b.medianChg;
    b.upCount = chgs.filter(c => c > 0).length;
    b.totalCount = chgs.length;
    b.upRatio = chgs.length > 0 ? b.upCount / chgs.length : null;
    const chgs5dPos = chgs5d.filter(c => c > 0).length;
    b.upRatio5d = chgs5d.length > 0 ? chgs5dPos / chgs5d.length : null;
    // 资金效率 = 5日净流入 / 主题ETF总规模（%）
    b.fundEfficiency = b.totalSize > 0 ? b.flow5d / b.totalSize * 100 : null;
    const sortedFlow = b.normalEtfs.slice().sort((a, b2) => (b2.flow || 0) - (a.flow || 0));
    b.topInflow = sortedFlow[0] && sortedFlow[0].flow > 0 ? sortedFlow[0] : null;
    b.topOutflow = sortedFlow[sortedFlow.length - 1] && sortedFlow[sortedFlow.length - 1].flow < 0 ? sortedFlow[sortedFlow.length - 1] : null;
  });

  return buckets;
}

function classifyEtf(etf) {
  const code = etf.code ? String(etf.code).replace(/\.(SH|SZ)$/i, '') : '';
  const name = (etf.name || '').toLowerCase();
  const trackIdx = (etf.trackIndex || '').toLowerCase();
  const text = name + ' ' + trackIdx;
  // 6位代码精确映射：覆盖全部主题样本池，按规范11个桶统一分类
  // （ETF code 在 buildIndustryEtfBuckets 中已 padStart(6,'0')，故此处用6位键）
  const CODE_BUCKET = {
    '159206':'科技成长','159326':'科技成长','159363':'科技成长','159516':'科技成长','159530':'科技成长','159558':'科技成长','159770':'科技成长','159777':'科技成长','159801':'科技成长','159813':'科技成长','159819':'科技成长','159852':'科技成长','159899':'科技成长','159939':'科技成长','159995':'科技成长','159998':'科技成长','512480':'科技成长','512760':'科技成长','515050':'科技成长','515070':'科技成长','515880':'科技成长','515980':'科技成长','560780':'科技成长','561980':'科技成长','562590':'科技成长','588170':'科技成长','588200':'科技成长','588750':'科技成长',
    '159748':'医药生物','159835':'医药生物','159858':'医药生物','159992':'医药生物','515120':'医药生物','516060':'医药生物','517380':'医药生物','560900':'医药生物','159828':'医药生物','159883':'医药生物','512010':'医药生物','512170':'医药生物','561510':'医药生物',
    '159841':'证券金融','159851':'证券金融','159993':'证券金融','512000':'证券金融','512070':'证券金融','512800':'证券金融','512880':'证券金融',
    '159307':'红利防御','159581':'红利防御','159611':'红利防御','510880':'红利防御','512890':'红利防御','515080':'红利防御','515100':'红利防御','515180':'红利防御','515450':'红利防御','560580':'红利防御','560700':'红利防御','563020':'红利防御',
    '159865':'消费价值','159928':'消费价值','159996':'消费价值','510630':'消费价值','512690':'消费价值','515650':'消费价值','516130':'消费价值','516670':'消费价值',
    '159157':'有色资源','159713':'有色资源','159871':'有色资源','159934':'有色资源','512400':'有色资源','515220':'有色资源','516150':'有色资源','516650':'有色资源','517520':'有色资源','518880':'有色资源','560860':'有色资源','562800':'有色资源',
    '159870':'化工','516120':'化工','516220':'化工',
    '159566':'新能源','159755':'新能源','159796':'新能源','515030':'新能源','515790':'新能源','562500':'新能源',
    '501019':'军工','512660':'军工','512710':'军工',
    '159869':'传媒游戏','512980':'传媒游戏','516890':'传媒游戏',
    '159531':'微盘小票','159628':'微盘小票','563300':'微盘小票'
  };
  if (CODE_BUCKET[code]) return CODE_BUCKET[code];
  // 兜底关键词（极少触发，仅防止新代码漏桶）
  if (/创新药|医药|医疗|生物科技|中药/.test(text)) return '医药生物';
  if (/黄金|au/.test(text)) return '有色资源';
  if (/红利|低波/.test(text)) return '红利防御';
  if (/证券/.test(text)) return '证券金融';
  if (/芯片|半导体|ic|ai|通信|机器人|科技|卫星/.test(text)) return '科技成长';
  if (/消费|食品|酒|家电|养殖|畜牧/.test(text)) return '消费价值';
  if (/有色|能源|稀土|稀有金属|工业金属/.test(text)) return '有色资源';
  if (/军工|航天/.test(text)) return '军工';
  if (/传媒|游戏/.test(text)) return '传媒游戏';
  if (/新能源|光伏|锂电|储能|电池|车/.test(text)) return '新能源';
  if (/化工|化学|材料/.test(text)) return '化工';
  if (/2000|微盘|小盘|国证2000|中证2000/.test(text)) return '微盘小票';
  return '其他';
}

// ============ 创新药/医药成长 主题识别 ============
// 两层样本：
//   coreInnov: 创新药核心池（基金/指数含 创新药/科创创新药/科创板创新药）
//   growthMed: 医药成长扩展池（含 生物医药/医药卫生/医疗/医疗器械/CXO/生物科技）
// 用于 buildIndustryEtfBrief 中的扩展识别，把所有沾边的ETF都纳入
// 即使系统数据中只有2只核心创新药，也要让结论识别出"创新药/医药成长"作为强势主线

function classifyInnovativeDrug(etf) {
  if (!etf) return null;
  const name = etf.name || '';
  const trackIdx = etf.trackIndex || '';
  const text = name + ' ' + trackIdx;
  // 核心：科创板/科创/创新药ETF
  if (/创新药|科创创新药|科创板创新药/i.test(text)) return 'coreInnov';
  // 扩展：医药成长方向
  if (/生物医药|医药卫生|医疗器械|医疗|CXO|生物科技|中药/i.test(text)) return 'growthMed';
  if (/医药/i.test(text) && !(/医药商业|医药流通/i.test(text))) return 'growthMed';  // 医药 + 不含商业
  return null;
}

// 把所有"创新药/医药成长"ETF从原始主题数据中抽出来，组成 unifiedBucket
// 在 buildIndustryEtfBrief 中调用，输出与 buildIndustryEtfBuckets 同结构的 bucket
function buildInnovativeDrugBucket(entry) {
  const coreEtfs = [];
  const growthEtfs = [];
  if (!entry || !entry.etfTheme || !entry.etfTheme.categories) return null;

  Object.values(entry.etfTheme.categories).forEach(cat => {
    Object.values(cat.themes || {}).forEach(t => {
      (t.etfDetails || []).forEach(e => {
        const cls = classifyInnovativeDrug(e);
        if (cls === 'coreInnov') coreEtfs.push(e);
        else if (cls === 'growthMed') growthEtfs.push(e);
      });
    });
  });

  // 核心和扩展都参与主线识别
  const all = [...coreEtfs, ...growthEtfs];
  if (all.length === 0) return null;

  // 异常剔除（涨跌绝对值 > 20）
  const ABNORMAL_THRESHOLD = 20;
  const normal = all.filter(e => !(e.chg != null && Math.abs(e.chg) > ABNORMAL_THRESHOLD));
  const abnormal = all.filter(e => e.chg != null && Math.abs(e.chg) > ABNORMAL_THRESHOLD);

  const flows = normal.map(e => e.flow).filter(f => f != null);
  const flows5d = normal.map(e => e.flow5d).filter(f => f != null);
  const chgs = normal.map(e => e.chg).filter(c => c != null);
  const chgs5d = normal.map(e => calcEtfChg5d(e, entry)).filter(c => c != null);
  // upRatio 用当日 chg 计算（与原始约定一致）；上涨比例字段口径明确为「当日」
  const upCount = chgs.filter(c => c > 0).length;
  const upRatio5d = chgs5d.length > 0 ? chgs5d.filter(c => c > 0).length / chgs5d.length : null;
  const totalSize = all.reduce((s, e) => s + (e.fundSize || 0), 0);

  const bucket = {
    name: '创新药/医药成长',
    etfs: all,
    normalEtfs: normal,
    abnormalEtfs: abnormal,
    abnormalCount: abnormal.length,
    coreCount: coreEtfs.length,
    growthCount: growthEtfs.length,
    etfCount: all.length,
    normalCount: normal.length,
    totalSize: totalSize,
    flowDay: flows.reduce((s, f) => s + f, 0),
    flow5d: flows5d.reduce((s, f) => s + f, 0),
    medianChg: chgs.length > 0 ? median(chgs) : null,
    // 5日涨跌中位数：优先用真实5日数据；缺失则回退当日涨跌中位数
    medianChg5d: chgs5d.length > 0 ? median(chgs5d) : (chgs.length > 0 ? median(chgs) : null),
    upCount: upCount,
    totalCount: chgs.length,
    upRatio: chgs.length > 0 ? upCount / chgs.length : null,
    upRatio5d: upRatio5d
  };
  // 资金效率：5日净流入 / 主题ETF总规模（%）
  bucket.fundEfficiency = totalSize > 0 ? bucket.flow5d / totalSize * 100 : null;
  return bucket;
}

// ============ 主题综合评分 + 主线类型 ============
// themeLeaderScore = 价格30% + 资金25% + 扩散20% + 效率15% + 趋势10%
// 主线类型 6 种：资金驱动型 / 价格扩散型 / 资金承接型 / 反抽型 / 兑现型 / 退潮型
// 按 BREADTH_ALIAS 把子主题成分股家数汇总到规范主题，返回成分股上涨占比
// （优先扁平 upRatio，否则嵌套 breadth.upCount/breadth.totalCount）
function componentUpRatioByNorm(entry, normName) {
  if (!entry || !entry.themeBreadth || !Array.isArray(entry.themeBreadth.themes)) return null;
  var u = 0, t = 0, has = false;
  entry.themeBreadth.themes.forEach(function (tb) {
    if (BREADTH_ALIAS[tb.name] !== normName) return;
    var up = (tb.upCount != null) ? tb.upCount : (tb.breadth && tb.breadth.upCount != null ? tb.breadth.upCount : null);
    var tot = (tb.totalCount != null) ? tb.totalCount : (tb.breadth && tb.breadth.totalCount != null ? tb.breadth.totalCount : null);
    if (up != null && tot != null && tot > 0) { u += up; t += tot; has = true; }
  });
  return has ? u / t : null;
}

// 不只看净流入绝对额：涨幅领先+上涨比例高+净流入为正即可进入主线候选

function buildThemeLeaderBoard(entry, data, currentDt, wma) {
  // 1) 收集每个主题桶的基础指标
  const buckets = buildIndustryEtfBuckets(entry);
  const innovBucket = buildInnovativeDrugBucket(entry);
  const allBuckets = [];
  if (innovBucket && innovBucket.etfCount > 0) allBuckets.push(innovBucket);
  Object.keys(buckets).forEach(function(k) {
    // 合并：把所有含医药/创新药的ETF都吸到创新药桶里
    if (k === '医药生物' && innovBucket) {
      // 跳过，因为已经合并到 innovBucket
      return;
    }
    if (buckets[k] && buckets[k].etfs.length > 0) allBuckets.push(buckets[k]);
  });

  if (allBuckets.length === 0) return [];

  // 上涨比改用真实成分股口径（Wind 指数成分股家数）：优先 themeBreadth，缺失时回退 ETF 池
  allBuckets.forEach(function (b) {
    var comp = componentUpRatioByNorm(entry, b.name);
    if (comp != null) b.upRatio = comp;
  });

  // 2) 计算每个桶在所有桶中的位次（用于评分归一化）
  function rankDesc(arr, key) {
    const sorted = arr.filter(x => x[key] != null && isFinite(x[key])).slice().sort((a, b) => b[key] - a[key]);
    const rankMap = {};
    sorted.forEach((x, i) => { rankMap[x.name] = sorted.length - i; });
    return rankMap;
  }
  const totalBuckets = allBuckets.length;
  const rankChg = rankDesc(allBuckets, 'medianChg');
  const rankChg5d = rankDesc(allBuckets, 'medianChg5d');
  const rankFlow5d = rankDesc(allBuckets, 'flow5d');
  const rankFlowDay = rankDesc(allBuckets, 'flowDay');
  const rankUpRatio = rankDesc(allBuckets, 'upRatio');
  const rankSample = rankDesc(allBuckets, 'normalCount');
  const rankEff = rankDesc(allBuckets, 'fundEfficiency');

  // 3) 计算综合评分（0-100）
  const results = allBuckets.map(function(b) {
    // 价格强度 30%
    const chgPart = ((rankChg[b.name] || 0) + (rankChg5d[b.name] || 0)) / 2 / totalBuckets * 30;
    // 资金强度 25%
    const flowPart = ((rankFlow5d[b.name] || 0) + (rankFlowDay[b.name] || 0)) / 2 / totalBuckets * 25;
    // 扩散强度 20%（上涨比例 + 样本数）
    const widthPart = ((rankUpRatio[b.name] || 0) * 0.7 + (rankSample[b.name] || 0) * 0.3) / totalBuckets * 20;
    // 资金效率 15%（资金流入 / 主题ETF总规模）
    const effPart = (rankEff[b.name] || 0) / totalBuckets * 15;
    // 趋势强度 10%（34周线状态）
    let trendScore = 0;
    let weeklyStatus = null;
    if (b.etfs && b.etfs.length > 0 && wma) {
      for (let i = 0; i < b.etfs.length; i++) {
        const w = wma[b.etfs[i].code];
        if (w && w.status) {
          weeklyStatus = w.status;
          break;
        }
      }
    }
    if (weeklyStatus === '强势上方') trendScore = 10;
    else if (weeklyStatus === '回踩观察' || weeklyStatus === '偏强') trendScore = 7;
    else if (weeklyStatus === '趋势争夺') trendScore = 5;
    else if (weeklyStatus === '反抽不过' || weeklyStatus === '偏弱') trendScore = 2;
    // 没有周线数据不加分（不扣分）

    const totalScore = Math.round((chgPart + flowPart + widthPart + effPart + trendScore) * 10) / 10;

    // 4) 主线类型判定（6 种）
    let leaderType = '中性';
    const hasFlow = b.flowDay != null;
    const flowPos = b.flowDay > 0;
    const flow5Pos = b.flow5d != null && b.flow5d > 0;
    const flow5Neg = b.flow5d != null && b.flow5d < 0;
    const chgPos = b.medianChg != null && b.medianChg > 0;
    const chgNeg = b.medianChg != null && b.medianChg < 0;
    const strongPrice = chgPos && b.medianChg >= 2;
    const strongWidth = b.upRatio != null && b.upRatio >= 0.7;
    const weekly34Weak = weeklyStatus === '反抽不过' || weeklyStatus === '中期弱势' || weeklyStatus === '偏弱';

    if (chgNeg && (flow5Neg || (b.flowDay < 0 && b.flow5d < 0)) && (b.upRatio == null || b.upRatio < 0.4)) {
      leaderType = '退潮型';
    } else if (chgNeg && flow5Pos) {
      leaderType = '兑现型';
    } else if (chgPos && flow5Pos && strongWidth && (b.flow5d / Math.max(Math.abs(b.flowDay || 0.1), 0.1) >= 5) && !flowPos) {
      // 5日大幅流入 + 当日接近持平或微流出 + 上涨比例高 = 价格扩散型（5日累计视为正流入）
      leaderType = '价格扩散型';
    } else if (chgPos && flow5Pos && b.upRatio != null && b.upRatio >= 0.5 && (b.flow5d / Math.max(Math.abs(b.flowDay || 0.1), 0.1) >= 10)) {
      // 5日累计远超当日（10倍以上）= 资金驱动型：周线承接资金，跟随5日流入上涨
      leaderType = '资金驱动型';
    } else if (chgPos && flow5Pos && flowPos && strongPrice && strongWidth) {
      leaderType = '资金驱动型';
    } else if (chgPos && flowPos && strongPrice && strongWidth) {
      leaderType = '价格扩散型';
    } else if (chgPos && flowPos) {
      leaderType = '价格扩散型';
    } else if (chgPos && b.flowDay != null && Math.abs(b.flowDay) < 1 && flow5Pos) {
      leaderType = '价格扩散型';
    } else if (chgPos && (flow5Neg || (!flowPos && b.flowDay == 0))) {
      leaderType = '反抽型';
    } else if (chgPos && !flowPos) {
      leaderType = '反抽型';
    }

    return {
      name: b.name,
      score: totalScore,
      leaderType: leaderType,
      medianChg: b.medianChg,
      medianChg5d: b.medianChg5d,
      flowDay: b.flowDay,
      flow5d: b.flow5d,
      upRatio: b.upRatio,
      normalCount: b.normalCount,
      totalSize: b.totalSize,
      fundEfficiency: b.fundEfficiency,
      weeklyStatus: weeklyStatus,
      // 评分明细（用于展开查看）
      scoreBreakdown: {
        price: Math.round(chgPart * 10) / 10,
        flow: Math.round(flowPart * 10) / 10,
        width: Math.round(widthPart * 10) / 10,
        efficiency: Math.round(effPart * 10) / 10,
        trend: trendScore
      }
    };
  });

  // 5) 按评分排序
  results.sort((a, b) => b.score - a.score);
  return results;
}

function median(arr) {
  if (!arr || arr.length === 0) return null;
  const s = arr.slice().sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

function buildIndustryEtfBrief(entry) {
  const buckets = buildIndustryEtfBuckets(entry);
  // 主题识别增强：把"创新药/医药成长"单独提到第一桶，并合并"医药生物"中所有创新药/医药相关 ETF
  const innovBucket = buildInnovativeDrugBucket(entry);
  const BUCKET_ORDER = ['创新药/医药成长', '科技成长', '消费价值', '证券金融', '有色资源', '化工', '红利防御', '新能源', '军工', '传媒游戏', '地产链', '其他'];
  const list = [];
  if (innovBucket && innovBucket.etfCount > 0) list.push(innovBucket);
  BUCKET_ORDER.filter(n => n !== '创新药/医药成长').forEach(name => {
    const b = buckets[name];
    if (b && b.etfs.length > 0) list.push(b);
  });
  // 兜底：其他未列入的桶
  Object.entries(buckets).filter(([k]) => !BUCKET_ORDER.includes(k)).forEach(([k, v]) => list.push(v));
  return list;
}

// ============ 页面2: 资金结构 ============

function renderCapital(data, currentDt) {
  const entry = data.data[currentDt];
  if (!entry) return '';

  const c = entry.computed || {};
  const dates = data.dates;
  const dtIdx = dates.indexOf(currentDt);

  // 成交额趋势数据（20日）
  const trendTotals = dates.slice(Math.max(0, dtIdx - 19), dtIdx + 1).map(dt => ({
    label: data.data[dt].label,
    value: data.data[dt].concentration.totalAmount
  }));

  // 集中度趋势
  const trendConc = dates.slice(Math.max(0, dtIdx - 19), dtIdx + 1).map(dt => ({
    label: data.data[dt].label,
    top100: data.data[dt].concentration.top100.value,
    top10: data.data[dt].concentration.top10.value,
    total: data.data[dt].concentration.totalAmount
  }));

  // TOP10 个股表
  const top10Rows = (entry.concentration.top10Stocks || []).map((s, i) => {
    const chg = safeNum(s[3]);
    const indChg = safeNum(s[5]);
    const indChgText = indChg != null ? fmtPct(indChg) : '未采集';
    return `<tr>
      <td data-label="排名">${i + 1}</td>
      <td data-label="名称">${s[1] || '--'} <span style="color:var(--t4);font-size:10px">${s[0] || ''}</span></td>
      <td data-label="成交额">${s[2] != null ? fmt(safeNum(s[2])) : '--'}</td>
      <td data-label="涨跌" class="${upDn(chg)}">${fmtPct(chg)}</td>
      <td data-label="行业">${s[4] || '--'}</td>
      <td data-label="行业涨跌" class="${indChg != null ? upDn(indChg) : 'unknown'}">${indChgText}</td>
    </tr>`;
  }).join('');

  return `
  <div class="tab-content" id="tab-capital">
    <div class="wrap">
      <div class="module-title">
        <span class="num">01</span><span class="title">成交额与流动性</span>
        <span class="subtitle">全市场成交额 · 20日趋势 · 分位数</span>
      </div>
      <div class="grid grid-3">
        <div class="kpi-card">
          <div class="kpi-label">当日成交额</div>
          <div class="kpi-value">${entry.concentration.totalAmount != null ? fmtAmountYi(entry.concentration.totalAmount) : '--'}</div>
          <div class="kpi-benchmark">20日${c.amountPctile20d != null ? (c.amountPctile20d*100).toFixed(0) : '--'}%分位</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">较5日均值</div>
          <div class="kpi-value ${upDn(c.amountVs5d)}">${c.amountVs5d != null ? fmtPct(c.amountVs5d) : '--'}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">较前日变化</div>
          <div class="kpi-value ${upDn(c.amountChgPct)}">${c.amountChgPct != null ? fmtPct(c.amountChgPct) : '--'}</div>
        </div>
      </div>

      <div class="chart-box" style="margin-top:var(--sp-2)">
        <div class="chart-canvas-wrap"><canvas id="chartAmount"></canvas></div>
        <div class="chart-conclusion" id="chartAmountConclusion"></div>
      </div>

      <div class="module-title">
        <span class="num">02</span><span class="title">成交集中度</span>
        <span class="subtitle">TOP100主线资金池 · TOP10极端抱团 · 分位基于近20个有效交易日</span>
      </div>
      <div class="grid grid-2">
        <div class="chart-box">
          <div style="font-size:var(--fs-small);color:var(--t2);margin-bottom:var(--sp-1)">TOP100 / TOP10 占比趋势</div>
          <div class="chart-canvas-wrap"><canvas id="chartConc"></canvas></div>
          <div class="chart-conclusion" id="chartConcConclusion"></div>
        </div>
        <div class="card">
          <div style="font-size:var(--fs-small);color:var(--t2);margin-bottom:var(--sp-2)">集中度解读</div>
          <div style="display:flex;flex-direction:column;gap:var(--sp-1)">
            <div>TOP100: <strong style="font-size:18px">${entry.concentration.top100.value != null ? entry.concentration.top100.value.toFixed(1) + '%' : '--'}</strong> ${c.top100Pctile20d != null ? '(近20个有效交易日' + (c.top100Pctile20d*100).toFixed(0) + '%分位)' : ''}</div>
            <div>TOP10: <strong style="font-size:18px">${entry.concentration.top10.value != null ? entry.concentration.top10.value.toFixed(1) + '%' : '--'}</strong> ${c.top10Pctile20d != null ? '(近20个有效交易日' + (c.top10Pctile20d*100).toFixed(0) + '%分位)' : ''}</div>
            <div style="font-size:11px;color:var(--t4);line-height:1.5;margin-top:6px">分位不是全历史排名，而是最近20个有集中度数据的交易日里的相对位置。</div>
            <div style="font-size:var(--fs-small);color:var(--t2);padding-top:var(--sp-1);border-top:1px dashed var(--border)">
              ${interpretConcentration(c, entry)}
            </div>
          </div>
        </div>
      </div>

      <div class="module-title">
        <span class="num">03</span><span class="title">TOP10成交个股</span>
        <span class="subtitle">当日成交额最大个股</span>
      </div>
      <div style="font-size:11px;color:var(--t3);margin:0 0 var(--sp-1) 0">行业涨跌来自 Wind 返回的行业平均涨跌幅，用于判断个股表现是否强于所属行业。</div>
      <div class="tbl-wrap">
        <div class="tbl-scroll">
          <table>
            <thead><tr>
              <th>#</th><th>名称</th><th>成交额<span class="tbl-unit">亿</span></th><th>涨跌<span class="tbl-unit">%</span></th><th>行业</th><th>行业涨跌<span class="tbl-unit">%</span></th>
            </tr></thead>
            <tbody>${top10Rows || '<tr><td colspan="6" style="text-align:center;color:var(--t3)">无数据</td></tr>'}</tbody>
          </table>
        </div>
      </div>

      <div class="module-title">
        <span class="num">04</span><span class="title">融资余额</span>
        <span class="subtitle">T+1数据 · 权重${entry.margin.weight < 1 ? '已降级' : '正常'}</span>
      </div>
      <div class="grid grid-3">
        <div class="kpi-card">
          <div class="kpi-label">融资余额 ${statusTag(entry.margin.status)}</div>
          <div class="kpi-value">${entry.margin.value != null ? entry.margin.value.toFixed(0) : '--'}<span class="unit">万亿</span></div>
          <div class="kpi-date">数据日期: ${entry.margin.date || '--'} ${entry.margin.isStale ? '(滞后)' : ''}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">较前日</div>
          <div class="kpi-value ${upDn(entry.margin.chg)}">${entry.margin.chg != null ? fmtPct(entry.margin.chg) : '--'}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">5日趋势</div>
          <div class="kpi-value">${entry.margin.trend5d === 'up' ? '↑ 上升' : (entry.margin.trend5d === 'down' ? '↓ 下降' : '--')}</div>
        </div>
      </div>
      <div class="chart-box" style="margin-top:var(--sp-2)">
        <div style="font-size:var(--fs-small);color:var(--t2);margin-bottom:var(--sp-1)">融资余额趋势</div>
        <div class="chart-canvas-wrap"><canvas id="chartMargin"></canvas></div>
        <div class="chart-conclusion" id="chartMarginConclusion"></div>
      </div>
      <div class="chart-box" style="margin-top:var(--sp-2)">
        <div style="font-size:var(--fs-small);color:var(--t2);margin-bottom:var(--sp-1)">融资余额日变化</div>
        <div class="chart-canvas-wrap"><canvas id="chartMarginDelta"></canvas></div>
        <div class="chart-conclusion" id="chartMarginDeltaConclusion"></div>
      </div>
    </div>
  </div>
  `;
}

function interpretConcentration(c, entry) {
  const top100 = entry.concentration.top100.value;
  const top100Chg = c.top100Chg;
  const pctile = c.top100Pctile20d;

  if (top100 == null) return '集中度数据不足';

  let result = '';
  if (top100Chg != null && top100Chg > 0.5) {
    // 集中度上升
    if (c.top10UpRatio != null && c.top10UpRatio < 0.4) {
      result = '⚠️ 集中度上升但上涨覆盖面收窄 → <strong>抱团风险</strong>';
    } else if (c.amountVs5d != null && c.amountVs5d > 0) {
      result = '✓ 集中度上升伴随成交放量 → <strong>主线强化</strong>';
    } else {
      result = '集中度上升，需结合宽度判断';
    }
  } else if (top100Chg != null && top100Chg < -0.5) {
    result = '✓ 集中度下降 → 资金扩散中';
  } else {
    if (pctile != null && pctile > 0.75) {
      result = '⚠️ 集中度处于历史高位，关注抱团风险';
    } else if (pctile != null && pctile < 0.25) {
      result = '集中度处于历史低位，分布均匀';
    } else {
      result = '集中度处于正常区间';
    }
  }
  return result;
}

// ============ 页面3: ETF方向 ============

function renderEtf(data, currentDt) {
  const entry = data.data[currentDt];
  if (!entry) return '';

  // 宽基ETF汇总 + 明细下钻
  const wideDetailMap = {};
  if (entry.etfWide.inflowDetails) {
    for (const [idx, etfs] of Object.entries(entry.etfWide.inflowDetails)) {
      if (!wideDetailMap[idx]) wideDetailMap[idx] = [];
      etfs.forEach(e => wideDetailMap[idx].push({ ...e, direction: 'inflow', index: idx }));
    }
  }
  if (entry.etfWide.outflowDetails) {
    for (const [idx, etfs] of Object.entries(entry.etfWide.outflowDetails)) {
      if (!wideDetailMap[idx]) wideDetailMap[idx] = [];
      etfs.forEach(e => wideDetailMap[idx].push({ ...e, direction: 'outflow', index: idx }));
    }
  }

  const renderWideDetail = (indexName) => {
    const details = (wideDetailMap[indexName] || []).sort((a, b) => Math.abs(b.flow || 0) - Math.abs(a.flow || 0));
    if (!details.length) return '<span style="color:var(--t4)">暂无样本明细</span>';
    return `<details style="display:block">
      <summary style="cursor:pointer;color:var(--c-link);list-style:none">${details.length}只ETF，点击展开</summary>
      <div style="margin-top:6px;display:grid;gap:4px">
        ${details.map(e => `
          <div style="display:grid;grid-template-columns:minmax(160px,1.5fr) repeat(5,minmax(62px,.8fr));gap:8px;align-items:center;font-size:11px;color:var(--t3);padding:4px 0;border-top:1px solid var(--border)">
            <span style="color:var(--t1)">${e.name || '--'} <em style="color:var(--t4);font-style:normal">${e.code || ''}</em></span>
            <span class="${upDn(e.flow)}">净流入 ${e.flow != null ? fmtFlow(e.flow) + '亿' : '--'}</span>
            <span>成交 ${e.volume != null ? fmt(e.volume) + '亿' : '--'}</span>
            <span class="${upDn(e.chg)}">涨跌 ${fmtPct(e.chg)}</span>
            <span>规模 ${e.fundSize != null ? fmt(e.fundSize) + '亿' : '--'}</span>
            <span>${statusTag(e.status)}</span>
          </div>
        `).join('')}
      </div>
    </details>`;
  };

  const wideRows = (entry.etfWide.items || []).map(item => {
    return `<tr>
      <td data-label="指数">${item.name}</td>
      <td data-label="净流入" class="${upDn(item.flow)}">${item.flow != null ? fmtFlow(item.flow) : '--'}</td>
      <td data-label="涨跌" class="${upDn(item.chg)}">${fmtPct(item.chg)}</td>
      <td data-label="样本明细">${renderWideDetail(item.name)}</td>
      <td data-label="状态">${statusTag(item.status)}</td>
    </tr>`;
  }).join('');

  const industryBuckets = buildIndustryEtfBuckets(entry);
  // 转换为有序数组展示
  const BUCKET_ORDER = ['科技成长', '医药生物', '消费价值', '证券金融', '有色资源', '化工', '红利防御', '新能源', '军工', '传媒游戏', '地产链', '其他'];
  const bucketList = BUCKET_ORDER
    .map(name => industryBuckets[name])
    .filter(b => b && b.etfs.length > 0)
    .concat(
      // 任何不在 BUCKET_ORDER 中的桶
      Object.entries(industryBuckets)
        .filter(([k]) => !BUCKET_ORDER.includes(k))
        .map(([k, v]) => v)
    );


  let themeRows = '';
  let themeCards = '';
  if (false && entry.etfTheme && entry.etfTheme.categories) {
    const allThemes = [];
    for (const [cat, catData] of Object.entries(entry.etfTheme.categories)) {
      for (const [theme, themeData] of Object.entries(catData.themes || {})) {
        const status = entry.computed.themeStatus[theme] || {};
        allThemes.push({ cat, theme, ...themeData, statusLabel: status.label, statusType: status.type });
      }
    }

    themeRows = allThemes.map(t => `
      <tr>
        <td data-label="主题">${t.theme} <span style="color:var(--t4);font-size:10px">[${t.cat}]</span></td>
        <td data-label="当日" class="${upDn(t.flow)}">${t.flow != null ? fmtFlow(t.flow) : '--'}</td>
        <td data-label="5日" class="${upDn(t.flow5d)}">${t.flow5d != null ? fmtFlow(t.flow5d) : '--'}</td>
        <td data-label="相对力度">${t.scaleRatio != null ? fmtPct(t.scaleRatio * 100, 2) : '--'}</td>
        <td data-label="涨跌" class="${upDn(t.chg)}">${fmtPct(t.chg)}</td>
        <td data-label="样本">${renderThemeSampleDrill(t)}${t.pendingCount > 0 ? `<div style="font-size:10px;color:var(--t4);margin-top:4px">${t.pendingCount}个待确认</div>` : ''}</td>
        <td data-label="状态"><span class="theme-status-tag ${t.statusType}">${t.statusLabel}</span></td>
      </tr>
    `).join('');
  }

  // 四象限数据准备
  const quadData = [];
  if (entry.etfWide.items) {
    entry.etfWide.items.forEach(item => {
      if (item.flow != null) {
        quadData.push({
          name: item.name,
          x: item.chg,
          y: item.flow,
          size: Math.abs(item.flow),
          type: 'wide'
        });
      }
    });
  }

  return `
  <div class="tab-content" id="tab-etf">
    <div class="wrap">

      <!-- 宽基ETF -->
      <div class="module-title">
        <span class="num">01</span><span class="title">宽基ETF资金流</span>
        <span class="subtitle">11个方向 · 资金流向观察 · 数据口径见数据质量中心</span>
      </div>

      <div class="grid grid-4">
        <div class="kpi-card">
          <div class="kpi-label">宽基合计净流入</div>
          <div class="kpi-value ${upDn(entry.etfWide.totalFlow)}">${entry.etfWide.totalFlow != null ? fmtFlow(entry.etfWide.totalFlow) : '--'}<span class="unit">亿</span></div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">流入方向数</div>
          <div class="kpi-value">${(entry.etfWide.items || []).filter(i => i.flow > 0).length}<span class="unit">/${entry.etfWide.items.length}</span></div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">最强流入</div>
          <div class="kpi-value" style="font-size:16px">${getTopFlow(entry.etfWide.items, true)}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">最大流出</div>
          <div class="kpi-value" style="font-size:16px">${getTopFlow(entry.etfWide.items, false)}</div>
        </div>
      </div>

      <div class="grid grid-2" style="margin-top:var(--sp-2)">
        <div class="chart-box">
          <div style="font-size:var(--fs-small);color:var(--t2);margin-bottom:var(--sp-1)">宽基净流入趋势</div>
          <div class="chart-canvas-wrap"><canvas id="chartWideFlow"></canvas></div>
          <div class="chart-conclusion" id="chartWideFlowConclusion"></div>
        </div>
        <div class="tbl-wrap">
          <div class="tbl-scroll">
            <table>
              <thead><tr><th>指数</th><th>净流入<span class="tbl-unit">亿</span></th><th>涨跌<span class="tbl-unit">%</span></th><th>样本明细</th><th>状态</th></tr></thead>
              <tbody>${wideRows}</tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- 四象限 -->
      <div class="module-title">
        <span class="num">02</span><span class="title">资金四象限</span>
        <span class="subtitle">横轴=当日净流入力度 · 纵轴=近5日净流入力度 · 力度=净流入/样本总规模 · 气泡=成交额 · 颜色=涨跌幅</span>
      </div>
      <div class="quad-wrap" id="quadChart"></div>

      ${themeRows ? `
      <!-- 主题四象限 -->
      <div class="module-title">
        <span class="num">03</span><span class="title">主题资金四象限</span>
        <span class="subtitle">横轴=当日净流入力度 · 纵轴=近5日净流入力度 · 力度=净流入/主题ETF总规模 · 气泡=成交额 · 颜色=涨跌幅</span>
      </div>
      <div class="quad-wrap" id="themeQuadChart"></div>` : ''}

      <!-- 主题/行业ETF观察：Top200池 + 分类桶 -->
      <div class="module-title">
        <span class="num">04</span><span class="title">主题/行业ETF观察</span>
        <span class="subtitle">剔除宽基后的股票ETF · 按跟踪指数+简称关键词+人工映射分类 · 12个分类桶 · 数据口径见下方</span>
      </div>
      <div style="font-size:11px;color:var(--t3);margin:0 0 8px 0;line-height:1.6">
        <strong style="color:var(--t2)">数据池口径</strong>：合并 themeEtf (来自 theme_etf_data.json) 中所有 ETFDetails，剔除 etfWide 中标注为宽基的代码（沪深300/上证50/中证500/中证1000/中证2000/中证A500/科创50/科创100/创业板指/创业板50/深证100 等），按基金规模 fundSize 排序。分类优先级：人工映射码表 (精确) > 跟踪指数名称匹配 > 基金简称关键词 > "其他"。涨跌用分类内 ETF 中位数，避免单只大波动样本扭曲。上涨比例 = 分类内上涨 ETF 数 / 有行情 ETF 数。每只 ETF 显示规模/当日净流入/涨跌/5日资金流。Top200 之外的"复盘价值高"ETF 可通过人工白名单补充，当前数据源实际 pool 全部由 themeEtf 提供。
      </div>
      <div class="tbl-wrap">
        <div class="tbl-scroll">
          <table>
            <thead><tr>
              <th>分类</th>
              <th>数量<span class="tbl-unit">只</span></th>
              <th>合计规模<span class="tbl-unit">亿</span></th>
              <th>当日净流入<span class="tbl-unit">亿</span></th>
              <th>5日累计<span class="tbl-unit">亿</span></th>
              <th>涨跌(中位)<span class="tbl-unit">%</span></th>
              <th>上涨比例</th>
              <th>最强ETF</th>
              <th>最弱ETF</th>
            </tr></thead>
            <tbody>
              ${bucketList.map(b => {
                const flowDayStr = b.flowDay != null ? `<span class="${upDn(b.flowDay)}">${fmtFlow(b.flowDay)}</span>` : '--';
                // 5日累计：当前数据只有当日 flow；按 pool 重新计算。简化为占位
                const flow5dStr = '--';
                const medianChgStr = b.medianChg != null ? `<span class="${upDn(b.medianChg)}">${fmtPct(b.medianChg)}</span>` : '--';
                const upRatioStr = b.upRatio != null ? `<span class="${b.upRatio > 0.5 ? 'green' : (b.upRatio < 0.4 ? 'red' : 'struct-neutral')}">${(b.upRatio * 100).toFixed(0)}%</span>` : '--';
                const topInStr = b.topInflow ? `${b.topInflow.name} <em style="color:var(--c-up);font-style:normal">+${(b.topInflow.flow || 0).toFixed(1)}</em>` : '--';
                const topOutStr = b.topOutflow ? `${b.topOutflow.name} <em style="color:var(--c-up);font-style:normal">${(b.topOutflow.flow || 0).toFixed(1)}</em>` : '--';
                return `<tr>
                  <td><strong>${b.name}</strong></td>
                  <td>${b.etfCount}</td>
                  <td>${b.totalSize.toFixed(0)}</td>
                  <td>${flowDayStr}</td>
                  <td>${flow5dStr}</td>
                  <td>${medianChgStr}</td>
                  <td>${upRatioStr}</td>
                  <td style="font-size:11px">${topInStr}</td>
                  <td style="font-size:11px">${topOutStr}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
      <div style="font-size:11px;color:var(--t3);margin-top:12px;padding-top:8px;border-top:1px dashed var(--border)">
        <strong style="color:var(--t2)">分类桶明细 · 点击展开 ETF 列表</strong>
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-top:8px">
          ${bucketList.map(b => `
            <details style="border:1px solid var(--border);border-radius:6px;padding:6px">
              <summary style="cursor:pointer;font-weight:600;color:var(--t2)">${b.name} · ${b.etfCount}只 · ${b.totalSize.toFixed(0)}亿</summary>
              <div style="margin-top:6px;display:grid;gap:4px">
                ${b.etfs.map(e => `
                  <div style="display:grid;grid-template-columns:minmax(140px,1fr) repeat(4, minmax(56px,.7fr));gap:8px;font-size:11px;color:var(--t3);padding:3px 0;border-top:1px solid var(--bg-3)">
                    <span style="color:var(--t1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${e.name || e.code}${e._whitelist ? ' <em style="color:var(--c-warn);font-style:normal">⚑</em>' : ''}</span>
                    <span class="${upDn(e.flow)}">${e.flow != null ? fmtFlow(e.flow) : '--'}</span>
                    <span class="${upDn(e.chg)}">${e.chg != null ? fmtPct(e.chg) : '--'}</span>
                    <span>${e.fundSize != null ? e.fundSize.toFixed(0) + '亿' : '--'}</span>
                    <span style="color:var(--t4);font-size:10px">${e.code}</span>
                  </div>
                `).join('')}
              </div>
            </details>
          `).join('')}
        </div>
      </div>

    </div>
  </div>
  `;
}

function getTopFlow(items, isInflow) {
  if (!items || items.length === 0) return '--';
  const filtered = items.filter(i => i.flow != null);
  if (filtered.length === 0) return '--';
  const sorted = filtered.sort((a, b) => isInflow ? b.flow - a.flow : a.flow - b.flow);
  const top = sorted[0];
  return `${top.name} ${fmtFlow(top.flow)}亿`;
}

function renderThemeSampleDrill(themeData) {
  const samples = Array.isArray(themeData && themeData.etfDetails) ? themeData.etfDetails : [];
  if (samples.length === 0) {
    return `<details style="display:block"><summary style="cursor:pointer;color:var(--c-link);list-style:none">0个，点击查看样本明细</summary><div style="margin-top:6px;color:var(--t4);font-size:11px">暂无样本明细</div></details>`;
  }
  const sorted = [...samples].sort((a, b) => {
    const af = a && a.flow != null ? a.flow : Number.NEGATIVE_INFINITY;
    const bf = b && b.flow != null ? b.flow : Number.NEGATIVE_INFINITY;
    return bf - af;
  });
  const sampleHtml = sorted.map(s => {
    const flowText = s.flow != null ? `${fmtFlow(s.flow)}亿` : '--';
    const sizeText = s.fundSize != null ? `${fmt(s.fundSize)}亿` : '--';
    const chgText = s.chg != null ? fmtPct(s.chg) : '--';
    const statusText = s.status ? `<span style="margin-left:6px;padding:1px 6px;border-radius:999px;font-size:10px;background:rgba(255,255,255,.05);color:var(--t3)">${s.status}</span>` : '';
    return `<div style="padding:6px 0;border-top:1px dashed rgba(255,255,255,.08)">
      <div style="font-size:12px;color:var(--t1)">${s.name || '--'} <span style="color:var(--t4);font-size:10px">${s.code || ''}</span></div>
      <div style="font-size:11px;color:var(--t3);margin-top:2px">${flowText} · ${chgText} · ${sizeText}${statusText}</div>
    </div>`;
  }).join('');
  return `<details style="display:block">
    <summary style="cursor:pointer;color:var(--c-link);list-style:none">${samples.length}个，点击查看样本明细</summary>
    <div style="margin-top:6px;max-height:180px;overflow:auto;padding-right:4px">${sampleHtml}</div>
  </details>`;
}

// ============ 页面4: 主线验证 ============

function renderValidate(data, currentDt) {
  const entry = data.data[currentDt];
  if (!entry) return '';

  const signals = calcSignals(entry);
  const phase = calcMarketPhase(signals);
  const consistency = calcConsistency(signals);
  const mainline = calcMainlineValidation(entry);

  const signalCards = ['liquidity', 'breadth', 'support', 'structure'].map(key => {
    const s = signals[key];
    const bars = [-2, -1, 0, 1, 2].map(level => {
      const active = Math.abs(s.strength) >= Math.abs(level) && level !== 0;
      const cls = active ? `active ${s.strength > 0 ? 'positive' : 'negative'}` : '';
      return `<div class="signal-bar ${cls}"></div>`;
    }).join('');
    return `
    <div class="signal-card">
      <div class="signal-card-header">
        <span class="signal-card-name">${key === 'liquidity' ? '成交有没有放大' : key === 'breadth' ? '上涨是不是更广' : key === 'support' ? 'ETF有没有托底' : '资金是集中还是分散'}</span>
        <div class="signal-strength">${bars}</div>
      </div>
      <div style="font-size:var(--fs-small);font-weight:600;color:var(--t1)">${s.label}</div>
      <div class="signal-card-detail">${s.detail}</div>
      ${s.isProxy ? '<div style="font-size:var(--fs-tiny);color:var(--c-warn)">⚠️ 使用代理数据</div>' : ''}
    </div>`;
  }).join('');

  function heatCell(m) {
    const share = m.heatShare != null ? (m.heatShare * 100).toFixed(1) + '%' : '--';
    const count = m.heatCount != null ? m.heatCount + '只' : '--';
    const status = m.heatStatus || '未计算';
    const cls = status === '热度确认' ? 'sustained' : (status === '龙头抱团' ? 'spike' : 'unknown');
    return `<span class="theme-status-tag ${cls}">${status}</span><div style="font-size:11px;color:var(--t3);margin-top:2px">${share} · ${count}</div>`;
  }

  const mainlineRows = mainline.map(m => `
    <tr>
      <td data-label="主题"><strong>${m.themeName}</strong></td>
      <td data-label="当日ETF" class="${upDn(m.etfFlow)}">${m.etfFlow != null ? fmtFlow(m.etfFlow) : '--'}</td>
      <td data-label="5日ETF" class="${upDn(m.etfFlow5d)}">${m.etfFlow5d != null ? fmtFlow(m.etfFlow5d) : '--'}</td>
      <td data-label="板块涨跌" class="${upDn(m.sectorChg)}">${fmtPct(m.sectorChg)}</td>
      <td data-label="成交热度" style="color:var(--t4);font-size:11px">已移除</td>
      <td data-label="TOP100热度">${heatCell(m)}</td>
      <td data-label="信号一致">${m.signalAgreement}</td>
      <td data-label="证据完整度">${m.coverage != null ? (m.coverage*100).toFixed(0) + '%' : '--'}</td>
      <td data-label="主线判断">
        ${m.confirmed ? '<span class="theme-status-tag sustained">主线确认</span>' :
          (m.label === '防御配置' ? '<span class="theme-status-tag unknown">防御配置</span>' :
          (m.confidence === 'medium' ? '<span class="theme-status-tag spike">潜在主线</span>' :
          (m.label === '数据不足' ? '<span class="theme-status-tag unknown">数据不足</span>' :
          '<span class="theme-status-tag unknown">非主线</span>')))}
      </td>
    </tr>
  `).join('');

  return `
  <div class="tab-content" id="tab-validate">
    <div class="wrap">
      <div class="module-title">
        <span class="num">01</span><span class="title">四个判断信号</span>
        <span class="subtitle">先看四个信号，再看结论 · 红柱=正向</span>
      </div>
      <div class="signal-grid">${signalCards}</div>

      <div class="verdict-card" style="margin-top:var(--sp-2)">
        <div class="verdict-phase">
          <span class="verdict-phase-tag ${phase.phase}">${phase.label}</span>
          <span class="verdict-confidence ${consistency.level}">一致度: ${consistency.label}</span>
        </div>
        <div class="verdict-sentence">${phase.description}</div>
        <div class="verdict-validate">📋 <strong>验证条件：</strong>${phase.validateNext}</div>
      </div>

      <div class="module-title">
        <span class="num">02</span><span class="title">主线方向验证</span>
        <span class="subtitle">确认的是资金承接与相对强度主线，不等于当天价格上涨</span>
      </div>
      <div class="card" style="margin-bottom:var(--sp-2);font-size:var(--fs-small);color:var(--t2);line-height:1.7">
        <strong style="color:var(--t1)">如何理解“主线确认”：</strong>
        本页的主线判断不是“今天涨了就确认”，而是看三项证据是否同时成立：ETF资金当日流入、主题相对全市场更强、近5日资金持续流入。
        因此在大跌日或弱市里，某个主题即使自身下跌，只要跌得比全市场更有韧性，同时资金仍在流入，也可能被标为“主线确认”。
        这更接近“资金承接主线”的含义，后续仍要观察价格能否转强。
      </div>
      <div class="tbl-wrap">
        <div class="tbl-scroll">
          <table>
            <thead><tr>
              <th>主题</th><th>当日ETF<span class="tbl-unit">亿</span></th><th>5日ETF<span class="tbl-unit">亿</span></th>
              <th>板块涨跌<span class="tbl-unit">%</span></th><th>成交热度<span style="font-size:10px;color:var(--t3)">已移除</span></th><th>TOP100热度</th>
              <th>信号一致</th><th>证据完整度</th><th>主线判断</th>
            </tr></thead>
            <tbody>${mainlineRows || '<tr><td colspan="9" style="text-align:center;color:var(--t3)">无主题数据</td></tr>'}</tbody>
          </table>
        </div>
      </div>
      <div class="card" style="margin-top:var(--sp-2);font-size:var(--fs-small);color:var(--t2);line-height:1.7">
        <strong style="color:var(--t1)">证据说明：</strong><br>
        • <strong>ETF资金</strong>：当日净流入>0为正向（用方向，不用固定金额）<br>
        • <strong>板块强度</strong>：优先使用真实主题宽度（主题上涨占比>全市场上涨占比），这是相对强弱，不要求板块涨跌为正；缺失时才降级为ETF涨跌代理<br>
        • <strong>持续性</strong>：5日ETF持续流入（type=sustained）为正向<br>
        • <strong>成交热度</strong>：已移除，原因——原"成交额>0"几乎必然成立，相当于免费送票。需建立主题历史成交额序列、计算20日分位后恢复<br>
        • <strong>TOP100热度</strong>：主题在成交额前100只股票中的占比与入榜数；第一版作为主线确认降级器，不免费加票<br>
        • <strong>确认条件</strong>：证据完整度达标 + 所有有效证据（≥3项）全部同向。若板块当日为负，含义应理解为“资金承接/相对抗跌主线”，不是价格趋势已经转强
      </div>
    </div>
  </div>
  `;
}

// ============ 页面5: 数据说明 ============

function renderQuality(data, currentDt) {
  const entry = data.data[currentDt];
  if (!entry) return '';

  const m = entry.meta;
  const margin = entry.margin;
  const etfTheme = entry.etfTheme;

  // 数据来源和口径说明
  // 覆盖率明确拆四口径：方向/样本/份额确认/规模
  // 缺数据的口径直接显示"暂不可用"，不用其他覆盖率代替
  const wideCov = entry.etfWide;
  // 宽基份额确认率：当前数据无独立份额确认字段，标"暂不可用"
  // 不再用 sampleCoverage 冒充（那是有效样本率，是另一个口径）
  const wideShareConfirmCov = '暂不可用';
  const wideScaleCov = '暂不可用'; // 当前无规模字段，待补

  const themeCov = etfTheme || {};
  const themeSampleCov = themeCov.sampleCoverage != null ? (themeCov.sampleCoverage * 100).toFixed(0) + '%' : '--';
  const themeScaleCov = themeCov.scaleWeightedCoverage != null ? (themeCov.scaleWeightedCoverage * 100).toFixed(0) + '%' : '--';
  // 主题ETF方向覆盖率：从实际数据计算（有flow数据的方向数 / 总方向数）
  let themeDirValid = 0, themeDirTotal = 0;
  if (etfTheme && etfTheme.categories) {
    for (const [cat, catData] of Object.entries(etfTheme.categories)) {
      for (const [tName, tData] of Object.entries(catData.themes || {})) {
        themeDirTotal++;
        if (tData.flow != null && isFinite(tData.flow)) themeDirValid++;
      }
    }
  }
  const themeDirCov = themeDirTotal > 0 ? (themeDirValid / themeDirTotal * 100).toFixed(0) + '% (' + themeDirValid + '/' + themeDirTotal + ')' : '--';
  const breadthCacheSuspicious = detectBreadthCacheSuspicion(data, currentDt);
  const margin5ForQuality = calcWindowChange(data, currentDt, e => e && e.margin ? e.margin.value : null, 5);
  const margin10ForQuality = calcWindowChange(data, currentDt, e => e && e.margin ? e.margin.value : null, 10);
  const margin5YiForQuality = margin5ForQuality != null ? margin5ForQuality * 10000 : null;
  const margin10YiForQuality = margin10ForQuality != null ? margin10ForQuality * 10000 : null;
  const marginJumpSuspicious = (margin5YiForQuality != null && Math.abs(margin5YiForQuality) > 5000) || (margin10YiForQuality != null && Math.abs(margin10YiForQuality) > 8000);

  const qualityItems = [
    {
      name: '全市场成交额',
      status: entry.concentration.status,
      date: currentDt,
      source: '集中度数据源',
      caliber: '正常上市且当日有成交的A股，排除ETF、债券、停牌股',
      coverage: entry.concentration.totalAmount != null ? '100%' : '0%'
    },
    {
      name: 'TOP100集中度',
      status: entry.concentration.top100.status,
      date: currentDt,
      source: '集中度数据源',
      caliber: '成交额最大100只A股 / 全市场A股成交额，排除ETF、债券、停牌、无成交',
      coverage: entry.concentration.top100.value != null ? '100%' : '0%'
    },
    {
      name: 'TOP10极端集中度',
      status: entry.concentration.top10.status,
      date: currentDt,
      source: '集中度数据源',
      caliber: '成交额最大10只 / 全市场成交额，用于识别极端抱团',
      coverage: entry.concentration.top10.value != null ? '100%' : '0%'
    },
    {
      name: '市场宽度',
      status: entry.market.upRatio != null ? (breadthCacheSuspicious ? DATA_STATUS.PARTIAL : DATA_STATUS.CONFIRMED) : DATA_STATUS.PENDING,
      date: entry.market.breadthStatus === 'confirmed' ? currentDt : '代理/待确认',
      source: entry.market.breadthStatus === 'confirmed' ? (entry.market.breadthSource || '真实宽度') : 'TOP10代理',
      caliber: '全市场上涨家数 / 参与交易家数；若连续多日涨跌家数完全相同但中位数涨跌变化，标记为疑似缓存并降权使用。',
      covDetail: [
        ['上涨家数', entry.market.upCount != null ? formatCount(entry.market.upCount) : '--'],
        ['下跌家数', entry.market.downCount != null ? formatCount(entry.market.downCount) : '--'],
        ['上涨占比', entry.market.upRatio != null ? (entry.market.upRatio * 100).toFixed(1) + '%' : '--'],
        ['数据质量', breadthCacheSuspicious ? '疑似缓存' : (entry.market.upRatio != null ? '正常' : '待确认')]
      ],
      coverage: entry.market.upRatio != null ? '100%' : '0%'
    },
    {
      name: '宽基ETF资金流',
      status: entry.etfWide.status,
      date: currentDt,
      source: entry.etfWide.source,
      caliber: '11个宽基方向（上证50/沪深300/中证500/中证1000/中证A500/科创50/创业板指/创业板50/中证2000/科创100/深证100），每方向取规模前5',
      // 四口径明细
      covDetail: [
        ['方向覆盖率', wideCov.directionCoverage != null ? (wideCov.directionCoverage * 100).toFixed(0) + '%' : '--'],
        ['有效样本率', wideCov.sampleCoverage != null ? (wideCov.sampleCoverage * 100).toFixed(0) + '% (' + wideCov.validSamples + '/' + wideCov.plannedSamples + ')' : '--'],
        ['份额确认率', wideShareConfirmCov],
        ['规模覆盖率', wideScaleCov]
      ],
      coverage: wideCov.directionCoverage != null ? (wideCov.directionCoverage * 100).toFixed(0) + '%' : '--'
    },
    {
      name: '主题ETF',
      status: etfTheme ? etfTheme.status : DATA_STATUS.PENDING,
      date: etfTheme ? (etfTheme.date || currentDt) : '待确认',
      source: 'Wind MCP',
      caliber: `5大类10方向，样本${etfTheme ? etfTheme.totalSampleCount : '--'}只，已确认${etfTheme ? etfTheme.totalConfirmedCount : '--'}只，待确认${etfTheme ? etfTheme.totalPendingCount : '--'}只`,
      // 四口径明细
      covDetail: [
        ['方向覆盖率', themeDirCov],
        ['有效样本率', themeSampleCov + ' (' + (etfTheme ? etfTheme.totalConfirmedCount : 0) + '/' + (etfTheme ? etfTheme.totalSampleCount : 0) + ')'],
        ['份额确认率', themeSampleCov],
        ['规模覆盖率', themeScaleCov]
      ],
      coverage: themeSampleCov
    },
    {
      name: '融资余额',
      status: margin.status,
      date: margin.date || '--',
      source: '沪深交易所（T+1披露）',
      caliber: '沪深两市合计融资余额。T+1数据，当日行情不可同权使用。权重=' + margin.weight,
      coverage: margin.value != null ? '100%' : '0%'
    }
  ];

  const itemsHtml = qualityItems.map(q => {
    // 渲染覆盖率：如果有 covDetail 就展示四口径明细，否则只显示 coverage
    const covHtml = q.covDetail
      ? '<div style="display:grid;grid-template-columns:1fr 1fr;gap:2px 12px;margin-top:2px">' +
        q.covDetail.map(([k, v]) => {
          const isNa = (v === '暂不可用');
          return '<span style="font-size:11px;color:' + (isNa ? 'var(--t4)' : 'var(--t3)') + '">' + k + ': ' + v + '</span>';
        }).join('') + '</div>'
      : '<span>📏 覆盖率: ' + q.coverage + '</span>';
    return `
    <div class="quality-item">
      <div class="quality-item-header">
        <span class="quality-item-name">${q.name}</span>
        ${statusTag(q.status)}
      </div>
      <div class="quality-item-meta">
        <span>📅 数据日期: ${q.date}</span>
        <span>📊 来源: ${q.source}</span>
        ${q.covDetail ? covHtml : covHtml}
        <span style="color:var(--t2);margin-top:2px">📐 口径: ${q.caliber}</span>
      </div>
    </div>`;
  }).join('');

  // 异常检测
  const anomalies = [];
  if (entry.concentration.top100.value == null) anomalies.push('TOP100集中度数据缺失');
  if (entry.etfWide.totalFlow == null) anomalies.push('宽基ETF数据缺失');
  if (!etfTheme) anomalies.push('主题ETF数据缺失');
  if (margin.isStale) anomalies.push('融资余额数据滞后(' + margin.date + ')');
  if (breadthCacheSuspicious) anomalies.push('市场宽度疑似缓存：连续多日上涨/下跌家数完全相同，但中位数涨跌变化，宽度证据需降权');
  if (marginJumpSuspicious) anomalies.push('融资余额疑似口径跳变：5/10日变化异常，连续变化不参与判断');
  if (etfTheme && etfTheme.totalPendingCount > etfTheme.totalSampleCount / 2) {
    anomalies.push('主题ETF过半数份额待确认(' + etfTheme.totalPendingCount + '/' + etfTheme.totalSampleCount + ')');
  }

  return `
  <div class="tab-content" id="tab-quality">
    <div class="wrap">
      <div class="module-title">
        <span class="num">01</span><span class="title">数据质量中心</span>
        <span class="subtitle">更新时间 · 数据状态 · 覆盖率 · 计算口径</span>
      </div>

      <div class="quality-grid">${itemsHtml}</div>

      <div class="module-title">
        <span class="num">02</span><span class="title">数据状态说明</span>
      </div>
      <div class="card">
        <table style="font-size:var(--fs-small)">
          <thead><tr><th style="text-align:left">状态</th><th style="text-align:left">含义</th></tr></thead>
          <tbody>
            <tr><td>${statusTag('realtime')}</td><td style="text-align:left">盘中实时估算，数据可能变动</td></tr>
            <tr><td>${statusTag('preliminary')}</td><td style="text-align:left">盘后首版，部分数据可能更新</td></tr>
            <tr><td>${statusTag('confirmed')}</td><td style="text-align:left">已确认，数据稳定</td></tr>
            <tr><td>${statusTag('pending')}</td><td style="text-align:left">待确认，份额等数据尚未结算</td></tr>
            <tr><td>${statusTag('partial')}</td><td style="text-align:left">部分缺失，使用时需注意</td></tr>
            <tr><td>${statusTag('stale')}</td><td style="text-align:left">已过期，数据日期早于当前页面日期</td></tr>
            <tr><td>${statusTag('failed')}</td><td style="text-align:left">取数失败</td></tr>
          </tbody>
        </table>
      </div>

      <div class="module-title">
        <span class="num">03</span><span class="title">异常检测</span>
      </div>
      <div class="card">
        ${anomalies.length > 0
          ? anomalies.map(a => `<div style="padding:4px 0;color:var(--c-warn)">⚠️ ${a}</div>`).join('')
          : '<div style="color:var(--c-confirm)">✓ 未检测到异常</div>'}
      </div>

      <div class="module-title">
        <span class="num">04</span><span class="title">核心计算口径</span>
      </div>
      <div class="card" style="font-size:var(--fs-small);line-height:1.8;color:var(--t2)">
        <p><strong style="color:var(--t1)">主题ETF净流入</strong>：(当日份额 - 前日份额) × 当日单位净值 / 10000 → 亿元。</p>
        <p><strong style="color:var(--t1)">主题ETF近5日净流入</strong>：最近5个交易日逐日计算净流入后累加，即 Σ[(当日份额 - 前一交易日份额) × 当日单位净值 / 10000] → 亿元。</p>
        <p><strong style="color:var(--t1)">宽基ETF净流入</strong>：(当日份额 - 前日份额) × 当日单位净值 / 10000 → 亿元。与主题ETF单日口径一致。</p>
        <p><strong style="color:var(--t1)">相对流入力度</strong>：净流入 / 当前样本总规模，用于跨规模比较。</p>
        <p><strong style="color:var(--t1)">TOP100集中度</strong>：成交额最大100只A股成交额 / 全市场A股成交额。排除ETF、债券、停牌、无成交股票。</p>
        <p><strong style="color:var(--t1)">20日分位数</strong>：当前值在最近20个有效交易日（跳过缺失）中的排名位置。</p>
        <p><strong style="color:var(--t1)">信号一致度</strong>：四类信号方向一致性，非涨跌概率。优先使用真实全市场宽度；代理或疑似缓存时置信度自动降级。</p>
        <p><strong style="color:var(--t1)">市场宽度（代理）</strong>：优先使用 Wind 全市场上涨占比；缺失时回退 TOP10 热门股代理。若连续多日涨跌家数完全相同但中位数涨跌变化，标记为疑似缓存并降权。</p>
        <p><strong style="color:var(--t1)">融资余额</strong>：T+1披露，当日行情不同权。滞后时自动降权至0.5。</p>
      </div>
    </div>
  </div>
  `;
}

// ===================================================================
// 结构性复盘看板（v4 — 决策顺序驾驶舱）
// 顺序：风格罗盘 → 核心结论 → 风险底色 → 节奏路径 → 资金分层
//       → 指数验证矩阵 → 主题承载 → 事件解释 → 验证条件 → 34周线 → 口径
// ===================================================================

// ============ 结构项配置 ============
/**
 * STRUCTURE_DEFS — 主题承载卡（位置后移到指数验证之后）
 * key, name, proxyName, etfThemes, note
 */
var STRUCTURE_DEFS = [
  { key: '科技成长',    name: '科技成长',    proxyName: '科创50 / 创业板指', etfThemes: ['半导体','AI','通信','机器人'], klineCodes: ['000688.SH','399006.SZ','515070.SH','512480.SH','515880.SH'], note: '' },
  { key: '创新药',      name: '创新药',      proxyName: '创新药ETF群',       etfThemes: ['创新药'],                       klineCodes: ['159992.SZ','515120.SH','560900.SH','159748.SZ','516060.SH','517380.SH','159858.SZ','159835.SZ'], note: '核心池8只创新药主题ETF，覆盖科创板/沪市/深市' },
  { key: '医药成长',    name: '医药成长',    proxyName: '医药/CXO/中药ETF',  etfThemes: ['医药成长'],                     klineCodes: ['159828.SZ','512010.SH','512170.SH','561510.SH'], note: '扩展池：生物医药/CXO/医疗器械/中药，与创新药核心池分离' },
  { key: '半导体设备',  name: '半导体设备',  proxyName: '半导体设备ETF群',   etfThemes: ['半导体设备'],                   klineCodes: ['512480.SH','159813.SZ','159995.SZ','159801.SZ','512760.SH','159777.SZ'], note: '跟踪半导体设备/材料' },
  { key: '消费价值',    name: '消费价值',    proxyName: '消费类ETF',         etfThemes: ['消费价值'],                     klineCodes: ['512690.SH','159928.SH','515650.SH'], note: '样本已扩展到8只消费价值ETF' },
  { key: '红利防御',    name: '红利防御',    proxyName: '红利ETF',           etfThemes: ['红利'],                          klineCodes: ['510880.SH'],                       note: '' },
  { key: '券商金融',    name: '券商金融',    proxyName: '证券ETF',           etfThemes: ['证券'],                          klineCodes: ['512880.SH'],                       note: '' },
  { key: '有色资源',    name: '有色资源',    proxyName: '有色金属/黄金ETF',  etfThemes: ['有色金属','黄金'],              klineCodes: ['512400.SH','518880.SH'],            note: '有色资源判断仅基于A股板块和ETF表现，不含商品价格确认' },
  { key: '化工',        name: '化工',        proxyName: '化工ETF',           etfThemes: ['化工'],                          klineCodes: ['159870.SH','516120.SH','516220.SH'], note: '样本3只化工ETF' },
  { key: '新能源',      name: '新能源',      proxyName: '新能源ETF',         etfThemes: ['新能源'],                        klineCodes: ['515030.SH','515790.SH','562500.SH'], note: '样本已扩展到6只新能源ETF' },
  { key: '军工',        name: '军工',        proxyName: '军工ETF',           etfThemes: ['军工'],                          klineCodes: ['512660.SH','512710.SH','501019.SH'], note: '样本3只军工ETF' },
  { key: '传媒游戏',    name: '传媒游戏',    proxyName: '传媒游戏ETF',       etfThemes: ['传媒游戏'],                      klineCodes: ['159869.SH','512980.SH','516890.SH'], note: '样本3只传媒游戏ETF' },
  { key: '微盘小票',    name: '微盘小票',    proxyName: '中证2000',          etfThemes: ['微盘小票'],                      klineCodes: ['932000.CSI'],                      note: '中证2000ETF作微盘指数代理（无独立微盘ETF）' }
];

function getSd(key) {
  for (var i = 0; i < STRUCTURE_DEFS.length; i++) {
    if (STRUCTURE_DEFS[i].key === key) return STRUCTURE_DEFS[i];
  }
  return null;
}

// ============ 结构数据收集 ============

function sumEtfFlow(entry, themeNames) {
  if (!entry || !entry.etfTheme || !entry.etfTheme.categories || themeNames.length === 0) return null;
  var total = 0, count = 0;
  for (var ck in entry.etfTheme.categories) {
    var cat = entry.etfTheme.categories[ck];
    if (!cat || !cat.themes) continue;
    for (var tk in cat.themes) {
      if (themeNames.indexOf(tk) >= 0) {
        var f = cat.themes[tk].flow;
        if (f != null && isFinite(f)) { total += f; count++; }
      }
    }
  }
  return count > 0 ? total : null;
}

function avgEtfChg(entry, themeNames) {
  if (!entry || !entry.etfTheme || !entry.etfTheme.categories || themeNames.length === 0) return null;
  var total = 0, count = 0;
  for (var ck in entry.etfTheme.categories) {
    var cat = entry.etfTheme.categories[ck];
    if (!cat || !cat.themes) continue;
    for (var tk in cat.themes) {
      if (themeNames.indexOf(tk) >= 0) {
        var c = cat.themes[tk].pctChg;
        if (c != null && isFinite(c)) { total += c; count++; }
      }
    }
  }
  return count > 0 ? total / count : null;
}

// 主题广度(成分股)子主题 → 规范主题 的归属映射（子主题指数需汇总到规范主题）
var BREADTH_ALIAS = {
  '半导体': '科技成长', 'AI': '科技成长', '通信': '科技成长', '机器人': '科技成长',
  '创新药': '创新药/医药成长', '证券': '证券金融', '红利': '红利防御',
  '有色金属': '有色资源', '黄金': '有色资源', '化工': '化工'
};

function avgEtfUpRatio(entry, themeNames) {
  // 优先：entry.themeBreadth 真实「成分股涨跌家数」口径（Wind 指数成分股）
  // 子主题(半导体/AI/...)需按 BREADTH_ALIAS 汇总到规范主题(科技成长/...)后再比对
  if (entry && entry.themeBreadth && Array.isArray(entry.themeBreadth.themes)) {
    var agg = {};
    entry.themeBreadth.themes.forEach(function (t) {
      if (!t || t.upRatio == null) return;
      var alias = BREADTH_ALIAS[t.name];
      if (!alias) return;
      if (!agg[alias]) agg[alias] = { u: 0, d: 0, f: 0, t: 0 };
      agg[alias].u += (t.upCount || 0);
      agg[alias].d += (t.downCount || 0);
      agg[alias].f += (t.flatCount || 0);
      agg[alias].t += (t.totalCount || 0);
    });
    var bs = [];
    themeNames.forEach(function (nm) {
      var a = agg[nm];
      if (a && a.t > 0) bs.push(a.u / a.t);
    });
    if (bs.length > 0) {
      var sb = 0; bs.forEach(function (v) { sb += v; });
      return sb / bs.length;
    }
  }
  // fallback：ETF 级口径
  if (!entry || !entry.etfTheme || !entry.etfTheme.categories || themeNames.length === 0) return null;
  var s = 0, n = 0;
  for (var ck in entry.etfTheme.categories) {
    var cat = entry.etfTheme.categories[ck];
    if (!cat || !cat.themes) continue;
    for (var tk in cat.themes) {
      if (themeNames.indexOf(tk) >= 0) {
        var t = cat.themes[tk];
        var ratio = null;
        if (t.upRatio != null) ratio = t.upRatio;
        else if (t.breadth && t.breadth.upCount != null && t.breadth.totalCount != null && t.breadth.totalCount > 0) {
          ratio = t.breadth.upCount / t.breadth.totalCount;
        }
        if (ratio != null) { s += ratio; n++; }
      }
    }
  }
  return n > 0 ? s / n : null;
}

function sumEtfFlow5d(data, currentDt, themeNames) {
  if (themeNames.length === 0) return null;
  return calcWindowSum(data, currentDt, function(e) { return sumEtfFlow(e, themeNames); }, 5);
}

// ============ K线摘要查询（注入到 data.klineSummary）============

/**
 * 从 data.klineSummary 取标的涨跌
 * data.klineSummary 由 build.js 从 kline_data.json 注入
 */
function klineChg(data, code) {
  if (!data || !data.klineSummary || !data.klineSummary[code]) return { chg1d: null, chg5d: null };
  var k = data.klineSummary[code];
  return { chg1d: k.chg1d, chg5d: k.chg5d, name: k.name };
}

/**
 * 取一组 code 的平均涨跌
 */
function klineAvg(data, codes) {
  if (!codes || codes.length === 0) return { chg1d: null, chg5d: null, missing: ['K线数据'] };
  var s1 = 0, s5 = 0, n1 = 0, n5 = 0;
  for (var i = 0; i < codes.length; i++) {
    var c = klineChg(data, codes[i]);
    if (c.chg1d != null) { s1 += c.chg1d; n1++; }
    if (c.chg5d != null) { s5 += c.chg5d; n5++; }
  }
  var missing = [];
  if (n1 === 0) missing.push('当日涨跌');
  if (n5 === 0) missing.push('5日涨跌');
  return {
    chg1d: n1 > 0 ? s1 / n1 : null,
    chg5d: n5 > 0 ? s5 / n5 : null,
    missing: missing
  };
}

// ============ 生命周期判定（统一封装，保留原规则） ============

/**
 * classifyStructureLifecycle(sd, entry, data, currentDt)
 * 输出：{ phase, phaseBadge, dailyFlow, flows5d, avgChg, upRatio, judgment, confirm, fail, missing }
 * 规则保持 v3 一致，新增 kline 价格回退（ETF pctChg 缺失时用 kline）
 */
function classifyStructureLifecycle(sd, entry, data, currentDt) {
  var tns = sd.etfThemes;
  var missing = [];
  var out = { phase: '待接入数据', phaseBadge: 'unknown', dailyFlow: null, flows5d: null, avgChg: null, upRatio: null, klineChg1d: null, klineChg5d: null, judgment: '暂无数据', confirm: '暂无数据', fail: '暂无数据', missing: [] };

  // K 线涨跌（独立维度，即使没有 ETF 也能用）
  var kavg = klineAvg(data, sd.klineCodes || []);
  out.klineChg1d = kavg.chg1d;
  out.klineChg5d = kavg.chg5d;

  if (tns.length === 0 && (sd.klineCodes || []).length === 0) {
    out.phase = '待接入数据';
    out.judgment = sd.name + '暂无独立ETF数据源和K线代理，无法基于资金流判断。' + (sd.note ? '当前备注：' + sd.note : '');
    out.confirm = '接入' + sd.name + '相关主题ETF或K线代理后可启用';
    out.fail = '暂无数据';
    return out;
  }

  var dailyFlow = sumEtfFlow(entry, tns);
  var avgChg = avgEtfChg(entry, tns);
  var upRatio = avgEtfUpRatio(entry, tns);
  var flows5d = sumEtfFlow5d(data, currentDt, tns);

  // 价格回退：ETF pctChg 缺失时用 K线
  if (avgChg == null) avgChg = out.klineChg1d;

  if (dailyFlow == null && tns.length > 0) missing.push('ETF流入');
  if (avgChg == null) missing.push('当日涨跌');
  if (upRatio == null && tns.length > 0) missing.push('上涨比例');
  if (!flows5d || flows5d.sum == null) missing.push('5日流入');

  out.dailyFlow = dailyFlow;
  out.avgChg = avgChg;
  out.upRatio = upRatio;
  out.flows5d = flows5d;
  out.missing = missing;

  var hasFlow = dailyFlow != null;
  var hasChg = avgChg != null;
  var hasWidth = upRatio != null;
  // 34 周线状态：从 sd.klineCodes 中取第一个有 weeklyMA34 数据的代码
  var weekly34Status = null;
  if (data && data.weeklyMA34 && sd.klineCodes) {
    for (var i = 0; i < sd.klineCodes.length; i++) {
      var w = data.weeklyMA34[sd.klineCodes[i]];
      if (w && w.status) { weekly34Status = w.status; break; }
    }
  }
  var weekly34Strong = weekly34Status === '强势上方' || weekly34Status === '回踩观察';
  var has5d = flows5d && flows5d.sum != null;
  var fPos = hasFlow && dailyFlow > 0;
  var fNeg = hasFlow && dailyFlow < 0;
  var chgPos = hasChg && avgChg > 0;
  var chgNeg = hasChg && avgChg < 0;
  var chgStrong = hasChg && avgChg > 2;
  var f5Pos = has5d && flows5d.sum > 0;
  var f5Neg = has5d && flows5d.sum < 0;

  // ---- 规则链（v4：以 34 周线为中期趋势锚点）----
  // 34 周线状态分组：
  //   strong: 强势上方/回踩观察（在趋势上方）
  //   mid:    趋势争夺（方向不明）
  //   weak:   反抽不过/中期弱势（在趋势下方）
  var weekly34Weak = weekly34Status === '反抽不过' || weekly34Status === '中期弱势';
  var weekly34StrongNow = weekly34Status === '强势上方';
  // 当周线状态待接入或为"回踩观察/趋势争夺"，按"中性"处理，不直接压制判定
  var weekly34Unknown = (weekly34Status == null || weekly34Status === '回踩观察' || weekly34Status === '趋势争夺');
  var weekly34Above = (weekly34Status === '强势上方' || weekly34Status === '回踩观察');

  if (!hasFlow && !hasChg && !hasWidth) {
    out.phase = '待接入数据';
    out.judgment = sd.name + '：ETF流入、当日涨跌、上涨比例全部缺失，跳过生命周期判定。';
    out.confirm = '任一数据维度补齐后即可启用';
    out.fail = '暂无数据';
  } else if (hasFlow && !hasChg && !hasWidth) {
    if (fPos && has5d && flows5d.sum > 0) {
      out.phase = '资金持续流入，价格待确认';
      out.phaseBadge = 'start';
      out.judgment = sd.name + '：ETF资金持续流入（当日' + fmtFlow(dailyFlow) + '亿，5日' + fmtFlow(flows5d.sum) + '亿），但价格和宽度字段待接入。';
      out.confirm = '下一交易日ETF继续净流入，且补齐价格或宽度后未出现反向验证';
      out.fail = 'ETF净流入转负，或5日累计流入明显收窄';
    } else if (fPos) {
      out.phase = '资金流入，价格待确认';
      out.phaseBadge = 'start';
      out.judgment = sd.name + '：ETF资金当日流入' + fmtFlow(dailyFlow) + '亿，但价格和宽度字段待接入。';
      out.confirm = '下一交易日ETF继续净流入';
      out.fail = 'ETF净流入转负';
    } else {
      out.phase = '资金流出，价格待确认';
      out.phaseBadge = 'cooling';
      out.judgment = sd.name + '：ETF资金当日流出' + fmtFlow(Math.abs(dailyFlow)) + '亿（仅ETF数据），暂属偏弱信号。';
      out.confirm = 'ETF转为净流入';
      out.fail = 'ETF持续流出且幅度扩大';
    }
  } else if (hasFlow && hasChg) {
    // === 优先级 1：34 周线下方 + 下跌 + 资金流出 + 宽度走弱 = 退潮 ===
    if (chgNeg && weekly34Weak && fNeg && hasWidth && upRatio < 0.4) {
      out.phase = '退潮'; out.phaseBadge = 'outflow';
    }
    // === 优先级 2：价格下跌但 ETF 仍流入 = 分歧/兑现（不直接判主升）===
    else if (chgNeg && fPos) {
      // ETF 流入 + 价格下跌 → 分歧或兑现，看 34 周线与 5 日累计
      if (f5Pos && weekly34Above) {
        out.phase = '兑现'; out.phaseBadge = 'cooling';
      } else {
        out.phase = '分歧'; out.phaseBadge = 'cooling';
      }
    }
    // === 优先级 3：上涨 + 资金流入 + 宽度改善 + 34 周线上方 = 主升/扩散 ===
    else if (chgPos && fPos) {
      if (weekly34StrongNow && hasWidth && upRatio >= 0.7 && f5Pos) {
        out.phase = '主升'; out.phaseBadge = 'sustained';
      }
      else if (weekly34StrongNow && hasWidth && upRatio >= 0.6 && f5Pos) {
        out.phase = '扩散'; out.phaseBadge = 'spike';
      }
      else if (weekly34StrongNow && hasWidth && upRatio >= 0.6) {
        out.phase = '扩散'; out.phaseBadge = 'spike';
      }
      else if (weekly34StrongNow && f5Pos) {
        out.phase = '扩散'; out.phaseBadge = 'spike';
      }
      else if (weekly34Unknown || weekly34StrongNow) {
        // 周线未接入或在趋势上方，按价格+资金+宽度判定
        if (hasWidth && upRatio >= 0.7 && f5Pos) { out.phase = '主升'; out.phaseBadge = 'sustained'; }
        else if (hasWidth && upRatio >= 0.6) { out.phase = '扩散'; out.phaseBadge = 'spike'; }
        else if (f5Pos) { out.phase = '扩散'; out.phaseBadge = 'spike'; }
        else { out.phase = '启动'; out.phaseBadge = 'start'; }
      }
      // 周线下方 + 上涨 = 反抽/修复（即使资金流入也不能直接判主升）
      else {
        if (f5Pos) { out.phase = '修复'; out.phaseBadge = 'rebound'; }
        else { out.phase = '反抽'; out.phaseBadge = 'rebound'; }
      }
    }
    // === 优先级 4：上涨 + 34 周线下方 = 反抽/修复 ===
    else if (chgPos && weekly34Weak) {
      if (fNeg) { out.phase = '反抽'; out.phaseBadge = 'rebound'; }
      else if (hasWidth && upRatio >= 0.5 && f5Pos) { out.phase = '修复'; out.phaseBadge = 'rebound'; }
      else { out.phase = '反抽'; out.phaseBadge = 'rebound'; }
    }
    // === 优先级 5：下跌 + 34 周线上方 = 回踩/分歧 ===
    else if (chgNeg && weekly34Above) {
      if (fPos) { out.phase = '兑现'; out.phaseBadge = 'cooling'; }
      else if (fNeg && hasWidth && upRatio < 0.4) { out.phase = '退潮'; out.phaseBadge = 'outflow'; }
      else { out.phase = '回踩'; out.phaseBadge = 'cooling'; }
    }
    // === 优先级 6：下跌 + 周线未知/中性 ===
    else if (chgNeg) {
      if (chgStrong && fNeg && f5Neg) { out.phase = '退潮'; out.phaseBadge = 'outflow'; }
      else if (fNeg && hasWidth && upRatio < 0.4) { out.phase = '退潮'; out.phaseBadge = 'outflow'; }
      else if (fPos) { out.phase = '兑现'; out.phaseBadge = 'cooling'; }
      else { out.phase = '分歧'; out.phaseBadge = 'cooling'; }
    }
    // === 优先级 7：上涨 + 资金流出 ===
    else if (chgPos && fNeg) {
      if (weekly34Weak) { out.phase = '反抽'; out.phaseBadge = 'rebound'; }
      else { out.phase = '分歧'; out.phaseBadge = 'cooling'; }
    }
    // === 默认：上涨但无明确资金方向 ===
    else {
      out.phase = '启动'; out.phaseBadge = 'start';
    }

    // 中文动词"流入/流出"后不带 + 号，直接用 toFixed（fmtFlow 会自动加 +）
    var flowAbsTxt = Math.abs(dailyFlow).toFixed(1);
    var flowTxt = fPos ? '流入 ' + flowAbsTxt + ' 亿' : '流出 ' + flowAbsTxt + ' 亿';
    var chgTxt = chgPos ? '上涨 ' + Math.abs(avgChg).toFixed(2) + '%' : '下跌 ' + Math.abs(avgChg).toFixed(2) + '%';
    var widthTxt = hasWidth ? '，上涨比例' + (upRatio * 100).toFixed(0) + '%' : '';
    // noteTxt 前缀：判断语句末尾已有句号时，note 用 ' '（空格）连接避免双句号
    // sd.note 本身是完整短语（如"有色资源判断仅基于..."），不需要再加"。"
    var noteTxt = sd.note ? ' ' + sd.note : '';

    switch (out.phase) {
      case '主升': out.judgment = sd.name + '主升：资金' + flowTxt + '、涨幅' + chgTxt + widthTxt + '、34周线状态支撑。'; break;
      case '扩散': out.judgment = sd.name + '扩散：资金' + flowTxt + '、涨幅' + chgTxt + widthTxt + '。'; break;
      case '启动': out.judgment = sd.name + '启动：资金' + flowTxt + '、价格' + chgTxt + widthTxt + '。'; break;
      case '分歧': out.judgment = sd.name + '分歧：价格与资金背离(' + chgTxt + '但' + flowTxt + ')' + widthTxt + '。'; break;
      case '兑现': out.judgment = sd.name + '兑现：价格与资金背离(' + chgTxt + '但' + flowTxt + ')' + widthTxt + '。'; break;
      case '退潮': out.judgment = sd.name + '退潮：资金' + flowTxt + '、价格' + chgTxt + widthTxt + '、34周线下方。'; break;
      case '反抽': out.judgment = sd.name + '反抽：价格上涨但 34 周线下方，仅视作修复，不等于主升。'; break;
      case '修复': out.judgment = sd.name + '修复：价格上涨、5日累计净流入，但 34 周线仍在下方，需补量确认。'; break;
      case '回踩': out.judgment = sd.name + '回踩：价格下跌但 34 周线仍在趋势上方，趋势未破。'; break;
      default: out.judgment = sd.name + '暂无明确方向(' + chgTxt + '，' + flowTxt + ')' + widthTxt + '。';
    }
    out.judgment += noteTxt;

    if (has5d && flows5d.sum != null) {
      var f5AbsTxt = Math.abs(flows5d.sum).toFixed(1);
      var f5Txt = flows5d.sum > 0 ? '5日累计流入 ' + fmtFlow(flows5d.sum) + ' 亿' : '5日累计流出 ' + f5AbsTxt + ' 亿';
      out.judgment += '（' + f5Txt + '）。';
    }

    switch (out.phase) {
      case '主升': out.confirm = 'ETF继续流入且宽度维持，主线延续'; out.fail = '流入转负或龙头补跌，进入兑现'; break;
      case '扩散': out.confirm = '流入加速且涨幅扩大，升级为主升'; out.fail = '流入放缓或成交萎缩，降级为启动'; break;
      case '启动': out.confirm = '连续3日正流入且涨幅>1%，进入扩散'; out.fail = '流入转负或跌破启动点'; break;
      case '分歧': out.confirm = '价格企稳，且 ETF 资金继续承接，宽度修复后确认兑现消化'; out.fail = '流出扩大且价格加速下跌，进入退潮'; break;
      case '兑现': out.confirm = '价格企稳，且 ETF 资金继续承接，宽度修复后确认兑现消化'; out.fail = '价格继续下跌且流出加大，转为退潮'; break;
      case '退潮': out.confirm = '流出收窄且价格止跌，或有反抽'; out.fail = '持续流出且新低，中期弱势延续'; break;
      default: out.confirm = '补齐更多数据维度后可生成更精确条件'; out.fail = '暂无数据';
    }
    var condNote = '';
    if (!hasWidth && tns.length > 0) condNote += '（上涨比例待接入）';
    if (!has5d) condNote += '（5日流入待接入）';
    if (condNote) { out.confirm += condNote; out.fail += condNote; }
  } else if (hasChg && !hasFlow) {
    // 有价格（来自K线）但无ETF资金
    if (chgPos) {
      out.phase = '资金流入，价格待确认';
      out.phaseBadge = 'start';
      out.judgment = sd.name + '：K线代理上涨 ' + Math.abs(avgChg).toFixed(2) + '%，但ETF资金数据待接入，仅能确认价格偏强。';
      out.confirm = '下一交易日价格继续走强且ETF资金补齐为正流入';
      out.fail = '价格回落跌破启动点';
    } else {
      out.phase = '资金流出，价格待确认';
      out.phaseBadge = 'cooling';
      out.judgment = sd.name + '：K线代理下跌 ' + Math.abs(avgChg).toFixed(2) + '%，但ETF资金数据待接入，仅能确认价格偏弱。';
      out.confirm = '价格止跌且ETF资金补齐为正流入';
      out.fail = '价格继续下跌';
    }
  } else {
    out.phase = '资金流入，价格待确认';
    out.phaseBadge = 'start';
    out.judgment = sd.name + '：数据部分就绪，但价格和资金方向无法交叉验证。';
    out.confirm = '补齐更多维度'; out.fail = '暂无数据';
  }

  return out;
}

// ============ 风险底色（降级为仓位环境）============

function calcRiskTint(entry, data, currentDt) {
  if (!entry) return { label: '中性', tone: 'neutral', position: '按结构性主线调配仓位，不押方向' };
  var c = entry.computed || {};
  var m = entry.market || {};
  var conc = entry.concentration || {};
  var wideFlow = entry.etfWide ? entry.etfWide.totalFlow : null;
  var upRatio = m.upRatio;
  var totalAmt = conc.totalAmount;
  var amtPct = c.amountVs5d;

  // === 融资盘（杠杆资金）信号 ===
  // margin.value: 万亿元；margin.chgYi: 较前日变化（亿元）；margin.trend5d: 'up'/'down'/'flat'
  var mg = entry.margin || {};
  var mgValueWan = mg.value;                  // 万亿元
  var mgChgYi = mg.chgYi;                      // 当日变化（亿元）
  var mgTrend5d = mg.trend5d;                  // 'up'/'down'/'flat'

  // 5 日累计融资变化（亿元）：对每日 chgYi 求和
  var mg5dSum = null;
  if (data && currentDt && mg.chgYi != null) {
    var mg5 = calcWindowSum(data, currentDt, function(e){ return e && e.margin ? e.margin.chgYi : null; }, 5);
    if (mg5 && mg5.days >= 3) mg5dSum = mg5.sum;  // 至少 3 天数据才用
  }
  // 5 日融资余额绝对变化（万亿元）：用 calcWindowChange 算端到端差额（备用口径）
  var mg5dAbsWan = (data && currentDt) ? calcWindowChange(data, currentDt, function(e){ return e && e.margin ? e.margin.value : null; }, 5) : null;
  var mg5dAbsYi = mg5dAbsWan != null ? mg5dAbsWan * 10000 : null;  // 转成亿元

  // 融资盘信号标记（用于 label 追加说明）
  var mgAlarm = '';

  // 极端：融资 5 日累计净偿还 > 500 亿（散户/游资去杠杆，往往领先于指数大跌）
  var mgDeleverage = (mg5dAbsYi != null && mg5dAbsYi < -500);

  // 过热：融资余额绝对值 > 1.8 万亿 且 5 日趋势上升
  var mgOverheated = (mgValueWan != null && mgValueWan >= 1.8 && mgTrend5d === 'up');

  if ((totalAmt != null && totalAmt < 18000 && upRatio != null && upRatio < 0.3) ||
      (totalAmt != null && totalAmt > 40000 && upRatio != null && upRatio < 0.35 && wideFlow != null && wideFlow < -20)) {
    mgAlarm = ' · 缩量普跌或天量普跌';
    return { label: '极端' + mgAlarm, tone: 'extreme', position: '严格控仓，等待信号修复' };
  }
  // 新增：融资去杠杆直接判极端（即使成交额/宽度没到极端，杠杆出清本身就是系统性风险信号）
  if (mgDeleverage) {
    mgAlarm = ' · 融资5日净偿还 ' + Math.abs(mg5dAbsYi).toFixed(0) + ' 亿，杠杆出清';
    return { label: '极端' + mgAlarm, tone: 'extreme', position: '严格控仓，杠杆资金去化未结束前不抢反弹' };
  }
  if ((totalAmt == null || totalAmt < 25000) && amtPct != null && amtPct < -5 && wideFlow != null && wideFlow < -10)
    return { label: '收缩', tone: 'contract', position: '控制仓位，多看少动' };
  // 收缩追加：融资 5 日累计净偿还 200-500 亿（轻度去杠杆）
  if (mg5dAbsYi != null && mg5dAbsYi < -200) {
    return { label: '收缩 · 融资连续净偿还 ' + Math.abs(mg5dAbsYi).toFixed(0) + ' 亿', tone: 'contract', position: '控制仓位，融资盘转弱，多看少动' };
  }
  if (totalAmt != null && totalAmt >= 30000 && upRatio != null && upRatio > 0.5 && wideFlow != null && wideFlow > 0)
    return { label: '宽松', tone: 'loose', position: '仓位可偏积极' };
  return { label: '中性', tone: 'neutral', position: '按结构性主线调配仓位，不押方向' };
}

// ============ 模块 1：风格罗盘 ============
/**
 * STYLE_DIMENSIONS — 5 个风格维度配置
 * 代理 code 引用 data.klineSummary 中的指数/ETF
 */
var STYLE_INDEX_DEFINITIONS = {
  growth: {
    name: '成长风格',
    // 申万大盘成长 399372.SZ + 申万小盘成长 399376.SZ（覆盖全市场成长股）
    primaryCodes: ['399372.SZ', '399376.SZ'],
    primaryName: '大盘成长+小盘成长（申万风格指数）',
    // 解释层：创业板/科创50/创新药ETF（仅作辅助解释，不参与主判断）
    fallback: ['000688.SH', '399006.SZ', '159992.SZ'],
    fallbackName: '科创50+创业板指+创新药ETF'
  },
  value: {
    name: '价值风格',
    // 申万大盘价值 399373.SZ + 申万小盘价值 399377.SZ
    primaryCodes: ['399373.SZ', '399377.SZ'],
    primaryName: '大盘价值+小盘价值（申万风格指数）',
    fallback: ['000016.SH', '000300.SH', '510880.SH'],
    fallbackName: '上证50+沪深300+红利ETF'
  },
  large: {
    name: '大盘风格',
    // 巨潮大盘 399314.SZ（国证系列，覆盖全市场大市值）
    primaryCodes: ['399314.SZ'],
    primaryName: '巨潮大盘（国证系列）',
    fallback: ['000016.SH', '000300.SH'],
    fallbackName: '上证50+沪深300'
  },
  small: {
    name: '小盘风格',
    // 巨潮小盘 399316.SZ
    primaryCodes: ['399316.SZ'],
    primaryName: '巨潮小盘（国证系列）',
    fallback: ['000852.SH', '932000.CSI'],
    fallbackName: '中证1000+中证2000'
  },
  highBeta: {
    name: '高贝塔（进攻）',
    // 沪深300高贝塔 000828.CSI
    primaryCodes: ['000828.CSI'],
    primaryName: '沪深300高贝塔指数',
    fallback: ['000688.SH', '515070.SH', '512880.SH', '512400.SH'],
    fallbackName: '科创50+AI+证券+有色'
  },
  lowVol: {
    name: '低波动（防御）',
    // 红利低波 h30269.CSI + 上证180波动率加权 000129.SH（双防御指数）
    primaryCodes: ['h30269.CSI', '000129.SH'],
    primaryName: '红利低波+180波动率加权',
    fallback: ['510880.SH', '518880.SH'],
    fallbackName: '红利ETF+黄金ETF'
  }
};

var STYLE_DIMENSIONS = [
  {
    key: 'growthVsValue', label: '成长 vs 价值',
    leftLabel: '价值', rightLabel: '成长',
    growth: { name: '成长组（解释层）', codes: STYLE_INDEX_DEFINITIONS.growth.fallback },
    value:  { name: '价值组（解释层）', codes: STYLE_INDEX_DEFINITIONS.value.fallback },
    primary: { right: STYLE_INDEX_DEFINITIONS.growth, left: STYLE_INDEX_DEFINITIONS.value }
  },
  {
    key: 'largeVsSmall', label: '大盘 vs 小盘',
    leftLabel: '小盘', rightLabel: '大盘',
    growth: { name: '大盘组（解释层）', codes: STYLE_INDEX_DEFINITIONS.large.fallback },
    value: { name: '小盘组（解释层）', codes: STYLE_INDEX_DEFINITIONS.small.fallback },
    primary: { right: STYLE_INDEX_DEFINITIONS.large, left: STYLE_INDEX_DEFINITIONS.small }
  },
  {
    key: 'attackVsDefense', label: '进攻 vs 防御',
    leftLabel: '防御', rightLabel: '进攻',
    growth: { name: '进攻组（解释层）', codes: STYLE_INDEX_DEFINITIONS.highBeta.fallback },
    value:  { name: '防御组（解释层）', codes: STYLE_INDEX_DEFINITIONS.lowVol.fallback },
    primary: { right: STYLE_INDEX_DEFINITIONS.highBeta, left: STYLE_INDEX_DEFINITIONS.lowVol }
  },
  {
    key: 'concentrationVsDiffusion', label: '集中 vs 扩散',
    leftLabel: '扩散', rightLabel: '集中',
    growth: { name: '集中（数据驱动）', codes: [], useConcentration: true },
    value:  { name: '扩散（宽度驱动）', codes: [], useBreadth: true }
  },
  {
    key: 'themeVsBroad', label: '主题 vs 宽基',
    leftLabel: '宽基', rightLabel: '主题',
    growth: { name: '主题ETF', codes: [], useThemeFlow: true },
    value:  { name: '宽基ETF', codes: [], useWideFlow: true }
  }
];

/**
 * 计算风格罗盘
 * 返回 [{ key, label, leftLabel, rightLabel, score(-1~1), bias, reasons[], missing[] }]
 * score > 0 偏右侧(growth/large/attack/concentration/theme)，< 0 偏左侧
 * bias 直接输出维度专属词（偏成长/偏价值/偏大盘/偏小盘/偏进攻/偏防御/偏集中/偏扩散/偏主题/偏宽基）
 */
function calculateStyleCompass(entry, data, dt) {
  return STYLE_DIMENSIONS.map(function(dim) {
    var reasons = [], missing = [];

    if (dim.key === 'concentrationVsDiffusion') {
      var conc = entry.concentration || {};
      var top100 = conc.top100 ? conc.top100.value : null;
      var upRatio = entry.market ? entry.market.upRatio : null;
      var concScore = top100 != null ? (top100 > 30 ? 1 : top100 > 25 ? 0.5 : 0) : null;
      var brScore = upRatio != null ? (upRatio > 0.6 ? -1 : upRatio > 0.45 ? -0.5 : upRatio < 0.3 ? 1 : 0) : null;
      if (concScore == null) missing.push('TOP100集中度');
      if (brScore == null) missing.push('上涨比例');
      var both = [concScore, brScore].filter(function(x){ return x != null; });
      var score = both.length ? both.reduce(function(a,b){return a+b;},0) / both.length : 0;
      if (concScore != null) reasons.push('TOP100成交占比 ' + (top100 != null ? top100.toFixed(1) + '%' : '待接入') + (concScore > 0 ? '（偏集中）' : concScore < 0 ? '（偏分散）' : '（中性）'));
      if (brScore != null) reasons.push('上涨比例 ' + (upRatio*100).toFixed(1) + '%' + (brScore < 0 ? '（偏扩散）' : brScore > 0 ? '（偏集中）' : '（中性）'));
      return { key: dim.key, label: dim.label, leftLabel: dim.leftLabel, rightLabel: dim.rightLabel, score: score, bias: styleBias(dim, score), reasons: reasons, missing: missing };
    }

    if (dim.key === 'themeVsBroad') {
      var wideFlow = entry.etfWide ? entry.etfWide.totalFlow : null;
      var themeTotal = 0, themeCount = 0;
      if (entry.etfTheme && entry.etfTheme.categories) {
        Object.keys(entry.etfTheme.categories).forEach(function(ck) {
          var cat = entry.etfTheme.categories[ck];
          if (!cat || !cat.themes) return;
          Object.keys(cat.themes).forEach(function(tk) {
            var f = cat.themes[tk].flow;
            if (f != null && isFinite(f)) { themeTotal += f; themeCount++; }
          });
        });
      }
      var themeFlow = themeCount > 0 ? themeTotal : null;
      if (wideFlow == null) missing.push('宽基ETF净流入');
      if (themeFlow == null) missing.push('主题ETF净流入');
      var score = 0;
      if (wideFlow != null && themeFlow != null) {
        var diff = themeFlow - wideFlow;
        score = diff > 30 ? 1 : diff > 10 ? 0.5 : diff < -30 ? -1 : diff < -10 ? -0.5 : 0;

        // 资金性质识别：宽基异动 = 被动/承接盘（疑似国家队或机构配置）
        var wideAnomaly = wideFlow > 50;
        var themeAnomaly = themeFlow > 30; // 主题净流入 >30 亿也算异动
        var wideTag = wideAnomaly ? '【承接型资金异动】' : '';
        var themeTag = themeAnomaly ? '【主动型进攻异动】' : '';

        if (themeFlow > 0 && wideFlow > 0) {
          // 两者都流入：判断承接方 vs 进攻方
          var broadDominant = wideFlow > themeFlow;
          var qualifier;
          if (broadDominant) {
            qualifier = wideAnomaly ? '宽基承接强于主题进攻' + (wideAnomaly ? '，疑似被动配置盘/国家队介入' : '') : '宽基承接强于主题进攻';
          } else {
            qualifier = '主题进攻强于宽基承接';
          }
          reasons.push(themeTag + '主题ETF ' + fmtFlow(themeFlow) + '亿 vs ' + wideTag + '宽基ETF ' + fmtFlow(wideFlow) + '亿（均流入，' + qualifier + '）');
        } else if (themeFlow > 0 && wideFlow <= 0) {
          reasons.push(themeTag + '主题ETF ' + fmtFlow(themeFlow) + '亿 vs 宽基ETF ' + fmtFlow(wideFlow) + '亿（主题进攻，宽基未承接）');
        } else if (themeFlow <= 0 && wideFlow > 0) {
          var note = wideAnomaly ? '，疑似被动配置盘/国家队托市' : '';
          reasons.push('主题ETF ' + fmtFlow(themeFlow) + '亿 vs ' + wideTag + '宽基ETF ' + fmtFlow(wideFlow) + '亿（结构降温，宽基独立承接' + note + '）');
        } else {
          // 两者都流出
          reasons.push('主题ETF ' + fmtFlow(themeFlow) + '亿 vs 宽基ETF ' + fmtFlow(wideFlow) + '亿（资金全面撤退）');
        }
      }
      return { key: dim.key, label: dim.label, leftLabel: dim.leftLabel, rightLabel: dim.rightLabel, score: score, bias: styleBias(dim, score), reasons: reasons, missing: missing };
    }

    // 成长vs价值 / 大盘vs小盘 / 进攻vs防御：主口径优先 Wind 风格指数，回退代理组
    var primaryRight = dim.primary ? klineAvg(data, dim.primary.right.primaryCodes) : { chg1d: null, chg5d: null };
    var primaryLeft  = dim.primary ? klineAvg(data, dim.primary.left.primaryCodes)  : { chg1d: null, chg5d: null };
    var usePrimary = (primaryRight.chg1d != null && primaryLeft.chg1d != null);
    var rightAvg = usePrimary ? primaryRight : klineAvg(data, dim.growth.codes);
    var leftAvg  = usePrimary ? primaryLeft  : klineAvg(data, dim.value.codes);
    var caliberTag = usePrimary ? '【主口径】' : '【解释层·代理组】';
    var rightName = usePrimary ? dim.primary.right.primaryName : dim.growth.name;
    var leftName  = usePrimary ? dim.primary.left.primaryName  : dim.value.name;
    if (rightAvg.chg1d == null) missing.push((usePrimary ? dim.primary.right.name : dim.growth.name) + '当日涨跌');
    if (leftAvg.chg1d == null) missing.push((usePrimary ? dim.primary.left.name : dim.value.name) + '当日涨跌');
    var score = 0;
    if (rightAvg.chg1d != null && leftAvg.chg1d != null) {
      var d = rightAvg.chg1d - leftAvg.chg1d;
      // 主口径阈值：|diff| > 1% 偏向，否则中性（用户指定）
      // 代理组阈值保留原 0.8/2（代理组波动更大）
      var strongT = usePrimary ? 1 : 2;
      var weakT   = usePrimary ? 1 : 0.8;
      score = d > strongT ? 1 : d > weakT ? 0.5 : d < -strongT ? -1 : d < -weakT ? -0.5 : 0;
      // 当日同向（双下跌）时：抗跌方 = 数值更接近0 的一方
      if (rightAvg.chg1d < 0 && leftAvg.chg1d < 0) {
        var gap = Math.abs(rightAvg.chg1d - leftAvg.chg1d);
        var rightResilient = rightAvg.chg1d > leftAvg.chg1d; // 右侧数值更大 = 跌得更少 = 抗跌
        var resilienceLabel;
        if (gap < 0.5) {
          resilienceLabel = '双方差异不大，相对均衡';
        } else {
          var sideWord = rightResilient ? dim.rightLabel : dim.leftLabel;
          resilienceLabel = sideWord + '相对抗跌';
        }
        reasons.push(caliberTag + rightName + ' ' + fmtPct(rightAvg.chg1d) + ' vs ' + leftName + ' ' + fmtPct(leftAvg.chg1d) + '（' + resilienceLabel + '）');
      } else {
        reasons.push(caliberTag + rightName + ' ' + fmtPct(rightAvg.chg1d) + ' vs ' + leftName + ' ' + fmtPct(leftAvg.chg1d));
      }
    }
    if (rightAvg.chg5d != null && leftAvg.chg5d != null) {
      reasons.push('5日：' + rightName + ' ' + fmtPct(rightAvg.chg5d) + ' vs ' + leftName + ' ' + fmtPct(leftAvg.chg5d));
    }

    // 进攻vs防御专属：主口径测"强度"，解释层补"方向"
    if (dim.key === 'attackVsDefense' && usePrimary) {
      var explRight = klineAvg(data, dim.growth.codes); // 科创/AI/证券/有色
      var explLeft  = klineAvg(data, dim.value.codes);  // 红利/黄金
      if (explRight.chg1d != null && explLeft.chg1d != null) {
        var explDiff = explRight.chg1d - explLeft.chg1d;
        var directionWord;
        if (explDiff > 0.5) directionWord = '主题进攻方向（科技/券商/周期）领涨';
        else if (explDiff < -0.5) directionWord = '防御方向（红利/黄金）抗跌';
        else directionWord = '方向未明显分化';
        reasons.push('【方向补充】解释层 ' + dim.growth.codes.join('/') + ' ' + fmtPct(explRight.chg1d) + ' vs ' + dim.value.codes.join('/') + ' ' + fmtPct(explLeft.chg1d) + ' → ' + directionWord);
      }
    }

    return { key: dim.key, label: dim.label, leftLabel: dim.leftLabel, rightLabel: dim.rightLabel, score: score, bias: styleBias(dim, score), reasons: reasons, missing: missing };
  });
}

/**
 * styleBias — 输出维度专属偏向词（不写左右）
 * 强度：|score|>0.5 明显偏, |score|>0.1 偏, 否则均衡
 * 方向：score>0 偏右(成长/大盘/进攻/集中/主题), score<0 偏左(价值/小盘/防御/扩散/宽基)
 */
function styleBias(dim, score) {
  var rightWord = dim.rightLabel; // 成长/大盘/进攻/集中/主题
  var leftWord = dim.leftLabel;   // 价值/小盘/防御/扩散/宽基
  if (score > 0.5) return '明显偏' + rightWord;
  if (score > 0.1) return '偏' + rightWord;
  if (score < -0.5) return '明显偏' + leftWord;
  if (score < -0.1) return '偏' + leftWord;
  return rightWord + '与' + leftWord + '均衡';
}

// ============ 模块 2：核心复盘结论 ============

function buildCoreConclusion(entry, data, dt, compass, risk, funding, rhythmSummary) {
  // 市场定性：综合风格罗盘偏向 + 资金流向（不只看 score，还要看是否实际流入）
  var growthScore = compass.find(function(d){ return d.key==='growthVsValue'; }).score;
  var themeScore = compass.find(function(d){ return d.key==='themeVsBroad'; }).score;
  var concScore = compass.find(function(d){ return d.key==='concentrationVsDiffusion'; }).score;
  var wideFlow = entry.etfWide ? entry.etfWide.totalFlow : null;
  // 主题 ETF 实际是否净流入
  var themeFlow = 0, themeCount = 0;
  if (entry.etfTheme && entry.etfTheme.categories) {
    Object.keys(entry.etfTheme.categories).forEach(function(ck) {
      var cat = entry.etfTheme.categories[ck];
      if (!cat || !cat.themes) return;
      Object.keys(cat.themes).forEach(function(tk) {
        var f = cat.themes[tk].flow;
        if (f != null && isFinite(f)) { themeFlow += f; themeCount++; }
      });
    });
  }
  themeFlow = themeCount > 0 ? themeFlow : null;

  // === 融资盘（杠杆资金）信号 ===
  // 杠杆驱动型上涨识别：ETF 流入温和但融资盘飙升 → 涨势靠杠杆撑，不稳
  var mg = entry.margin || {};
  var mg5dAbsYi = null;
  if (data && dt) {
    var mg5dAbsWan = calcWindowChange(data, dt, function(e){ return e && e.margin ? e.margin.value : null; }, 5);
    mg5dAbsYi = mg5dAbsWan != null ? mg5dAbsWan * 10000 : null;
  }
  // 杠杆加速入场：5日融资净流入 > 300 亿
  var mgAccelerating = (mg5dAbsYi != null && mg5dAbsYi > 300);
  // 杠杆去化：5日融资净偿还 > 200 亿
  var mgDeleveraging = (mg5dAbsYi != null && mg5dAbsYi < -200);

  var tone;
  if (growthScore > 0.3 && themeScore > 0) {
    // 基础判断：成长 + 主题进攻
    if (mgAccelerating && (wideFlow == null || wideFlow < themeFlow)) {
      // 杠杆加速 + 宽基没同步大幅流入 = 杠杆驱动型上涨，不稳
      tone = '成长吸筹 + 主题进攻，但融资盘5日净流入 ' + mg5dAbsYi.toFixed(0) + ' 亿加速入场，宽基未同步承接，杠杆驱动特征明显，注意结构稳定性';
    } else {
      tone = '成长吸筹，主题资金主动进攻，非科技板块承压';
    }
  } else if (growthScore > 0.3) {
    tone = '成长相对占优，但资金未全面切换';
  } else if (growthScore < -0.3) {
    // 价值抗跌，看主题是否仍在流入
    if (themeFlow != null && themeFlow > 0) {
      if (wideFlow != null && wideFlow > themeFlow) {
        tone = '价值防御相对占优，宽基承接强于主题进攻；主题资金仍流入，但进攻强度弱于宽基';
      } else {
        tone = '价值防御相对占优，但主题资金仍维持净流入，结构进攻未全面退潮';
      }
    } else {
      // 价值强 + 主题撤退：进一步看融资盘是否也在去杠杆
      if (mgDeleveraging) {
        tone = '价值防御主导，主题资金净流出，且融资盘5日净偿还 ' + Math.abs(mg5dAbsYi).toFixed(0) + ' 亿，杠杆去化叠加避险，下行压力加剧';
      } else {
        tone = '价值防御主导，主题资金净流出，避险情绪上升';
      }
    }
  } else {
    // 风格均衡：补看融资盘是否在异动
    if (mgAccelerating) {
      tone = '风格表面均衡，但融资盘5日净流入 ' + mg5dAbsYi.toFixed(0) + ' 亿加速入场，杠杆资金异动，主线方向待确认';
    } else if (mgDeleveraging) {
      tone = '风格表面均衡，但融资盘5日净偿还 ' + Math.abs(mg5dAbsYi).toFixed(0) + ' 亿，杠杆去化暗流，资金观望中带谨慎';
    } else {
      tone = '风格均衡，主线未明，资金观望';
    }
  }

  // 战略判断
  var strategy;
  if (wideFlow != null && wideFlow > 0) strategy = '宽基承接 + 产业趋势未证伪，增量资金未逆转';
  else if (wideFlow != null && wideFlow < -30) strategy = '宽基转为流出，增量资金出现逆转迹象，需警惕';
  else strategy = '产业趋势未证伪，流动性条件仍在，但增量资金边际放缓';

  // 战术扰动
  var upRatio = entry.market ? entry.market.upRatio : null;
  var amt = entry.concentration ? entry.concentration.totalAmount : null;

  // 融资盘战术信号
  var mg = entry.margin || {};
  var mgValueWan = mg.value;
  var mgTrend5d = mg.trend5d;
  // 5 日累计融资变化（亿元）
  var mg5dAbsYi = null;
  if (data && dt) {
    var mg5dAbsWan = calcWindowChange(data, dt, function(e){ return e && e.margin ? e.margin.value : null; }, 5);
    mg5dAbsYi = mg5dAbsWan != null ? mg5dAbsWan * 10000 : null;
  }

  var tactic;
  if (upRatio != null && upRatio < 0.4) tactic = '宽度恶化（上涨比例 ' + (upRatio*100).toFixed(0) + '%），短期赚钱效应转弱';
  else if (amt != null && amt > 38000) tactic = '成交额 ' + (amt/1000).toFixed(1) + '千亿，短期可能过热';
  else if (mgValueWan != null && mgValueWan >= 1.8 && mgTrend5d === 'up') tactic = '融资余额 ' + mgValueWan.toFixed(2) + ' 万亿处于历史高位且持续上升，杠杆资金过热';
  else if (mg5dAbsYi != null && mg5dAbsYi > 300) tactic = '融资5日净流入 ' + mg5dAbsYi.toFixed(0) + ' 亿，杠杆加速入场，注意结构稳定性';
  else if (rhythmSummary && rhythmSummary.tail === '兑现') tactic = '近日路径出现高位兑现迹象，波动放大';
  else tactic = '战术扰动有限，仓位再平衡未明显触发';

  // 交易含义
  var trade;
  if (risk.tone === 'extreme') trade = '严格控仓，等待信号修复后再行动';
  else if (risk.tone === 'contract') trade = '多看少动，降低仓位，不追高';
  else if (growthScore > 0.3) trade = '不轻言主线结束，但不追高，等待回踩后的验证';
  else if (growthScore < -0.3) trade = '降低进攻性，转向防御或等待主线切换';
  else trade = '维持均衡配置，按结构信号动态调整';

  return { tone: tone, strategy: strategy, tactic: tactic, trade: trade };
}

// ============ 模块 4：节奏路径 ============

/**
 * 节奏路径标签规则（四类独立判定，可叠加）
 * 1. 量能：成交额对比 5 日均值 / 20 日分位
 * 2. 宽度：上涨比例分布 + 指数与宽度背离
 * 3. 资金：宽基 / 主题 ETF 净流入的组合
 * 4. 风格：成长/价值/小盘/防御 当日涨跌对比（klineSummary 即时计算）
 */

// ---------- 量能标签 ----------
function rhythmAmountTag(amt, amt5dAvg) {
  if (amt == null) return null;
  var tags = [];
  if (amt5dAvg != null && amt > 0) {
    if (amt > amt5dAvg * 1.10) tags.push('放量');
    else if (amt < amt5dAvg * 0.90) tags.push('缩量');
    if (amt > 40000) tags.push('天量');
    if (amt < amt5dAvg * 0.80) tags.push('量能衰减');
  }
  // 流动性高位（绝对值高，与均值变化无直接关系，可叠加）
  if (amt > 35000) tags.push('流动性高位');
  return tags.length ? tags : null;
}

// ---------- 宽度标签 ----------
function rhythmBreadthTag(upRatio, prevUpRatio, idxChg1d) {
  if (upRatio == null) return null;
  var tags = [];
  if (upRatio > 0.70) tags.push('普涨扩散');
  else if (upRatio >= 0.50 && upRatio <= 0.70) tags.push('宽度修复');
  else if (upRatio >= 0.30 && upRatio < 0.50) tags.push('宽度中性偏弱');
  else if (upRatio < 0.30) tags.push('宽度恶化');
  // 指数强但宽度差
  if (idxChg1d != null && idxChg1d > 0.3 && upRatio < 0.40) tags.push('指数强个股弱');
  // 反包（宽度前日弱、今日强）
  if (prevUpRatio != null && upRatio > 0.55 && prevUpRatio < 0.40) tags.push('宽度反包');
  return tags.length ? tags : null;
}

// ---------- 资金标签 ----------
function rhythmFundingTag(wideFlow, themeFlow) {
  if (wideFlow == null && themeFlow == null) return null;
  var wf = wideFlow != null ? wideFlow : 0;
  var tf = themeFlow != null ? themeFlow : 0;
  var tags = [];
  if (wf > 0 && tf > 0) {
    if (tf > wf) tags.push('主题进攻');
    else tags.push('同步流入');
  } else if (wf > 0 && tf <= 0) {
    tags.push('宽基托底');
  } else if (wf <= 0 && tf > 0) {
    tags.push('被动承接');
  } else {
    tags.push('同步流出');
  }
  // 资金切换：宽基或主题单一方向剧烈（>30亿）且与前一日方向相反
  // （此判断依赖 prev 数据，单独函数处理）
  return tags.length ? tags : null;
}

// ---------- 风格标签 ----------
// 即时计算：用每日指数/ETF 数据对比成长组 vs 价值组、小盘 vs 大盘、进攻 vs 防御
// 返回 ['成长占优', '价值承接'...] 形式
function rhythmStyleTags(klineSummary) {
  if (!klineSummary) return [];
  // 风格组定义：和 STYLE_DIMENSIONS 中"解释层"代理组一致
  var groups = {
    growth: ['000688.SH', '399006.SZ', '159992.SZ'],   // 科创50/创业板指/创新药ETF
    value: ['000016.SH', '000300.SH', '510880.SH'],    // 上证50/沪深300/红利ETF
    small: ['000852.SH', '932000.CSI'],                  // 中证1000/中证2000
    large: ['000016.SH', '000300.SH'],                   // 上证50/沪深300
    attack: ['000688.SH', '515070.SH', '512880.SH', '512400.SH'], // 科创/AI/证券/有色
    defense: ['510880.SH', '518880.SH']                  // 红利/黄金
  };
  function avg(codes) {
    var s = 0, n = 0;
    codes.forEach(function(c) {
      var x = klineSummary[c];
      if (x && x.chg1d != null) { s += x.chg1d; n++; }
    });
    return n > 0 ? s / n : null;
  }
  var g = avg(groups.growth), v = avg(groups.value);
  var l = avg(groups.large), s = avg(groups.small);
  var a = avg(groups.attack), d = avg(groups.defense);
  var tags = [];
  if (g != null && v != null) {
    var gd = g - v;
    if (gd > 0.8) tags.push('成长占优');
    else if (gd < -0.8) tags.push('价值承接');
  }
  if (l != null && s != null) {
    var ls = l - s;
    if (ls > 0.5) tags.push('大盘托底');
    else if (ls < -0.5) tags.push('小盘扩散');
  }
  if (a != null && d != null) {
    var ad = a - d;
    if (ad > 0.8) tags.push('集中抱团');
    else if (ad < -0.8) tags.push('防御占优');
  }
  // 扩散修复：宽度好 + 成交活跃（间接，由 rhythmBreadthTag 已处理；此处保留占位）
  return tags;
}

// ---------- 节奏形态 ----------
/**
 * detectBaseRhythmPattern — 基础节奏判断（覆盖普通交易日）
 * 输入：e（当日）、prev（前一日）、idxChg（当日指数涨跌）、amtVs5d（成交较5日均偏离%）、amt（成交额）、upRatio、prevUpRatio、wideFlow、themeFlow
 * 输出：{ label, text }
 * 6 类：温和修复 / 弱修复 / 温和回调 / 弱回踩 / 平量震荡 / 分歧震荡
 * 强信号未命中时才走基础节奏
 */
function detectBaseRhythmPattern(e, prev, idxChg, amt, amt5dAvg, amtVs5d, upRatio, prevUpRatio, wideFlow, themeFlow) {
  if (idxChg == null || upRatio == null) return null;

  // 成交偏离正常区间：amtVs5d 在 ±5% 内
  var amtStable = amtVs5d != null && Math.abs(amtVs5d) <= 5;

  // 宽度改善判定
  function breadthImproved() {
    if (upRatio == null) return null;
    if (prevUpRatio == null) return upRatio > 0.5;
    return (upRatio - prevUpRatio) > 0.02;
  }
  function breadthDeteriorated() {
    if (upRatio == null || prevUpRatio == null) return null;
    return (prevUpRatio - upRatio) > 0.02;
  }
  // 主题/宽基资金方向
  function themeWideOpposite() {
    if (wideFlow == null || themeFlow == null) return false;
    return (wideFlow > 0 && themeFlow < -10) || (wideFlow < -10 && themeFlow > 0);
  }
  function themeOutflow() {
    return themeFlow != null && themeFlow < -20;
  }

  // 1. 分歧震荡：涨跌窄（-0.5%~0.5%）但宽度或资金方向极端
  if (idxChg >= -0.5 && idxChg <= 0.5) {
    if ((upRatio < 0.45 || upRatio > 0.55) || themeWideOpposite()) {
      return {
        pattern: '分歧震荡',
        label: '分歧震荡',
        text: '指数波动小但宽度或资金方向分裂，未走出统一行情'
      };
    }
  }

  // 2. 平量震荡：±0.3% 内 + 成交稳定
  if (idxChg >= -0.3 && idxChg <= 0.3 && amtStable) {
    return {
      pattern: '平量震荡',
      label: '平量震荡',
      text: '平量震荡，方向未充分选择'
    };
  }

  // 3. 温和修复：涨幅 >0.3%、成交稳定、宽度改善或良好
  if (idxChg > 0.3) {
    var improved = breadthImproved();
    if ((improved != null && improved) || upRatio > 0.5) {
      if (amtStable) {
        return {
          pattern: '温和修复',
          label: '温和修复',
          text: '温和修复，力度仍需资金确认'
        };
      }
    }
  }

  // 4. 弱修复：涨幅 >0.3% 但宽度未改善或资金仍流出
  if (idxChg > 0.3) {
    var improved2 = breadthImproved();
    if ((improved2 != null && !improved2) || themeFlow != null && themeFlow < 0) {
      return {
        pattern: '弱修复',
        label: '弱修复',
        text: '上涨但宽度或资金未跟进，修复质量偏弱'
      };
    }
  }

  // 5. 温和回调：跌幅 >0.3%、成交稳定、宽度未明显恶化
  if (idxChg < -0.3) {
    if (amtStable && (breadthDeteriorated() == null || !breadthDeteriorated())) {
      return {
        pattern: '温和回调',
        label: '温和回调',
        text: '温和回调，宽度未恶化，趋势内整理'
      };
    }
  }

  // 6. 弱回踩：跌幅 >0.3% 但成交未放大、主题资金未明显流出
  if (idxChg < -0.3) {
    var amtNotSurged = amtVs5d == null || amtVs5d < 5;
    if (amtNotSurged && !themeOutflow()) {
      return {
        pattern: '弱回踩',
        label: '弱回踩',
        text: '缩量小幅回踩，未见恐慌，按趋势内观察'
      };
    }
  }

  return null;
}

/**
 * detectRhythmPattern — 基于量价关系推导当日节奏形态（强信号）
 * 输入：entry（当日）、prevEntry（前日）、amt5dAvg（近5日均额·含当日）、amtPrev（前日成交额）、idxChg（当日指数涨跌）
 * 输出：{ pattern, label, text }
 * 优先级：放量反包 > 回调放量 > 放量滞涨 > 缩量修复 > 缩量回踩 > 缩量阴跌
 */
function detectRhythmPattern(entry, prevEntry, amt5dAvg, amtPrev, idxChg) {
  var amt = entry && entry.concentration ? entry.concentration.totalAmount : null;
  var upRatio = entry && entry.market ? entry.market.upRatio : null;
  var prevUpRatio = prevEntry && prevEntry.market ? prevEntry.market.upRatio : null;

  if (amt == null || idxChg == null) return null;

  // 近5日均额对比（含当日）
  var amtVs5d = (amt5dAvg != null && amt5dAvg > 0) ? amt / amt5dAvg : null;
  // 较前日成交额变化
  var amtChg = (amtPrev != null && amtPrev > 0) ? (amt - amtPrev) / amtPrev : null;

  // 前一日涨跌（用于反包/阴跌判断）
  // 优先使用 entry 自身的 idxChgSeries.prevChg1d（_regen.js 注入的 per-entry 数据）
  var prevChg = null;
  if (prevEntry && prevEntry.idxChgSeries && prevEntry.idxChgSeries.idxChg1d != null) {
    prevChg = prevEntry.idxChgSeries.idxChg1d;
  } else if (prevEntry && prevEntry.klineSummary) {
    var pks = prevEntry.klineSummary;
    var pzz = pks['930903.CSI'];
    if (pzz && pzz.chg1d != null) prevChg = pzz.chg1d;
  }

  // 帮助函数：宽度恶化判定（upRatio < 0.35 或较前日下降超过 15 个百分点）
  function breadthBad() {
    if (upRatio == null) return false;
    if (upRatio < 0.35) return true;
    if (prevUpRatio != null && (prevUpRatio - upRatio) > 0.15) return true;
    return false;
  }
  function breadthWeakening() {
    if (prevUpRatio == null || upRatio == null) return false;
    return upRatio < prevUpRatio && (prevUpRatio - upRatio) > 0.05;
  }

  // 1. 放量反包（优先级最高）
  // 条件：前一日下跌、今日上涨、今日涨幅覆盖前一日跌幅 60%+、成交 > 5 日均额
  if (prevChg != null && prevChg < 0 && idxChg > 0 && (-idxChg / prevChg) >= 0.6) {
    if (amtVs5d != null && amtVs5d > 1.0) {
      return {
        pattern: '放量反包',
        label: '放量反包',
        text: '放量反包，分歧后有主动资金承接，次日需确认不是拉高出货'
      };
    }
  }

  // 2. 回调放量
  // 条件：当日下跌，且（成交 > 5日均额的1.05倍 或 成交额较前日增加超过8%）
  if (idxChg < 0) {
    if ((amtVs5d != null && amtVs5d > 1.05) || (amtChg != null && amtChg > 0.08)) {
      return {
        pattern: '回调放量',
        label: '回调放量',
        text: '下跌放量，分歧释放，需观察次日是否承接修复'
      };
    }
  }

  // 3. 放量滞涨
  // 条件：成交 > 5日均额的1.10倍，但指数涨幅 < 0.3%
  if (amtVs5d != null && amtVs5d > 1.10 && idxChg >= 0 && idxChg < 0.3) {
    return {
      pattern: '放量滞涨',
      label: '放量滞涨',
      text: '放量但价格推进不足，上方抛压较重'
    };
  }

  // 4. 缩量修复
  // 条件：当日上涨，但（成交 < 5日均额的0.95倍 或 成交额较前日下降超过8%）
  if (idxChg > 0) {
    if ((amtVs5d != null && amtVs5d < 0.95) || (amtChg != null && amtChg < -0.08)) {
      return {
        pattern: '缩量修复',
        label: '缩量修复',
        text: '上涨缩量，属于修复，不等于趋势确认，次日需要补量'
      };
    }
  }

  // 5. 缩量回踩
  // 条件：当日下跌，成交 < 5日均额的0.95倍，且上涨比例没有明显恶化
  if (idxChg < 0 && amtVs5d != null && amtVs5d < 0.95 && !breadthBad()) {
    return {
      pattern: '缩量回踩',
      label: '缩量回踩',
      text: '缩量回踩，暂按趋势内整理观察'
    };
  }

  // 6. 缩量阴跌
  // 条件：连续两日或以上下跌，成交额未明显放大，上涨比例连续走弱
  if (idxChg < 0 && prevChg != null && prevChg < 0) {
    // 成交未明显放大：amtVs5d < 1.05
    if ((amtVs5d == null || amtVs5d < 1.05) && breadthWeakening()) {
      return {
        pattern: '缩量阴跌',
        label: '缩量阴跌',
        text: '缩量阴跌，不是恐慌出清，而是买盘不足'
      };
    }
  }

  return null;
}

/**
 * buildRhythmPath — 最近 N 个交易日的节奏卡片 + 路径总结 + 路径判断
 * 输入: data（数据索引）, dt（当前日期）, n（5）
 * 输出: { days: [...], summary: '...', tail: '...', judgment: ['趋势延续', ...], pathTags: [...] }
 */
function buildRhythmPath(data, dt, n) {
  n = n || 5;
  var idx = data.dates.indexOf(dt);
  if (idx < 0) return { days: [], summary: '当前日期不在历史中，节奏路径待接入完整历史数据。', tail: '', judgment: [], pathTags: [] };

  // 5 日均值（用于量能对比）
  var amt5dAvg = null;
  var amtValues = [];
  for (var j = Math.max(0, idx - 4); j <= idx; j++) {
    var ej = data.data[data.dates[j]];
    var amtj = ej && ej.concentration ? ej.concentration.totalAmount : null;
    if (amtj != null) amtValues.push(amtj);
  }
  if (amtValues.length > 0) {
    amt5dAvg = amtValues.reduce(function(a, b) { return a + b; }, 0) / amtValues.length;
  }

  // 宽基指数 1d 涨跌（用于节奏形态和"指数强个股弱"判定）
  // 优先使用 中证A股 930903.CSI（接近全市场），其次 沪深300/中证1000/创业板指 等权代理
  function idxChg1d(d) {
    if (!d || !d.klineSummary) return null;
    var ks = d.klineSummary;
    // 1. 中证A股 930903.CSI
    var zz = ks['930903.CSI'];
    if (zz && zz.chg1d != null) return zz.chg1d;
    // 2. 等权代理：沪深300 / 中证1000 / 创业板指
    var codes = ['000300.SH', '000852.SH', '399006.SZ'];
    var s = 0, n = 0;
    codes.forEach(function(c) {
      var x = ks[c];
      if (x && x.chg1d != null) { s += x.chg1d; n++; }
    });
    return n > 0 ? s / n : null;
  }

  var start = Math.max(0, idx - n + 1);
  var days = [];

  for (var i = start; i <= idx; i++) {
    var d = data.dates[i];
    var e = data.data[d];
    if (!e) continue;

    var amt = e.concentration ? e.concentration.totalAmount : null;
    var top100 = e.concentration ? (e.concentration.top100 ? e.concentration.top100.value : null) : null;
    var top10 = e.concentration ? (e.concentration.top10 ? e.concentration.top10.value : null) : null;
    var upRatio = e.market ? e.market.upRatio : null;
    var wideFlow = e.etfWide ? e.etfWide.totalFlow : null;
    var themeFlow = sumThemeFlow(e);

    // 主题最强流入方向
    var topThemeName = null, topThemeFlow = null;
    if (e.etfTheme && e.etfTheme.categories) {
      Object.keys(e.etfTheme.categories).forEach(function(ck) {
        var cat = e.etfTheme.categories[ck];
        if (!cat || !cat.themes) return;
        Object.keys(cat.themes).forEach(function(tk) {
          var t = cat.themes[tk];
          if (t && t.flow != null && isFinite(t.flow)) {
            if (topThemeFlow == null || t.flow > topThemeFlow) {
              topThemeFlow = t.flow;
              topThemeName = tk;
            }
          }
        });
      });
    }

    var prev = i > 0 ? data.data[data.dates[i - 1]] : null;
    var prevUpRatio = prev && prev.market ? prev.market.upRatio : null;
    var prevWideFlow = prev && prev.etfWide ? prev.etfWide.totalFlow : null;
    var prevThemeFlow = prev ? sumThemeFlow(prev) : null;
    var idxChg = idxChg1d(e);

    // 当日 5 日均值的成交额变化
    var amtVs5d = (amt != null && amt5dAvg != null && amt5dAvg > 0) ? (amt - amt5dAvg) / amt5dAvg * 100 : null;

    // 标签分桶
    var amtTags = rhythmAmountTag(amt, amt5dAvg) || [];
    var brdTags = rhythmBreadthTag(upRatio, prevUpRatio, idxChg) || [];
    var fndTag = rhythmFundingTag(wideFlow, themeFlow) || [];
    var styleTags = rhythmStyleTags(e.klineSummary) || [];

    // 资金切换（依赖前一日数据）：宽基或主题方向反转
    var switchTag = null;
    if (wideFlow != null && prevWideFlow != null) {
      if ((wideFlow > 10 && prevWideFlow < -10) || (wideFlow < -10 && prevWideFlow > 10)) switchTag = '资金切换';
    } else if (themeFlow != null && prevThemeFlow != null) {
      if ((themeFlow > 10 && prevThemeFlow < -10) || (themeFlow < -10 && prevThemeFlow > 10)) switchTag = '资金切换';
    }

    // 主标签优先级：资金 > 宽度 > 量能 > 风格（最影响"性质"的优先）
    var primary = (switchTag ? switchTag : (fndTag[0] || brdTags[0] || amtTags[0] || styleTags[0] || '震荡'));
    // 副标签：剩余标签拼成（最多 3 个，用" / "连接）
    var secondary = [];
    [switchTag, fndTag[0], brdTags[0], amtTags[0]].forEach(function(t) {
      if (t && t !== primary && secondary.indexOf(t) < 0) secondary.push(t);
    });
    styleTags.slice(0, 2).forEach(function(t) {
      if (secondary.indexOf(t) < 0) secondary.push(t);
    });
    secondary = secondary.slice(0, 3);

    // 宽度评级（中性偏弱/中性/良好）
    var widthGrade;
    if (upRatio != null) {
      if (upRatio >= 0.55) widthGrade = '良好';
      else if (upRatio >= 0.40) widthGrade = '中性';
      else widthGrade = '偏弱';
    } else widthGrade = '待接入';

    // 一句话解释（不堆数据，给出判断）
    var expl = buildRhythmDayExplain(primary, fndTag[0], wideFlow, themeFlow, upRatio, idxChg, topThemeName, amtVs5d);

    // 节奏形态判断
    // 指数涨跌：用每个 entry 自带的 idxChgSeries（_regen.js 注入，per-entry 取数）
    // 这样历史日期的指数涨跌也能取到，节奏形态可以补全近 2 周
    var useIdxChg = null;
    if (e.idxChgSeries && e.idxChgSeries.idxChg1d != null) {
      useIdxChg = e.idxChgSeries.idxChg1d;
    } else if (data.klineSummary && data.klineSummary['930903.CSI']) {
      // 兜底：若 per-entry 数据不可用，用全局 ks（仅最新日期有意义）
      useIdxChg = data.klineSummary['930903.CSI'].chg1d;
    }
    var prevAmt = prev && prev.concentration ? prev.concentration.totalAmount : null;
    var rp = useIdxChg != null ? detectRhythmPattern(e, prev, amt5dAvg, prevAmt, useIdxChg) : null;

    // 基础节奏判断（强信号未命中时启用）
    var brp = null;
    if (!rp) {
      brp = detectBaseRhythmPattern(e, prev, useIdxChg, amt, amt5dAvg, amtVs5d, upRatio, prevUpRatio, wideFlow, themeFlow);
    }

    days.push({
      date: d,
      label: e.label || d,
      primary: primary,
      secondary: secondary,
      strongRhythmPattern: rp ? rp.label : null,
      strongRhythmPatternText: rp ? rp.text : null,
      baseRhythmPattern: brp ? brp.label : null,
      baseRhythmPatternText: brp ? brp.text : null,
      rhythmPattern: rp ? rp.label : (brp ? brp.label : null),
      rhythmPatternText: rp ? rp.text : (brp ? brp.text : null),
      amount: amt,
      amountVs5d: amtVs5d,
      upRatio: upRatio,
      widthGrade: widthGrade,
      wideFlow: wideFlow,
      themeFlow: themeFlow,
      topTheme: topThemeName ? { name: topThemeName, flow: topThemeFlow } : null,
      styleTags: styleTags,
      top100: top100,
      top10: top10,
      idxChg1d: idxChg,
      explain: expl
    });
  }

  // === 路径总结（三层：标签路径 + 节奏形态 + 因果解释） ===
  var pathTags = days.map(function(d) { return d.primary; });
  var pathStr = pathTags.join(' → ');
  var causal = buildRhythmCausal(days, pathTags);

  // 节奏结论：双层（强信号 + 基础节奏）
  var allPatterns = [];          // 合并展示用
  var strongPatterns = [];       // 强信号集合
  var basePatterns = [];         // 基础节奏集合
  days.forEach(function(d) {
    if (d.strongRhythmPattern) {
      strongPatterns.push(d.strongRhythmPattern);
      allPatterns.push(d.strongRhythmPattern);
    } else if (d.baseRhythmPattern) {
      basePatterns.push(d.baseRhythmPattern);
      allPatterns.push(d.baseRhythmPattern);
    }
  });

  // 强信号/基础分布统计
  var sigCount = strongPatterns.length;
  var baseCount = basePatterns.length;
  var sigRate = days.length > 0 ? (sigCount / days.length) : 0;
  var distributionLine = '';
  if (days.length > 0) {
    var distributionTags = strongPatterns.length > 0
      ? strongPatterns.join('、')
      : '（无强信号）';
    distributionLine = '近 ' + days.length + ' 日出现强信号 ' + sigCount + ' 个（' + distributionTags + '），其余 ' + baseCount + ' 日为基础节奏（' +
      (basePatterns.length > 0 ? Array.from(new Set(basePatterns)).join('、') : '无') +
      '）；说明当前市场' + (sigRate >= 0.3 ? '强趋势信号频繁' : (sigRate >= 0.1 ? '少数日期有强趋势，多数时间处于平量拉锯' : '缺少强趋势信号，整体处于震荡期')) + '。';
  }

  var rhythmConclusion = '';
  if (allPatterns.length > 0) {
    rhythmConclusion = '【节奏形态】' + allPatterns.join(' → ') + '。\n';
    rhythmConclusion += '【节奏结论】' + distributionLine + '\n';

    // 最后一日判断
    var lastDay = days[days.length - 1];
    var lastLabel = lastDay.strongRhythmPattern || lastDay.baseRhythmPattern;
    var lastText = lastDay.strongRhythmPatternText || lastDay.baseRhythmPatternText;
    var lastPrefix = lastDay.strongRhythmPattern ? '强信号' : '基础';
    if (lastLabel && lastText) {
      rhythmConclusion += '今日（' + lastPrefix + '）：' + lastLabel + '，' + lastText + '\n';
    }
  }

  var summary = '【标签路径】' + pathStr + '。\n' + rhythmConclusion + '【因果解释】' + causal;

  // === 路径判断（最终落点） ===
  var judgment = buildRhythmJudgment(days);

  // 尾部标签（保留兼容：原 buildCoreConclusion.tactic 用）
  var tail = days.length > 0 ? days[days.length - 1].primary : '';

  return { days: days, summary: summary, tail: tail, judgment: judgment, pathTags: pathTags };
}

/**
 * 每日一句话解释（不堆数据，给判断）
 */
function buildRhythmDayExplain(primary, fundTag, wideFlow, themeFlow, upRatio, idxChg, topThemeName, amtVs5d) {
  // 关键判断组合
  if (primary === '宽基托底') {
    var tailW = wideFlow != null ? '，宽基+' + wideFlow.toFixed(0) + '亿' : '';
    var themeNote = '';
    if (themeFlow != null) {
      if (themeFlow > 0) themeNote = '，主题' + (themeFlow > 20 ? '接力' : '小幅流入') + '，进攻未尽';
      else if (themeFlow < -20) themeNote = '，但主题撤退' + themeFlow.toFixed(0) + '亿，结构降温';
      else themeNote = '，主题偏弱';
    }
    return '宽基承接明显' + tailW + themeNote;
  }
  if (primary === '主题进攻') {
    return '主题ETF流入强于宽基，结构进攻明确' + (topThemeName ? '，最强方向' + topThemeName : '');
  }
  if (primary === '同步流出') {
    return '宽基与主题同步流出，资金离场，警惕系统性调整';
  }
  if (primary === '同步流入') {
    return '宽基与主题同步流入，全面进攻信号' + (amtVs5d != null && amtVs5d > 5 ? '，且成交放量' : '');
  }
  if (primary === '被动承接') {
    return '宽基流出但主题流入，结构性资金未撤离，但指数层面承压';
  }
  if (primary === '资金切换') {
    return '资金方向反转，主流资金切换中，需观察次日确认';
  }
  if (primary === '宽度恶化') {
    return '宽度恶化，赚钱效应差，' + (idxChg != null && idxChg > 0 ? '指数被权重撑着' : '系统性回调');
  }
  if (primary === '普涨扩散') {
    return '普涨扩散，赚钱效应好，主线多点开花';
  }
  if (primary === '宽度修复') {
    return '宽度从弱修复，前期分化行情或告一段落';
  }
  if (primary === '宽度反包') {
    return '宽度从前日弱势修复至强势，主线情绪转好';
  }
  if (primary === '指数强个股弱') {
    return '指数涨但多数个股跌，行情集中在权重，市场广度差';
  }
  if (primary === '天量') {
    return '成交进入天量级别，市场分歧加剧' + (amtVs5d != null ? '（较5日+' + amtVs5d.toFixed(0) + '%）' : '');
  }
  if (primary === '放量') {
    return '成交活跃放量，' + (upRatio != null && upRatio >= 0.5 ? '配合宽度修复' : '但宽度一般');
  }
  if (primary === '缩量') {
    return '成交萎缩' + (amtVs5d != null ? '（较5日' + amtVs5d.toFixed(0) + '%）' : '') + '，观望情绪上升';
  }
  if (primary === '量能衰减') {
    return '成交大幅萎缩，市场参与度快速下降';
  }
  if (primary === '流动性高位') {
    return '成交处于流动性高位，但' + (upRatio != null && upRatio < 0.5 ? '宽度跟不上，结构分化明显' : '结构尚未恶化');
  }
  if (primary === '成长占优') {
    return '成长风格占优，资金偏好弹性' + (topThemeName === '成长主题' || topThemeName === '科技' ? '' : '');
  }
  if (primary === '价值承接') {
    return '价值风格承接，资金偏好确定性';
  }
  if (primary === '防御占优') {
    return '防御方向抗跌或走强，避险属性凸显';
  }
  if (primary === '小盘扩散') {
    return '小盘弹性扩散，赚钱效应向中小票扩散';
  }
  if (primary === '大盘托底') {
    return '大盘托底，权重股走势强于小盘';
  }
  if (primary === '集中抱团') {
    return '进攻方向集中度高，资金在少数板块抱团';
  }
  return '震荡整理，' + (primary === '震荡' ? '主线待确认' : primary);
}

/**
 * 因果解释生成：基于最近 N 日标签路径，给出"为什么走成这样"
 */
function buildRhythmCausal(days, pathTags) {
  if (days.length === 0) return '数据不足。';
  var last = days[days.length - 1];

  // 统计各标签出现频次
  var fundTags = { '宽基托底': 0, '主题进攻': 0, '同步流出': 0, '同步流入': 0, '被动承接': 0, '资金切换': 0 };
  var brdTags = { '宽度恶化': 0, '普涨扩散': 0, '宽度修复': 0, '宽度反包': 0, '指数强个股弱': 0 };
  days.forEach(function(d) {
    [fundTags, brdTags].forEach(function(map) {
      if (map[d.primary] != null) map[d.primary]++;
    });
  });

  var segs = [];
  // 1. 起始日状态
  var first = days[0];
  if (brdTags['宽度恶化'] > 0 && first.primary === '宽度恶化') {
    segs.push('近5日起步宽度恶化，' + (first.upRatio != null ? '上涨比例仅' + (first.upRatio * 100).toFixed(0) + '%，' : '') + '高位兑现压力显现');
  } else if (brdTags['普涨扩散'] > 0 && first.primary === '普涨扩散') {
    segs.push('近5日起步普涨扩散，赚钱效应良好');
  } else {
    segs.push('近5日起步' + first.primary + '，' + (first.upRatio != null ? '上涨比例' + (first.upRatio * 100).toFixed(0) + '%' : ''));
  }

  // 2. 资金演变
  if (fundTags['资金切换'] >= 2) {
    segs.push('随后资金在宽基与主题之间反复切换' + (fundTags['资金切换'] >= 3 ? '，切换频繁' : ''));
  } else if (fundTags['同步流出'] >= 3) {
    segs.push('资金持续同步流出，离场迹象明显');
  } else if (fundTags['主题进攻'] >= 3) {
    segs.push('主题进攻持续，结构行情明确');
  } else if (fundTags['宽基托底'] >= 3) {
    segs.push('宽基持续托底，被动配置主导');
  }

  // 3. 最新一日定性
  if (last.primary === '宽基托底' && (fundTags['主题进攻'] >= 1 && fundTags['宽基托底'] >= 1)) {
    segs.push('最新一日宽基重新流入但主题进攻弱于宽基，说明行情更像仓位再平衡后的承接，不是全面进攻');
  } else if (last.primary === '主题进攻') {
    segs.push('最新一日主题进攻延续，主线方向明确');
  } else if (last.primary === '同步流出') {
    segs.push('最新一日资金全面撤退，警惕系统性调整');
  } else if (last.primary === '被动承接') {
    segs.push('最新一日结构性资金仍流入但指数承压，主题独自撑盘');
  } else if (last.primary === '资金切换') {
    segs.push('最新一日资金方向反转，主流切换中次日待确认');
  }

  return segs.join('，') + '。';
}

/**
 * 路径判断：从候选枚举中输出 1-2 个最贴近的标签
 * 候选：趋势延续 / 高位兑现 / 仓位再平衡 / 风格切换 / 超跌修复 / 主线退潮 / 主线反包 / 宽基托底
 */
function buildRhythmJudgment(days) {
  if (days.length === 0) return [];
  var last = days[days.length - 1];
  var first = days[0];

  // 统计
  var tagsCount = {};
  days.forEach(function(d) { tagsCount[d.primary] = (tagsCount[d.primary] || 0) + 1; });
  var wndSwitch = (tagsCount['资金切换'] || 0) >= 2;
  var wndWidth = (tagsCount['宽度恶化'] || 0) + (tagsCount['指数强个股弱'] || 0);
  var wndDiffuse = (tagsCount['普涨扩散'] || 0) + (tagsCount['宽度修复'] || 0) + (tagsCount['宽度反包'] || 0);
  var wndOutflow = (tagsCount['同步流出'] || 0);

  // 路径形态特征
  var flowTrend = 0; // 资金方向趋势（>0 = 流入趋势，<0 = 流出趋势）
  days.forEach(function(d) {
    if (d.wideFlow != null) flowTrend += d.wideFlow;
    if (d.themeFlow != null) flowTrend += d.themeFlow;
  });
  var flowTrendYi = flowTrend / 10000; // 转万亿（粗略）

  var widthTrend = 0;
  days.forEach(function(d) { if (d.upRatio != null) widthTrend += d.upRatio; });
  var avgWidth = widthTrend / days.length;

  var judgment = [];

  // 1. 主线反包：宽度反包 + 资金转正
  if (tagsCount['宽度反包'] >= 1 && last.wideFlow != null && last.wideFlow > 0) {
    judgment.push('主线反包');
    return judgment;
  }
  // 2. 超跌修复：宽度从 <30 修复到 >55
  if (days.length >= 3) {
    var minW = Infinity, maxW = -Infinity;
    days.forEach(function(d) { if (d.upRatio != null) { if (d.upRatio < minW) minW = d.upRatio; if (d.upRatio > maxW) maxW = d.upRatio; } });
    if (minW < 0.30 && maxW > 0.55 && last.upRatio > 0.55) {
      judgment.push('超跌修复');
      return judgment;
    }
  }
  // 3. 高位兑现：连续 3 日以上宽度恶化 + 资金撤
  if (wndWidth >= 3 && wndOutflow >= 2) {
    judgment.push('高位兑现');
    return judgment;
  }
  // 4. 主线退潮：宽度恶化 + 主题资金连续净流出
  var themeFlowTrend = days.reduce(function(s, d) { return s + (d.themeFlow || 0); }, 0);
  if (wndWidth >= 2 && themeFlowTrend < -100) {
    judgment.push('主线退潮');
    return judgment;
  }
  // 5. 风格切换：最近 5 日风格标签由一类切到另一类（成长→价值 或 反之）
  var styleShift = false;
  var earlyStyles = days.slice(0, 2).map(function(d) { return d.styleTags.join(','); }).join('|');
  var lateStyles = days.slice(-2).map(function(d) { return d.styleTags.join(','); }).join('|');
  if (earlyStyles && lateStyles && earlyStyles !== lateStyles) {
    var hasGrowth = /成长占优/.test(earlyStyles) && /价值承接|防御占优/.test(lateStyles);
    var hasValue = /价值承接|防御占优/.test(earlyStyles) && /成长占优/.test(lateStyles);
    if (hasGrowth || hasValue) {
      judgment.push('风格切换');
    }
  }
  // 6. 宽基托底：最新一日宽基承接 + 历史非全面进攻
  if (last.primary === '宽基托底') {
    judgment.push('宽基托底');
    if (wndSwitch) judgment.push('仓位再平衡');
    return judgment;
  }
  // 7. 仓位再平衡：宽基/主题反复切换
  if (wndSwitch && (tagsCount['宽基托底'] || 0) >= 1 && (tagsCount['主题进攻'] || 0) >= 1) {
    judgment.push('仓位再平衡');
    return judgment;
  }
  // 8. 趋势延续：5 日路径无剧烈震荡，方向连续
  // 简单：宽度好 + 资金流入 + 无极端标签
  if (avgWidth > 0.5 && flowTrendYi > 0 && wndOutflow === 0 && wndWidth === 0) {
    judgment.push('趋势延续');
    return judgment;
  }
  // 兜底：根据最新一日 + 整体方向给一个
  if (judgment.length === 0) {
    if (last.primary === '震荡') judgment.push('趋势延续');  // 震荡路径默认"延续"
    else judgment.push(last.primary);
  }
  return judgment;
}

// ============ 模块 5：资金分层 ============

/**
 * calculateFundingLayers — 按资金属性分层
 * 返回 [{ layer, meaning, flow1d, flow5d, detail, judgment, missing[] }]
 */
function calculateFundingLayers(entry, data, dt) {
  var layers = [];

  // 1. 宽基ETF
  var wideFlow = entry.etfWide ? entry.etfWide.totalFlow : null;
  var wide5d = (data && data.dates) ? calcWindowSum(data, dt, function(e){ return e.etfWide ? e.etfWide.totalFlow : null; }, 5) : null;
  var wideJ = '待接入';
  if (wideFlow != null) {
    if (wideFlow > 30) wideJ = '宽基大幅流入，指数托底或被动配置活跃';
    else if (wideFlow > 0) wideJ = '宽基小幅流入，被动配置温和';
    else if (wideFlow > -30) wideJ = '宽基小幅流出，仓位再平衡';
    else wideJ = '宽基大幅流出，警惕指数拖累';
  }
  layers.push({
    layer: '宽基ETF', meaning: '指数托底 / 被动配置 / 仓位再平衡',
    flow1d: wideFlow, flow5d: wide5d ? wide5d.sum : null,
    detail: '', judgment: wideJ,
    missing: wideFlow == null ? ['宽基ETF净流入'] : []
  });

  // 2. 行业主题ETF
  var themeTotal = 0, themeCount = 0;
  var strongestTheme = null, strongestFlow = -Infinity;
  if (entry.etfTheme && entry.etfTheme.categories) {
    Object.keys(entry.etfTheme.categories).forEach(function(ck) {
      var cat = entry.etfTheme.categories[ck];
      if (!cat || !cat.themes) return;
      Object.keys(cat.themes).forEach(function(tk) {
        var f = cat.themes[tk].flow;
        if (f != null && isFinite(f)) {
          themeTotal += f; themeCount++;
          if (f > strongestFlow) { strongestFlow = f; strongestTheme = tk; }
        }
      });
    });
  }
  var themeFlow = themeCount > 0 ? themeTotal : null;
  var theme5d = calcWindowSum(data, dt, function(e) {
    if (!e.etfTheme || !e.etfTheme.categories) return null;
    var s = 0, n = 0;
    Object.keys(e.etfTheme.categories).forEach(function(ck) {
      var cat = e.etfTheme.categories[ck];
      if (!cat || !cat.themes) return;
      Object.keys(cat.themes).forEach(function(tk) {
        var f = cat.themes[tk].flow;
        if (f != null && isFinite(f)) { s += f; n++; }
      });
    });
    return n > 0 ? s : null;
  }, 5);
  var themeJ = '待接入';
  if (themeFlow != null) {
    if (themeFlow > 20 && strongestTheme) themeJ = '主题资金主动进攻，最强方向：' + strongestTheme;
    else if (themeFlow > 0) themeJ = '主题资金小幅流入，结构进攻温和';
    else if (themeFlow > -20) themeJ = '主题资金小幅流出，结构降温';
    else themeJ = '主题资金明显转弱';
  }
  layers.push({
    layer: '行业主题ETF', meaning: '主线选择 / 结构进攻',
    flow1d: themeFlow, flow5d: theme5d ? theme5d.sum : null,
    detail: strongestTheme ? '最强流入：' + strongestTheme : '',
    judgment: themeJ,
    missing: themeFlow == null ? ['主题ETF净流入'] : []
  });

  // 3. 融资资金 — normalize.js 提供两个单位：
  //    margin.value 单位：万亿元；margin.chg 单位：百分比（如 +0.19 表示 +0.19%）
  //    margin.chgYi 单位：亿元（较前日真实变化，新增字段）
  var mg = entry.margin || {};
  var mgJ = '待接入';
  // 当日变化：优先使用 chgYi（亿元，真实变化），回退到 chg（百分比）
  var mgDailyYi = mg.chgYi != null ? mg.chgYi : null;      // 亿元
  var mgDailyPct = mg.chg != null ? mg.chg : null;          // 百分比

  // 5 日累计融资变化（亿元）：优先用 calcWindowChange 端到端差额（更稳健，受单日跳变影响小）
  // 与风险底色/核心结论里的 mg5dAbsYi 口径保持一致，避免多口径打架
  var mg5dYi = null;
  if (data && dt) {
    var mg5dWan = calcWindowChange(data, dt, function(e){ return e && e.margin ? e.margin.value : null; }, 5);
    mg5dYi = mg5dWan != null ? mg5dWan * 10000 : null;  // 万亿→亿
  }
  // 备用口径：每日 chgYi 求和（数据点更多时更准）
  var mg5dSumYi = null;
  if (data && dt && mg.chgYi != null) {
    var mg5 = calcWindowSum(data, dt, function(e){ return e && e.margin ? e.margin.chgYi : null; }, 5);
    if (mg5 && mg5.days >= 3) mg5dSumYi = mg5.sum;
  }

  if (mg.value != null) {
    if (mgDailyYi != null) {
      // 有真实亿元变化（fmtFlow 对正数加 +，下降时用绝对值不带 +）
      if (mgDailyYi > 0) mgJ = '融资余额上升 ' + fmtFlow(mgDailyYi) + ' 亿元，风险偏好改善';
      else if (mgDailyYi < 0) mgJ = '融资余额下降 ' + Math.abs(mgDailyYi).toFixed(0) + ' 亿元，风险偏好回落';
      else mgJ = '融资余额持平';
    } else if (mgDailyPct != null) {
      // 只有百分比
      if (mgDailyPct > 0) mgJ = '融资余额较前日 +' + mgDailyPct.toFixed(2) + '%，风险偏好改善';
      else if (mgDailyPct < 0) mgJ = '融资余额较前日 ' + mgDailyPct.toFixed(2) + '%，风险偏好回落';
      else mgJ = '融资余额持平';
    } else {
      mgJ = '融资余额待接入较前日变化';
    }
    // 5日累计定性（用端到端差额口径）
    // 注意：净偿还时显示绝对值，不带 + 号（fmtFlow 会给正数加 +，语义冲突）
    if (mg5dYi != null) {
      var mg5Abs = Math.abs(mg5dYi).toFixed(0);
      if (mg5dYi > 300) mgJ += '，5日累计净流入 ' + fmtFlow(mg5dYi) + ' 亿，杠杆加速入场';
      else if (mg5dYi > 0) mgJ += '，5日累计净流入 ' + fmtFlow(mg5dYi) + ' 亿，风险偏好延续';
      else if (mg5dYi > -200) mgJ += '，5日累计净偿还 ' + mg5Abs + ' 亿，小幅去杠杆';
      else mgJ += '，5日累计净偿还 ' + mg5Abs + ' 亿，杠杆明显去化';
    } else if (mg.trend5d) {
      // 5日累计算不出来时退回方向描述
      mgJ += '，5日趋势' + (mg.trend5d === 'up' ? '上升' : mg.trend5d === 'down' ? '下降' : '平稳');
    }
  }
  layers.push({
    layer: '融资资金', meaning: '风险偏好 / 弹性资金',
    flow1d: mgDailyYi, // 亿元（用于表格统一显示）
    flow5d: mg5dYi,    // 5日累计净变化（亿元，端到端差额口径）
    detail: mg.value != null ? '余额 ' + mg.value.toFixed(4) + ' 万亿元' + (mgDailyPct != null ? '（较前日 ' + (mgDailyPct >= 0 ? '+' : '') + mgDailyPct.toFixed(2) + '%）' : '') : '',
    judgment: mgJ,
    missing: mg.value == null ? ['融资余额'] : []
  });

  // 4. 情绪资金
  var m = entry.market || {};
  var limitUp = m.limitUp, limitDown = m.limitDown;
  var maxBoard = m.maxConsecutiveBoard;
  var emoJ = '待接入';
  var emoStatus = null;
  var emoMissing = [];
  if (limitUp == null) emoMissing.push('涨停数');
  if (limitDown == null) emoMissing.push('跌停数');
  if (maxBoard == null) emoMissing.push('连板高度');

  if (limitUp != null && limitDown != null) {
    // 情绪状态判断（初版规则）
    var emoStatus = '';
    var upMore = limitUp > limitDown * 2;        // 涨停明显多于跌停
    var dnMore = limitDown > limitUp * 0.5 && limitDown > 30; // 跌停明显多
    if (upMore && !dnMore) emoStatus = '情绪修复';
    else if (dnMore && !upMore) emoStatus = '情绪退潮';
    else if (limitUp > 50 && limitDown > 50) emoStatus = '分歧加大';
    else emoStatus = '情绪平稳';

    var parts = ['涨停 ' + limitUp + ' / 跌停 ' + limitDown];
    if (maxBoard != null) parts.push('最高 ' + maxBoard + ' 连板');
    parts.push(emoStatus);
    emoJ = parts.join('，');
    // 数据状态备注
    if (m.limitDataStatus === 'partial') {
      emoJ += '（' + (m.limitNote || '数据未完全排除ST') + '）';
    }
  } else if (limitUp != null || limitDown != null) {
    emoJ = '涨停 ' + (limitUp != null ? limitUp : '待接入') + ' / 跌停 ' + (limitDown != null ? limitDown : '待接入') + '，连板高度' + (maxBoard != null ? maxBoard + '连板' : '待接入');
  }

  layers.push({
    layer: '情绪资金', meaning: '涨停 / 跌停 / 连板高度',
    flow1d: null, flow5d: null,
    limitUp: limitUp,
    limitDown: limitDown,
    emoStatus: (limitUp != null && limitDown != null) ? emoStatus : null,
    detail: maxBoard != null ? '最高连板 ' + maxBoard : '',
    judgment: emoJ,
    missing: emoMissing
  });

  // 资金分层总结 — 结合风格罗盘，不只描述数据，要表达资金意图
  // 集中收敛：原内联于 renderStructuralReview 的 fundingSummary 逻辑
  var wideF = layers[0].flow1d;
  var themeF = layers[1].flow1d;
  var summary = '';
  if (wideF != null && themeF != null) {
    if (wideF < 0 && themeF > 0) {
      summary = '宽基流出但主题流入，说明资金不是离场，而是在压缩非主线，主动选择成长/科技方向进攻。';
    } else if (wideF > 0 && themeF > 0) {
      if (wideF > themeF) {
        summary = '宽基和主题同步流入，但宽基强于主题，说明资金更偏承接和防守，不是无差别进攻。';
      } else {
        summary = '宽基和主题同步流入，主题强于宽基，结构进攻明确，仓位可适度积极。';
      }
    } else if (wideF < 0 && themeF < 0) {
      summary = '宽基和主题同步流出，资金离场迹象，警惕系统性调整。';
    } else {
      summary = '宽基流入但主题流出，资金转向防御或被动配置，结构进攻性下降。';
    }
  }

  return { layers: layers, summary: summary };
}

// ============ 模块 6：指数验证矩阵 ============

/**
 * buildIndexValidationMatrix — 四组指数
 * 返回 [{ group, validationFocus, items: [{ code, name, chg1d, chg5d, chg20d, weekly34, role }] }]
 */
var INDEX_GROUPS = [
  {
    group: '成长组',
    validationFocus: '成长vs价值（成长端）',
    items: [
      { code: '399006.SZ', name: '创业板指' },
      { code: '000688.SH', name: '科创50' },
      { code: '000698.SH', name: '科创100' }
    ]
  },
  {
    group: '价值权重组',
    validationFocus: '成长vs价值（价值端）',
    items: [
      { code: '000300.SH', name: '沪深300' },
      { code: '000016.SH', name: '上证50' },
      { code: null,        name: '中证A500', altCode: null, note: '（market.indices 已有，但无独立 code 字段，按ETF数据近似）' }
    ]
  },
  {
    group: '小盘弹性组',
    validationFocus: '集中vs扩散（小盘扩散端）',
    items: [
      { code: '000852.SH', name: '中证1000' },
      { code: '932000.CSI', name: '中证2000' },
      { code: null,        name: '微盘股指数', placeholder: '待接入' }
    ]
  },
  {
    group: '防御周期组',
    validationFocus: '进攻vs防御（防御端）',
    items: [
      { code: null, name: '中证红利', altEtf: '510880.SH', note: '红利ETF代理' },
      { code: null, name: '有色金属指数', altEtf: '512400.SH', note: '有色金属ETF代理' },
      { code: null, name: '证券指数', altEtf: '512880.SH', note: '证券ETF代理' },
      { code: null, name: '创新药指数', altEtf: '159992.SZ', note: '创新药ETF代理' }
    ]
  }
];

/**
 * buildIndexValidationMatrix — 验证矩阵 v2（紧凑复核版）
 * 列：验证维度 / 代表指数 / 当日涨跌 / 5日涨跌 / 相对全A / 34周线状态 / 验证结论
 * 返回的 items 中字段：code / name / chg1d / chg5d / vsFullA / weekly34Status / weekly34Text / missing
 */
function buildIndexValidationMatrix(entry, data, dt) {
  // 中证A股 chg1d 作为"相对全A"参考
  var fullAChg = null;
  if (data.klineSummary && data.klineSummary['930903.CSI']) {
    fullAChg = data.klineSummary['930903.CSI'].chg1d;
  }

  return INDEX_GROUPS.map(function(g) {
    var items = g.items.map(function(it) {
      var chg1d = null, chg5d = null;
      var weekly34Status = null;
      var weekly34Text = '—';
      var missing = [];
      var stale = false;
      var dataAsOf = null;

      var code = it.code;
      if (!code && it.altEtf) code = it.altEtf;
      if (code && data.klineSummary && data.klineSummary[code]) {
        var k = data.klineSummary[code];
        if (k.latestDate && k.latestDate !== dt) {
          stale = true;
          dataAsOf = k.latestDate;
          chg1d = null; chg5d = null;
        } else {
          chg1d = k.chg1d; chg5d = k.chg5d;
        }
      }
      if (chg1d == null && !stale && entry.market && entry.market.indices) {
        for (var i = 0; i < entry.market.indices.length; i++) {
          if (entry.market.indices[i].name === it.name) {
            chg1d = entry.market.indices[i].chg;
            break;
          }
        }
      }
      if (code && data.weeklyMA34 && data.weeklyMA34[code]) {
        var w = data.weeklyMA34[code];
        weekly34Status = w.status;
        weekly34Text = w.status;
      }
      if (it.placeholder) missing.push(it.placeholder);

      var vsFullA = (chg1d != null && fullAChg != null) ? (chg1d - fullAChg) : null;

      return {
        code: it.code, name: it.name,
        chg1d: chg1d, chg5d: chg5d,
        vsFullA: vsFullA,
        weekly34Status: weekly34Status,
        weekly34Text: weekly34Text,
        missing: missing,
        note: it.note || '',
        dataAsOf: dataAsOf,
        stale: stale
      };
    });
    return { group: g.group, validationFocus: g.validationFocus || '', items: items };
  });
}

/**
 * buildIndexMatrixConclusion — 每组出"支持/不支持/分歧 + 原因"验证结论
 * 五维度：成长vs价值 / 大盘vs小盘 / 进攻vs防御 / 集中vs扩散 / 主题vs宽基
 */
function firstName(grp) {
  if (!grp || !grp.items || grp.items.length === 0) return '--';
  return grp.items[0].name || grp.items[0].code || '--';
}

function buildIndexMatrixConclusion(indexMatrix, entry, data) {
  // 动态获取 kline 最新日期（格式化为 MM/DD）
  var klineAsOf = '';
  if (data && data.klineSummary) {
    var latestRaw = null;
    for (var code in data.klineSummary) {
      var k = data.klineSummary[code];
      if (k.latestDateRaw) { latestRaw = k.latestDateRaw; break; }
      if (k.latestDate) { latestRaw = k.latestDate; break; }
    }
    if (latestRaw) {
      // YYYYMMDD 或 YYYY-MM-DD → MM/DD
      var clean = latestRaw.replace(/-/g, '');
      if (clean.length === 8) klineAsOf = clean.slice(4, 6) + '/' + clean.slice(6, 8);
    }
  }
  var dateTag = klineAsOf ? '数据截至 ' + klineAsOf : '数据待确认';
  function avgChg(grp) {
    if (!grp || !grp.items) return null;
    var s = 0, n = 0;
    grp.items.forEach(function(it){ if (it.chg1d != null) { s += it.chg1d; n++; } });
    return n > 0 ? s / n : null;
  }
  function statusOf(grp) {
    if (!grp) return null;
    for (var i = 0; i < grp.items.length; i++) {
      if (grp.items[i].weekly34Status) return grp.items[i].weekly34Status;
    }
    return null;
  }
  var growthGrp = indexMatrix.find(function(g){ return g.group==='成长组'; });
  var valueGrp = indexMatrix.find(function(g){ return g.group==='价值权重组'; });
  var smallGrp = indexMatrix.find(function(g){ return g.group==='小盘弹性组'; });
  var defenseGrp = indexMatrix.find(function(g){ return g.group==='防御周期组'; });
  var gAvg = avgChg(growthGrp), vAvg = avgChg(valueGrp), sAvg = avgChg(smallGrp), dAvg = avgChg(defenseGrp);
  var gStatus = statusOf(growthGrp), vStatus = statusOf(valueGrp), sStatus = statusOf(smallGrp), dStatus = statusOf(defenseGrp);
  var gName = firstName(growthGrp), vName = firstName(valueGrp), sName = firstName(smallGrp), dName = firstName(defenseGrp);

  // 维度1：成长 vs 价值
  // 当 chg1d 全缺失时，基于 34 周线 status 给出定性结论
  var growthVsValue = '数据不足';
  if (gAvg != null && vAvg != null) {
    var gv = gAvg - vAvg;
    if (gv < -0.5) {
      growthVsValue = '支持价值风格：' + vName + '当日强于' + gName + '（' + fmtPct(vAvg - gAvg) + '）';
      if (gStatus === '强势上方' || gStatus === '回踩观察') growthVsValue += '，但' + gName + '仍处34周线' + gStatus + '，短线分歧未破中期';
    } else if (gv > 0.5) {
      growthVsValue = '支持成长风格：' + gName + '当日强于' + vName + '（' + fmtPct(gv) + '）';
      if (vStatus === '反抽不过' || vStatus === '中期弱势') growthVsValue += '，但' + vName + '仍在34周线下方，防御属性弱';
    } else {
      growthVsValue = '分歧：成长' + gName + '与价值' + vName + '基本持平（差' + Math.abs(gv).toFixed(2) + '%）';
    }
  } else if (gStatus || vStatus) {
    // chg1d 缺失场景：基于 34 周线判断
    if (gStatus === '强势上方' && (vStatus === '反抽不过' || vStatus === '中期弱势')) {
      growthVsValue = '分歧：当日涨跌待确认（' + dateTag + '），但成长' + gName + '稳在 34 周线上方（' + gStatus + '），价值' + vName + '仍在下方（' + vStatus + '）';
    } else if (gStatus === '反抽不过' && vStatus === '强势上方') {
      growthVsValue = '分歧：当日涨跌待确认（' + dateTag + '），成长' + gName + '在 34 周线下方（' + gStatus + '），价值' + vName + '在 34 周线上方';
    } else {
      growthVsValue = '分歧：当日涨跌待确认（' + dateTag + '），成长 34 周线状态=' + (gStatus || '—') + '，价值=' + (vStatus || '—');
    }
  }

  // 维度2：大盘 vs 小盘
  var largeVsSmall = '数据不足';
  if (vAvg != null && sAvg != null) {
    var ls = vAvg - sAvg;
    if (ls > 0.5) {
      largeVsSmall = '支持大盘占优：' + vName + '（大盘代理）当日强于' + sName + '（小盘代理）（' + fmtPct(ls) + '）';
      if (sStatus === '强势上方') largeVsSmall += '，但' + sName + '仍处34周线上方，扩散潜力仍在';
    } else if (ls < -0.5) {
      largeVsSmall = '支持小盘扩散：' + sName + '当日强于' + vName + '（' + fmtPct(-ls) + '）';
    } else {
      largeVsSmall = '分歧：大小盘表现接近（差' + Math.abs(ls).toFixed(2) + '%）';
    }
  } else if (vStatus || sStatus) {
    largeVsSmall = '分歧：当日涨跌待确认（' + dateTag + '），大盘 34 周线=' + (vStatus || '—') + '，小盘=' + (sStatus || '—');
  }

  // 维度3：进攻 vs 防御（用防御周期组代理）
  var attackVsDefense = '数据不足';
  if (gAvg != null && dAvg != null) {
    var ad = gAvg - dAvg;
    if (ad > 0.5) {
      attackVsDefense = '支持进攻方向：成长组' + gName + '强于防御周期组' + dName + '（' + fmtPct(ad) + '）';
      if (dStatus === '反抽不过' || dStatus === '中期弱势') attackVsDefense += '，但' + dName + '仍在34周线下方，防御偏弱';
    } else if (ad < -0.5) {
      attackVsDefense = '支持防御方向：' + dName + '强于' + gName + '（' + fmtPct(-ad) + '）';
      if (dStatus === '强势上方') attackVsDefense += '，但' + dName + '已进入34周线上方，非简单反抽';
      else attackVsDefense += '，暂按反抽处理，不宜直接定义为主升';
    } else {
      attackVsDefense = '分歧：进攻与防御接近（差' + Math.abs(ad).toFixed(2) + '%）';
    }
  } else if (gStatus || dStatus) {
    attackVsDefense = '分歧：当日涨跌待确认（' + dateTag + '），进攻 34 周线=' + (gStatus || '—') + '，防御=' + (dStatus || '—');
  }

  // 维度4：集中 vs 扩散
  var breadth = entry && entry.market ? entry.market.upRatio : null;
  var top100 = entry && entry.concentration && entry.concentration.top100 ? entry.concentration.top100.value : null;
  var focusVsDiff = '数据不足';
  if (breadth != null && top100 != null) {
    if (top100 >= 27 && breadth < 0.45) {
      focusVsDiff = '支持集中抱团：TOP100占比' + top100.toFixed(1) + '%偏高，但上涨比例仅' + (breadth * 100).toFixed(0) + '%，赚钱效应差';
    } else if (top100 < 22 && breadth > 0.6) {
      focusVsDiff = '支持扩散修复：TOP100占比' + top100.toFixed(1) + '%，上涨比例' + (breadth * 100).toFixed(0) + '%，资金广度好';
    } else {
      focusVsDiff = '分歧：TOP100=' + top100.toFixed(1) + '%，上涨比例=' + (breadth * 100).toFixed(0) + '%，集中/扩散信号不一致';
    }
  }

  // 维度5：主题 vs 宽基
  var wideFlow = entry && entry.etfWide ? entry.etfWide.totalFlow : null;
  var themeFlowDay = 0, themeFlowHas = false;
  if (entry && entry.etfTheme && entry.etfTheme.categories) {
    Object.values(entry.etfTheme.categories).forEach(function(cat){
      Object.values(cat.themes || {}).forEach(function(t){
        if (t && t.flow != null && isFinite(t.flow)) { themeFlowDay += t.flow; themeFlowHas = true; }
      });
    });
  }
  if (!themeFlowHas) themeFlowDay = null;
  var themeVsBroad = '数据不足';
  if (wideFlow != null && themeFlowDay != null) {
    if (themeFlowDay > 0 && wideFlow < 0) {
      themeVsBroad = '支持结构行情：主题ETF净流入' + fmtFlow(themeFlowDay) + '亿、宽基ETF净流出' + fmtFlow(Math.abs(wideFlow)) + '亿，资金在结构内切换而非全面撤退';
    } else if (themeFlowDay > 0 && wideFlow > 0) {
      themeVsBroad = '支持全面进攻：主题+宽基同步流入（主题' + fmtFlow(themeFlowDay) + '亿、宽基' + fmtFlow(wideFlow) + '亿）';
    } else if (themeFlowDay < 0 && wideFlow < 0) {
      themeVsBroad = '不支持反弹：主题宽基同步流出（主题' + fmtFlow(themeFlowDay) + '亿、宽基' + fmtFlow(wideFlow) + '亿），资金全面撤退';
    } else {
      themeVsBroad = '分歧：主题' + fmtFlow(themeFlowDay) + '亿、宽基' + fmtFlow(wideFlow) + '亿，方向不一致';
    }
  }

  return [
    { dim: '成长 vs 价值', conclusion: growthVsValue },
    { dim: '大盘 vs 小盘', conclusion: largeVsSmall },
    { dim: '进攻 vs 防御', conclusion: attackVsDefense },
    { dim: '集中 vs 扩散', conclusion: focusVsDiff },
    { dim: '主题 vs 宽基', conclusion: themeVsBroad }
  ];
}

// ============ 模块 8：事件解释 ============

function buildEventInterpretation(currentDt) {
  // 临时数据，后续接入真实事件日历
  var dt = currentDt || ''; // 当前复盘日期，用于判断过去/未来
  var events = [
    { date: '2026-07-15', event: '美国CPI数据公布', impact: '有色资源', riskType: '波动放大', eventNature: '流动性扰动', trendChange: '不直接证伪，需观察美元走势' },
    { date: '2026-07-20', event: 'LPR报价日', impact: '全市场', riskType: '方向选择', eventNature: '流动性扰动', trendChange: '通常不改变趋势，但影响短期节奏' },
    { date: '2026-07-24', event: '中央政治局会议', impact: '全市场', riskType: '主线强化 / 主线证伪', eventNature: '产业验证', trendChange: '可能强化或证伪当前主线，需重点跟踪' },
    { date: '2026-07-31', event: '7月PMI数据发布', impact: '科技成长,消费价值', riskType: '方向选择', eventNature: '产业验证', trendChange: '不直接证伪，但影响基本面预期' },
    { date: '2026-07-28', event: '中报密集披露期', impact: '全市场', riskType: '利好兑现 / 利空落地', eventNature: '利好兑现', trendChange: '高位品种可能兑现，低位品种可能修复' },
    { date: '2026-06-30', event: '季度末仓位再平衡', impact: '宽基/科技', riskType: '波动放大', eventNature: '仓位再平衡', trendChange: '通常是短期扰动，不改变中期趋势' }
  ];
  // 增加 status 字段：已发生 / 未来（依据 currentDt 判断）
  // 按 date 升序输出，过去事件在前（已是已发生扰动），未来事件在后
  return events.map(function(ev) {
    var status = (dt && ev.date <= dt) ? '已发生' : '未来';
    return Object.assign({}, ev, { status: status });
  }).sort(function(a, b) {
    if (a.status !== b.status) return a.status === '已发生' ? -1 : 1;
    return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
  });
}

// ============ 模块 9：明日/下周验证条件（三层）============

function buildValidationPlan(entry, compass, indexMatrix, sectorCycles) {
  var plans = [];

  // 1. 风格验证
  var growthD = compass.find(function(d){ return d.key==='growthVsValue'; });
  var themeD = compass.find(function(d){ return d.key==='themeVsBroad'; });
  var concD = compass.find(function(d){ return d.key==='concentrationVsDiffusion'; });
  plans.push({
    layer: '风格验证',
    items: [
      {
        confirm: '成长组继续强于价值组（当前 ' + styleBias(growthD, growthD.score) + '）',
        fail: '价值组反超成长组，且持续 2 个交易日',
        action: growthD.score > 0.1 ? '提高进攻性' : growthD.score < -0.1 ? '降低追高' : '继续跟踪'
      },
      {
        confirm: '主题ETF 继续强于宽基ETF（当前 ' + styleBias(themeD, themeD.score) + '）',
        fail: '宽基ETF 反超主题ETF，主题资金转弱',
        action: themeD.score > 0.1 ? '维持结构进攻' : themeD.score < -0.1 ? '防守观察' : '继续跟踪'
      },
      {
        confirm: '集中度下降带来扩散（当前 ' + styleBias(concD, concD.score) + '）',
        fail: '集中度持续上升，赚钱效应继续恶化',
        action: concD.score < -0.1 ? '提高进攻性（扩散利于赚钱效应）' : concD.score > 0.3 ? '防守观察（过度集中有风险）' : '继续跟踪'
      }
    ]
  });

  // 2. 指数验证（取关键指数）
  var growthGrp = indexMatrix.find(function(g){ return g.group==='成长组'; });
  var smallGrp = indexMatrix.find(function(g){ return g.group==='小盘弹性组'; });
  var valueGrp = indexMatrix.find(function(g){ return g.group==='价值权重组'; });
  function findItem(grp, name) { return grp && grp.items ? grp.items.find(function(it){ return it.name === name; }) : null; }
  var chuangye = findItem(growthGrp, '创业板指');
  var ke50 = findItem(growthGrp, '科创50');
  var hs300 = findItem(valueGrp, '沪深300');
  var zz1000 = findItem(smallGrp, '中证1000');

  plans.push({
    layer: '指数验证',
    items: [
      {
        confirm: '创业板指和科创50 守住关键趋势' + (chuangye && chuangye.chg1d != null ? '（当前 ' + fmtPct(chuangye.chg1d) + '）' : ''),
        fail: '创业板指或科创50 跌破近期低点',
        action: chuangye && chuangye.chg1d != null && chuangye.chg1d > 0 ? '继续跟踪' : '等待回踩'
      },
      {
        confirm: '沪深300 不继续拖累' + (hs300 && hs300.chg1d != null ? '（当前 ' + fmtPct(hs300.chg1d) + '）' : ''),
        fail: '沪深300 加速下跌，拖累全市场风险偏好',
        action: hs300 && hs300.chg1d != null && hs300.chg1d < -1 ? '防守观察' : '继续跟踪'
      },
      {
        confirm: '中证1000 补涨扩散' + (zz1000 && zz1000.chg1d != null ? '（当前 ' + fmtPct(zz1000.chg1d) + '）' : ''),
        fail: '中证1000 持续弱于大盘指数，扩散失败',
        action: zz1000 && zz1000.chg5d != null && zz1000.chg5d > 0 ? '提高进攻性' : '等待回踩'
      }
    ]
  });

  // 3. 主题验证（取生命周期明确的结构项）
  var main = sectorCycles.filter(function(s){ return s && s.phase && s.phase !== '待接入数据'; }).slice(0, 5);
  plans.push({
    layer: '主题验证',
    items: main.map(function(s) {
      var act = '继续跟踪';
      if (s.phase === '主升' || s.phase === '扩散') act = '提高进攻性，但注意兑现风险';
      else if (s.phase === '启动') act = '等待回踩后验证';
      else if (s.phase === '分歧' || s.phase === '兑现') act = '降低追高，观察一致性修复';
      else if (s.phase === '退潮') act = '主题失效，转向防御';
      return {
        confirm: s.name + '：' + s.confirm,
        fail: s.name + '：' + s.fail,
        action: act
      };
    })
  });

  return plans;
}

// ============ 风格落点说明（主题承载卡上方）============

/**
 * buildStyleLanding — 基于结构项生命周期 + 风格罗盘，生成一句风格落点
 * 示例："科技成长进入兑现观察，创新药成为成长内部修复分支，红利/宽基承接偏防御。"
 */
function buildStyleLanding(sectorCycles, compass) {
  var parts = [];

  // 找各结构项的当前阶段
  function phaseOf(name) {
    var s = sectorCycles.find(function(x){ return x.name === name; });
    return s ? s.phase : null;
  }
  var tech = phaseOf('科技成长');
  var pharm = phaseOf('创新药');
  var consume = phaseOf('消费价值');
  var div = phaseOf('红利防御');
  var broker = phaseOf('券商金融');
  var metal = phaseOf('有色资源');
  var micro = phaseOf('微盘小票');

  // 科技成长
  if (tech) {
    if (tech === '兑现' || tech === '分歧') parts.push('科技成长进入兑现观察');
    else if (tech === '主升') parts.push('科技成长仍在主升');
    else if (tech === '扩散' || tech === '启动') parts.push('科技成长保持活跃');
    else if (tech === '退潮') parts.push('科技成长退潮');
    else if (tech.indexOf('待确认') >= 0) parts.push('科技成长资金流入但价格待确认');
  }
  // 创新药（成长内部修复分支判断）
  if (pharm) {
    if (pharm === '主升' || pharm === '扩散') parts.push('创新药成为成长内部强势分支');
    else if (pharm === '启动' || pharm.indexOf('待确认') >= 0) parts.push('创新药成为成长内部修复分支');
    else if (pharm === '退潮' || pharm === '分歧') parts.push('创新药同步调整');
  }
  // 红利/宽基承接
  if (div) {
    if (div === '主升' || div === '扩散') parts.push('红利/宽基明显承接（偏防御）');
    else if (div === '启动' || div.indexOf('待确认') >= 0) parts.push('红利/宽基承接偏防御');
    else if (div === '退潮') parts.push('红利也跟随调整');
  }
  // 券商金融（弹性观察）
  if (broker) {
    if (broker === '启动' || broker === '扩散') parts.push('券商金融提供进攻弹性');
    else if (broker === '退潮') parts.push('券商金融退潮削弱指数弹性');
  }
  // 有色资源
  if (metal) {
    if (metal === '启动' || metal.indexOf('待确认') >= 0) parts.push('有色资源脉冲但缺商品确认');
    else if (metal === '主升' || metal === '扩散') parts.push('有色资源走强（注意商品价格未确认）');
  }
  // 微盘
  if (micro) {
    if (micro === '主升' || micro === '扩散') parts.push('微盘小票扩散');
    else if (micro === '退潮') parts.push('微盘小票未扩散');
  }

  if (parts.length === 0) return '各主题结构数据不足，风格落点待补齐。';
  return parts.join('，') + '。';
}

// ============ 统一决策链 decisionState ============
// 所有页面从这一个对象读数据，不再各自下结论

function buildDecisionState(entry, data, currentDt) {
  if (!entry) return null;
  var dt = currentDt;

  // ---- 调用现有计算函数 ----
  var risk = calcRiskTint(entry, data, dt);
  var compass = calculateStyleCompass(entry, data, dt);
  var rhythm = buildRhythmPath(data, dt, 5);
  var fundingResult = calculateFundingLayers(entry, data, dt);
  var funding = fundingResult.layers;
  var fundingSummary = fundingResult.summary;
  var indexMatrix = buildIndexValidationMatrix(entry, data, dt);
  var indexConclusion = buildIndexMatrixConclusion(indexMatrix, entry, data);
  var events = buildEventInterpretation(dt);

  var sectorCycles = STRUCTURE_DEFS.map(function(sd) {
    var lc = classifyStructureLifecycle(sd, entry, data, dt);
    return Object.assign({ name: sd.name, sd: sd }, lc);
  });

  var conclusion = buildCoreConclusion(entry, data, dt, compass, risk, funding, rhythm);
  var validationPlan = buildValidationPlan(entry, compass, indexMatrix, sectorCycles);
  var styleLanding = buildStyleLanding(sectorCycles, compass);

  var WEEKLY34_TARGETS = [
    { code: '399006.SZ', name: '创业板指' },
    { code: '000688.SH', name: '科创50' },
    { code: '000698.SH', name: '科创100' },
    { code: '000300.SH', name: '沪深300' },
    { code: '000016.SH', name: '上证50' },
    { code: '000852.SH', name: '中证1000' },
    { code: '932000.CSI', name: '中证2000' }
  ];
  var wma = (data && data.weeklyMA34) ? data.weeklyMA34 : {};

  var industryEtfBuckets = null;
  var industryEtfBrief = null;
  try {
    industryEtfBuckets = buildIndustryEtfBuckets(entry);
    industryEtfBrief = buildIndustryEtfBrief(entry);
  } catch(e) {}

  // ===== 主题综合评分榜（Top3 + 类型）=====
  var themeLeaders = [];
  try {
    themeLeaders = buildThemeLeaderBoard(entry, data, dt, wma);
  } catch(e) {}

  // ===== 原始信号提取（用于决策规则）=====
  var c = entry.computed || {};
  var totalAmount = entry.concentration ? entry.concentration.totalAmount : null;
  var upRatio = c.upRatio != null ? c.upRatio : (c.top10UpRatio != null ? c.top10UpRatio : null);
  var wideFlow = entry.etfWide ? entry.etfWide.totalFlow : null;
  // 统一口径：themeFlowTotal 必须与 calculateFundingLayers 同源（entry.etfTheme.categories），
  // 否则不同模块对同一指标显示不同数值。industryEtfBrief 只用于结构承载榜的细分展示。
  var themeFlowTotal = 0;
  var themeFlowSource = 'etfTheme';  // 标注数据源
  if (entry.etfTheme && entry.etfTheme.categories) {
    Object.keys(entry.etfTheme.categories).forEach(function(ck) {
      var cat = entry.etfTheme.categories[ck];
      if (!cat || !cat.themes) return;
      Object.keys(cat.themes).forEach(function(tk) {
        var f = cat.themes[tk].flow;
        if (f != null && isFinite(f)) themeFlowTotal += f;
      });
    });
  } else if (industryEtfBrief) {
    // 回退口径：从 industryEtfBrief 汇总（标注来源不同）
    themeFlowSource = 'industryEtfBrief';
    industryEtfBrief.forEach(function(b) {
      if (b.flowDay != null) themeFlowTotal += b.flowDay;
    });
  }
  var m = entry.margin || {};
  var mg5dAbsWan = (data && dt) ? calcWindowChange(data, dt, function(e){ return e && e.margin ? e.margin.value : null; }, 5) : null;
  var mg5dAbsYi = mg5dAbsWan != null ? mg5dAbsWan * 10000 : null;

  // 情绪资金（涨停跌停）
  var emoLayer = funding.find(function(f) { return f.layer === '情绪资金'; });
  var limitUp = emoLayer && emoLayer.limitUp != null ? emoLayer.limitUp : null;
  var limitDown = emoLayer && emoLayer.limitDown != null ? emoLayer.limitDown : null;
  var emoStatus = emoLayer && emoLayer.emoStatus ? emoLayer.emoStatus : '';

  // ====== riskTone：进攻/轻进攻/观察/防守 ======
  var riskTone;
  if (risk.tone === 'extreme' || risk.tone === 'contract') {
    riskTone = '防守';
  } else if (risk.tone === 'loose' && upRatio != null && upRatio > 0.55 && (wideFlow == null || wideFlow > -30)) {
    riskTone = '进攻';
  } else if (risk.tone === 'loose') {
    riskTone = '轻进攻';
  } else if (limitDown != null && limitUp != null && limitDown > limitUp * 1.5 && limitDown > 30) {
    riskTone = '防守';  // 跌停扩散
  } else {
    riskTone = '观察';
  }
  // 融资5日大幅净偿还 → 至少降一级
  if (mg5dAbsYi != null && mg5dAbsYi < -300) {
    if (riskTone === '进攻') riskTone = '轻进攻';
    else if (riskTone === '轻进攻') riskTone = '观察';
    else if (riskTone === '观察') riskTone = '防守';
  }

  // ====== styleBias：成长/价值/大盘/小盘/主题/宽基/混沌 ======
  var growthD = compass.find(function(d) { return d.key === 'growthVsValue'; });
  var largeD = compass.find(function(d) { return d.key === 'largeVsSmall'; });
  var themeD = compass.find(function(d) { return d.key === 'themeVsBroad'; });
  var concD = compass.find(function(d) { return d.key === 'concentrationVsDiffusion'; });
  var attackD = compass.find(function(d) { return d.key === 'attackVsDefense'; });
  var styleBias = '混沌';
  // 主题vs宽基优先（资金选择比价格风格更真实）
  if (themeD && themeD.score > 0.3 && wideFlow != null && wideFlow < 0 && themeFlowTotal > 0) {
    styleBias = '主题';
  } else if (themeD && themeD.score < -0.3 && wideFlow != null && wideFlow > 30 && themeFlowTotal < 0) {
    styleBias = '宽基';
  } else if (growthD && growthD.score > 0.3) {
    styleBias = '成长';
  } else if (growthD && growthD.score < -0.3) {
    styleBias = '价值';
  } else if (largeD && largeD.score > 0.3) {
    styleBias = '大盘';
  } else if (largeD && largeD.score < -0.3) {
    styleBias = '小盘';
  }

  // ====== rhythmState：主升/放量分歧/缩量修复/平量拉锯/回调放量/退潮 ======
  var todayRhythm = rhythm.days && rhythm.days.length > 0 ? rhythm.days[rhythm.days.length - 1] : null;
  var idxChg = null;
  if (entry.idxChgSeries && entry.idxChgSeries.idxChg1d != null) idxChg = entry.idxChgSeries.idxChg1d;
  else if (data && data.klineSummary && data.klineSummary['000300.SH']) idxChg = data.klineSummary['000300.SH'].chg1d;
  var amtVs5d = c.amountVs5d != null ? c.amountVs5d : (todayRhythm ? todayRhythm.amountVs5d : null);
  var rhythmState = '平量拉锯';
  if (todayRhythm) {
    if (todayRhythm.strongRhythmPattern === '放量反包') rhythmState = '放量反包';
    else if (todayRhythm.strongRhythmPattern === '回调放量') rhythmState = '回调放量';
    else if (todayRhythm.strongRhythmPattern === '缩量修复') rhythmState = '缩量修复';
    else if (todayRhythm.strongRhythmPattern === '缩量阴跌') rhythmState = '退潮';
  }
  if (rhythmState === '平量拉锯') {
    // 细化
    if (idxChg != null && idxChg > 1 && amtVs5d != null && amtVs5d > 10 && upRatio != null && upRatio > 0.6) rhythmState = '主升';
    else if (idxChg != null && idxChg < -1 && amtVs5d != null && amtVs5d > 10) rhythmState = '回调放量';
    else if (idxChg != null && idxChg < -1 && upRatio != null && upRatio < 0.35) rhythmState = '退潮';
    else if (idxChg != null && idxChg > 0 && amtVs5d != null && amtVs5d < -5) rhythmState = '缩量修复';
    else if (idxChg != null && Math.abs(idxChg) > 0.5 && amtVs5d != null && amtVs5d > 8) rhythmState = '放量分歧';
  }

  // ====== fundingNature：主动进攻/被动护盘/结构切换/全面撤退/分歧 ======
  var fundingNature = '分歧';
  var wideNeg = wideFlow != null && wideFlow < -20;
  var widePos = wideFlow != null && wideFlow > 20;
  var themePos = themeFlowTotal > 10;
  var themeNeg = themeFlowTotal < -10;
  if (widePos && themePos) fundingNature = '主动进攻';
  else if (wideNeg && themeNeg) fundingNature = '全面撤退';
  else if (wideNeg && themePos) fundingNature = '结构切换';
  else if (widePos && themeNeg) fundingNature = '被动护盘';
  else if (limitDown != null && limitDown > 50) fundingNature = '全面撤退';

  // ====== structureLeaders：主线主题列表（四确认：资金+价格+宽度+34周线）======
  var structureLeaders = sectorCycles.filter(function(s) {
    if (!s.phase || s.phase === '待接入数据') return false;
    // 主线候选：主升/扩散/启动
    if (s.phase === '主升' || s.phase === '扩散' || s.phase === '启动') return true;
    return false;
  }).map(function(s) {
    var weeklyStatus = null;
    if (s.sd && s.sd.klineCodes) {
      for (var i = 0; i < s.sd.klineCodes.length; i++) {
        var code = s.sd.klineCodes[i];
        if (wma[code]) { weeklyStatus = wma[code].status; break; }
      }
    }
    var confirmed = (s.dailyFlow != null && s.dailyFlow > 0) && (s.avgChg != null && s.avgChg > 0) && (s.upRatio != null && s.upRatio >= 0.5);
    return {
      name: s.name,
      phase: s.phase,
      phaseBadge: s.phaseBadge,
      dailyFlow: s.dailyFlow,
      flows5d: s.flows5d,
      avgChg: s.avgChg,
      upRatio: s.upRatio,
      weeklyStatus: weeklyStatus,
      confirmed: confirmed,
      confirm: s.confirm,
      fail: s.fail,
      judgment: s.judgment
    };
  });

  // ====== milestones：关键里程碑信号（数据触发的决策信号，非事件日历）======
  // 只展示数据本身触发的"状态变化"，不展示人工事件日历
  var milestones = [];

  // 1) riskTone 升降档信号（对比基础 risk tone）
  var rawRiskLabel = risk.label || '';
  if (riskTone === '进攻') {
    milestones.push({ level: 'strong', title: '风险底色转为进攻', desc: rawRiskLabel + ' · 上涨比例 ' + (upRatio != null ? (upRatio * 100).toFixed(0) + '%' : '--') });
  } else if (riskTone === '防守') {
    milestones.push({ level: 'risk', title: '风险底色降为防守', desc: rawRiskLabel + (mg5dAbsYi != null && mg5dAbsYi < -300 ? ' · 融资5日净偿还 ' + Math.abs(mg5dAbsYi).toFixed(0) + '亿' : '') });
  }

  // 2) 资金全面撤退/全面进攻信号
  if (fundingNature === '全面撤退') {
    milestones.push({ level: 'risk', title: '宽基+主题同步流出', desc: '宽基 ' + fmtSignedFlowYi(wideFlow) + ' · 主题 ' + fmtSignedFlowYi(themeFlowTotal) });
  } else if (fundingNature === '主动进攻') {
    milestones.push({ level: 'strong', title: '宽基+主题同步流入', desc: '宽基 ' + fmtSignedFlowYi(wideFlow) + ' · 主题 ' + fmtSignedFlowYi(themeFlowTotal) });
  } else if (fundingNature === '结构切换') {
    milestones.push({ level: 'watch', title: '资金结构切换中', desc: '宽基流出但主题流入，老主线退潮、新方向试探' });
  }

  // 3) 34周线穿越信号（任一指数从中期弱势/反抽转为强势，或反之）
  if (wma && Object.keys(wma).length > 0) {
    var crossUps = [];
    var crossDowns = [];
    Object.keys(wma).forEach(function(code) {
      var w = wma[code];
      if (w.crossUp) crossUps.push(w.name || code);
      if (w.crossDown) crossDowns.push(w.name || code);
    });
    if (crossUps.length > 0) {
      milestones.push({ level: 'strong', title: crossUps.slice(0, 3).join('、') + ' 站上34周线', desc: '中期趋势转强确认' });
    }
    if (crossDowns.length > 0) {
      milestones.push({ level: 'risk', title: crossDowns.slice(0, 3).join('、') + ' 跌破34周线', desc: '中期趋势转弱警示' });
    }
  }

  // 4) 情绪极端信号
  if (limitDown != null && limitUp != null && limitDown > 50 && limitDown > limitUp) {
    milestones.push({ level: 'risk', title: '跌停扩散至 ' + limitDown + ' 家', desc: '涨停 ' + limitUp + ' 家，情绪退潮明显' });
  } else if (limitUp != null && limitUp > 80 && (limitDown == null || limitDown < 15)) {
    milestones.push({ level: 'strong', title: '涨停 ' + limitUp + ' 家', desc: '赚钱效应活跃' });
  }

  // 5) 主线确认信号
  if (riskTone === '进攻' || riskTone === '轻进攻') {
    var confirmedLeaders = structureLeaders.filter(function(l) { return l.confirmed; });
    if (confirmedLeaders.length > 0) {
      milestones.push({ level: 'strong', title: confirmedLeaders[0].name + ' 四确认完成', desc: '资金+价格+宽度+34周线同步，可作主线' });
    }
  }

  // 6) 创新药/医药成长扩散信号（4 个条件任一即触发）
  if (themeLeaders && themeLeaders.length > 0) {
    var innovLeader = themeLeaders.find(function(l) { return l.name === '创新药/医药成长'; });
    if (innovLeader) {
      // 条件 A：5日涨幅中位数进入所有主题前三，且5日净流入为正
      var flowPos5d = innovLeader.flow5d != null && innovLeader.flow5d > 0;
      var chgTop3 = false;
      var sortedByChg = themeLeaders.slice().sort(function(a, b) { return (b.medianChg || -999) - (a.medianChg || -999); });
      var rankIdx = sortedByChg.findIndex(function(l) { return l.name === '创新药/医药成长'; });
      if (rankIdx >= 0 && rankIdx <= 2) chgTop3 = true;
      if (flowPos5d && chgTop3) {
        milestones.push({
          level: 'strong',
          title: '主线候选扩散｜创新药/医药成长涨幅领先',
          desc: '当日中位数 ' + (innovLeader.medianChg != null ? innovLeader.medianChg.toFixed(2) + '%' : '--') + ' · 5日净流入 ' + fmtSignedFlowYi(innovLeader.flow5d) + ' · 上涨ETF比例 ' + ((innovLeader.upRatio || 0) * 100).toFixed(0) + '%'
        });
      }
      // 条件 B：上涨ETF比例超过70%，且有效样本数不少于10只
      else if (innovLeader.upRatio != null && innovLeader.upRatio > 0.7 && innovLeader.normalCount >= 10) {
        milestones.push({
          level: 'strong',
          title: '主线候选扩散｜创新药宽度强势',
          desc: '上涨ETF比例 ' + ((innovLeader.upRatio || 0) * 100).toFixed(0) + '% · 有效样本 ' + innovLeader.normalCount + '只 · 当日涨幅中位数 ' + (innovLeader.medianChg != null ? innovLeader.medianChg.toFixed(2) + '%' : '--')
        });
      }
      // 条件 C：核心创新药ETF涨幅中位数超过10%（用当日 medianChg 代理涨幅强度）
      else if (innovLeader.medianChg != null && innovLeader.medianChg > 10 && (innovLeader.flow5d || 0) > 0) {
        milestones.push({
          level: 'strong',
          title: '主线候选扩散｜创新药核心强势',
          desc: '涨幅中位数 ' + innovLeader.medianChg.toFixed(2) + '% · 5日净流入 ' + fmtSignedFlowYi(innovLeader.flow5d) + ' · 类型：' + innovLeader.leaderType
        });
      }
      // 条件 D：创新药综合评分相对科技成长、半导体明显占优
      else if (innovLeader.score > 0) {
        var techLeader = themeLeaders.find(function(l) { return l.name === '科技成长'; });
        if (techLeader && innovLeader.score >= techLeader.score + 10 && innovLeader.score >= 30) {
          milestones.push({
            level: 'watch',
            title: '创新药/医药成长综合评分领先',
            desc: '创新药 ' + innovLeader.score + '分 vs 科技成长 ' + techLeader.score + '分 · 类型：' + innovLeader.leaderType
          });
        }
      }
    }
  }

  // 最多保留 5 条，按级别优先级排序：risk > strong > watch
  var levelOrder = { 'risk': 0, 'strong': 1, 'watch': 2 };
  milestones.sort(function(a, b) { return (levelOrder[a.level] || 9) - (levelOrder[b.level] || 9); });
  milestones = milestones.slice(0, 5);

  // ====== tomorrowChecks：明日验证条件 — 在 mainLineCandidates 生成后动态构建（见下方）=====
  var tomorrowChecks = [];

  // ====== 主线方向（用于今日决策卡）======
  var maxRisk = '无明显系统性风险';
  if (risk.tone === 'extreme') maxRisk = risk.label;
  else if (fundingNature === '全面撤退') maxRisk = '资金全面撤退，宽基和主题同步流出';
  else if (limitDown != null && limitDown > 50) maxRisk = '跌停 ' + limitDown + ' 家，情绪退潮';
  else if (mg5dAbsYi != null && mg5dAbsYi < -300) maxRisk = '融资5日净偿还 ' + Math.abs(mg5dAbsYi).toFixed(0) + ' 亿，杠杆去化';
  else if (upRatio != null && upRatio < 0.3) maxRisk = '上涨比例仅 ' + (upRatio * 100).toFixed(0) + '%，赚钱效应差';
  else if (wideFlow != null && wideFlow < -50) maxRisk = '宽基ETF净流出 ' + Math.abs(wideFlow).toFixed(0) + ' 亿';

  // ====== 主线方向（用于今日决策卡）======
  // 新规则：使用 themeLeaderBoard（综合评分）Top3 + 类型
  // 不再只看净流入绝对额；涨幅领先+上涨比例高+净流入为正 即可进入主线候选
  // 强度规则：riskTone 决定主线能用多强的词
  //   进攻/轻进攻 → 允许写"主升"（必须四确认）
  //   观察        → 只能写"主线候选"或"短线承载"
  //   防守        → 只能写"潜在方向"
  //
  // 数据质量门控：
  //   通过门控 → 进入"正式主线候选"
  //   未通过门控但信号强 → 进入"强线索待确认"
  //   既没通过也没信号 → 不展示
  // ====================================================================
  // 先计算 coreDataHealth 和 structureDataHealth（dataQualityGate 依赖它们）
  // ====================================================================
  // 核心数据：资金 / 价格 / 宽度 / 34周线 四项决策支柱
  var coreChecks = [
    { key: 'wideFlow',  label: '宽基资金', ok: wideFlow != null },
    { key: 'themeFlow', label: '主题资金', ok: themeFlowTotal != null && industryEtfBrief && industryEtfBrief.length > 0 },
    { key: 'price',     label: '指数价格', ok: idxChg != null },
    { key: 'upRatio',   label: '上涨宽度', ok: upRatio != null },
    { key: 'margin',    label: '融资余额', ok: m.value != null },
    { key: 'weekly34',  label: '34周线',   ok: wma && Object.keys(wma).length > 0 }
  ];
  var coreOk = coreChecks.filter(function(c) { return c.ok; }).length;
  var coreTotal = coreChecks.length;
  var coreRatio = coreOk / coreTotal;
  var coreDataHealth = {
    ok: coreOk,
    total: coreTotal,
    ratio: coreRatio,
    status: coreRatio >= 0.9 ? '完整' : (coreRatio >= 0.6 ? '部分缺失' : '核心缺失'),
    missing: coreChecks.filter(function(c) { return !c.ok; }).map(function(c) { return c.label; })
  };

  // 结构数据：主题生命周期覆盖
  var themesTotal = sectorCycles.length;
  var themesWithData = sectorCycles.filter(function(s) { return s.phase && s.phase !== '待接入数据'; }).length;
  var structureDataHealth = {
    ok: themesWithData,
    total: themesTotal,
    ratio: themesTotal > 0 ? themesWithData / themesTotal : 0,
    status: themesWithData === themesTotal ? '全覆盖' : (themesWithData >= themesTotal / 2 ? '部分主题缺数据' : '主题覆盖不足'),
    missing: sectorCycles.filter(function(s) { return !s.phase || s.phase === '待接入数据'; }).map(function(s) { return s.name; })
  };

  // ====================================================================
  // dataQualityGate 构建
  // ====================================================================
  var BASE_EXPECTED_SAMPLE = 10;
  var COVERAGE_PASS_RATIO = 0.6;
  // 全市场大致主题ETF数（用于"全样本参考"）
  // 创新药：wind 行业分类下总样本 56 只，但其中科创板创新药ETF是关注核心（前 10 大规模约占 80% 资金）
  // 评估"样本是否足够"应参考市场关注度而非全样本数，所以调整为 10 只即可视为覆盖核心
  var FULL_MARKET_INNOV_DRUG = 10;  // 改为覆盖核心即可（汇添富/国泰/华夏/银华/富国/工银/天弘/南方 + 两只次主流）
  var FULL_MARKET_TECH = 80;

  // 构建 themeQualityMap
  var themeQualityMap = {};
  var innovDrugBucket = null;
  try {
    innovDrugBucket = buildInnovativeDrugBucket(entry);
  } catch(e) {}

  themeLeaders.forEach(function(l) {
    var name = l.name;
    var sampleCount = l.normalCount || 0;
    var expectedSample = BASE_EXPECTED_SAMPLE;
    if (name === '创新药/医药成长') expectedSample = Math.round(FULL_MARKET_INNOV_DRUG * COVERAGE_PASS_RATIO);
    else if (name === '科技成长') expectedSample = Math.round(FULL_MARKET_TECH * COVERAGE_PASS_RATIO);

    // 样本健康按有效ETF数量分级（不再用比例口径，避免科技成长28只被误标"覆盖不足"）
    // ≥5 充足 / 3–4 基本可用 / 1–2 覆盖不足 / 0 不可用
    // 关键约束：coverageRatio < 0.6 ⟺ 有效ETF < 3，保证"样本覆盖不足"只在 valid<3 时出现
    var coverageRatio;
    if (sampleCount >= 5) coverageRatio = 1.0;
    else if (sampleCount >= 3) coverageRatio = 0.8;
    else if (sampleCount >= 1) coverageRatio = 0.4;
    else coverageRatio = 0;
    var hasAbnormalSample = false;
    var missingFields = [];

    // 异常样本（涨跌 > 20）
    if (industryEtfBuckets && industryEtfBuckets[name] && industryEtfBuckets[name].abnormalCount) {
      hasAbnormalSample = industryEtfBuckets[name].abnormalCount > 0;
    }
    if (innovDrugBucket && name === '创新药/医药成长' && innovDrugBucket.abnormalCount > 0) {
      hasAbnormalSample = true;
    }

    // 缺关键字段检查
    if (l.flowDay == null && l.flow5d == null) missingFields.push('ETF资金');
    if (l.medianChg == null) missingFields.push('价格');
    if (l.upRatio == null) missingFields.push('宽度');
    if (l.weeklyStatus == null) missingFields.push('34周线');

    // 置信度等级（四档：高/中/低/极低）
    // 规则：
    //   - 样本严重不足或字段缺 ≥2 → 低
    //   - 样本/字段/异常任一不达标 → 中
    //   - 当日资金为负（flowDay<0 且 flow5d≤0）→ 强制降为"中"（资金是方向性证据，不能在流出时写"置信高"）
    //   - 全部达标 → 高
    // 置信度等级与样本健康联动：有效<3（覆盖不足/不可用）→ 低；3–4（基本可用）→ 中；≥5（充足）→ 高
    var confidenceLevel = '高';
    if (coverageRatio < COVERAGE_PASS_RATIO || missingFields.length >= 2) {
      confidenceLevel = '低';
    } else if (coverageRatio < 1.0 || missingFields.length > 0 || hasAbnormalSample) {
      confidenceLevel = '中';
    }
    // 资金方向强制降级：当日净流出 → 不能写"置信高"
    // （用户要求：不要在当日净流入为负时写"置信高"）
    var flowDayNeg = (l.flowDay != null && l.flowDay < 0);
    if (flowDayNeg && confidenceLevel === '高') {
      confidenceLevel = '中';
    }

    themeQualityMap[name] = {
      sampleCount: sampleCount,
      expectedSampleCount: expectedSample,
      coverageRatio: coverageRatio,
      hasAbnormalSample: hasAbnormalSample,
      missingFields: missingFields,
      confidenceLevel: confidenceLevel,
      flowDayNeg: flowDayNeg  // 记录资金方向降级原因
    };
  });

  // coreDataStatus / structureCoverageStatus
  var coreDataStatus = coreDataHealth.status === '完整' ? '完整' : (coreDataHealth.status === '部分缺失' ? '部分缺失' : '不可用');
  var structureCoverageStatus = structureDataHealth.status === '全覆盖' ? '完整' : (structureDataHealth.status === '部分主题缺数据' ? '部分缺口' : '严重不足');

  // decisionConfidence 综合判定
  var hasHighConfidence = Object.values(themeQualityMap).some(function(q) { return q.confidenceLevel === '高'; });
  var allLowConfidence = Object.values(themeQualityMap).length > 0 && Object.values(themeQualityMap).every(function(q) { return q.confidenceLevel === '低'; });
  var decisionConfidence;
  if (coreDataStatus === '不可用' || structureCoverageStatus === '严重不足' || allLowConfidence) {
    decisionConfidence = '低';
  } else if (coreDataStatus === '完整' && structureCoverageStatus === '完整' && hasHighConfidence) {
    decisionConfidence = '高';
  } else {
    decisionConfidence = '中';
  }

  var dataQualityGate = {
    coreDataStatus: coreDataStatus,
    structureCoverageStatus: structureCoverageStatus,
    themeQualityMap: themeQualityMap,
    decisionConfidence: decisionConfidence
  };

  // 主题是否能进入正式主线的检查函数
  function canEnterFormalMainline(l) {
    var q = themeQualityMap[l.name];
    if (!q) return false;
    if (q.coverageRatio < COVERAGE_PASS_RATIO) return false;
    if (q.missingFields.length >= 2) return false;
    // 异常剔除允许进入正式主线（只降权评分，标注出来）
    return true;
  }

  // 主题是否只能进入强线索待确认
  function canEnterStrongClue(l) {
    var q = themeQualityMap[l.name];
    if (!q) return false;
    if (l.score < 30) return false;
    if (l.leaderType === '退潮型') return false;
    var hasDefect = q.coverageRatio < COVERAGE_PASS_RATIO || q.hasAbnormalSample || q.missingFields.length > 0;
    return hasDefect;
  }

  // 重新生成 mainLineCandidates（按 dataQualityGate 拆分）
  var formalMainline = [];
  var strongClue = [];
  var top5Leaders = themeLeaders.slice(0, 5).filter(function(l) { return l.score > 0; });

  top5Leaders.forEach(function(l) {
    if (canEnterFormalMainline(l)) {
      var q = themeQualityMap[l.name];
      var label;
      if (riskTone === '防守') {
        label = l.name + '（潜在方向·' + l.leaderType + '）';
      } else if (riskTone === '观察') {
        label = l.name + '（主线候选·' + l.leaderType + '）';
      } else {
        label = l.name + '（' + l.leaderType + '）';
      }
      if (q.hasAbnormalSample) {
        label += ' · 异常样本已剔除';
      }
      formalMainline.push({ name: l.name, text: label, type: l.leaderType, score: l.score, confidence: q.confidenceLevel });
    } else if (canEnterStrongClue(l)) {
      var q2 = themeQualityMap[l.name];
      var reason = [];
      if (q2.coverageRatio < COVERAGE_PASS_RATIO) reason.push('样本覆盖不足');
      if (q2.hasAbnormalSample) reason.push('异常样本已剔除');
      if (q2.missingFields.length > 0) reason.push('缺' + q2.missingFields.join('、'));
      var reasonTxt = reason.length > 0 ? '（' + reason.join('，') + '）' : '';
      strongClue.push({
        name: l.name,
        text: l.name + '：' + l.leaderType + '信号强，但' + reasonTxt + '，待补齐后确认',
        type: l.leaderType,
        score: l.score,
        confidence: q2.confidenceLevel,
        reason: reason
      });
    }
  });

  // mainLineCandidates 合并（保留旧接口）
  // 正式主线 Top3 在前，强线索 Top2 在后（标注类型以区分）
  var mainLineCandidates = formalMainline.slice(0, 3).map(function(c) {
    return Object.assign({ slot: 'formal' }, c);
  }).concat(strongClue.slice(0, 2).map(function(c) {
    return Object.assign({ slot: 'strongClue' }, c);
  }));

  var mainLine = formalMainline.length > 0
    ? formalMainline.slice(0, 3).map(function(c) { return c.text; }).join(' + ')
    : (strongClue.length > 0
        ? strongClue[0].text
        : (styleBias !== '混沌' ? '风格偏' + styleBias + '，但缺主题承载' : '暂无明确主线'));

  // ====== 重新生成 tomorrowChecks：从当前 mainLineCandidates 动态生成 ======
  // 规则：每个正式主线生成一条 + 每个强线索生成一条 + 资金/风险兜底
  // 口径：当日净流入为负时，验证条件用"转正"而非"继续净流入"
  var dynamicChecks = [];
  formalMainline.slice(0, 3).forEach(function(c) {
    var tl = (themeLeaders || []).find(function(x) { return x.name === c.name; });
    var flowDayVal = tl && tl.flowDay != null ? tl.flowDay : null;
    var flowNegNow = flowDayVal != null && flowDayVal <= 0;
    var confirmTxt;
    if (flowNegNow) {
      // 当前资金为负 → 验证条件是"转正"
      confirmTxt = c.name + '当日ETF净流入转正，涨跌中位数为正，上涨ETF比例维持60%以上，34周线维持当前状态';
    } else {
      // 当前资金为正 → 验证条件是"继续净流入"
      confirmTxt = c.name + '继续维持' + c.type + '信号：ETF继续净流入，涨跌中位数为正，上涨ETF比例维持60%以上，34周线维持当前状态';
    }
    dynamicChecks.push({
      layer: '主线验证·' + c.name,
      item: {
        confirm: confirmTxt,
        fail: '资金转为净流出，或价格转弱且上涨ETF比例跌破50%，或34周线状态恶化',
        action: flowNegNow ? '若转正确认可作加仓依据；若继续流出则降级为观察' : '若确认可作加仓依据；若证伪则降级为观察，不再视为正式主线'
      }
    });
  });
  strongClue.slice(0, 2).forEach(function(c) {
    dynamicChecks.push({
      layer: '强线索确认·' + c.name,
      item: {
        confirm: c.name + '信号持续：补齐ETF样本后，5日涨跌中位数仍位居主题前三，5日净流入为正',
        fail: '补齐样本后涨跌中位数回落，或资金转为净流出',
        action: '样本不足前只作为观察线索，不作为正式加仓依据；样本补齐后再决定是否升格'
      }
    });
  });
  // 兜底：风险/资金方向验证
  if (dynamicChecks.length < 3) {
    dynamicChecks.push({
      layer: '风险底色验证',
      item: {
        confirm: '市场维持当前' + riskTone + '状态，融资余额不大幅净偿还（5日 > -300亿），跌停数不扩散',
        fail: '融资5日净偿还扩大，或跌停扩散至50家以上，riskTone降级',
        action: '若降级则同步降仓' + (riskTone === '防守' ? '' : '至防守水位')
      }
    });
  }
  tomorrowChecks = dynamicChecks.slice(0, 4);  // 最多 4 条（原 3 条）
  var topCheck = tomorrowChecks.length > 0 ? tomorrowChecks[0].item.confirm : '待补验证条件';

  // ====== dataWarnings：影响判断的数据问题（去重管理）======
  var warningMap = {};
  function addWarning(key, text) {
    if (!warningMap[key]) warningMap[key] = text;
  }
  var meta = entry.meta || {};
  if (meta.completeness != null && meta.completeness < 0.7) {
    addWarning('meta-completeness', '数据完整度仅 ' + (meta.completeness * 100).toFixed(0) + '%，部分指标可能失真');
  }
  if (meta.phase === 'stale') addWarning('meta-stale', '数据已过期');
  if (meta.phase === 'partial') addWarning('meta-partial', '数据不完整');
  // 缺数据主题（按主题名去重）
  var missingDataThemes = sectorCycles.filter(function(s) {
    return !s.phase || s.phase === '待接入数据';
  });
  missingDataThemes.forEach(function(s) {
    addWarning('missing-theme-' + s.name, '主题' + s.name + '：数据缺失');
  });
  // 异常ETF（聚合所有主题）
  if (industryEtfBuckets) {
    Object.keys(industryEtfBuckets).forEach(function(k) {
      var b = industryEtfBuckets[k];
      if (b.abnormalCount) {
        addWarning('abnormal-etf-' + k, k + '已剔除 ' + b.abnormalCount + ' 只异常行情ETF样本（涨跌绝对值>20%）');
      }
    });
  }
  // 创新药/医药成长样本覆盖（独立 key，与 missing-theme-创新药/医药成长 不重复）
  if (themeQualityMap['创新药/医药成长']) {
    var iq = themeQualityMap['创新药/医药成长'];
    if (iq.coverageRatio < COVERAGE_PASS_RATIO) {
      addWarning('insufficient-innovation-drug-samples',
        '创新药/医药成长样本覆盖不足：当前有效 ' + iq.sampleCount + ' 只（≥3 只方可进入正式主线），主题结论请谨慎使用');
    }
  }
  // 消费价值缺失（独立 key，与 missing-theme-消费价值 不重复但语义更清晰）
  if (structureDataHealth.missing.indexOf('消费价值') >= 0) {
    addWarning('missing-consumption', '消费价值主题数据缺失，相关结论暂时不展示');
  }
  // 融资 T+1
  if (m.isStale) addWarning('margin-t1', '融资数据为 T+1 披露');

  var dataWarnings = Object.values(warningMap);

  // ====== 最大风险（用于今日决策卡）======
  var maxRisk = '无明显系统性风险';
  if (risk.tone === 'extreme') maxRisk = risk.label;
  else if (fundingNature === '全面撤退') maxRisk = '资金全面撤退，宽基和主题同步流出';
  else if (limitDown != null && limitDown > 50) maxRisk = '跌停 ' + limitDown + ' 家，情绪退潮';
  else if (mg5dAbsYi != null && mg5dAbsYi < -300) maxRisk = '融资5日净偿还 ' + Math.abs(mg5dAbsYi).toFixed(0) + ' 亿，杠杆去化';
  else if (upRatio != null && upRatio < 0.3) maxRisk = '上涨比例仅 ' + (upRatio * 100).toFixed(0) + '%，赚钱效应差';
  else if (wideFlow != null && wideFlow < -50) maxRisk = '宽基ETF净流出 ' + Math.abs(wideFlow).toFixed(0) + ' 亿';

  return {
    // spec 要求的顶层字段
    riskTone: riskTone,
    styleBias: styleBias,
    rhythmState: rhythmState,
    fundingNature: fundingNature,
    structureLeaders: structureLeaders,
    milestones: milestones,
    tomorrowChecks: tomorrowChecks,
    dataWarnings: dataWarnings,
    // 数据健康度（两层）
    coreDataHealth: coreDataHealth,
    structureDataHealth: structureDataHealth,
    themeLeaders: themeLeaders,
    mainLineCandidates: mainLineCandidates,
    // 新增：dataQualityGate + 正式主线/强线索拆分
    dataQualityGate: dataQualityGate,
    themeQualityMap: themeQualityMap,
    formalMainline: formalMainline,
    strongClue: strongClue,
    // 决策卡用
    maxRisk: maxRisk,
    mainLine: mainLine,
    topCheck: topCheck,
    // 判断链摘要用（四张小卡）
    chain: {
      risk: { label: '风险底色', value: riskTone, evidence: [risk.label, risk.position].filter(Boolean) },
      style: { label: '风格方向', value: styleBias, evidence: compass.slice(0, 3).map(function(d) { return d.label.split('vs')[0] + ' ' + d.bias; }) },
      rhythm: { label: '节奏位置', value: rhythmState, evidence: [
        idxChg != null ? '指数 ' + fmtPct(idxChg) : null,
        amtVs5d != null ? '成交 ' + (amtVs5d >= 0 ? '+' : '') + amtVs5d.toFixed(1) + '%' : null,
        upRatio != null ? '上涨 ' + (upRatio * 100).toFixed(0) + '%' : null
      ].filter(Boolean) },
      funding: { label: '资金性质', value: fundingNature, evidence: [
        wideFlow != null ? '宽基 ' + fmtSignedFlowYi(wideFlow) : null,
        '主题 ' + fmtSignedFlowYi(themeFlowTotal) + (themeFlowSource === 'industryEtfBrief' ? '（行业桶口径）' : '')
      ].filter(Boolean) }
    },
    // 原始数据引用
    _raw: {
      risk: risk, compass: compass, rhythm: rhythm, funding: funding,
      fundingSummary: fundingSummary, indexMatrix: indexMatrix,
      indexConclusion: indexConclusion, sectorCycles: sectorCycles,
      conclusion: conclusion, validationPlan: validationPlan,
      styleLanding: styleLanding, events: events, wma: wma,
      weekly34Targets: WEEKLY34_TARGETS, industryEtfBrief: industryEtfBrief,
      industryEtfBuckets: industryEtfBuckets
    }
  };
}

// ============ 主渲染函数 ============

function renderStructuralReview(data, currentDt) {
  var entry = data.data[currentDt];
  if (!entry) return '<div class="page tab-content" id="tab-structural"><div class="wrap"><p>数据加载中...</p></div></div>';

  var ds = buildDecisionState(entry, data, currentDt);
  if (!ds) return '<div class="page tab-content" id="tab-structural"><div class="wrap"><p>决策链生成失败</p></div></div>';

  // ====== ① 今日决策卡 ======
  var riskToneClass = ({ '进攻':'dc-tone-attack', '轻进攻':'dc-tone-light-attack', '观察':'dc-tone-watch', '防守':'dc-tone-defend' })[ds.riskTone] || 'dc-tone-watch';
  // 主线方向拆分为正式主线 + 强线索待确认（来自 dataQualityGate）
  var formalMainline = ds.formalMainline || [];
  var strongClue = ds.strongClue || [];
  var typeClassMap = {
    '资金驱动型':'drive','价格扩散型':'diffuse','资金承接型':'underpin',
    '反抽型':'rebound','兑现型':'cashout','退潮型':'outflow','中性':'neutral'
  };
  var formalMainlineHtml = (formalMainline && formalMainline.length > 0)
    ? formalMainline.slice(0, 3).map(function(c, i) {
        return '<div class="mainline-item">' +
          '<span class="mainline-rank">' + (i + 1) + '</span>' +
          '<span class="mainline-name">' + c.name + '</span>' +
          '<span class="mainline-type mainline-type-' + (typeClassMap[c.type] || 'neutral') + '">' + c.type + '</span>' +
          '<span class="mainline-conf conf-' + (c.confidence || '高') + '">置信' + (c.confidence || '高') + '</span>' +
        '</div>';
      }).join('')
    : '<div class="compact-empty">暂无正式主线，维持观察</div>';
  var strongClueHtml = (strongClue && strongClue.length > 0)
    ? strongClue.slice(0, 2).map(function(c, i) {
        return '<div class="mainline-item mainline-item-clue">' +
          '<span class="mainline-rank">' + (i + 1) + '</span>' +
          '<span class="mainline-name">' + c.name + '</span>' +
          '<span class="mainline-type mainline-type-clue">' + c.type + '</span>' +
          '<span class="mainline-conf conf-中">置信中</span>' +
          '<span class="mainline-warn">不作为加仓依据</span>' +
        '</div>';
      }).join('')
    : '';
  var decisionCardHtml =
    '<div class="decision-card ' + riskToneClass + '">' +
      '<div class="dc-row"><span class="dc-label">市场状态</span><span class="dc-value">' + ds.riskTone + ' · ' + ds.rhythmState + '</span></div>' +
      '<div class="dc-row"><span class="dc-label">仓位倾向</span><span class="dc-value">' + ({
        '进攻':'可偏积极，沿主线加仓',
        '轻进攻':'结构性参与，不押方向',
        '观察':'中性仓位，多看少动',
        '防守':'控仓为主，不抢反弹'
      })[ds.riskTone] + '</span></div>' +
      '<div class="dc-row dc-mainline"><span class="dc-label">主线方向 · 正式主线候选</span><div class="mainline-list">' + formalMainlineHtml + '</div></div>' +
      (strongClueHtml ? '<div class="dc-row dc-mainline-clue"><span class="dc-label">强线索待确认</span><div class="mainline-list mainline-list-clue">' + strongClueHtml + '</div></div>' : '') +
      '<div class="dc-row dc-risk"><span class="dc-label">最大风险</span><span class="dc-value">' + ds.maxRisk + '</span></div>' +
      '<div class="dc-row dc-check"><span class="dc-label">明日关键验证</span><span class="dc-value">' + ds.topCheck + '</span></div>' +
    '</div>';

  // ====== ② 关键里程碑信号（数据触发的决策信号）======
  var levelIcons = { 'risk': '⚠', 'strong': '▲', 'watch': '◆' };
  var levelClasses = { 'risk': 'ms-risk', 'strong': 'ms-strong', 'watch': 'ms-watch' };
  var milestoneHtml = ds.milestones.length > 0
    ? ds.milestones.map(function(m) {
        return '<div class="milestone-item ' + (levelClasses[m.level] || '') + '">' +
          '<span class="ms-icon">' + (levelIcons[m.level] || '·') + '</span>' +
          '<span class="ms-title">' + m.title + '</span>' +
          '<span class="ms-desc">' + m.desc + '</span>' +
        '</div>';
      }).join('')
    : '<div class="struct-missing">今日无数据触发的决策信号</div>';

  // ====== ③ 判断链摘要（四张小卡）======
  function chainCard(c) {
    var evHtml = c.evidence.slice(0, 3).map(function(e) { return '<li>' + e + '</li>'; }).join('');
    return '<div class="chain-card chain-' + c.label + '">' +
      '<div class="chain-label">' + c.label + '</div>' +
      '<div class="chain-value">' + c.value + '</div>' +
      '<ul class="chain-evidence">' + evHtml + '</ul>' +
    '</div>';
  }
  var chainHtml = '<div class="chain-grid">' +
    chainCard(ds.chain.risk) +
    chainCard(ds.chain.style) +
    chainCard(ds.chain.rhythm) +
    chainCard(ds.chain.funding) +
  '</div>';

  // ====== ④ 结构承载榜（只展示与顶部"正式主线候选"一致的主题卡）======
  // 一致性：顶部 mainLine 列表展示什么，④ 就展示什么。
  // 没有进入"正式主线"的主题不进入结构承载榜。
  var leaderHtml = formalMainline.length > 0
    ? formalMainline.slice(0, 5).map(function(c) {
        var tl = (ds.themeLeaders || []).find(function(x) { return x.name === c.name; });
        if (!tl) return '';
        var q = (ds.dataQualityGate && ds.dataQualityGate.themeQualityMap && ds.dataQualityGate.themeQualityMap[c.name]) || null;
        var flowTxt = tl.flowDay != null
          ? '<span class="' + upDn(tl.flowDay) + '">' + fmtSignedFlowYi(tl.flowDay) + '</span>'
          : '--';
        var flow5dTxt = tl.flow5d != null
          ? '<span class="' + upDn(tl.flow5d) + '">' + fmtSignedFlowYi(tl.flow5d) + '</span>'
          : '--';
        var chgTxt = tl.medianChg != null ? '<span class="' + upDn(tl.medianChg) + '">' + fmtPct(tl.medianChg) + '</span>' : '--';
        var upTxt = tl.upRatio != null ? (tl.upRatio * 100).toFixed(0) + '%' : '--';
        var weeklyTxt = tl.weeklyStatus || '--';

        // 重新定义确认等级（按用户要求）
        // 四确认：资金>0 + 价格>0 + 宽度>=60% + 34周线强势上方
        // 三确认：资金+价格+宽度满足，34周线是回踩观察/趋势争夺
        // 弱确认：只有资金和价格满足，宽度或34周线不满足
        // 待确认：信号不足或样本不足
        var flowPos = (tl.flowDay != null && tl.flowDay > 0) || (tl.flow5d != null && tl.flow5d > 0);
        var chgPos = tl.medianChg != null && tl.medianChg > 0;
        var widthStrong = tl.upRatio != null && tl.upRatio >= 0.6;
        var weeklyStrong = tl.weeklyStatus === '强势上方';
        var weeklyMid = tl.weeklyStatus === '回踩观察' || tl.weeklyStatus === '趋势争夺' || tl.weeklyStatus === '偏强';
        var weeklyWeak = tl.weeklyStatus === '反抽不过' || tl.weeklyStatus === '中期弱势' || tl.weeklyStatus === '偏弱';

        var confirmLevel = '待确认';
        var confirmLabel = '';
        if (flowPos && chgPos && widthStrong && weeklyStrong) {
          confirmLevel = '四确认';
          confirmLabel = '资金+价格+宽度+34周线强势上方';
        } else if (flowPos && chgPos && widthStrong && weeklyMid) {
          confirmLevel = '三确认';
          confirmLabel = '资金+价格+宽度满足，34周线' + (tl.weeklyStatus || '待确认') + '（非强势上方）';
        } else if (flowPos && chgPos && (widthStrong || weeklyStrong)) {
          confirmLevel = '弱确认';
          confirmLabel = '资金+价格满足，宽度或34周线未达门控';
        } else if (flowPos && chgPos) {
          confirmLevel = '弱确认';
          confirmLabel = '资金+价格满足，但宽度与34周线均未达门控';
        } else if (chgPos && !flowPos) {
          confirmLevel = '反抽';
          confirmLabel = '价格上涨但资金不足';
        } else if (!chgPos && flowPos) {
          confirmLevel = '承接';
          confirmLabel = '资金流入但价格回调';
        }
        var confirmClass = ({
          '四确认':'conf-full','三确认':'conf-three','弱确认':'conf-weak','反抽':'conf-rebound','承接':'conf-underpin','待确认':'conf-pending'
        })[confirmLevel];

        var confirmIcon = '<span class="leader-confirm ' + confirmClass + '">' + confirmLevel + '</span>';

        // 生命周期文案（按确认等级 + riskTone）
        var lifeText = confirmLevel;
        if (confirmLevel === '四确认' && (ds.riskTone === '进攻' || ds.riskTone === '轻进攻')) {
          lifeText = '主升';
        } else if (confirmLevel === '四确认' && ds.riskTone === '观察') {
          lifeText = '扩散';
        } else if (confirmLevel === '三确认') {
          lifeText = ds.riskTone === '防守' ? '潜在方向·回踩观察' : '短线承载';
        } else if (confirmLevel === '弱确认') {
          lifeText = ds.riskTone === '防守' ? '修复观察' : '修复';
        } else if (confirmLevel === '反抽') {
          lifeText = '价格扩散待确认';
        } else if (confirmLevel === '承接') {
          lifeText = '资金承接';
        }

        var lifeHtml = '<span class="life-tag life-' + (confirmClass || 'pending') + '">' + lifeText + '</span>';

        // 样本健康（按有效ETF数量分级，提示只在 valid<3 时出现）
        var sampleSize = tl.normalCount || 0;
        var sampleHealthTxt;
        if (q && q.coverageRatio < 0.6) {
          sampleHealthTxt = '<span class="sample-warn-tag">样本' + sampleSize + '只·不足</span>';
        } else if (q && q.hasAbnormalSample) {
          sampleHealthTxt = '<span class="sample-warn-tag">样本' + sampleSize + '只·异常剔除</span>';
        } else {
          var hLabel = q ? (q.coverageRatio >= 1.0 ? '充足' : '基本可用') : '';
          sampleHealthTxt = '<span class="sample-ok-tag">样本' + sampleSize + '只' + (hLabel ? '·' + hLabel : '') + '</span>';
        }

        return '<div class="leader-item">' +
          '<span class="leader-name">' + c.name + '</span>' +
          '<span class="mainline-type mainline-type-' + (typeClassMap[c.type] || 'neutral') + '">' + c.type + '</span>' +
          confirmIcon +
          lifeHtml +
          '<span class="leader-flow">' + flowTxt + '</span>' +
          '<span class="leader-flow5d">' + flow5dTxt + '</span>' +
          '<span class="leader-chg">' + chgTxt + '</span>' +
          '<span class="leader-width">' + upTxt + '</span>' +
          '<span class="leader-weekly">' + weeklyTxt + '</span>' +
          sampleHealthTxt +
        '</div>';
      }).filter(Boolean).join('')
    : '<div class="compact-empty">暂无正式主线，维持观察</div>';

  // 强线索待确认区（如果有）
  var strongClueSectionHtml = strongClue.length > 0
    ? '<div class="struct-section">' +
      '<div class="struct-section-title">④B 强线索待确认 <span class="struct-subtitle">（样本不足但信号突出，不作为正式主线，仅作观察）</span></div>' +
      '<div class="strong-clue-list">' +
        strongClue.slice(0, 3).map(function(c) {
          return '<div class="strong-clue-item">' +
            '<div class="sc-header"><span class="sc-name">' + c.name + '</span><span class="mainline-type mainline-type-clue">' + c.type + '</span></div>' +
            '<div class="sc-reason">' + (c.reason && c.reason.length > 0 ? '数据缺口：' + c.reason.join('，') : '') + '</div>' +
          '</div>';
        }).join('') +
      '</div>' +
    '</div>'
    : '';

  // ====== ⑤ 明日验证条件（最多3条）—— 两行布局：对象+状态 / 确认-证伪-动作 ======
  var tomorrowHtml = ds.tomorrowChecks.length > 0
    ? ds.tomorrowChecks.slice(0, 3).map(function(tc) {
        return '<div class="tomorrow-item">' +
          '<div class="tomorrow-row1">' +
            '<span class="tomorrow-layer">' + tc.layer + '</span>' +
            '<span class="tomorrow-status">— 待明日开盘验证</span>' +
          '</div>' +
          '<div class="tomorrow-row2">' +
            '<span>✅ ' + tc.item.confirm + '</span>' +
            '<span>❌ ' + tc.item.fail + '</span>' +
            '<span>👉 ' + tc.item.action + '</span>' +
          '</div>' +
        '</div>';
      }).join('')
    : '<div class="compact-empty">暂无明日验证条件</div>';

  // ====== ⑥ 数据质量提醒（分层口径，不写"100%"绝对值）======
  var warningItems = ds.dataWarnings.map(function(w) { return '<div class="dq-warning">⚠ ' + w + '</div>'; }).join('');
  var meta = entry.meta || {};
  var phaseLabels = { realtime:'盘中估算', preliminary:'盘后初版', confirmed:'盘后确认', partial:'数据不完整', stale:'数据过期', failed:'取数失败', pending:'待确认' };

  // 核心数据健康：6项决策支柱（用比例 100% / 部分 / 不可用，不再写笼统的"完整度100%"）
  var coreH = ds.coreDataHealth;
  var coreRatioTxt = coreH.ratio != null ? Math.round(coreH.ratio * 100) + '%' : '--';
  var coreMissingTxt = coreH.missing.length > 0 ? '（缺 ' + coreH.missing.join('、') + '）' : '';
  var coreStatusClass = coreH.status === '完整' ? 'dq-ok' : (coreH.status === '部分缺失' ? 'dq-warning' : 'dq-error');
  // 结构数据健康：主题覆盖（按实际主题覆盖计算，如 6/7）
  var structH = ds.structureDataHealth;
  var structMissingTxt = structH.missing.length > 0 ? '（缺 ' + structH.missing.slice(0, 5).join('、') + (structH.missing.length > 5 ? ' 等' + structH.missing.length + '个' : '') + '）' : '';
  var structStatusClass = structH.status === '全覆盖' ? 'dq-ok' : (structH.status === '部分主题缺数据' ? 'dq-warning' : 'dq-error');

  // 样本异常：聚合所有主题的异常剔除数
  var industryEtfBuckets = ds._raw.industryEtfBuckets;
  var abnormalTotal = 0;
  var abnormalByTheme = {};
  if (industryEtfBuckets) {
    Object.keys(industryEtfBuckets).forEach(function(k) {
      var b = industryEtfBuckets[k];
      if (b.abnormalCount) {
        abnormalTotal += b.abnormalCount;
        abnormalByTheme[k] = b.abnormalCount;
      }
    });
  }
  var abnormalClass = abnormalTotal === 0 ? 'dq-ok' : 'dq-warning';
  var abnormalTxt = abnormalTotal === 0 ? '无' : ('已剔除 ' + abnormalTotal + ' 只（' + Object.keys(abnormalByTheme).slice(0, 3).join('、') + (Object.keys(abnormalByTheme).length > 3 ? ' 等' : '') + '）');

  // 决策置信度（来自 dataQualityGate）
  var conf = (ds.dataQualityGate && ds.dataQualityGate.decisionConfidence) || '中';
  var confClass = conf === '高' ? 'dq-ok' : (conf === '中' ? 'dq-warning' : 'dq-error');

  var healthHtml =
    '<div class="dq-meta">阶段：<strong>' + (phaseLabels[meta.phase] || meta.phase || '--') + '</strong>' + (entry.label ? ' · ' + entry.label : '') + '</div>' +
    '<div class="dq-layer ' + coreStatusClass + '"><span class="dq-layer-label">核心数据完整度</span><strong>' + coreRatioTxt + ' · ' + coreH.status + '</strong><span class="dq-layer-detail">' + coreH.ok + '/' + coreH.total + ' 决策支柱' + coreMissingTxt + '</span></div>' +
    '<div class="dq-layer ' + structStatusClass + '"><span class="dq-layer-label">结构样本覆盖</span><strong>' + structH.ok + '/' + structH.total + ' 主题 · ' + structH.status + '</strong><span class="dq-layer-detail">' + structMissingTxt + '</span></div>' +
    '<div class="dq-layer ' + abnormalClass + '"><span class="dq-layer-label">样本异常</span><strong>' + abnormalTxt + '</strong><span class="dq-layer-detail">涨跌绝对值&gt;20% 已剔除</span></div>' +
    '<div class="dq-layer ' + confClass + '"><span class="dq-layer-label">决策置信度</span><strong>' + conf + '</strong><span class="dq-layer-detail">综合核心数据/结构覆盖/主题样本/异常剔除</span></div>' +
    (warningItems || '<div class="dq-ok">✓ 无额外数据告警</div>');

  // ====== 组装 00 决策总览 ======
  return '<div class="page tab-content" id="tab-structural">' +
    '<div class="wrap struct-wrap">' +

    '<div class="struct-section">' +
      '<div class="struct-section-title">① 今日决策卡</div>' +
      decisionCardHtml +
    '</div>' +

    '<div class="struct-section">' +
      '<div class="struct-section-title">② 关键里程碑信号</div>' +
      '<div class="milestone-list">' + milestoneHtml + '</div>' +
    '</div>' +

    '<div class="struct-section">' +
      '<div class="struct-section-title">③ 判断链摘要</div>' +
      chainHtml +
    '</div>' +

    (formalMainline.length > 0
      ? '<div class="struct-section">' +
        '<div class="struct-section-title">④ 结构承载榜 <span class="struct-subtitle">（与顶部正式主线候选一致 · 确认等级：四/三/弱/待）</span></div>' +
        '<div class="leader-list">' + leaderHtml + '</div>' +
      '</div>'
      : '<div class="struct-section"><div class="struct-section-title">④ 结构承载榜</div><div class="compact-empty">暂无正式主线，维持观察</div></div>') +

    (strongClue.length > 0 ? strongClueSectionHtml : '') +

    '<div class="struct-section">' +
      '<div class="struct-section-title">⑤ 明日验证条件</div>' +
      '<div class="tomorrow-list">' + tomorrowHtml + '</div>' +
    '</div>' +

    '<div class="struct-section">' +
      '<div class="struct-section-title">⑥ 数据质量提醒</div>' +
      '<div class="dq-list">' + healthHtml + '</div>' +
    '</div>' +

    '</div>' +
  '</div>';
}

// ============ 02 结构承载（方向页）============
function renderStructure(data, currentDt) {
  var entry = data.data[currentDt];
  if (!entry) return '<div class="page tab-content" id="tab-structure"><div class="wrap"><p>数据加载中...</p></div></div>';

  var ds = buildDecisionState(entry, data, currentDt);
  if (!ds) return '<div class="page tab-content" id="tab-structure"><div class="wrap"><p>决策链生成失败</p></div></div>';

  var sectorCycles = ds._raw.sectorCycles;
  var wma = ds._raw.wma;
  var industryEtfBrief = ds._raw.industryEtfBrief;
  var industryEtfBuckets = ds._raw.industryEtfBuckets;

  // ====== 结构承载榜：以"主题"为基本单位，合并 ETF池 + 生命周期 + ETF明细 ======
  // 数据源：
  //   - industryEtfBuckets[主题名]：每只 ETF 的 chg/flow/flow5d/fundSize（来自 etfTheme.categories + 异常剔除）
  //   - themeQualityMap[主题名]：dataQualityGate 的样本健康度（coverageRatio/hasAbnormalSample/missingFields/confidenceLevel）
  //   - ds.themeLeaders[].leaderType/fundEfficiency/scoreBreakdown：综合评分、类型、资金效率
  //   - sectorCycles：phase/judgment/confirm/fail 生命周期文案
  //   - wma：34 周线状态
  //   - formalMainline / strongClue：正式主线 / 强线索待确认 分组
  //   同主题的数据只出现一次（在卡内），不再在两张并列表之间来回对照。

  var bucketByName = {}; // name -> industryEtfBrief 行（已有 medianChg/upRatio/flowDay/flow5d/sampleCount）
  var bucketByCls = industryEtfBuckets || {}; // cls -> { name/etfs/normalCount/abnormalCount/... }
  if (industryEtfBrief && industryEtfBrief.length > 0) {
    industryEtfBrief.forEach(function(b) { bucketByName[b.name] = b; });
  }
  var themeLeadersArr = ds.themeLeaders || [];
  var themeLeaderByName = {};
  themeLeadersArr.forEach(function(tl) { themeLeaderByName[tl.name] = tl; });

  // 把所有候选主题收集起来：themeLeaders + industryEtfBrief + sectorCycles
  var themeNames = [];
  var seenName = {};
  themeLeadersArr.forEach(function(tl) { if (!seenName[tl.name]) { themeNames.push(tl.name); seenName[tl.name] = true; } });
  if (industryEtfBrief) industryEtfBrief.forEach(function(b) { if (!seenName[b.name]) { themeNames.push(b.name); seenName[b.name] = true; } });
  if (sectorCycles) sectorCycles.forEach(function(s) { if (!seenName[s.name]) { themeNames.push(s.name); seenName[s.name] = true; } });

  // 数据健康度查询表
  var tqMap = (ds && ds.themeQualityMap) || {};

  // 主题归类：正式主线 / 强线索待确认 / 其它观察
  var formalSet = {};
  (ds.formalMainline || []).forEach(function(m) { formalSet[m.name] = m; });
  var strongSet = {};
  (ds.strongClue || []).forEach(function(m) { strongSet[m.name] = m; });

  // 每张主题卡按主线分组，再按 themeLeaderScore 从高到低排序（score 缺失则按 flow5d）
  function rankOf(name) {
    var t = themeLeaderByName[name];
    if (t && typeof t.score === 'number') return [1, t.score];
    var b = bucketByName[name];
    if (b && b.flow5d != null) return [2, b.flow5d];
    return [3, 0];
  }
  function cmp(a, b) {
    var ra = rankOf(a), rb = rankOf(b);
    if (ra[0] !== rb[0]) return ra[0] - rb[0];
    return rb[1] - ra[1];
  }

  var formalList = [], strongList = [], otherList = [];
  themeNames.forEach(function(name) {
    // 至少要有一点数据才展示
    var b = bucketByName[name];
    var bucket = bucketByCls[name];
    if (!b && (!bucket || !(bucket.etfs || []).length)) return;
    if (formalSet[name]) formalList.push(name);
    else if (strongSet[name]) strongList.push(name);
    else otherList.push(name);
  });
  // 样本不足的主题即使没有数据质量门控归类，也可以放到"其它"（标注待确认）
  [formalList, strongList, otherList].forEach(function(arr) { arr.sort(cmp); });

  // === 渲染单张主题卡 ===
  // 主题广度(成分股)子主题 → 02页规范主题 的归属映射见模块级 BREADTH_ALIAS
  function renderThemeCard(name) {
    var b = bucketByName[name] || {};
    var bucket = bucketByCls[name] || { etfs: [], normalEtfs: [], abnormalEtfs: [] };
    var tl = themeLeaderByName[name] || {};
    var tq = tqMap[name] || {};
    var sc = (sectorCycles || []).find(function(s) { return s.name === name; }) || {};

    // 第1层：主题结论
    // confirmLevel 来源（优先级）：
    //   1) tq.confirmationLevel（数据质量门控直接推导）
    //   2) formalSet/strongSet.text（结构承载榜文本）
    //   3) sectorCycles.phase 推导出基础阶段
    //   4) 兜底：从 confirmCount + weeklyStatus 推导
    var confirmLevel = '';
    if (tq.confirmationLevel) {
      confirmLevel = tq.confirmationLevel;
    } else if (formalSet[name] && /\u4e3b\u5347|\u6269\u6563/.test(formalSet[name].text)) {
      confirmLevel = '四确认';
    } else if (formalSet[name]) {
      confirmLevel = '三确认';
    } else if (strongSet[name]) {
      confirmLevel = '强线索待确认';
    } else if (sc.phase && sc.phase !== '待接入数据') {
      confirmLevel = sc.phase;
    } else {
      confirmLevel = '待观察';
    }
    var confirmClass = ({'四确认':'lvl-4','三确认':'lvl-3','弱确认':'lvl-2','强线索待确认':'lvl-strong','待观察':'lvl-watch','待接入数据':'lvl-watch'})[confirmLevel] || 'lvl-watch';
    var leaderType = tl.leaderType || '中性';
    var typeClass = ({
      '资金驱动型':'type-drive','价格扩散型':'type-diffuse','资金承接型':'type-underpin',
      '反抽型':'type-rebound','兑现型':'type-cashout','退潮型':'type-outflow','中性':'type-neutral'
    })[leaderType] || 'type-neutral';
    var confidenceLevel = tq.confidenceLevel || (tq.coverageRatio != null ? (tq.coverageRatio >= 0.6 ? '中' : '低') : '--');
    var confidenceClass = ({'高':'conf-h','中':'conf-m','低':'conf-l'})[confidenceLevel] || 'conf-l';
    // 样本徽标：按有效ETF数量分级（不再展示比例口径，避免误导）
    var sampleHealthLabel = tq.coverageRatio >= 1.0 ? '充足' : (tq.coverageRatio >= 0.6 ? '基本可用' : (tq.coverageRatio > 0 ? '覆盖不足' : '不可用'));
    var sampleBadge = '样本 ' + (tq.sampleCount || 0) + '只 · ' + sampleHealthLabel;
    var sampleBadgeClass = (tq.coverageRatio != null && tq.coverageRatio < 0.6) || (tq.hasAbnormalSample) ? 'sample-warn-tag' : 'sample-ok-tag';

    var oneJudgment = (formalSet[name] && formalSet[name].text)
      || (strongSet[name] && strongSet[name].text)
      || sc.judgment
      || (b.flow5d != null ? '5日累计 ' + fmtSignedFlowYi(b.flow5d) + '，涨跌中位' + (b.medianChg != null ? fmtPct(b.medianChg) : '--') : '样本待接入');

    // 分组归属标签
    var groupLabel = '';
    if (formalSet[name]) groupLabel = '<span class="theme-group-tag group-formal">正式主线</span>';
    else if (strongSet[name]) groupLabel = '<span class="theme-group-tag group-strong">强线索待确认</span>';
    else groupLabel = '<span class="theme-group-tag group-other">其它</span>';

    // 34 周线状态（来自 themeLeader 或 sectorCycles）
    var weeklyStatus = tl.weeklyStatus || '';
    if (!weeklyStatus && sc.sd && sc.sd.klineCodes) {
      for (var wi = 0; wi < sc.sd.klineCodes.length; wi++) {
        if (wma[sc.sd.klineCodes[wi]]) { weeklyStatus = wma[sc.sd.klineCodes[wi]].status; break; }
      }
    }
    var weeklyBadge = weeklyStatus ? '<span class="role-tag role-' + ({'强势上方':'lead','回踩观察':'hold','趋势争夺':'wait','反抽不过':'rebound','中期弱势':'out','偏强':'hold','偏弱':'drag'})[weeklyStatus] + '">' + weeklyStatus + '</span>' : '<span class="struct-missing">待接入</span>';

    var headerHtml =
      '<div class="theme-card-header">' +
        '<div class="theme-card-title">' +
          '<span class="theme-card-name">' + name + '</span>' +
          groupLabel +
          '<span class="theme-card-type ' + typeClass + '">' + leaderType + '</span>' +
          '<span class="theme-card-confirm ' + confirmClass + '">' + confirmLevel + '</span>' +
          '<span class="theme-card-confidence ' + confidenceClass + '">置信度：' + confidenceLevel + '</span>' +
          (tq.hasAbnormalSample ? '<span class="sample-warn-tag">已剔除 ' + (tq.abnormalSampleCount || '若干') + ' 只异常</span>' : '') +
          '<span class="' + sampleBadgeClass + '">' + sampleBadge + '</span>' +
        '</div>' +
        '<div class="theme-card-meta">' +
          '<span class="theme-card-meta-label">判断：</span>' +
          '<span class="theme-card-meta-text">' + oneJudgment + '</span>' +
        '</div>' +
        (tl.score != null ? '<div class="theme-card-score">综合评分 <strong>' + (typeof tl.score === 'number' ? tl.score.toFixed(0) : tl.score) + '</strong> 分</div>' : '') +
      '</div>';

    // 第2层：核心指标
    // 主题广度：成分股涨跌家数口径（Wind 指数成分股），保持口径不改为 ETF 级
    // 02页规范主题(科技成长/有色资源等)由多个子主题指数聚合，需把子主题映射到规范主题后汇总
    var tbThemes = [];
    if (entry && entry.themeBreadth && Array.isArray(entry.themeBreadth.themes)) {
      for (var tbi = 0; tbi < entry.themeBreadth.themes.length; tbi++) {
        var tbT = entry.themeBreadth.themes[tbi];
        var tbAlias = BREADTH_ALIAS[tbT.name];
        if (tbAlias === name && tbT.upRatio != null) tbThemes.push(tbT);
      }
    }
    var tbCard = null;
    if (tbThemes.length > 0) {
      var _u = 0, _d = 0, _f = 0, _t = 0;
      tbThemes.forEach(function (x) { _u += (x.upCount || 0); _d += (x.downCount || 0); _f += (x.flatCount || 0); _t += (x.totalCount || 0); });
      tbCard = { upCount: _u, downCount: _d, flatCount: _f, totalCount: _t, upRatio: _t > 0 ? _u / _t : null };
    }
    var breadthUpRatio = tbCard ? tbCard.upRatio : (b.upRatio != null ? b.upRatio : null);
    var breadthLabel = tbCard ? '主题广度(成分股)' : '上涨ETF比例';
    var breadthVal = breadthUpRatio != null ? (breadthUpRatio * 100).toFixed(0) + '%' : '--';
    if (tbCard) breadthVal += '<span class="breadth-counts">(' + tbCard.upCount + '涨/' + tbCard.downCount + '跌/' + tbCard.flatCount + '平)</span>';
    var statsHtml =
      '<div class="theme-card-stats">' +
        statCell('当日涨跌中位数', b.medianChg != null ? fmtPct(b.medianChg) : '--', upDn(b.medianChg)) +
        statCell('5日涨跌中位数', calc5dMedian(b, bucket) != null ? fmtPct(calc5dMedian(b, bucket)) : '--', upDn(calc5dMedian(b, bucket))) +
        statCell('当日ETF净流入', b.flowDay != null ? fmtSignedFlowYi(b.flowDay) : '--', upDn(b.flowDay)) +
        statCell('5日ETF净流入', b.flow5d != null ? fmtSignedFlowYi(b.flow5d) : '--', upDn(b.flow5d)) +
        statCell(breadthLabel, breadthVal, breadthUpRatio != null ? (breadthUpRatio >= 0.6 ? 'green' : breadthUpRatio <= 0.4 ? 'red' : 'struct-neutral') : '') +
        statCell('有效ETF样本数', (b.normalCount != null ? b.normalCount : (bucket.normalCount != null ? bucket.normalCount : (b.etfs ? b.etfs.length : (bucket.etfs ? bucket.etfs.length : 0)))) + ' 只', '') +
        statCell('34周线', weeklyBadge) +
        statCell('资金效率', tl.fundEfficiency != null ? tl.fundEfficiency.toFixed(2) + '%' : '--', tl.fundEfficiency != null ? (tl.fundEfficiency > 0 ? 'green' : tl.fundEfficiency < 0 ? 'red' : 'struct-neutral') : '') +
      '</div>';

    // 第3层：ETF明细
    // 优先用 briefRow.etfs（同名主题的 ETF 明细，与 ds.themeLeaders 同源）
    // 兜底从 industryEtfBuckets 按 cls key 取
    var etfRows = (b && Array.isArray(b.etfs) && b.etfs.length > 0) ? b.etfs.slice() : ((bucket.etfs || []).slice());
    // 排序：5日净流入 > 当日净流入 > 成交额
    etfRows.sort(function(x, y) {
      var x5 = x.flow5d != null ? x.flow5d : (x.flow != null ? x.flow : (x.volume != null ? -x.volume : -Infinity));
      var y5 = y.flow5d != null ? y.flow5d : (y.flow != null ? y.flow : (y.volume != null ? -y.volume : -Infinity));
      return y5 - x5;
    });
    var ABNORMAL_THRESHOLD = 20;
    var normalRows = etfRows.filter(function(e) { return !(e.chg != null && Math.abs(e.chg) > ABNORMAL_THRESHOLD); });
    var abnormalRows = etfRows.filter(function(e) { return e.chg != null && Math.abs(e.chg) > ABNORMAL_THRESHOLD; });
    var visibleRows = etfRows; // 不剔，让用户看到异常样本（"样本状态"会标注）
    var isLong = visibleRows.length > 10;
    var topRows = isLong ? visibleRows.slice(0, 10) : visibleRows;
    var restRows = isLong ? visibleRows.slice(10) : [];

    function etfStatusOf(e) {
      if (e.chg != null && Math.abs(e.chg) > ABNORMAL_THRESHOLD) return '<span class="sample-warn-tag">异常</span>';
      if (e.flow == null && e.flow5d == null && e.chg == null) return '<span class="struct-missing">缺数据</span>';
      return '<span class="sample-ok-tag">正常</span>';
    }
    function etfRowHtml(e) {
      var chg5dVal = calcEtf5dChg(e, entry);
      return '<tr>' +
        '<td>' + e.code + '</td>' +
        '<td>' + (e.name || '--') + '</td>' +
        '<td class="' + upDn(e.chg) + '">' + (e.chg != null ? fmtPct(e.chg) : '--') + '</td>' +
        '<td class="' + upDn(chg5dVal) + '">' + (chg5dVal != null ? fmtPct(chg5dVal) : '--') + '</td>' +
        '<td class="' + upDn(e.flow) + '">' + (e.flow != null ? fmtSignedFlowYi(e.flow) : '--') + '</td>' +
        '<td class="' + upDn(e.flow5d) + '">' + (e.flow5d != null ? fmtSignedFlowYi(e.flow5d) : '--') + '</td>' +
        '<td>' + (e.volume != null ? fmt(e.volume) + '万' : '--') + '</td>' +
        '<td>' + (e.fundSize != null ? e.fundSize.toFixed(2) + '亿' : '--') + '</td>' +
        '<td>' + etfStatusOf(e) + '</td>' +
      '</tr>';
    }

    var tableBody = topRows.map(etfRowHtml).join('') + (abnormalRows.length > 0 ? '<tr class="abn-row-info"><td colspan="9">⚠ 异常样本（涨跌绝对值&gt;20%，已从涨跌中位数/上涨比例中剔除，但保留明细供查阅）</td></tr>' : '') + abnormalRows.map(etfRowHtml).join('');
    var restBody = restRows.map(etfRowHtml).join('');
    var tableId = 'themeEtfTbl_' + name.replace(/[^\w]/g, '_');
    var etfHtml =
      '<div class="theme-card-etfs">' +
        '<div class="theme-card-etfs-head">' +
          '<span>ETF 明细</span>' +
          '<span class="theme-card-etfs-meta">共 ' + visibleRows.length + ' 只' + (abnormalRows.length > 0 ? '（含 ' + abnormalRows.length + ' 异常）' : '') + '</span>' +
        '</div>' +
        '<div class="tbl-scroll"><table class="struct-table theme-card-table">' +
          '<thead><tr><th>代码</th><th>名称</th><th>当日</th><th>5日</th><th>当日净流入</th><th>5日净流入</th><th>成交额</th><th>规模</th><th>样本状态</th></tr></thead>' +
          '<tbody>' + tableBody + '</tbody>' +
          (restRows.length > 0 ? '<tbody class="theme-card-rest" id="' + tableId + '" style="display:none">' + restBody + '</tbody>' : '') +
        '</table></div>' +
        (restRows.length > 0 ? '<div class="theme-card-expand"><button class="theme-expand-btn" data-target="' + tableId + '">展开全部（+ ' + restRows.length + ' 只）</button></div>' : '') +
      '</div>';

    return '<div class="theme-card">' + headerHtml + statsHtml + etfHtml + '</div>';
  }

  function statCell(label, value, colorClass) {
    return '<div class="theme-card-stat">' +
      '<span class="theme-stat-label">' + label + '</span>' +
      '<span class="theme-stat-value ' + (colorClass || '') + '">' + value + '</span>' +
    '</div>';
  }

  // 5日涨跌中位数（如果没有 medianChg5d 字段就退化为当日涨跌）
  function calc5dMedian(briefRow, bucket) {
    if (briefRow && briefRow.medianChg5d != null && isFinite(briefRow.medianChg5d)) return briefRow.medianChg5d;
    return briefRow ? briefRow.medianChg : null;
  }

  // 单只 ETF 5 日涨跌幅（若无当日明细则退化为当日涨跌；接受 entry 用 K线兜底）
  function calcEtf5dChg(e, entryArg) {
    if (!e) return null;
    return calcEtfChg5d(e, entryArg || entry);
  }

  var htmlFormal = formalList.length > 0
    ? formalList.map(renderThemeCard).join('')
    : '<div class="compact-empty">暂无正式主线候选主题</div>';
  var htmlStrong = strongList.length > 0
    ? strongList.map(renderThemeCard).join('')
    : '<div class="compact-empty">暂无强线索主题</div>';
  var htmlOther = otherList.length > 0
    ? otherList.map(renderThemeCard).join('')
    : '<div class="compact-empty">暂无其它主题数据</div>';

  // 渲染空状态：完全没数据
  if (formalList.length === 0 && strongList.length === 0 && otherList.length === 0) {
    htmlFormal = '<div class="struct-missing">主题数据待接入</div>';
  }

  return '<div class="page tab-content" id="tab-structure">' +
    '<div class="wrap">' +

    (formalList.length > 0
      ? '<div class="module-title"><span class="num">01</span><span class="title">结构承载榜 · 正式主线候选</span><span class="subtitle">同主题下：第①层 主题结论 → 第②层 核心指标 → 第③层 ETF明细</span></div>' +
        '<div class="theme-card-group group-formal-section">' + htmlFormal + '</div>'
      : '<div class="module-title"><span class="num">01</span><span class="title">结构承载榜 · 正式主线候选</span></div><div class="compact-empty">暂无正式主线候选主题</div>') +

    (strongList.length > 0
      ? '<div class="module-title"><span class="num">02</span><span class="title">强线索待确认</span><span class="subtitle">数据信号强，但样本覆盖不足 / 缺 34 周线，需补齐后确认</span></div>' +
        '<div class="theme-card-group group-strong-section">' + htmlStrong + '</div>'
      : '') +

    (otherList.length > 0
      ? '<div class="module-title"><span class="num">03</span><span class="title">其它主题</span><span class="subtitle">信号较弱或数据不足，仅作观察</span></div>' +
        '<div class="theme-card-group group-other-section">' + htmlOther + '</div>'
      : '') +

    '</div>' +
  '</div>';
}

// ============ 03 资金与情绪（力量页）============
function renderCapitalEmotion(data, currentDt) {
  var entry = data.data[currentDt];
  if (!entry) return '<div class="page tab-content" id="tab-capital-emo"><div class="wrap"><p>数据加载中...</p></div></div>';

  var ds = buildDecisionState(entry, data, currentDt);
  if (!ds) return '<div class="page tab-content" id="tab-capital-emo"><div class="wrap"><p>决策链生成失败</p></div></div>';

  var funding = ds._raw.funding;
  var fundingSummary = ds._raw.fundingSummary;
  var dates = data.dates;
  var dtIdx = dates.indexOf(currentDt);

  // ====== 01 资金性质判断 ======
  var natureHtml = '<div class="nature-card nature-' + ({
    '主动进攻':'attack','被动护盘':'defend','结构切换':'switch','全面撤退':'retreat','分歧':'divergence'
  })[ds.fundingNature] + '">' +
    '<div class="nature-label">资金性质</div>' +
    '<div class="nature-value">' + ds.fundingNature + '</div>' +
    '<div class="nature-desc">' + (fundingSummary || '') + '</div>' +
  '</div>';

  // ====== 02 宽基ETF多日趋势 ======
  var wideRows = [];
  for (var i = Math.max(0, dtIdx - 4); i <= dtIdx; i++) {
    var d = dates[i];
    var e = data.data[d];
    if (!e || !e.etfWide) continue;
    wideRows.push('<tr><td>' + (e.label || d) + '</td><td class="' + upDn(e.etfWide.totalFlow) + '">' + (e.etfWide.totalFlow != null ? fmtSignedFlowYi(e.etfWide.totalFlow) : '--') + '</td></tr>');
  }
  var wideTrendHtml = wideRows.length > 0
    ? '<div class="tbl-scroll"><table class="struct-table"><thead><tr><th>日期</th><th>宽基ETF净流入</th></tr></thead><tbody>' + wideRows.join('') + '</tbody></table></div>'
    : '<div class="struct-missing">宽基ETF历史待接入</div>';

  // ====== 03 主题ETF多日趋势（与 calculateFundingLayers 同源：entry.etfTheme.categories）======
  var themeRows = [];
  for (var i = Math.max(0, dtIdx - 4); i <= dtIdx; i++) {
    var d = dates[i];
    var e = data.data[d];
    if (!e) continue;
    var themeTotal = 0;
    if (e.etfTheme && e.etfTheme.categories) {
      Object.keys(e.etfTheme.categories).forEach(function(ck) {
        var cat = e.etfTheme.categories[ck];
        if (!cat || !cat.themes) return;
        Object.keys(cat.themes).forEach(function(tk) {
          var f = cat.themes[tk].flow;
          if (f != null && isFinite(f)) themeTotal += f;
        });
      });
    }
    themeRows.push('<tr><td>' + (e.label || d) + '</td><td class="' + upDn(themeTotal) + '">' + fmtSignedFlowYi(themeTotal) + '</td></tr>');
  }
  var themeTrendHtml = themeRows.length > 0
    ? '<div class="tbl-scroll"><table class="struct-table"><thead><tr><th>日期</th><th>主题ETF合计净流入 <span class="caliber-tag">（etfTheme口径）</span></th></tr></thead><tbody>' + themeRows.join('') + '</tbody></table></div>'
    : '<div class="struct-missing">主题ETF历史待接入</div>';

  // ====== 04 融资多日趋势 ======
  var marginRows = [];
  for (var i = Math.max(0, dtIdx - 4); i <= dtIdx; i++) {
    var d = dates[i];
    var e = data.data[d];
    if (!e || !e.margin) continue;
    var m = e.margin;
    marginRows.push('<tr><td>' + (e.label || d) + '</td><td>' + (m.value != null ? m.value.toFixed(4) + ' 万亿' : '--') + '</td><td class="' + upDn(m.chgYi) + '">' + (m.chgYi != null ? fmtSignedFlowYi(m.chgYi) : '--') + '</td>' + (m.isStale ? '<td>T+1</td>' : '<td></td>') + '</tr>');
  }
  var marginTrendHtml = marginRows.length > 0
    ? '<div class="tbl-scroll"><table class="struct-table"><thead><tr><th>日期</th><th>余额</th><th>较前日</th><th>备注</th></tr></thead><tbody>' + marginRows.join('') + '</tbody></table></div>'
    : '<div class="struct-missing">融资历史待接入</div>';

  // ====== 05 涨停跌停连板 ======
  var emoLayer = funding.find(function(f) { return f.layer === '情绪资金'; });
  var emoTodayHtml = emoLayer
    ? '<div class="emo-today">' +
      '<div class="emo-item"><span>涨停</span><strong class="green">' + (emoLayer.limitUp != null ? emoLayer.limitUp + ' 家' : '--') + '</strong></div>' +
      '<div class="emo-item"><span>跌停</span><strong class="red">' + (emoLayer.limitDown != null ? emoLayer.limitDown + ' 家' : '--') + '</strong></div>' +
      '<div class="emo-item"><span>连板高度</span><strong>' + (emoLayer.limitHeight != null ? emoLayer.limitHeight + ' 板' : '待接入') + '</strong></div>' +
      '<div class="emo-item"><span>情绪状态</span><strong>' + (emoLayer.emoStatus || '--') + '</strong></div>' +
    '</div>'
    : '<div class="struct-missing">情绪数据待接入</div>';

  // 情绪多日
  var emoRows = [];
  for (var i = Math.max(0, dtIdx - 4); i <= dtIdx; i++) {
    var d = dates[i];
    var e = data.data[d];
    if (!e) continue;
    try {
      var fr = calculateFundingLayers(e, data, d);
      var el = fr.layers.find(function(f) { return f.layer === '情绪资金'; });
      if (el) {
        emoRows.push('<tr><td>' + (e.label || d) + '</td><td class="green">' + (el.limitUp != null ? el.limitUp : '--') + '</td><td class="red">' + (el.limitDown != null ? el.limitDown : '--') + '</td><td>' + (el.limitHeight != null ? el.limitHeight : '--') + '</td></tr>');
      }
    } catch(err) {}
  }
  var emoTrendHtml = emoRows.length > 0
    ? '<div class="tbl-scroll"><table class="struct-table"><thead><tr><th>日期</th><th>涨停</th><th>跌停</th><th>连板高度</th></tr></thead><tbody>' + emoRows.join('') + '</tbody></table></div>'
    : '<div class="struct-missing">情绪历史待接入</div>';

  // ====== 06 资金分层 ======
  var fundingLayersHtml = funding.map(function(f) {
    var f1d, f5d;
    if (f.layer === '情绪资金') {
      f1d = f.limitUp != null ? f.limitUp + ' 涨停' : '--';
      f5d = f.limitDown != null ? f.limitDown + ' 跌停' : '--';
    } else {
      f1d = f.flow1d != null ? '<span class="' + upDn(f.flow1d) + '">' + fmtSignedFlowYi(f.flow1d) + '</span>' : '--';
      f5d = f.flow5d != null ? '<span class="' + upDn(f.flow5d) + '">' + fmtSignedFlowYi(f.flow5d) + '</span>' : '--';
    }
    return '<div class="fund-layer-compact">' +
      '<span class="fund-name">' + f.layer + '</span>' +
      '<span class="fund-1d">' + f1d + '</span>' +
      '<span class="fund-5d">' + f5d + '</span>' +
      '<span class="fund-judgment">' + f.judgment + '</span>' +
    '</div>';
  }).join('');

  return '<div class="page tab-content" id="tab-capital-emo">' +
    '<div class="wrap">' +

    '<div class="module-title"><span class="num">01</span><span class="title">资金性质判断</span></div>' +
    natureHtml +

    '<div class="module-title"><span class="num">02</span><span class="title">宽基ETF多日趋势</span><span class="subtitle">近5日</span></div>' +
    wideTrendHtml +

    '<div class="module-title"><span class="num">03</span><span class="title">主题ETF多日趋势</span><span class="subtitle">近5日合计</span></div>' +
    themeTrendHtml +

    '<div class="module-title"><span class="num">04</span><span class="title">融资多日趋势</span><span class="subtitle">近5日</span></div>' +
    marginTrendHtml +

    '<div class="module-title"><span class="num">05</span><span class="title">涨停跌停连板</span></div>' +
    emoTodayHtml +
    emoTrendHtml +

    '<div class="module-title"><span class="num">06</span><span class="title">资金分层</span><span class="subtitle">四层资金当日+5日</span></div>' +
    '<div class="fund-list-compact">' + fundingLayersHtml + '</div>' +

    '</div>' +
  '</div>';
}

// ============ 04 验证与数据质量（复核页）============
function renderValidationQuality(data, currentDt) {
  var entry = data.data[currentDt];
  if (!entry) return '<div class="page tab-content" id="tab-validate-q"><div class="wrap"><p>数据加载中...</p></div></div>';

  var ds = buildDecisionState(entry, data, currentDt);
  if (!ds) return '<div class="page tab-content" id="tab-validate-q"><div class="wrap"><p>决策链生成失败</p></div></div>';

  var indexMatrix = ds._raw.indexMatrix;
  var indexConclusion = ds._raw.indexConclusion;
  var events = ds._raw.events;
  var sectorCycles = ds._raw.sectorCycles;

  // ====== 01 指数验证矩阵 ======
  var idxMatrixHtml = '';
  if (indexMatrix && indexMatrix.length > 0) {
    idxMatrixHtml = indexMatrix.map(function(g) {
      var rows = g.items.map(function(it, ii) {
        var chg1d = it.chg1d != null ? '<span class="' + upDn(it.chg1d) + '">' + fmtPct(it.chg1d) + '</span>' : '<span class="struct-missing">—</span>';
        var chg5d = it.chg5d != null ? '<span class="' + upDn(it.chg5d) + '">' + fmtPct(it.chg5d) + '</span>' : '<span class="struct-missing">—</span>';
        var vsFullA = it.vsFullA != null ? '<span class="' + upDn(it.vsFullA) + '">' + (it.vsFullA >= 0 ? '+' : '') + it.vsFullA.toFixed(2) + '%</span>' : '<span class="struct-missing">—</span>';
        var weeklyCell = it.weekly34Status
          ? '<span class="role-tag role-' + ({'强势上方':'lead','回踩观察':'hold','趋势争夺':'wait','反抽不过':'rebound','中期弱势':'out'})[it.weekly34Status] + '">' + it.weekly34Text + '</span>'
          : '<span class="struct-missing">—</span>';
        var nameCell = (ii === 0) ? '<strong>' + it.name + '</strong> <span class="idx-focus-tag">' + (g.validationFocus || '—') + '</span>' : it.name;
        return '<tr><td>' + nameCell + '</td><td>' + chg1d + '</td><td>' + chg5d + '</td><td>' + vsFullA + '</td><td>' + weeklyCell + '</td></tr>';
      }).join('');
      return '<div class="tbl-scroll"><table class="struct-table idx-table"><thead><tr><th>代表指数</th><th>当日</th><th>5日</th><th>相对全A</th><th>34周线</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
    }).join('');
  }

  // ====== 02 主线验证（5维度结论）======
  var idxConclusionList = Array.isArray(indexConclusion) ? indexConclusion : [];
  var idxConclusionHtml = idxConclusionList.map(function(c) {
    return '<div class="idx-concl-row"><span class="idx-concl-dim">' + c.dim + '</span><span class="idx-concl-text">' + c.conclusion + '</span></div>';
  }).join('');

  // ====== 03 事件日历 ======
  var eventRows = events.map(function(ev) {
    var statusClass = ev.status === '已发生' ? 'evt-status-past' : 'evt-status-future';
    return '<tr><td><span class="evt-status ' + statusClass + '">' + ev.status + '</span></td><td>' + ev.date + '</td><td>' + ev.event + '</td><td>' + ev.impact + '</td><td>' + ev.riskType + '</td></tr>';
  }).join('');

  // ====== 04 异常数据 ======
  var industryEtfBuckets = ds._raw.industryEtfBuckets;
  var abnormalHtml = '';
  if (industryEtfBuckets) {
    var abnormalList = [];
    Object.keys(industryEtfBuckets).forEach(function(k) {
      var b = industryEtfBuckets[k];
      if (b.abnormalEtfs && b.abnormalEtfs.length > 0) {
        b.abnormalEtfs.forEach(function(e) {
          abnormalList.push('<div class="abnormal-item"><span>' + k + '</span><span>' + e.code + ' ' + e.name + '</span><span class="red">涨跌 ' + (e.chg > 0 ? '+' : '') + e.chg.toFixed(2) + '%</span></div>');
        });
      }
    });
    abnormalHtml = abnormalList.length > 0 ? abnormalList.join('') : '<div class="dq-ok">✓ 无异常数据样本</div>';
  }

  // ====== 05 缺数据主题 ======
  var missingThemes = sectorCycles.filter(function(s) {
    return !s.phase || s.phase === '待接入数据';
  });
  var missingHtml = missingThemes.length > 0
    ? missingThemes.map(function(s) { return '<div class="missing-theme">⚠ ' + s.name + '：' + (s.sd.note || '数据缺失') + '</div>'; }).join('')
    : '<div class="dq-ok">✓ 所有主题数据可用</div>';

  // ====== 06 数据质量提醒 ======
  var dqHtml = ds.dataWarnings.length > 0
    ? ds.dataWarnings.map(function(w) { return '<div class="dq-warning">⚠ ' + w + '</div>'; }).join('')
    : '<div class="dq-ok">✓ 数据质量正常</div>';

  // ====== 07 数据质量门控（反向约束 00）======
  // 显示哪些主题被 dataQualityGate 阻挡、为什么阻挡
  var gate = ds.dataQualityGate || {};
  var themeQualityMap = gate.themeQualityMap || {};
  var formalMainlineNames = (ds.formalMainline || []).map(function(c) { return c.name; });
  var strongClueNames = (ds.strongClue || []).map(function(c) { return c.name; });
  var allThemeNames = Object.keys(themeQualityMap);
  var blockedNames = allThemeNames.filter(function(n) {
    return formalMainlineNames.indexOf(n) < 0 && strongClueNames.indexOf(n) < 0;
  });
  var gateRows = [];
  formalMainlineNames.forEach(function(n) {
    var q = themeQualityMap[n] || {};
    gateRows.push({ name: n, status: '正式主线', detail: '有效' + (q.sampleCount || 0) + '只 · 置信' + (q.confidenceLevel || '高'), cls: 'gate-pass' });
  });
  strongClueNames.forEach(function(n) {
    var q = themeQualityMap[n] || {};
    var reasonTxt = [];
    if (q.coverageRatio < 0.6) reasonTxt.push('有效样本' + (q.sampleCount || 0) + '只不足');
    if (q.hasAbnormalSample) reasonTxt.push('异常剔除');
    if (q.missingFields && q.missingFields.length > 0) reasonTxt.push('缺' + q.missingFields.join('/'));
    gateRows.push({ name: n, status: '强线索待确认', detail: reasonTxt.join('，') || '数据缺陷待补', cls: 'gate-clue' });
  });
  blockedNames.forEach(function(n) {
    var q = themeQualityMap[n] || {};
    var reasonTxt = [];
    if ((q.score || 0) < 30) reasonTxt.push('评分低');
    if (q.leaderType === '退潮型') reasonTxt.push('退潮型');
    if (q.coverageRatio < 0.6) reasonTxt.push('有效样本' + (q.sampleCount || 0) + '只不足');
    gateRows.push({ name: n, status: '未入选', detail: reasonTxt.join('，') || '信号不足', cls: 'gate-block' });
  });
  var gateHtml = gateRows.length > 0
    ? gateRows.map(function(r) {
        return '<div class="gate-row ' + r.cls + '"><span class="gate-name">' + r.name + '</span><span class="gate-status">' + r.status + '</span><span class="gate-detail">' + r.detail + '</span></div>';
      }).join('')
    : '<div class="dq-ok">✓ 所有主题都已评估</div>';

  return '<div class="page tab-content" id="tab-validate-q">' +
    '<div class="wrap">' +

    '<div class="module-title"><span class="num">01</span><span class="title">指数验证矩阵</span><span class="subtitle">5维度验证</span></div>' +
    (idxMatrixHtml || '<div class="struct-missing">指数验证矩阵待接入</div>') +

    '<div class="module-title"><span class="num">02</span><span class="title">主线验证</span><span class="subtitle">5维度结论</span></div>' +
    (idxConclusionHtml || '<div class="struct-missing">主线验证待接入</div>') +

    '<div class="module-title"><span class="num">03</span><span class="title">事件日历</span><span class="subtitle">人工维护</span></div>' +
    '<div class="tbl-scroll"><table class="struct-table evt-table"><thead><tr><th>状态</th><th>日期</th><th>事件</th><th>影响</th><th>风险类型</th></tr></thead><tbody>' + eventRows + '</tbody></table></div>' +

    '<div class="module-title"><span class="num">04</span><span class="title">异常数据</span><span class="subtitle">涨跌绝对值&gt;20%已剔除</span></div>' +
    abnormalHtml +

    '<div class="module-title"><span class="num">05</span><span class="title">缺数据主题</span></div>' +
    missingHtml +

    '<div class="module-title"><span class="num">06</span><span class="title">数据质量提醒</span></div>' +
    '<div class="dq-list">' + dqHtml + '</div>' +

    '<div class="module-title"><span class="num">07</span><span class="title">数据质量门控 · 反向约束 00</span><span class="subtitle">哪些主题被 00 正式主线/强线索 接纳 vs 阻挡</span></div>' +
    '<div class="gate-list">' + gateHtml + '</div>' +

    '<div class="module-title"><span class="num">08</span><span class="title">口径说明</span></div>' +
    '<div class="struct-caliber">' +
      '<p><strong>风险底色</strong>：极端/收缩/中性/宽松。融资5日净偿还&gt;500亿判极端；200-500亿判收缩。</p>' +
      '<p><strong>风险底色优先级最高</strong>：宽基+主题同时大幅流出或跌停扩散，直接降为防守/观察。宽基流出但主题流入=结构切换，不是全面撤退。</p>' +
      '<p><strong>确认等级（00 顶部规则）</strong>：四确认=资金+价格+宽度≥60%+34周线强势上方；三确认=资金+价格+宽度满足，但34周线是回踩观察/趋势争夺；弱确认=只有资金和价格满足；待确认=信号或样本不足。</p>' +
      '<p><strong>主线类型（6 种）</strong>：资金驱动型/价格扩散型/资金承接型/反抽型/兑现型/退潮型。</p>' +
      '<p><strong>dataQualityGate 阻挡规则</strong>：主题覆盖率&lt;60% → 不能进入正式主线；样本不足但信号强 → 进入强线索待确认；异常剔除 → 标注降权但允许进入正式主线。</p>' +
      '<p><strong>rhythmState</strong>：主升/放量分歧/缩量修复/平量拉锯/回调放量/退潮。</p>' +
      '<p><strong>fundingNature</strong>：主动进攻/被动护盘/结构切换/全面撤退/分歧。</p>' +
    '</div>' +

    '</div>' +
  '</div>';
}

module.exports = {
  renderTopbar,
  renderReview,
  renderCapital,
  renderEtf,
  renderValidate,
  renderQuality,
  renderStructuralReview,
  renderStructure,
  renderCapitalEmotion,
  renderValidationQuality,
  buildDecisionState,
  buildIndustryEtfBuckets,
  buildIndustryEtfBrief,
  classifyEtf,
  avgEtfUpRatio,
  median,
  fmt,
  fmtPct,
  fmtFlow,
  fmtSignedFlowYi,
  upDn,
  statusTag
};
