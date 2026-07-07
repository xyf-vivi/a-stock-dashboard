/**
 * etf-flow.js — ETF资金流统一计算模块
 * 
 * 统一口径（v3）：
 *   单日资金流：(份额T − 份额T−1) × 净值T
 *   5日资金流：逐日资金流累加，而不是期初/期末差额 × 期末净值
 * 
 * 历史口径（v1）：宽基用 (份额T − 份额T−1) × 净值T-1
 *           主题用 (份额T − 份额T−1) × 净值T
 * 
 * 从 v2 开始，宽基和主题ETF共用同一单日公式。
 * 从 v3 开始，5日资金流改为逐日净流入累计。
 */

'use strict';

/**
 * 计算单只ETF的单日资金流
 * 
 * 公式：(份额T − 份额T−1) × 净值T / 10000
 * 单位：亿元（份额单位为万份，/10000 转换为亿份对应的金额）
 * 
 * @param {number} shareT  - T日份额（万份）
 * @param {number} shareT1 - T-1日份额（万份）
 * @param {number} navT     - T日单位净值（元）
 * @returns {number|null} 资金流（亿元），数据不足时返回 null
 */
function calcEtfFlow(shareT, shareT1, navT) {
  if (shareT == null || shareT1 == null || navT == null) return null;
  if (navT === 0) return null;
  return (shareT - shareT1) * navT / 10000;
}

/**
 * 计算单只ETF的5日资金流
 * 
 * 公式：Σ(份额d − 份额d−1) × 净值d / 10000
 * 
 * @param {Object} series - 份额/净值历史 { 'YYYYMMDD': { share, nav, fundSize } }
 * @param {Object} dates  - { T: 'YYYYMMDD', T5: 'YYYYMMDD'|null }
 * @returns {number|null} 5日资金流（亿元），数据不足时返回 null
 */
function calcEtfFlow5d(series, dates) {
  if (!series || !dates || !dates.T || !dates.T5) return null;
  var keys = Object.keys(series).filter(function(k) { return k <= dates.T; }).sort();
  var startIdx = keys.indexOf(dates.T5);
  var endIdx = keys.indexOf(dates.T);
  if (startIdx < 0 || endIdx < 0 || endIdx <= startIdx) return null;

  var total = 0;
  for (var i = startIdx + 1; i <= endIdx; i++) {
    var prev = series[keys[i - 1]];
    var cur = series[keys[i]];
    if (!prev || !cur) return null;
    var flow = calcEtfFlow(cur.share, prev.share, cur.nav);
    if (flow == null) return null;
    total += flow;
  }
  return total;
}

/**
 * 批量计算一组ETF的资金流
 * 
 * @param {Object} series - 份额/净值历史 { 'YYYYMMDD': { share, nav, fundSize } }
 * @param {Object} dates  - { T: 'YYYYMMDD', T1: 'YYYYMMDD', T5: 'YYYYMMDD'|null }
 * @returns {Object} { flow, flow5d, shareChange, shareChange5d }
 */
function calcFlowFromSeries(series, dates) {
  var T = dates.T, T1 = dates.T1, T5 = dates.T5;
  var sT = series[T];
  var result = { flow: null, flow5d: null, shareChange: null, shareChange5d: null };

  if (!sT || sT.share == null || sT.nav == null) return result;

  var sT1 = series[T1];
  if (sT1 && sT1.share != null) {
    result.flow = calcEtfFlow(sT.share, sT1.share, sT.nav);
    result.shareChange = sT.share - sT1.share;
  }

  var sT5 = series[T5];
  if (sT5 && sT5.share != null) {
    result.flow5d = calcEtfFlow5d(series, dates);
    result.shareChange5d = sT.share - sT5.share;
  }

  return result;
}

/**
 * 计算口径版本号
 * 用于输出中记录当前使用的计算口径
 */
function getCaliberVersion() {
  return 'v3'; // 单日用 T 日净值；5日为逐日净流入累计
}

module.exports = {
  calcEtfFlow,
  calcEtfFlow5d,
  calcFlowFromSeries,
  getCaliberVersion
};
