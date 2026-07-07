/**
 * normalize.js — 数据标准化层
 * 统一字段口径、日期格式归一化、缺失值状态化、覆盖率计算
 *
 * 输入：原始 JSON 数据（rawData / themeEtf / concData / marginData / shareData）
 * 输出：按日期组织的数据结构，每个字段附带状态标签
 */

'use strict';

// ============ 数据状态枚举 ============
const DATA_STATUS = {
  REALTIME: 'realtime',         // 实时（盘中）
  PRELIMINARY: 'preliminary',   // 初步（盘后首版）
  CONFIRMED: 'confirmed',       // 已确认
  PARTIAL: 'partial',           // 部分缺失
  STALE: 'stale',               // 已过期
  FAILED: 'failed',             // 取数失败
  PENDING: 'pending'            // 待确认
};

const STATUS_LABEL = {
  realtime: '实时',
  preliminary: '初步',
  confirmed: '已确认',
  partial: '部分缺失',
  stale: '已过期',
  failed: '取数失败',
  pending: '待确认'
};

/**
 * 归一化日期为 YYYY-MM-DD
 * 处理 "20260618", "2026-06-18", "6/10" 等格式
 */
function normDate(d) {
  if (!d) return null;
  if (typeof d === 'string') {
    // YYYYMMDD
    if (/^\d{8}$/.test(d)) return d.slice(0, 4) + '-' + d.slice(4, 6) + '-' + d.slice(6);
    // YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
    // M/D or MM/DD (无年份，需外部传入年份)
    const m = d.match(/^(\d{1,2})[/-](\d{1,2})$/);
    if (m) return null; // 缺年份，需上下文
  }
  if (d instanceof Date) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  return String(d);
}

/**
 * 归一化 label（用于图表X轴）
 */
function normLabel(dateStr) {
  if (!dateStr) return '--';
  const m = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return m[2] + '/' + m[3];
  return dateStr;
}

/**
 * 安全数值：null/undefined/NaN/'' → null
 */
function safeNum(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'string' ? parseFloat(v) : v;
  if (typeof n !== 'number' || !isFinite(n)) return null;
  return n;
}

/**
 * 带状态的值
 */
function tagged(v, status) {
  const val = safeNum(v);
  return {
    value: val,
    status: val === null ? (status || DATA_STATUS.PARTIAL) : (status || DATA_STATUS.CONFIRMED)
  };
}

// ============ 主标准化函数 ============

/**
 * @param {Object} rawEtf       - rawData.json 解析结果
 * @param {Object} rawTheme     - theme_etf_data.json 解析结果（单日）
 * @param {Object} concData     - 集中度数据 { date: {...} }
 * @param {Object} marginData   - 融资余额数据 { date: value }
 * @param {Object} shareData    - ETF份额历史数据（可选）
 * @param {Object} breadthData  - market_breadth_data.json 解析结果（新增）
 * @returns {Object} 按日期组织的标准化数据 { dates: [...], data: { 'YYYY-MM-DD': {...} } }
 */
function normalizeData(rawEtf, rawTheme, concData, marginData, shareData, breadthData, themeBreadthData) {
  const result = { dates: [], data: {} };

  // --- 收集所有日期 ---
  const dateSet = new Set();
  if (rawEtf) {
    for (const k of Object.keys(rawEtf)) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(k)) dateSet.add(k);
    }
  }
  if (concData) {
    for (const k of Object.keys(concData)) dateSet.add(k);
  }
  // --- 主题ETF：兼容单日快照和日期累积 ---
  // themeByDate: { '2026-06-18': { themeEtf, stats, ... }, ... }
  let themeByDate = {};
  if (rawTheme) {
    // 检测格式：日期累积 vs 单日快照
    if (rawTheme.dates && typeof rawTheme.dates === 'object') {
      // 新格式：日期累积
      for (const [dateKey, dateData] of Object.entries(rawTheme.dates)) {
        const dtNorm = normDate(dateData.date || dateData.label);
        if (dtNorm) {
          // 构建适配对象（模仿单日快照格式，让 buildEtfTheme 能处理）
          themeByDate[dtNorm] = {
            themeEtf: dateData.themeEtf,
            stats: dateData.stats || null
          };
        }
      }
      console.log('[normalize] 主题ETF日期累积格式，日期数: ' + Object.keys(themeByDate).length);
    } else {
      // 旧格式：单日快照，只映射到自身日期
      const themeDateStr = normDate(rawTheme.date || rawTheme.label);
      if (themeDateStr) {
        themeByDate[themeDateStr] = rawTheme;
        console.log('[normalize] 主题ETF单日快照格式，日期: ' + themeDateStr);
      }
    }
  }

  const sortedDates = [...dateSet].sort();
  result.dates = sortedDates;

  // --- 按日期标准化 ---
  // 处理 themeBreadthData 的混合格式（既有日期键如 "20260618"，又有快照字段如 "date","themes"）
  let themeBreadthByDate = {};
  if (themeBreadthData) {
    for (const key of Object.keys(themeBreadthData)) {
      // 只保留 8位数字键（日期键），忽略 "date","label","themes","generated" 等快照字段
      if (/^\d{8}$/.test(key) && themeBreadthData[key] && themeBreadthData[key].themes) {
        themeBreadthByDate[key] = themeBreadthData[key];
      }
    }
    // 如果没找到日期键，说明是纯快照格式，转成按日期格式
    if (Object.keys(themeBreadthByDate).length === 0 && themeBreadthData.themes) {
      const snapshotDate = normDate(themeBreadthData.date || themeBreadthData.label);
      if (snapshotDate) {
        const dtKey = snapshotDate.replace(/-/g, '');
        themeBreadthByDate[dtKey] = { date: themeBreadthData.date, label: themeBreadthData.label, themes: themeBreadthData.themes };
      }
    }
  }
  for (let i = 0; i < sortedDates.length; i++) {
    const dt = sortedDates[i];
    const prevDt = i > 0 ? sortedDates[i - 1] : null;

    // 匹配主题宽度数据（支持 YYYY-MM-DD 和 YYYYMMDD 两种格式）
    let themeBreadth = null;
    if (themeBreadthByDate) {
      const dtKey = dt.replace(/-/g, '');
      themeBreadth = themeBreadthByDate[dtKey] || null;
    }

    // 全市场宽度：统一日期键格式（YYYYMMDD）
    let breadthEntry = null;
    if (breadthData) {
      const dtKey = dt.replace(/-/g, '');
      breadthEntry = breadthData[dtKey] || breadthData[dt] || null;
    }
    const item = buildDateEntry(
      dt, prevDt,
      rawEtf && rawEtf[dt],
      themeByDate[dt] || null,  // 从 themeByDate 取数，兼容新旧格式
      concData && concData[dt],
      marginData,
      shareData,
      breadthEntry,
      themeBreadth
    );
    result.data[dt] = item;
  }

  return result;
}

/**
 * 构建单个日期的标准化数据条目
 */
function buildDateEntry(dt, prevDt, etfDay, themeDay, concDay, marginData, shareData, breadthData, themeBreadth) {
  const entry = {
    date: dt,
    label: normLabel(dt),

    // --- 数据质量元数据 ---
    meta: buildMeta(dt, etfDay, themeDay, concDay, marginData),

    // --- 市场概览（指数行情作为背景） ---
    market: buildMarket(etfDay, concDay, dt, prevDt, breadthData),

    // --- 集中度 ---
    concentration: buildConcentration(concDay),

    // --- 宽基ETF ---
    etfWide: buildEtfWide(etfDay),

    // --- 主题ETF ---
    etfTheme: themeDay ? buildEtfTheme(themeDay) : null,

    // --- 融资余额 ---
    margin: buildMargin(dt, marginData),

    // --- 份额数据（用于ETF净流入计算） ---
    shareData: shareData || null,

    // --- 主题宽度（新增） ---
    themeBreadth: themeBreadth || null
  };

  // 把主题宽度数据合并到 etfTheme.categories[cat].themes[themeName] 上
  // 注意：etfTheme.themes 不存在，真实结构是 categories[cat].themes[themeName] 嵌套对象
  // 注意：themeBreadth 是整个按日期组织的对象 { "20260618": {...}, "20260621": {...} }
  // 注意：dt 是 YYYY-MM-DD 格式，但 themeBreadth 的键是 YYYYMMDD 格式，需要转换
  if (entry.etfTheme && entry.etfTheme.categories) {
    // 情况1：有主题宽度数据，合并
    if (entry.themeBreadth && entry.themeBreadth.themes) {
      const tbData = entry.themeBreadth;
      for (const [catName, cat] of Object.entries(entry.etfTheme.categories)) {
        if (!cat.themes) continue;
        for (const [themeName, theme] of Object.entries(cat.themes)) {
          const tb = tbData.themes.find(t => t.name === themeName);
          if (tb) {
            theme.medianReturn  = tb.medianReturn != null ? tb.medianReturn : null;
            theme.marketMedian  = tb.marketMedian != null ? tb.marketMedian : null;
            theme.upRatio       = tb.upRatio != null ? tb.upRatio : null;
            theme.breadthSource = tb.source || null;
            theme.breadthStatus = tb.dataStatus || 'confirmed'; // 有数据，默认 confirmed
          } else {
            // 有宽度数据，但当前主题不在里面（可能数据源没覆盖）
            theme.breadthStatus = 'historical_missing';
          }
        }
      }
    } else {
      // 情况2：没有主题宽度数据（历史缺失或抓取失败）
      for (const [catName, cat] of Object.entries(entry.etfTheme.categories)) {
        if (!cat.themes) continue;
        for (const [themeName, theme] of Object.entries(cat.themes)) {
          theme.breadthStatus = 'historical_missing';
        }
      }
    }
  }

  return entry;
}

function buildMeta(dt, etfDay, themeDay, concDay, marginData) {
  const meta = {
    quoteTime: null,
    etfShareDate: null,
    marginDate: null,
    fetchTime: null,
    phase: DATA_STATUS.PARTIAL,
    completeness: 0,
    pendingItems: []
  };

  // 行情时间
  if (etfDay) {
    if (etfDay.updated) meta.fetchTime = etfDay.updated;
    else if (etfDay.updateTime) meta.fetchTime = etfDay.updateTime;
  }

  // ETF份额日期
  if (themeDay && themeDay.stats && themeDay.stats.dates) {
    meta.etfShareDate = normDate(themeDay.stats.dates.T);
  }

  // 融资余额日期（T+1，所以取前一日）
  if (marginData) {
    const marginDates = Object.keys(marginData).sort();
    const prevMargin = marginDates.filter(d => d <= dt).pop();
    if (prevMargin) {
      meta.marginDate = prevMargin;
      if (prevMargin < dt) meta.pendingItems.push('融资余额(T+1)');
    }
  }

  // 数据阶段判断
  const hasConc = !!concDay;
  const hasEtf = !!etfDay;
  const hasTheme = !!themeDay;

  if (hasConc && concDay && concDay.isIntra) {
    meta.phase = DATA_STATUS.REALTIME;
  } else if (hasConc && (hasEtf || hasTheme)) {
    meta.phase = DATA_STATUS.CONFIRMED;
  } else if (hasConc || hasEtf) {
    meta.phase = DATA_STATUS.PRELIMINARY;
  } else {
    meta.phase = DATA_STATUS.PARTIAL;
  }

  // 完整度计算 —— 固定 6 项分母，缺失模块算 0
  // 修复：之前分母会随已有模块动态变化，导致"模块缺失反而完整度高"
  const FIXED_FIELDS = 6; // 成交额/集中度TOP100/集中度TOP10/宽基ETF/主题ETF/融资余额
  let filled = 0;
  if (concDay && concDay.total != null) filled++;
  if (concDay && concDay.top100S != null) filled++;
  if (concDay && concDay.top10S != null) filled++;
  if (etfDay && (etfDay.wideBase || etfDay.wideTotal != null)) filled++;
  if (themeDay && themeDay.themeEtf) filled++;
  // 融资余额
  const marginDatesAvail = marginData ? Object.keys(marginData).filter(k => !k.startsWith('_')).sort().filter(d => d <= dt).pop() : null;
  if (marginDatesAvail) filled++;

  meta.completeness = Math.min(filled / FIXED_FIELDS, 1);

  return meta;
}

function buildMarket(etfDay, concDay, dt, prevDt, breadthData) {
  const m = {
    // 指数行情（当前无独立指数数据源，用宽基ETF涨跌代理）
    indices: [],
    // 全市场成交额
    totalAmount: null,
    amountPrev: null,
    amountChgPct: null,
    amountVs5d: null,
    amountPctile20d: null,
    // 市场宽度（真实数据，从 breadthData 接入）
    advDecRatio: null,      // 上涨占比（旧字段名，兼容）
    upRatio: null,          // 上涨占比（新字段名，与主题宽度一致）
    medianReturn: null,    // 全市场涨跌幅中位数
    limitUp: null,          // 涨停数量
    limitDown: null,        // 跌停数量
    maxConsecutiveBoard: null, // 最高连板数（如 5 = 5连板）
    limitDataStatus: null,  // 涨跌停数据状态：confirmed | partial | null
    limitNote: null,        // 涨跌停数据备注（如"含ST"）
    upCount: null,          // 上涨家数
    downCount: null,        // 下跌家数
    flatCount: null,        // 平盘家数
    totalCount: null,       // 参与交易家数
    // 市场宽度状态
    breadthStatus: null,
    breadthSource: null      // 'wind' | 'proxy' | null
  };

  // --- 成交额来自集中度数据 ---
  if (concDay) {
    m.totalAmount = safeNum(concDay.total);
  }

  // --- 宽基ETF数据中提取指数涨跌作为背景 ---
  if (etfDay && etfDay.wideBase) {
    m.indices = etfDay.wideBase.slice(0, 6).map(item => ({
      name: item.name || '--',
      chg: safeNum(item.chg),
      flow: safeNum(item.flow),
      vs20d: null
    }));
  }

  // --- 接入真实市场宽度 ---
  if (breadthData && breadthData.dataStatus !== 'missing') {
    m.medianReturn = safeNum(breadthData.medianChg);
    m.advDecRatio = safeNum(breadthData.upRatio);   // 旧字段，兼容
    m.upRatio     = safeNum(breadthData.upRatio);   // 新字段，与主题宽度一致
    m.upCount = breadthData.upCount != null ? breadthData.upCount : null;
    m.downCount = breadthData.downCount != null ? breadthData.downCount : null;
    m.flatCount = breadthData.flatCount != null ? breadthData.flatCount : null;
    m.totalCount = breadthData.totalCount != null ? breadthData.totalCount : null;
    m.limitUp = breadthData.limitUpCount != null ? breadthData.limitUpCount : null;
    m.limitDown = breadthData.limitDownCount != null ? breadthData.limitDownCount : null;
    m.maxConsecutiveBoard = breadthData.maxConsecutiveBoard != null ? breadthData.maxConsecutiveBoard : null;
    m.limitDataStatus = breadthData.limitDataStatus || null;  // 'confirmed' | 'partial' | null
    m.limitNote = breadthData.limitNote || null;
    m.breadthStatus = breadthData.dataStatus || 'partial';
    m.breadthSource = 'wind';
  } else {
    // 降级：用TOP10代理（保留原有逻辑）
    if (concDay && concDay.top10) {
      const stocks = concDay.top10.filter(s => s && s[3] != null);
      if (stocks.length > 0) {
        const upCount = stocks.filter(s => safeNum(s[3]) > 0).length;
        m.advDecRatio = upCount / stocks.length;
        m.medianReturn = stocks.map(s => safeNum(s[3])).filter(v => v != null).sort((a, b) => a - b)[Math.floor(stocks.length / 2)];
        m.breadthStatus = 'partial';
        m.breadthSource = 'proxy';
      }
    }
  }

  m.breadthStatus = m.advDecRatio !== null ? m.breadthStatus || 'confirmed' : 'historical_missing';

  return m;
}

function buildConcentration(concDay) {
  if (!concDay) {
    return {
      top100: { value: null, status: DATA_STATUS.PARTIAL },
      top10: { value: null, status: DATA_STATUS.PARTIAL },
      top100Stocks: [],
      top10Stocks: [],
      industryDist: {},
      status: DATA_STATUS.PARTIAL
    };
  }

  const total = safeNum(concDay.total);
  const top100S = safeNum(concDay.top100S);
  const top10S = safeNum(concDay.top10S);

  return {
    top100: {
      value: (top100S != null && total != null && total > 0) ? (top100S / total * 100) : null,
      rawAmount: top100S,
      status: top100S != null ? DATA_STATUS.CONFIRMED : DATA_STATUS.PARTIAL
    },
    top10: {
      value: (top10S != null && total != null && total > 0) ? (top10S / total * 100) : null,
      rawAmount: top10S,
      status: top10S != null ? DATA_STATUS.CONFIRMED : DATA_STATUS.PARTIAL
    },
    totalAmount: total,
    top100Stocks: (concDay.top100 || []).filter(s => s && s[0]),
    top10Stocks: (concDay.top10 || []).filter(s => s && s[0]),
    industryDist: {},
    isIntra: !!concDay.isIntra,
    status: DATA_STATUS.CONFIRMED
  };
}

function buildEtfWide(etfDay) {
  if (!etfDay) {
    return { items: [], totalFlow: null, status: DATA_STATUS.PARTIAL, coverage: 0 };
  }

  const items = (etfDay.wideBase || []).map(item => ({
    name: item.name || '--',
    flow: safeNum(item.flow),
    chg: safeNum(item.chg),
    status: safeNum(item.flow) !== null ? DATA_STATUS.CONFIRMED : DATA_STATUS.PARTIAL
  }));

  // 明细数据（如果有）
  let inflowDetails = null;
  let outflowDetails = null;
  if (etfDay.inflowDetails) inflowDetails = normalizeEtfDetails(etfDay.inflowDetails);
  if (etfDay.outflowDetails) outflowDetails = normalizeEtfDetails(etfDay.outflowDetails);

  // 修复覆盖率口径：拆分三个独立指标
  // - directionCoverage: 已有方向数 / 11（仅判断"哪些方向有数据"）
  // - sampleCoverage: 有效样本数 / 计划样本数（基于wideBaseETFs池子）
  // 不再用单一 coverage 字段混淆多种含义
  const directionCount = items.length;
  const plannedDirectionTotal = 11; // 上证50/沪深300/中证500/中证1000/中证A500/科创50/创业板指/创业板50/中证2000/科创100/深证100
  const directionCoverage = directionCount / plannedDirectionTotal;

  // 计划样本数：从wideBaseETFs池统计（如果有）
  let plannedSamples = 0;
  if (etfDay.wideBaseETFs) {
    for (const idx in etfDay.wideBaseETFs) {
      plannedSamples += (etfDay.wideBaseETFs[idx] || []).length;
    }
  } else {
    plannedSamples = 55; // 11方向×5，默认计划值
  }
  // 有效样本：有 flow 数值的明细数
  let validSamples = 0;
  if (inflowDetails) {
    for (const idx in inflowDetails) validSamples += inflowDetails[idx].length;
  }
  if (outflowDetails) {
    for (const idx in outflowDetails) validSamples += outflowDetails[idx].length;
  }
  const sampleCoverage = plannedSamples > 0 ? Math.min(1, validSamples / plannedSamples) : 0;

  return {
    items,
    totalFlow: safeNum(etfDay.wideTotal),
    inflowDetails,
    outflowDetails,
    source: etfDay.source || etfDay.sampleNote || '--',
    status: DATA_STATUS.CONFIRMED,
    // 三个独立覆盖率口径
    directionCoverage,           // 方向数覆盖（11分之几）
    sampleCoverage,              // 样本ETF覆盖
    plannedSamples,
    validSamples,
    // 兼容字段（保留 coverage 但语义更准确）
    coverage: directionCoverage  // 此前字段含义=方向数覆盖率
  };
}

function normalizeEtfDetails(details) {
  const nameFallback = {
    '510360': '广发沪深300ETF'
  };
  const invalidByIndex = {
    '创业板指': new Set(['159916']), // 159916=建信深证基本面60ETF，不应归入创业板指
    '中证A500': new Set(['560230']) // 非中证A500样本，不应归入中证A500
  };
  const result = {};
  for (const [indexName, etfList] of Object.entries(details)) {
    const invalidCodes = invalidByIndex[indexName] || new Set();
    result[indexName] = (etfList || [])
      .filter(etf => !invalidCodes.has(String(etf.code || '')))
      .map(etf => ({
        code: etf.code || '',
        name: nameFallback[etf.code] || etf.name || '--',
        flow: safeNum(etf.flow),
        volume: safeNum(etf.volume),
        turnover: safeNum(etf.turnover),
        premium: safeNum(etf.premium),
        chg: safeNum(etf.chg),
        fundSize: safeNum(etf.fundSize != null ? etf.fundSize : etf.scale),
        manager: etf.manager || '',
        status: safeNum(etf.flow) !== null ? DATA_STATUS.CONFIRMED : DATA_STATUS.PENDING
      }));
  }
  return result;
}

function buildEtfTheme(themeDay) {
  if (!themeDay || !themeDay.themeEtf) {
    return null;
  }

  const categories = {};
  let totalSampleCount = 0;
  let totalConfirmedCount = 0;
  let totalFundSize = 0;
  let totalConfirmedFundSize = 0; // 修复：规模加权覆盖率

  for (const [catName, catData] of Object.entries(themeDay.themeEtf)) {
    const themes = {};
    for (const [themeName, themeData] of Object.entries(catData.themes || {})) {
      const sampleCount = safeNum(themeData.sampleCount) || 0;
      const confirmedCount = (themeData.etfDetails || []).filter(e => !e.sharePending).length;
      const fundSize = safeNum(themeData.fundSize) || 0;
      const coverage = safeNum(themeData.coverage);
      const isPending = (themeData.etfDetails || []).some(e => e.sharePending);

      // 规模加权：只累计已确认份额ETF的规模
      const confirmedFundSize = (themeData.etfDetails || [])
        .filter(e => !e.sharePending)
        .reduce((s, e) => s + (safeNum(e.fundSize) || 0), 0);

      totalSampleCount += sampleCount;
      totalConfirmedCount += confirmedCount;
      totalFundSize += fundSize;
      totalConfirmedFundSize += confirmedFundSize;

      themes[themeName] = {
        flow: safeNum(themeData.flow),
        flow5d: safeNum(themeData.flow5d),
        scaleRatio: safeNum(themeData.scaleRatio),
        volume: safeNum(themeData.volume),
        turnover: safeNum(themeData.turnover),
        chg: safeNum(themeData.chg),
        premium: safeNum(themeData.premium),
        sampleCount,
        confirmedCount,
        pendingCount: sampleCount - confirmedCount,
        coverage: coverage !== null ? coverage : (sampleCount > 0 ? confirmedCount / sampleCount : 0),
        // 修复：补上规模加权覆盖率
        fundSizeCoverage: fundSize > 0 ? confirmedFundSize / fundSize : 0,
        confirmedFundSize,
        fundSize,
        status: coverage !== null && coverage >= 0.6 ? DATA_STATUS.CONFIRMED : (coverage !== null && coverage >= 0.3 ? DATA_STATUS.PARTIAL : DATA_STATUS.PENDING),
        sharePending: isPending,
        etfDetails: (themeData.etfDetails || []).map(etf => ({
          code: etf.code || '',
          name: etf.name || '--',
          trackIndex: etf.trackIndex || '',
          manager: etf.manager || '',
          included: etf.included !== false,
          flow: safeNum(etf.flow),
          flow5d: safeNum(etf.flow5d),
          fundSize: safeNum(etf.fundSize),
          volume: safeNum(etf.volume),
          turnover: safeNum(etf.turnover),
          chg: safeNum(etf.chg),
          nav: safeNum(etf.nav),
          shareChange: safeNum(etf.shareChange),
          sharePending: !!etf.sharePending,
          status: etf.sharePending ? DATA_STATUS.PENDING : DATA_STATUS.CONFIRMED
        }))
      };
    }

    categories[catName] = {
      themes,
      totalFlow: safeNum(catData.totalFlow),
      topTheme: catData.topTheme || '--'
    };
  }

  return {
    categories,
    // 数量覆盖率（之前使用）
    sampleCoverage: totalSampleCount > 0 ? totalConfirmedCount / totalSampleCount : 0,
    // 修复：规模加权覆盖率（更准确的资金覆盖度）
    scaleWeightedCoverage: totalFundSize > 0 ? totalConfirmedFundSize / totalFundSize : 0,
    // 兼容字段（保留并明确语义）
    overallCoverage: totalSampleCount > 0 ? totalConfirmedCount / totalSampleCount : 0,
    totalSampleCount,
    totalConfirmedCount,
    totalPendingCount: totalSampleCount - totalConfirmedCount,
    totalFundSize,
    totalConfirmedFundSize,
    stats: themeDay.stats || null,
    poolMeta: themeDay.poolMeta || null,
    date: normDate(themeDay.date || themeDay.label || (themeDay.stats && themeDay.stats.dates && themeDay.stats.dates.T)),
    status: totalSampleCount > 0 && (totalConfirmedCount / totalSampleCount) >= 0.6 ? DATA_STATUS.CONFIRMED : DATA_STATUS.PARTIAL
  };
}

function buildMargin(dt, marginData) {
  if (!marginData) {
    return { value: null, date: null, status: DATA_STATUS.FAILED, weight: 0 };
  }

  const dates = Object.keys(marginData).sort();
  const validDate = dates.filter(d => d <= dt).pop();

  if (!validDate) {
    return { value: null, date: null, status: DATA_STATUS.FAILED, weight: 0 };
  }

  const value = safeNum(marginData[validDate]);
  if (value === null || value < 1.0) {
    // 异常值过滤（正常值 > 1.5万亿）
    return { value: null, date: validDate, status: DATA_STATUS.FAILED, weight: 0 };
  }

  const isStale = validDate < dt;
  const prevDate = dates.filter(d => d < validDate).pop();
  const prevValue = prevDate ? safeNum(marginData[prevDate]) : null;
  // chg: 百分比变化（单位：%），如 +0.19 表示较前日增加 0.19%
  const chg = (prevValue !== null && prevValue > 0) ? (value - prevValue) / prevValue * 100 : null;
  // chgYi: 较前日亿元变化（value/prevValue 单位都是万亿元，×10000 → 亿元）
  const chgYi = (prevValue !== null) ? (value - prevValue) * 10000 : null;

  // 计算5日趋势
  const recent5 = dates.filter(d => d <= validDate).slice(-5).map(d => safeNum(marginData[d])).filter(v => v !== null);
  let trend5d = null;
  if (recent5.length >= 2) {
    trend5d = recent5[recent5.length - 1] > recent5[0] ? 'up' : 'down';
  }

  return {
    value,
    date: validDate,
    chg,
    chgYi,  // 较前日亿元变化（新增字段，单位：亿元）
    trend5d,
    isStale,
    status: isStale ? DATA_STATUS.STALE : DATA_STATUS.CONFIRMED,
    weight: isStale ? 0.5 : 1.0 // 滞后数据权重降低
  };
}

module.exports = {
  DATA_STATUS,
  STATUS_LABEL,
  normDate,
  normLabel,
  safeNum,
  tagged,
  normalizeData
};
