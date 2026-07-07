/**
 * metrics.js — 指标计算层（派生层）
 * 只读取标准化数据，计算派生指标，不直接操作原始数据
 *
 * 计算：成交额口径、市场宽度、集中度分位、ETF净流入、相对流入力度、融资趋势
 */

'use strict';

const { safeNum } = require('./normalize');

/**
 * 历史分位数计算
 * @param {number[]} sortedValues - 已排序的历史值
 * @param {number} current - 当前值
 * @returns {number} 0-1 分位
 */
function percentile(sortedValues, current) {
  if (!sortedValues || sortedValues.length === 0 || current == null) return null;
  const sorted = [...sortedValues].filter(v => v != null && isFinite(v)).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  let lo = 0, hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid] < current) lo = mid + 1;
    else hi = mid;
  }
  return lo / sorted.length;
}

/**
 * 计算均值
 */
function mean(arr) {
  const valid = arr.filter(v => v != null && isFinite(v));
  if (valid.length === 0) return null;
  return valid.reduce((s, v) => s + v, 0) / valid.length;
}

/**
 * 计算全部日期的派生指标
 * @param {Object} normData - normalizeData() 的输出
 * @returns {Object} 同结构，每条 entry 追加 computed 字段
 *
 * 重要：历史窗口必须按"有效交易日"向前取，而不是先压缩成数组再按下标切片。
 * 否则缺失数据会导致日期-值错位。
 */
function computeAll(normData, themeConstituents) {
  const { dates, data } = normData;

  // 逐日计算
  for (let i = 0; i < dates.length; i++) {
    const dt = dates[i];
    const e = data[dt];
    const prevDt = i > 0 ? dates[i - 1] : null;
    const prevEntry = prevDt ? data[prevDt] : null;

    e.computed = computeDateEntry(e, prevEntry, dates, data, i, themeConstituents);
  }

  return normData;
}

/**
 * 从当前日期向前取 N 个"有效值"
 * 有效 = 对应字段非null。返回数组（含当日如果有效），长度可能小于N
 */
function lookbackValid(dates, data, idx, getter, N) {
  const result = [];
  for (let j = idx; j >= 0 && result.length < N; j--) {
    const v = getter(data[dates[j]]);
    if (v != null && isFinite(v)) result.push(v);
  }
  return result.reverse(); // 时间正序
}

/**
 * 单日派生指标计算
 */
function computeDateEntry(entry, prevEntry, allDates, allData, idx, themeConstituents) {
  const c = {};

  // 取值器
  const getTotal = e => e.concentration.totalAmount;
  const getTop100 = e => e.concentration.top100.value;
  const getTop10 = e => e.concentration.top10.value;
  const getWideFlow = e => e.etfWide.totalFlow;

  // --- 成交额指标 ---
  const total = getTotal(entry);
  const prevTotal = prevEntry ? getTotal(prevEntry) : null;

  c.amountChgPct = null;
  c.amountPrev = prevTotal;
  if (total != null && prevTotal != null && prevTotal > 0) {
    c.amountChgPct = (total - prevTotal) / prevTotal * 100;
  }

  // 5日均值偏离（按有效交易日取5日，不按下标）
  const last5Totals = lookbackValid(allDates, allData, idx, getTotal, 5);
  const avg5d = mean(last5Totals);
  c.amountVs5d = (total != null && avg5d != null && avg5d > 0) ? (total - avg5d) / avg5d * 100 : null;

  // 20日分位（按有效交易日取20日）
  const last20Totals = lookbackValid(allDates, allData, idx, getTotal, 20);
  c.amountPctile20d = percentile(last20Totals, total);

  // --- 集中度分位 ---
  const last20Top100 = lookbackValid(allDates, allData, idx, getTop100, 20);
  c.top100Pctile20d = percentile(last20Top100, getTop100(entry));

  const last20Top10 = lookbackValid(allDates, allData, idx, getTop10, 20);
  c.top10Pctile20d = percentile(last20Top10, getTop10(entry));

  // --- 集中度变化 ---
  c.top100Chg = null;
  if (prevEntry && getTop100(entry) != null && getTop100(prevEntry) != null) {
    c.top100Chg = getTop100(entry) - getTop100(prevEntry);
  }

  // --- ETF指标 ---
  const last20WideFlow = lookbackValid(allDates, allData, idx, getWideFlow, 20);
  c.wideFlowPctile20d = percentile(last20WideFlow, getWideFlow(entry));

  // --- 宽基ETF 5日持续性（辅助主线判断） ---
  const last5WideFlow = lookbackValid(allDates, allData, idx, getWideFlow, 5);
  c.wideFlow5dInflowDays = last5WideFlow.filter(v => v > 0).length;
  c.wideFlow5dSum = last5WideFlow.reduce((s, v) => s + v, 0);

  // 主题ETF各方向 —— 修复：传递 flow / flow5d / chg / volume
  c.themeStatus = {};
  if (entry.etfTheme && entry.etfTheme.categories) {
    for (const [catName, catData] of Object.entries(entry.etfTheme.categories)) {
      for (const [themeName, themeData] of Object.entries(catData.themes || {})) {
        const status = classifyThemeFlow(themeData.flow, themeData.flow5d);
        c.themeStatus[themeName] = {
          type: status.type,
          label: status.label,
          confidence: status.confidence,
          // 修复字段断裂：补齐主线验证需要的字段
          flow: themeData.flow,
          flow5d: themeData.flow5d,
          scaleRatio: themeData.scaleRatio,
          coverage: themeData.coverage,
          fundSize: themeData.fundSize,
          chg: themeData.chg,
          volume: themeData.volume,
          sampleCount: themeData.sampleCount,
          confirmedCount: themeData.confirmedCount,
          sharePending: themeData.sharePending,
          // 第4项：主题宽度数据（真实中位数收益）
          medianReturn: themeData.medianReturn || null,
          upRatio: themeData.upRatio || null,
          breadthSource: themeData.breadthSource || null,
          breadthStatus: themeData.breadthStatus || null
        };
      }
    }
  }

  // --- 市场宽度 ---
  // 优先使用真实全市场宽度；缺失时才回退TOP10个股涨跌做代理。
  if (entry.market && entry.market.breadthSource === 'wind' && entry.market.upRatio != null) {
    c.top10UpRatio = entry.market.upRatio; // 兼容旧渲染字段，语义已是全市场上涨占比
    c.top10Median = entry.market.medianReturn;
    c.breadthProxy = false;
  } else {
    const top10Stocks = entry.concentration.top10Stocks;
    if (top10Stocks && top10Stocks.length > 0) {
      const returns = top10Stocks.map(s => safeNum(s[3])).filter(v => v != null);
      if (returns.length > 0) {
        c.top10UpRatio = returns.filter(r => r > 0).length / returns.length;
        c.top10Median = returns.sort((a, b) => a - b)[Math.floor(returns.length / 2)];
      }
    }
    c.breadthProxy = true;
  }

  // --- 主题TOP100成交热度 ---
  c.themeHeat = calcThemeHeat(entry, allDates, allData, idx, c.themeStatus, themeConstituents);

  return c;
}

// 主题热度第一版：基于 TOP100 成交额股票的行业/名称关键词归因。
// 这不是精确成分股归因，所以输出 heatMethod=keyword_top100，供前端提示。
const THEME_HEAT_RULES = {
  '半导体': {
    industry: ['半导体'],
    name: ['芯', '半导体', '晶', '微电', '光刻', '封测']
  },
  'AI': {
    industry: ['软件', '信息技术服务', '应用软件', '电脑存储', '电脑与外围设备'],
    name: ['算力', '数据', '软件', '同花顺', '指南针', '寒武纪', '海光信息', '中科曙光', '浪潮信息']
  },
  '通信': {
    industry: ['通信设备', '通信'],
    name: ['通信', '光电', '光迅', '中兴', '新易盛', '中际旭创', '天孚']
  },
  '机器人': {
    industry: ['机械', '工业机械', '自动化'],
    name: ['机器人', '绿的谐波', '埃斯顿', '汇川', '鸣志', '拓普']
  },
  '创新药': {
    industry: ['生物科技', '制药', '医疗保健', '医药'],
    name: ['药', '生物', '医药', '医疗', '创新药']
  },
  '证券': {
    industry: ['资本市场', '投资银行业与经纪业', '证券'],
    name: ['证券', '东方财富', '同花顺', '指南针']
  },
  '黄金': {
    industry: ['黄金'],
    name: ['黄金', '金钼', '紫金矿业']
  },
  '有色金属': {
    industry: ['金属、非金属与采矿', '铜', '铝', '稀土', '有色'],
    name: ['稀土', '铜', '铝', '钨', '钼', '有色', '洛阳钼业', '北方稀土']
  },
  '化工': {
    industry: ['化工', '工业气体', '特种化工', '基础化工'],
    name: ['化工', '材料', '天赐材料', '多氟多', '昊华科技']
  }
};

const DEFENSIVE_THEMES = new Set(['红利']);

function textHasAny(text, arr) {
  if (!text || !arr) return false;
  return arr.some(k => text.indexOf(k) !== -1);
}

function normalizeStockCode(code) {
  return code ? String(code).trim().toUpperCase() : '';
}

function getConstituentSet(themeName, themeConstituents) {
  const t = themeConstituents && themeConstituents.themes && themeConstituents.themes[themeName];
  if (!t || !Array.isArray(t.constituents) || t.constituents.length === 0) return null;
  return new Set(t.constituents.map(x => normalizeStockCode(x.code)).filter(Boolean));
}

function getConstituentMethod(themeName, themeConstituents) {
  const t = themeConstituents && themeConstituents.themes && themeConstituents.themes[themeName];
  return t && t.method ? t.method : null;
}

function stockMatchesTheme(stock, themeName, themeConstituents) {
  if (DEFENSIVE_THEMES.has(themeName)) return false;
  const code = stock && stock[0] ? normalizeStockCode(stock[0]) : '';
  const constituentSet = getConstituentSet(themeName, themeConstituents);
  const constituentMethod = getConstituentMethod(themeName, themeConstituents);
  if (constituentSet && code && constituentSet.has(code)) return true;
  const rule = THEME_HEAT_RULES[themeName];
  if (constituentSet && constituentMethod === 'constituent_full') return false;
  if (!rule) return false;
  const name = stock && stock[1] ? String(stock[1]) : '';
  const industry = stock && stock[4] ? String(stock[4]) : '';
  return textHasAny(industry, rule.industry) || textHasAny(name, rule.name) || textHasAny(code, rule.codes);
}

function calcThemeHeat(entry, allDates, allData, idx, themeStatus, themeConstituents) {
  const result = {};
  const themeNames = themeStatus
    ? Object.keys(themeStatus)
    : [];
  const top100Stocks = entry && entry.concentration ? (entry.concentration.top100Stocks || []) : [];
  const top100Amount = entry && entry.concentration && entry.concentration.top100
    ? safeNum(entry.concentration.top100.rawAmount)
    : null;

  for (const themeName of themeNames) {
    if (DEFENSIVE_THEMES.has(themeName)) {
      result[themeName] = {
        amount: null,
        share: null,
        count: 0,
        top10Count: 0,
        pctile20d: null,
        heatPositive: false,
        heatStatus: '防御配置',
        heatMethod: 'defensive_theme',
        heatNote: '红利属于配置/防御方向，需额外盘面热度确认，不默认按TOP100关键词归因'
      };
      continue;
    }

    if (!top100Stocks || top100Stocks.length < 80 || top100Amount == null || top100Amount <= 0) {
      result[themeName] = {
        amount: null,
        share: null,
        count: 0,
        top10Count: 0,
        pctile20d: null,
        heatPositive: null,
        heatStatus: '待补TOP100',
        heatMethod: 'missing_top100',
        heatNote: '当前日期缺完整TOP100明细，热度不参与确认'
      };
      continue;
    }

    const constituentSet = getConstituentSet(themeName, themeConstituents);
    const constituentMethod = getConstituentMethod(themeName, themeConstituents);
    const heatMethod = constituentSet
      ? ((constituentMethod || 'constituent_partial') === 'constituent_full' ? 'constituent_full' : 'constituent_partial+keyword')
      : 'keyword_top100';
    const matched = top100Stocks.filter(s => stockMatchesTheme(s, themeName, themeConstituents));
    const amount = matched.reduce((sum, s) => sum + (safeNum(s[2]) || 0), 0);
    const share = amount / top100Amount;
    const top10Count = top100Stocks.slice(0, 10).filter(s => stockMatchesTheme(s, themeName)).length;

    const historyShares = [];
    for (let j = idx; j >= 0 && historyShares.length < 20; j--) {
      const e = allData[allDates[j]];
      const stocks = e && e.concentration ? (e.concentration.top100Stocks || []) : [];
      const amt = e && e.concentration && e.concentration.top100 ? safeNum(e.concentration.top100.rawAmount) : null;
      if (stocks.length >= 80 && amt != null && amt > 0) {
        const m = stocks.filter(s => stockMatchesTheme(s, themeName, themeConstituents));
        const a = m.reduce((sum, s) => sum + (safeNum(s[2]) || 0), 0);
        historyShares.push(a / amt);
      }
    }
    const pctile20d = historyShares.length >= 5 ? percentile(historyShares, share) : null;

    const heatPositive = matched.length >= 3 && share >= 0.05;
    let heatStatus = '热度不足';
    if (matched.length <= 2 && share >= 0.08) heatStatus = '龙头抱团';
    else if (heatPositive) heatStatus = '热度确认';

    result[themeName] = {
      amount,
      share,
      count: matched.length,
      top10Count,
      pctile20d,
      heatPositive,
      heatStatus,
      heatMethod,
      heatNote: (constituentSet ? 'TOP100指数成分股优先，关键词补漏' : 'TOP100关键词/行业归因') + '：' + matched.length + '只，' + (share * 100).toFixed(1) + '%'
    };
  }

  return result;
}

/**
 * 主题流向状态分类
 * 当日为正 + 近5日为正 → 持续流入
 * 当日为正 + 近5日为负 → 短线异动
 * 当日为负 + 近5日为正 → 今日降温
 * 当日为负 + 近5日为负 → 持续流出
 */
function classifyThemeFlow(flow, flow5d) {
  const f = safeNum(flow);
  const f5 = safeNum(flow5d);

  if (f === null || f5 === null) {
    return { type: 'unknown', label: '数据不足', confidence: 'low' };
  }

  if (f > 0 && f5 > 0) return { type: 'sustained', label: '持续流入', confidence: 'high' };
  if (f > 0 && f5 <= 0) return { type: 'spike', label: '短线异动', confidence: 'medium' };
  if (f <= 0 && f5 > 0) return { type: 'cooling', label: '今日降温', confidence: 'medium' };
  return { type: 'outflow', label: '持续流出', confidence: 'high' };
}

/**
 * 计算ETF相对流入力度
 * 净流入 / 当前样本总规模
 */
function calcInflowStrength(flow, fundSize) {
  const f = safeNum(flow);
  const fs = safeNum(fundSize);
  if (f === null || fs === null || fs <= 0) return null;
  return f / fs * 100;
}

module.exports = {
  percentile,
  mean,
  computeAll,
  classifyThemeFlow,
  calcInflowStrength
};
