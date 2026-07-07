/**
 * states.js — 状态判断层
 * 四信号体系 → 信号一致度 → 市场阶段
 * 主题状态 + 主线验证
 *
 * 阈值策略（如实标注）：
 * - 历史分位：成交额、集中度水平判断使用20日分位（动态）
 * - 业务阈值：5日均值偏离幅度（±10%）、宽基ETF单日净流入方向（0为界，不用固定亿数）
 * - 真实宽度：优先使用全市场上涨占比；缺失时回退TOP10代理，代理置信度强制降级
 */

'use strict';

const { safeNum } = require('./normalize');

// ============ 四信号体系 ============

/**
 * 计算四类信号
 * @param {Object} entry - 标准化+派生的单日数据
 * @returns {Object} { liquidity, breadth, support, structure }
 */
function calcSignals(entry) {
  const c = entry.computed || {};

  return {
    liquidity: calcLiquiditySignal(entry, c),
    breadth: calcBreadthSignal(entry, c),
    support: calcSupportSignal(entry, c),
    structure: calcStructureSignal(entry, c)
  };
}

/**
 * 流动性信号：成交额 vs 5日均值 + 20日分位
 */
function calcLiquiditySignal(entry, c) {
  const total = entry.concentration.totalAmount;
  const vs5d = c.amountVs5d;
  const pctile = c.amountPctile20d;

  if (total == null) {
    return { signal: 'unknown', label: '数据不足', strength: 0, detail: '成交额数据缺失' };
  }

  let score = 0;
  const reasons = [];

  if (vs5d != null) {
    if (vs5d > 10) { score += 2; reasons.push('较5日均值放大' + vs5d.toFixed(0) + '%'); }
    else if (vs5d > 0) { score += 1; reasons.push('略高于5日均值'); }
    else if (vs5d > -10) { score -= 1; reasons.push('略低于5日均值'); }
    else { score -= 2; reasons.push('较5日均值缩量' + Math.abs(vs5d).toFixed(0) + '%'); }
  }

  if (pctile != null) {
    if (pctile > 0.7) { score += 1; reasons.push('处于20日高位(' + (pctile * 100).toFixed(0) + '%分位)'); }
    else if (pctile < 0.3) { score -= 1; reasons.push('处于20日低位(' + (pctile * 100).toFixed(0) + '%分位)'); }
  }

  let signal, label;
  if (score >= 2) { signal = 'expanding'; label = '流动性扩张'; }
  else if (score >= 0) { signal = 'neutral'; label = '流动性中性'; }
  else { signal = 'contracting'; label = '流动性收缩'; }

  return { signal, label, strength: score, detail: reasons.join('；') };
}

/**
 * 市场宽度信号
 * 市场宽度信号：优先真实全市场上涨占比；缺失时用TOP10代理 + 集中度变化推断
 * 重要：代理数据强制降权，单证据最多±1分，且置信度自动降级
 */
function calcBreadthSignal(entry, c) {
  const top100Chg = c.top100Chg;
  const realUpRatio = entry.market && entry.market.breadthSource === 'wind' && entry.market.upRatio != null
    ? entry.market.upRatio
    : null;
  const proxyUpRatio = c.top10UpRatio;

  if (realUpRatio == null && proxyUpRatio == null && top100Chg == null) {
    return { signal: 'unknown', label: '宽度数据不足', strength: 0, detail: '市场宽度数据待补充', isProxy: true };
  }

  let score = 0;
  const reasons = [];
  let isProxy = false;
  let degraded = false;

  // 优先使用真实全市场上涨占比；缺失时才回退 TOP10 热门股代理。
  if (realUpRatio != null && isFinite(realUpRatio)) {
    if (realUpRatio > 0.6) { score += 2; reasons.push('全市场上涨占比' + (realUpRatio * 100).toFixed(1) + '%，宽度改善'); }
    else if (realUpRatio > 0.45) { score += 0.5; reasons.push('全市场上涨占比' + (realUpRatio * 100).toFixed(1) + '%，宽度中性'); }
    else if (realUpRatio < 0.35) { score -= 2; reasons.push('全市场上涨占比' + (realUpRatio * 100).toFixed(1) + '%，宽度明显收窄'); }
    else { score -= 0.5; reasons.push('全市场上涨占比' + (realUpRatio * 100).toFixed(1) + '%，宽度偏弱'); }
  } else if (proxyUpRatio != null) {
    isProxy = true;
    degraded = true;
    if (proxyUpRatio > 0.7) { score += 1; reasons.push('热门股普涨(代理)'); }
    else if (proxyUpRatio > 0.5) { score += 0.5; reasons.push('涨多跌少(代理)'); }
    else if (proxyUpRatio < 0.3) { score -= 1; reasons.push('热门股普跌(代理)'); }
    else { score -= 0.5; reasons.push('跌多涨少(代理)'); }
  }

  if (top100Chg != null) {
    if (top100Chg < -0.5) { score += 0.5; reasons.push('集中度下降'); }
    if (top100Chg > 0.5) { score -= 0.5; reasons.push('集中度上升'); }
  }

  let signal, label;
  if (score >= 1.5) { signal = 'broad'; label = isProxy ? '宽度改善(代理)' : '宽度改善'; }
  else if (score >= 0) { signal = 'neutral'; label = isProxy ? '宽度中性(代理)' : '宽度中性'; }
  else { signal = 'narrow'; label = isProxy ? '宽度收窄(代理)' : '宽度收窄'; }

  return { signal, label, strength: score, detail: reasons.join('；'), isProxy, degraded };
}
/**
 * 资金承接信号：宽基ETF净流入方向 + 20日分位
 * 注：阈值用"方向（正负）"而非固定亿数，避免规模膨胀后失灵
 */
function calcSupportSignal(entry, c) {
  const wideFlow = entry.etfWide.totalFlow;
  const pctile = c.wideFlowPctile20d;
  const inflowDays5d = c.wideFlow5dInflowDays != null ? c.wideFlow5dInflowDays : 0;

  if (wideFlow == null) {
    return { signal: 'unknown', label: 'ETF数据不足', strength: 0, detail: '宽基ETF数据待确认' };
  }

  let score = 0;
  const reasons = [];

  // 主判断：方向（正/负）
  if (wideFlow > 0) {
    score += 1;
    reasons.push('宽基净流入' + wideFlow.toFixed(1) + '亿');
  } else if (wideFlow < 0) {
    score -= 1;
    reasons.push('宽基净流出' + Math.abs(wideFlow).toFixed(1) + '亿');
  }

  // 辅助：20日分位
  if (pctile != null) {
    if (pctile > 0.7) { score += 1; reasons.push('ETF流入处于20日高位(' + (pctile*100).toFixed(0) + '%分位)'); }
    else if (pctile < 0.3) { score -= 1; reasons.push('ETF流入处于20日低位(' + (pctile*100).toFixed(0) + '%分位)'); }
  }

  // 持续性：5日里有几日流入
  if (inflowDays5d >= 4) { score += 1; reasons.push('近5日' + inflowDays5d + '日流入'); }
  else if (inflowDays5d <= 1) { score -= 1; reasons.push('近5日仅' + inflowDays5d + '日流入'); }

  let signal, label;
  if (score >= 2) { signal = 'inflow'; label = '资金有承接'; }
  else if (score >= 0) { signal = 'neutral'; label = '资金承接中性'; }
  else { signal = 'outflow'; label = '资金流出'; }

  return { signal, label, strength: score, detail: reasons.join('；') };
}

/**
 * 资金结构信号：集中度 + 分布
 */
function calcStructureSignal(entry, c) {
  const top100 = entry.concentration.top100.value;
  const top10 = entry.concentration.top10.value;
  const top100Chg = c.top100Chg;

  if (top100 == null) {
    return { signal: 'unknown', label: '集中度数据不足', strength: 0, detail: '集中度数据缺失' };
  }

  let score = 0;
  const reasons = [];

  // 集中度水平（用分位）
  if (c.top100Pctile20d != null) {
    if (c.top100Pctile20d > 0.75) { score -= 1; reasons.push('TOP100集中度偏高(' + (c.top100Pctile20d * 100).toFixed(0) + '%分位)'); }
    else if (c.top100Pctile20d < 0.25) { score += 1; reasons.push('TOP100集中度偏低，分布均匀'); }
  }

  // 极端抱团（用20日分位替代固定10%）
  if (c.top10Pctile20d != null && c.top10Pctile20d > 0.85) {
    score -= 1;
    reasons.push('TOP10处于20日极端高位(' + (c.top10Pctile20d * 100).toFixed(0) + '%分位)');
  }

  // 集中度变化趋势（描述性，不参与打分，避免与分位重复计权）
  if (top100Chg != null) {
    if (top100Chg > 0.5) { reasons.push('集中度上升' + top100Chg.toFixed(1) + 'pct（描述，未计权）'); }
    else if (top100Chg < -0.5) { reasons.push('集中度下降' + Math.abs(top100Chg).toFixed(1) + 'pct（描述，未计权）'); }
  }

  let signal, label;
  if (score >= 1) { signal = 'dispersed'; label = '分布均匀'; }
  else if (score >= 0) { signal = 'neutral'; label = '结构中性'; }
  else { signal = 'crowded'; label = '结构拥挤'; }

  return { signal, label, strength: score, detail: reasons.join('；') };
}

// ============ 市场阶段判断 ============

/**
 * 综合四信号 → 市场阶段
 * 重要：宽度信号是代理数据时，最高置信度强制降为 medium
 */
function calcMarketPhase(signals) {
  const { liquidity, breadth, support, structure } = signals;

  // 判断各信号方向
  const liqPositive = liquidity.signal === 'expanding';
  const liqNegative = liquidity.signal === 'contracting';
  const broadPositive = breadth.signal === 'broad';
  const broadNegative = breadth.signal === 'narrow';
  const supportPositive = support.signal === 'inflow';
  const supportNegative = support.signal === 'outflow';
  const structCrowded = structure.signal === 'crowded';
  const structDispersed = structure.signal === 'dispersed';

  // 数据降级：宽度使用代理或被异常标记时，最高置信度 = medium
  const breadthIsProxy = !!breadth.isProxy;
  const breadthDegraded = !!breadth.degraded;
  const maxConfidence = (breadthIsProxy || breadthDegraded) ? 'medium' : 'high';
  const downgradeNote = breadthIsProxy ? '（宽度代理数据，置信度降级）' : (breadthDegraded ? '（宽度数据降级，置信度降级）' : '');

  // 增量共振：流动性改善 + 宽度改善 + ETF有承接
  if (liqPositive && broadPositive && supportPositive) {
    return {
      phase: 'surge',
      label: '增量共振',
      confidence: maxConfidence,
      description: '成交额放大、上涨覆盖面扩大、宽基ETF同步流入，资金增量入场' + downgradeNote,
      evidence: [liquidity.label, breadth.label, support.label],
      counterEvidence: structCrowded ? '集中度偏高，可能存在局部抱团' : null,
      validateNext: '关注成交额能否持续放大，ETF流入是否延续。宽度数据待接入真实全市场数据后可提升置信度'
    };
  }

  // 存量抱团：缩量 + 集中度升高 + 宽度变差
  if ((liqNegative || liquidity.signal === 'neutral') && structCrowded && broadNegative) {
    return {
      phase: 'crowd',
      label: '存量抱团',
      confidence: maxConfidence,
      description: '成交额未放大、资金高度集中、个股分化加剧' + downgradeNote,
      evidence: [liquidity.label, structure.label, breadth.label],
      counterEvidence: supportPositive ? 'ETF仍在流入，底部有支撑' : null,
      validateNext: '关注抱团方向是否扩散、成交额是否改善'
    };
  }

  // 资金扩散：集中度下降 + 宽度改善 + 非核心活跃
  if (structDispersed && broadPositive) {
    return {
      phase: 'diffuse',
      label: '资金扩散',
      confidence: 'medium',
      description: '集中度下降、上涨覆盖面扩大，资金从核心向边缘扩散',
      evidence: [structure.label, breadth.label],
      counterEvidence: liqNegative ? '整体成交额偏低，扩散可能缺乏增量' : null,
      validateNext: '关注扩散方向能否形成新主线'
    };
  }

  // 整体降温：缩量 + 宽度差 + ETF流出
  if (liqNegative && (broadNegative || supportNegative)) {
    return {
      phase: 'cool',
      label: '整体降温',
      confidence: maxConfidence,
      description: '成交额下降、市场宽度走弱、ETF资金流出' + downgradeNote,
      evidence: [liquidity.label, breadth.label, support.label],
      counterEvidence: null,
      validateNext: '关注是否有政策催化或资金回流信号'
    };
  }

  // 默认：观望
  return {
    phase: 'watch',
    label: '温和观望',
    confidence: 'low',
    description: '多空信号交织，缺乏一致性方向',
    evidence: [liquidity.label, breadth.label, support.label, structure.label],
    counterEvidence: null,
    validateNext: '等待信号一致性提升'
  };
}

/**
 * 信号一致度
 */
function calcConsistency(signals) {
  const dirs = [signals.liquidity, signals.breadth, signals.support, signals.structure];
  const positive = dirs.filter(s => s.strength > 0).length;
  const negative = dirs.filter(s => s.strength < 0).length;
  const neutral = dirs.filter(s => s.strength === 0 || s.signal === 'unknown').length;

  const consistency = Math.abs(positive - negative) / dirs.length;

  if (consistency >= 0.75) return { level: 'high', label: '信号高度一致', score: consistency };
  if (consistency >= 0.5) return { level: 'medium', label: '信号基本一致', score: consistency };
  return { level: 'low', label: '信号分歧', score: consistency };
}

// ============ 主线验证 ============

/**
 * 主线验证：三证据交叉（成交热度证据已移除，因无历史序列支撑）
 *
 * 真实宽度证据（第4项接入后）：
 * 1. ETF资金承接（当日流向 + 持续性合并判定，使用 theme.type）
 * 2. 板块相对强度（三层优先级）：
 *     优先级1：主题中位数收益 − 全市场中位数 > 0（真实宽度，medianReturn 可用）
 *     优先级2：主题ETF涨跌 − 全市场中位数 > 0（ETF代理，medianReturn 缺失）
 *     优先级3：主题ETF涨跌 > 0（全市场中位数也缺失，最低门槛）
 * 3. ETF持续性（5日ETF同向，独立计票）
 *
 * 降级逻辑：
 *   - 使用优先级1 → 置信度 normal
 *   - 使用优先级2或3 → 置信度降级，标注 sectorStrongIsProxy=true
 *
 * 阈值策略（如实标注）：
 * - ETF资金用"方向"判断（流入/流出），不用固定金额
 * - 板块强度：优先级1用真实中位数差，优先级2用ETF涨跌差，优先级3用涨跌方向
 * - 持续性：5日ETF同向（type=sustained）
 */
function calcMainlineValidation(entry) {
  const themeStatus = entry.computed ? entry.computed.themeStatus : {};
  const themeHeat = entry.computed ? (entry.computed.themeHeat || {}) : {};
  const results = [];

  for (const [themeName, status] of Object.entries(themeStatus)) {
    // 证据1：ETF资金方向（null = 数据不足，不进入分母）
    let etfPositive = null;
    if (status.flow != null && isFinite(status.flow)) {
      etfPositive = status.flow > 0;
    }

    // 证据2：板块相对强度
    // 三层优先级（与用户需求一致）：
    //   优先级1：真实主题宽度（upRatio − marketUpRatio > 0，代理中位数收益）
    //   优先级2：ETF涨跌代理（chg − marketMedian > 0，宽度缺失时）
    //   优先级3：全市场中位数也缺失（chg > 0，最低门槛）
    let sectorStrong = null;
    let sectorStrongNote = '';
    let sectorStrongIsProxy = false;
    const marketUpRatio = entry.market && entry.market.upRatio;
    const marketMedian  = entry.market && entry.market.medianReturn;

    // 优先级1：真实主题宽度（用 upRatio 代理中位数收益）
    // 逻辑：主题上涨比 > 全市场上涨比 → 主题强于市场
    let breadthMethod = null;
    if (status.upRatio != null && isFinite(status.upRatio) && marketUpRatio != null && isFinite(marketUpRatio)) {
      sectorStrong = status.upRatio > marketUpRatio;
      sectorStrongNote = '真实宽度：主题上涨比(' + (status.upRatio * 100).toFixed(1) + '%) > 全市场上涨比(' + (marketUpRatio * 100).toFixed(1) + '%)';
      breadthMethod = 'real_breadth';
    }
    // 优先级2：ETF涨跌代理（主题宽度缺失，但有全市场中位数）
    else if (status.chg != null && isFinite(status.chg) && marketMedian != null && isFinite(marketMedian)) {
      const excessRet = status.chg - marketMedian;
      sectorStrong = excessRet > 0;
      sectorStrongIsProxy = true;
      sectorStrongNote = 'ETF代理：主题ETF涨跌(' + status.chg.toFixed(2) + '%) − 全市场中位数(' + marketMedian.toFixed(2) + '%) = ' + excessRet.toFixed(2) + '%';
      breadthMethod = 'etf_proxy';
    }
    // 优先级3：全市场数据也缺失，最低门槛
    else if (status.chg != null && isFinite(status.chg)) {
      sectorStrong = status.chg > 0;
      sectorStrongIsProxy = true;
      sectorStrongNote = '降级代理：板块涨跌>0（全市场数据缺失，置信度已降低）';
      breadthMethod = 'minimum_threshold';
    }

    // 证据3：ETF持续性（type=sustained；type=unknown 时为 null）
    let sustainedPositive = null;
    if (status.type && status.type !== 'unknown') {
      sustainedPositive = (status.type === 'sustained');
    }

    const evidence = {
      themeName,
      etfFlow: status.flow,
      etfFlow5d: status.flow5d,
      etfStatus: status.label,
      etfPositive,
      etf5dPositive: status.flow5d != null && isFinite(status.flow5d) ? status.flow5d > 0 : null,
      sectorChg: status.chg,
      // 真实宽度路径：主题涨跌 − 全市场中位数 > 0
      sectorStrong,
      sectorStrongNote,
      sectorStrongIsProxy,
      breadthMethod,      // 新增：记录使用的宽度方法
      breadthStatus: status.breadthStatus || null,  // 新增：数据状态
      upRatio: status.upRatio,  // 新增：传到证据里
      // 成交热度证据已移除，保留字段供前端兼容显示
      volume: status.volume,
      volumeStrong: null,
      volumeNote: '已移除（待建立主题历史成交额序列后恢复）',
      // 持续性
      sustained: status.type === 'sustained',
      sustainedPositive,
      // 覆盖率
      coverage: status.coverage,
      coverageOk: status.coverage >= 0.6,
      sharePending: status.sharePending,
      // TOP100成交热度：作为确认降级器，不免费加票
      heat: themeHeat[themeName] || null,
      heatPositive: themeHeat[themeName] ? themeHeat[themeName].heatPositive : null,
      heatStatus: themeHeat[themeName] ? themeHeat[themeName].heatStatus : '未计算',
      heatShare: themeHeat[themeName] ? themeHeat[themeName].share : null,
      heatCount: themeHeat[themeName] ? themeHeat[themeName].count : null,
      heatMethod: themeHeat[themeName] ? themeHeat[themeName].heatMethod : null
    };

    // 三证据合成：null 不进入分母
    const signals = [];
    if (etfPositive !== null) signals.push(etfPositive);
    if (sectorStrong !== null) signals.push(sectorStrong);
    if (sustainedPositive !== null) signals.push(sustainedPositive);

    const positiveCount = signals.filter(Boolean).length;
    const validCount = signals.length;

    let mainline;
    if (validCount === 0) {
      mainline = { confirmed: false, label: '数据不足', confidence: 'low' };
    } else {
      const ratio = positiveCount / validCount;
      // 确认条件：覆盖率达标 + 三项证据全部存在（validCount===3）且全部同向
      // 仅 2/2 同向时不再判定主线确认，降级为潜在主线（避免证据不足时高估）
      if (evidence.coverageOk && validCount === 3 && ratio === 1) {
        mainline = { confirmed: true, label: '主线确认', confidence: 'high' };
      } else if (evidence.coverageOk && validCount === 3 && ratio >= 2/3) {
        mainline = { confirmed: false, label: '潜在主线', confidence: 'medium' };
      } else if (ratio >= 0.5) {
        mainline = { confirmed: false, label: '潜在主线', confidence: 'medium' };
      } else {
        mainline = { confirmed: false, label: '非主线', confidence: 'low' };
      }
    }

    // TOP100热度降级器：
    // 明确热度不足/防御配置时，不允许仅靠ETF持续流入 + 宽度确认成为主线。
    // heatPositive=null 表示数据不足，暂不降级，避免历史缺TOP100时误杀。
    if (mainline.confirmed && evidence.heatPositive === false) {
      mainline = {
        confirmed: false,
        label: evidence.heatStatus === '防御配置' ? '防御配置' : '潜在主线',
        confidence: 'medium',
        heatDowngraded: true
      };
    }
    if (!mainline.confirmed && evidence.heatStatus === '防御配置') {
      mainline.label = '防御配置';
      mainline.heatDowngraded = true;
    }

    // 降级：使用板块强度代理数据时，降低置信度
    if (sectorStrongIsProxy && mainline.confidence === 'high') {
      mainline.confidence = 'medium';
      mainline.isProxy = true;
    } else if (sectorStrongIsProxy && mainline.confidence === 'medium') {
      mainline.confidence = 'low';
      mainline.isProxy = true;
    }

    results.push({ ...evidence, ...mainline, signalAgreement: positiveCount + '/' + validCount,
      // 新增：用于排序（避免 2/2 排在 2/3 前面）
      _positiveCount: positiveCount,
      _validCount: validCount
    });
  }

  // 排序：1) 主线确认优先 2) 有效证据数多优先 3) 正向比例高优先 4) ETF流入大优先
  function parseAgreement(s) {
    if (typeof s !== 'string') return -1;
    const parts = s.split('/');
    if (parts.length !== 2) return -1;
    const pos = parseFloat(parts[0]) || 0;
    const total = parseFloat(parts[1]) || 1;
    if (total <= 0) return -1;
    return pos / total;
  }
  results.sort((a, b) => {
    // 1) 确认状态
    if (a.confirmed !== b.confirmed) return b.confirmed ? 1 : -1;
    // 2) 有效证据数（多优先）—— 避免 2/2 排在 2/3 前面
    const va = a._validCount || 0, vb = b._validCount || 0;
    if (va !== vb) return vb - va;
    // 3) 正向比例（高优先）
    const ra = parseAgreement(a.signalAgreement);
    const rb = parseAgreement(b.signalAgreement);
    if (ra !== rb) return rb - ra;
    // 4) ETF流入（大优先）
    return (b.etfFlow || 0) - (a.etfFlow || 0);
  });

  return results;
}

// ============ 明日观察情景 ============

/**
 * 生成明日观察情景卡
 */
function genWatchScenarios(entry, marketPhase) {
  const scenarios = [];

  // 基于当前状态，生成观察方向
  const signals = calcSignals(entry);
  const liquidity = signals.liquidity;
  const support = signals.support;

  // 情景1：成交额验证
  if (liquidity.signal === 'expanding') {
    scenarios.push({
      direction: '成交额持续性',
      current: '当前成交额处于扩张状态',
      confirm: '明日成交额维持或超过今日水平',
      invalid: '成交额回落至5日均值以下',
      action: '维持当前判断强度'
    });
  } else if (liquidity.signal === 'contracting') {
    scenarios.push({
      direction: '成交额恢复',
      current: '当前成交额处于收缩状态',
      confirm: '成交额回升至5日均值以上',
      invalid: '继续缩量，低于20日30%分位',
      action: '降低仓位预期'
    });
  }

  // 情景2：ETF承接
  if (support.signal === 'inflow') {
    scenarios.push({
      direction: 'ETF流入延续',
      current: '宽基ETF今日有净流入',
      confirm: '明日ETF继续净流入，份额数据确认',
      invalid: 'ETF转为净流出',
      action: '关注流入方向是否扩散'
    });
  } else if (support.signal === 'outflow') {
    scenarios.push({
      direction: 'ETF流出缓解',
      current: '宽基ETF今日净流出',
      confirm: '流出放缓或转为流入',
      invalid: '流出加速',
      action: '保持谨慎'
    });
  }

  // 情景3：集中度
  const structSignal = signals.structure;
  if (structSignal.signal === 'crowded') {
    scenarios.push({
      direction: '集中度风险',
      current: 'TOP100集中度偏高',
      confirm: '集中度回落，资金扩散至更多方向',
      invalid: '集中度继续升高',
      action: '警惕抱团瓦解风险'
    });
  }

  // 情景4：主线方向（如果有确认的主题）
  const mainline = calcMainlineValidation(entry);
  const confirmed = mainline.filter(m => m.confirmed);
  if (confirmed.length > 0) {
    scenarios.push({
      direction: confirmed[0].themeName + '主线延续',
      current: confirmed[0].themeName + '已通过主线验证',
      confirm: '继续获得ETF资金和成交额支撑',
      invalid: '资金大幅流出、板块涨幅回落',
      action: '持续跟踪该方向'
    });
  }

  // 兜底
  if (scenarios.length === 0) {
    scenarios.push({
      direction: '整体信号观察',
      current: '当前多空信号交织',
      confirm: '等待成交额和ETF方向一致',
      invalid: '出现单边缩量+流出',
      action: '保持观望'
    });
  }

  return scenarios;
}

module.exports = {
  calcSignals,
  calcMarketPhase,
  calcConsistency,
  calcMainlineValidation,
  genWatchScenarios
};
