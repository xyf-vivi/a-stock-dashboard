/**
 * styles.js — 双模式样式系统
 * 深色操作模式 + 浅色报告模式
 * CSS 变量驱动，通过 [data-theme] 切换
 */

'use strict';

function getStyles() {
  return `
:root {
  /* === 间距系统 === */
  --sp-1: 8px;
  --sp-2: 12px;
  --sp-3: 16px;
  --sp-4: 24px;
  --sp-5: 32px;

  /* === 字号系统 === */
  --fs-title: 22px;
  --fs-module: 16px;
  --fs-body: 13px;
  --fs-small: 12px;
  --fs-tiny: 11px;

  /* === 圆角 === */
  --radius: 10px;
  --radius-sm: 6px;

  /* === 布局 === */
  --max-w: 1400px;
  --cols: 12;

  /* === 深色模式（默认） === */
  --bg: #0b1219;
  --bg-elevated: #131d28;
  --bg-card: #15212e;
  --bg-card2: #101a24;
  --bg-hover: #1a2837;
  --border: #1f3040;
  --border-strong: #2a4053;

  --t1: #e0ecf1;
  --t2: #8ab0c4;
  --t3: #5a8094;
  --t4: #3d5a6b;

  /* 功能色 */
  --c-brand: #2b6fd6;       /* 深蓝主品牌色 */
  --c-brand-light: #4a8aef;
  --c-up: #e84057;          /* 红涨 */
  --c-down: #28c76f;        /* 绿跌 */
  --c-warn: #e8930a;        /* 橙：风险/待确认 */
  --c-etf: #9580f0;         /* 紫：ETF */
  --c-confirm: #17c49a;     /* 青绿：确认/承接 */
  --c-neutral: #6b8da5;     /* 灰蓝：辅助 */

  /* 状态标签底色 */
  --tag-up-bg: rgba(232,64,87,.12);
  --tag-down-bg: rgba(40,199,111,.12);
  --tag-warn-bg: rgba(232,147,10,.12);
  --tag-confirm-bg: rgba(23,196,154,.12);
  --tag-etf-bg: rgba(149,128,240,.12);
  --tag-neutral-bg: rgba(107,141,165,.12);

  /* 阶段色 */
  --phase-surge: #17c49a;
  --phase-crowd: #e8930a;
  --phase-diffuse: #2b93f5;
  --phase-cool: #8ab0c4;
  --phase-watch: #6b8da5;

  /* 结构性复盘模块 */
  --struct-bg: #111d2a;
  --struct-card-bg: #172837;
  --struct-border: #1e3342;
  --tint-loose: #135e47;
  --tint-loose-text: #5ed4a8;
  --tint-contract: #4a2810;
  --tint-contract-text: #d68c44;
  --tint-extreme: #4a1010;
  --tint-extreme-text: #e05555;
  --tint-neutral: #13202e;
  --tint-neutral-text: #8ab0c4;

  /* 阴影 */
  --shadow: 0 2px 8px rgba(0,0,0,.3);
  --shadow-hover: 0 4px 16px rgba(0,0,0,.4);

  /* 过渡 */
  --t: .2s ease;
}

/* === 浅色报告模式 === */
[data-theme="light"] {
  --bg: #f0f4f8;
  --bg-elevated: #ffffff;
  --bg-card: #ffffff;
  --bg-card2: #f7f9fb;
  --bg-hover: #eef2f7;
  --border: #d6dee5;
  --border-strong: #b0bcc8;

  --t1: #1a2b3c;
  --t2: #5a7080;
  --t3: #8a9ba8;
  --t4: #aab8c4;

  --c-brand: #1a5cc4;
  --c-brand-light: #2b7bed;
  --c-up: #d63548;
  --c-down: #1ea558;
  --c-warn: #d97e0a;
  --c-etf: #7c5fee;
  --c-confirm: #12a87f;
  --c-neutral: #5a7080;

  --tag-up-bg: rgba(214,53,72,.08);
  --tag-down-bg: rgba(30,165,88,.08);
  --tag-warn-bg: rgba(217,126,10,.08);
  --tag-confirm-bg: rgba(18,168,127,.08);
  --tag-etf-bg: rgba(124,95,238,.08);
  --tag-neutral-bg: rgba(90,112,128,.08);

  --shadow: 0 1px 4px rgba(0,40,80,.06);
  --shadow-hover: 0 2px 12px rgba(0,40,80,.1);
}

/* === 全局重置 === */
* { margin:0; padding:0; box-sizing:border-box; }
body {
  font-family: -apple-system, "PingFang SC", "Microsoft YaHei", "Segoe UI", sans-serif;
  font-size: var(--fs-body);
  color: var(--t1);
  background: var(--bg);
  line-height: 1.5;
  transition: background var(--t), color var(--t);
  -webkit-font-smoothing: antialiased;
}

/* === 布局 === */
.wrap {
  max-width: var(--max-w);
  margin: 0 auto;
  padding: 0 var(--sp-3);
}

/* === 顶部全局栏 === */
.topbar {
  position: sticky;
  top: 0;
  z-index: 100;
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border);
  padding: var(--sp-2) var(--sp-3);
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  flex-wrap: wrap;
  transition: background var(--t), border-color var(--t);
}
.topbar-brand {
  font-size: var(--fs-module);
  font-weight: 700;
  color: var(--c-brand);
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 6px;
}
.topbar-brand .icon {
  width: 22px; height: 22px;
  background: var(--c-brand);
  border-radius: 5px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 13px;
  font-weight: 800;
}
.topbar-meta {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  flex: 1;
  flex-wrap: wrap;
}
.topbar-actions {
  display: flex;
  align-items: center;
  gap: var(--sp-1);
}
.tb-select, .tb-btn {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--t1);
  padding: 5px 10px;
  font-size: var(--fs-small);
  cursor: pointer;
  transition: all var(--t);
}
.tb-select:hover, .tb-btn:hover {
  border-color: var(--c-brand);
  background: var(--bg-hover);
}
.tb-btn.active {
  background: var(--c-brand);
  color: #fff;
  border-color: var(--c-brand);
}

/* 数据阶段标签 */
.phase-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: var(--fs-tiny);
  font-weight: 600;
  white-space: nowrap;
}
.phase-pill.realtime { background: var(--tag-up-bg); color: var(--c-up); }
.phase-pill.preliminary { background: var(--tag-warn-bg); color: var(--c-warn); }
.phase-pill.confirmed { background: var(--tag-confirm-bg); color: var(--c-confirm); }
.phase-pill.partial, .phase-pill.stale, .phase-pill.failed, .phase-pill.pending {
  background: var(--tag-neutral-bg); color: var(--c-neutral);
}

.data-health-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: var(--fs-tiny);
  font-weight: 600;
  white-space: nowrap;
  color: var(--t2);
  background: var(--bg-card2);
  border: 1px solid var(--border);
}
.data-health-pill.confirmed { color: var(--c-confirm); background: var(--tag-confirm-bg); }
.data-health-pill.partial { color: var(--c-warn); background: var(--tag-warn-bg); }
.data-health-pill.error { color: var(--c-dn); background: var(--tag-dn-bg, rgba(220,53,69,.12)); }
.data-health-pill .dh-sep { opacity: .5; margin: 0 2px; }

/* 数据元信息行 */
.meta-row {
  display: flex;
  gap: var(--sp-2);
  flex-wrap: wrap;
  font-size: var(--fs-tiny);
  color: var(--t3);
  padding: var(--sp-1) var(--sp-3);
  background: var(--bg-card2);
  border-bottom: 1px solid var(--border);
}
.meta-row .meta-item {
  display: flex;
  align-items: center;
  gap: 3px;
}
.meta-row .meta-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: var(--c-confirm);
}
.meta-row .meta-dot.warn { background: var(--c-warn); }
.meta-row .meta-dot.neutral { background: var(--c-neutral); }

/* === Tab 导航 === */
.tabs-bar {
  display: flex;
  gap: 2px;
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border);
  padding: 0 var(--sp-3);
  overflow-x: auto;
}
.tab-btn {
  padding: 10px 16px;
  font-size: var(--fs-body);
  color: var(--t2);
  border: none;
  background: none;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all var(--t);
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 6px;
}
.tab-btn:hover { color: var(--t1); }
.tab-btn.active {
  color: var(--c-brand);
  border-bottom-color: var(--c-brand);
  font-weight: 600;
}
.tab-btn .tab-num {
  font-size: var(--fs-tiny);
  color: var(--t3);
  font-weight: 400;
}

/* === Tab 内容 === */
.tab-content { display: none; }
.tab-content.active { display: block; }

/* === 模块编号标题 === */
.module-title {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  padding: var(--sp-3) 0 var(--sp-2);
}
.module-title .num {
  font-size: var(--fs-tiny);
  font-weight: 700;
  color: var(--c-brand);
  background: var(--tag-confirm-bg);
  padding: 2px 6px;
  border-radius: 4px;
}
.module-title .title {
  font-size: var(--fs-module);
  font-weight: 700;
  color: var(--t1);
}
.module-title .subtitle {
  font-size: var(--fs-small);
  color: var(--t2);
  flex: 1;
}

/* === 卡片基础 === */
.card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: var(--sp-3);
  transition: all var(--t);
}
.card:hover { border-color: var(--border-strong); }

/* === 网格 === */
.grid { display: grid; gap: var(--sp-2); }
.grid-2 { grid-template-columns: repeat(2, 1fr); }
.grid-3 { grid-template-columns: repeat(3, 1fr); }
.grid-4 { grid-template-columns: repeat(4, 1fr); }
.grid-6 { grid-template-columns: repeat(6, 1fr); }
.grid-12 { grid-template-columns: repeat(12, 1fr); }

/* === 指数卡 === */
.idx-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: var(--sp-2) var(--sp-3);
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.idx-name { font-size: var(--fs-small); color: var(--t2); }
.idx-chg { font-size: 20px; font-weight: 700; }
.idx-flow { font-size: var(--fs-tiny); color: var(--t3); }

/* === 核心判断卡 === */
.verdict-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: var(--sp-4);
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
}
.verdict-strap {
  font-size: var(--fs-tiny);
  color: var(--t3);
  padding-bottom: var(--sp-1);
  border-bottom: 1px dashed var(--border);
}
.verdict-phase {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
}
.verdict-phase-tag {
  font-size: var(--fs-module);
  font-weight: 800;
  padding: 4px 14px;
  border-radius: 20px;
}
.verdict-phase-tag.surge { background: var(--tag-confirm-bg); color: var(--phase-surge); }
.verdict-phase-tag.crowd { background: var(--tag-warn-bg); color: var(--phase-crowd); }
.verdict-phase-tag.diffuse { background: rgba(43,147,245,.12); color: var(--phase-diffuse); }
.verdict-phase-tag.cool { background: var(--tag-neutral-bg); color: var(--phase-cool); }
.verdict-phase-tag.watch { background: var(--tag-neutral-bg); color: var(--phase-watch); }

.verdict-confidence {
  font-size: var(--fs-tiny);
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 600;
}
.verdict-confidence.high { background: var(--tag-confirm-bg); color: var(--c-confirm); }
.verdict-confidence.medium { background: var(--tag-warn-bg); color: var(--c-warn); }
.verdict-confidence.low { background: var(--tag-neutral-bg); color: var(--c-neutral); }

.verdict-sentence {
  font-size: 15px;
  color: var(--t1);
  line-height: 1.6;
}
.verdict-section-title {
  font-size: var(--fs-small);
  font-weight: 700;
  color: var(--t2);
}
.verdict-evidence {
  display: flex;
  gap: var(--sp-2);
  flex-wrap: wrap;
}
.evidence-pill {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: var(--radius-sm);
  font-size: var(--fs-small);
  background: var(--bg-card2);
  border: 1px solid var(--border);
}
.evidence-pill.positive { border-color: var(--c-up); }
.evidence-pill.negative { border-color: var(--c-down); }
.evidence-pill .evi-icon { font-size: 10px; }

.verdict-validate {
  font-size: var(--fs-small);
  color: var(--t2);
  padding: var(--sp-2);
  background: var(--bg-card2);
  border-radius: var(--radius-sm);
  border-left: 3px solid var(--c-brand);
}
.verdict-hint {
  font-size: var(--fs-tiny);
  color: var(--t3);
  padding-left: 2px;
}

/* === KPI 卡（资金脉搏） === */
.kpi-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: var(--sp-2) var(--sp-3);
  cursor: pointer;
  transition: all var(--t);
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.kpi-card:hover {
  border-color: var(--c-brand);
  background: var(--bg-hover);
}
.kpi-label {
  font-size: var(--fs-tiny);
  color: var(--t3);
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.kpi-value {
  font-size: 20px;
  font-weight: 700;
  display: flex;
  align-items: baseline;
  gap: 4px;
}
.kpi-value .unit {
  font-size: var(--fs-small);
  font-weight: 400;
  color: var(--t3);
}
.kpi-benchmark {
  font-size: var(--fs-tiny);
  color: var(--t2);
}
.kpi-status {
  font-size: var(--fs-tiny);
  font-weight: 600;
}
.kpi-date {
  font-size: 10px;
  color: var(--t4);
}
.kpi-layer-tag {
  font-size: 9px;
  color: var(--c-brand);
  text-transform: uppercase;
  letter-spacing: .5px;
}

/* === 主题结构地图 === */
.theme-map {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--sp-2);
}
.theme-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: var(--sp-2) var(--sp-3);
  cursor: pointer;
  transition: all var(--t);
}
.theme-card:hover { border-color: var(--c-brand); }
.theme-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}
.theme-card-name { font-size: var(--fs-body); font-weight: 600; }
.theme-status-tag {
  font-size: var(--fs-tiny);
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 600;
}
.theme-status-tag.sustained { background: var(--tag-confirm-bg); color: var(--c-confirm); }
.theme-status-tag.spike { background: rgba(43,147,245,.12); color: var(--c-brand-light); }
.theme-status-tag.cooling { background: var(--tag-warn-bg); color: var(--c-warn); }
.theme-status-tag.outflow { background: var(--tag-down-bg); color: var(--c-down); }
.theme-status-tag.unknown { background: var(--tag-neutral-bg); color: var(--c-neutral); }

.theme-card-flow {
  font-size: 16px;
  font-weight: 700;
  margin-bottom: 2px;
}
.theme-card-meta {
  display: flex;
  gap: var(--sp-2);
  font-size: var(--fs-tiny);
  color: var(--t3);
}
.theme-card-coverage {
  font-size: 10px;
  color: var(--t4);
  margin-top: 2px;
}

/* === 主题资金热力榜（结构复盘内） === */
.theme-heatmap {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
}
.theme-auto-line {
  background: linear-gradient(90deg, rgba(74,222,128,.10), rgba(43,147,245,.06));
  border-left: 3px solid var(--c-brand);
  padding: 10px 14px;
  border-radius: 4px;
  font-size: var(--fs-body);
  color: var(--t1);
  line-height: 1.5;
}
.theme-card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--sp-2);
}
.theme-card-rhythm {
  font-size: var(--fs-tiny);
  padding: 2px 8px;
  border-radius: 10px;
  background: rgba(43,147,245,.12);
  color: var(--c-brand-light);
  font-weight: 600;
}
.sample-warn-tag {
  font-size: 9px;
  padding: 1px 6px;
  border-radius: 3px;
  background: rgba(232,167,10,.15);
  color: var(--c-warn);
  font-weight: 600;
}
.etf-abnormal-tag {
  font-size: 9px;
  padding: 1px 6px;
  border-radius: 3px;
  background: rgba(248,113,113,.15);
  color: var(--c-up);
  font-weight: 600;
  margin-top: 4px;
  display: inline-block;
}
.theme-card-stats {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 6px 12px;
  margin-top: 6px;
}
.tcs-item {
  display: flex;
  justify-content: space-between;
  font-size: var(--fs-tiny);
  padding: 3px 0;
  border-bottom: 1px dashed var(--border);
}
.tcs-label { color: var(--t3); }
.tcs-val { color: var(--t1); font-weight: 600; }

/* 主题卡片左侧色条 */
.theme-card-stripe-strong { border-left: 4px solid var(--c-up); }
.theme-card-stripe-mid { border-left: 4px solid var(--c-brand-light); }
.theme-card-stripe-weak { border-left: 4px solid var(--border); }

/* 折叠明细 */
.theme-card-details { margin-top: 8px; }
.theme-card-details summary {
  font-size: var(--fs-tiny);
  color: var(--c-brand-light);
  cursor: pointer;
  padding: 4px 0;
  user-select: none;
}
.theme-card-details summary:hover { color: var(--c-brand); }
.etf-detail-table {
  font-size: var(--fs-tiny);
}
.etf-detail-table th, .etf-detail-table td {
  padding: 4px 6px;
}

/* === 34周线趋势状态面板 === */
.weekly-summary {
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
}
.ws-topline {
  font-size: var(--fs-body);
  font-weight: 600;
  color: var(--t1);
  padding: 12px 16px;
  background: linear-gradient(90deg, rgba(74,222,128,.10), rgba(43,147,245,.06));
  border-left: 3px solid var(--c-brand);
  border-radius: 4px;
  line-height: 1.6;
}
.ws-panel {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: var(--sp-3);
}
.ws-panel-label {
  font-size: var(--fs-small);
  font-weight: 600;
  color: var(--t2);
  margin-bottom: 10px;
}
.ws-bars {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.ws-bar-item {
  display: grid;
  grid-template-columns: 90px 1fr 30px;
  align-items: center;
  gap: 12px;
}
.ws-bar-label {
  font-size: var(--fs-tiny);
  color: var(--t2);
  font-weight: 500;
}
.ws-bar-track {
  height: 16px;
  background: var(--bg-2);
  border-radius: 3px;
  overflow: hidden;
}
.ws-bar-fill {
  height: 100%;
  border-radius: 3px;
  transition: width var(--t);
}
.ws-bar-count {
  font-size: var(--fs-tiny);
  color: var(--t1);
  font-weight: 600;
  text-align: right;
}
.ws-strength-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--sp-2);
}
.ws-strength-col {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: var(--sp-2) var(--sp-3);
}
.ws-strength-strong { border-top: 3px solid var(--c-up); }
.ws-strength-weak { border-top: 3px solid var(--c-down); }
.ws-col-title {
  font-size: var(--fs-small);
  font-weight: 600;
  color: var(--t2);
  margin-bottom: 8px;
}
.ws-top-row-item {
  display: grid;
  grid-template-columns: 1fr 80px 1fr;
  align-items: center;
  gap: 8px;
  padding: 5px 0;
  border-bottom: 1px dashed var(--border);
  font-size: var(--fs-tiny);
}
.ws-top-name { color: var(--t1); font-weight: 500; }
.ws-top-dist { text-align: right; font-weight: 600; font-family: monospace; }
.ws-top-status { color: var(--t3); font-size: 10px; text-align: right; }
.ws-top-empty {
  color: var(--t3);
  font-size: var(--fs-tiny);
  padding: 8px 0;
}
.ws-trade-note {
  background: rgba(232,167,10,.06);
  border-left: 3px solid var(--c-warn);
  padding: 8px 12px;
  border-radius: 4px;
  font-size: var(--fs-small);
  color: var(--t1);
  line-height: 1.5;
}
.ws-trade-tag {
  display: inline-block;
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 3px;
  background: var(--c-warn);
  color: #fff;
  font-weight: 600;
  margin-right: 8px;
  vertical-align: 1px;
}

/* === 情景卡（明日观察） === */
.scenario-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-left: 3px solid var(--c-brand);
  border-radius: var(--radius);
  padding: var(--sp-3);
  display: flex;
  flex-direction: column;
  gap: var(--sp-1);
}
.scenario-direction {
  font-size: var(--fs-body);
  font-weight: 700;
  color: var(--t1);
}
.scenario-current {
  font-size: var(--fs-small);
  color: var(--t2);
}
.scenario-condition {
  display: flex;
  gap: 6px;
  font-size: var(--fs-small);
  padding: 4px 0;
}
.scenario-condition .label {
  color: var(--t3);
  white-space: nowrap;
  min-width: 50px;
}
.scenario-confirm { color: var(--c-confirm); }
.scenario-invalid { color: var(--c-warn); }
.scenario-action {
  font-size: var(--fs-small);
  font-weight: 600;
  color: var(--c-brand);
  padding-top: 4px;
  border-top: 1px dashed var(--border);
}

/* === 信号一致度 === */
.consistency-bar {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  padding: var(--sp-2) var(--sp-3);
  background: var(--bg-card);
  border-radius: var(--radius);
  border: 1px solid var(--border);
}
.consistency-label { font-size: var(--fs-small); color: var(--t2); white-space: nowrap; }
.consistency-track {
  flex: 1;
  height: 8px;
  background: var(--bg-card2);
  border-radius: 4px;
  overflow: hidden;
  position: relative;
}
.consistency-fill {
  height: 100%;
  border-radius: 4px;
  transition: width .5s ease;
}
.consistency-fill.high { background: var(--c-confirm); }
.consistency-fill.medium { background: var(--c-warn); }
.consistency-fill.low { background: var(--c-neutral); }
.consistency-value { font-size: var(--fs-small); font-weight: 600; min-width: 30px; text-align: right; }

/* === 表格 === */
.tbl-wrap {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
}
.tbl-scroll {
  overflow-x: auto;
}
table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--fs-small);
}
thead { position: sticky; top: 0; z-index: 5; }
th {
  background: var(--bg-card2);
  color: var(--t2);
  font-weight: 600;
  text-align: right;
  padding: 8px var(--sp-2);
  border-bottom: 1px solid var(--border);
  white-space: nowrap;
  position: relative;
}
th:first-child, td:first-child { text-align: left; }
td {
  padding: 7px var(--sp-2);
  border-bottom: 1px solid var(--border);
  text-align: right;
  white-space: nowrap;
}
tbody tr:hover { background: var(--bg-hover); }
tbody tr:last-child td { border-bottom: none; }
.tbl-unit {
  font-size: 10px;
  color: var(--t4);
  font-weight: 400;
  margin-left: 2px;
}

/* === 涨跌色 === */
.up { color: var(--c-up); }
.dn { color: var(--c-down); }

/* === 数据状态标签 === */
.dstatus {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: var(--fs-tiny);
  padding: 1px 6px;
  border-radius: 8px;
  font-weight: 600;
}
.dstatus.confirmed { background: var(--tag-confirm-bg); color: var(--c-confirm); }
.dstatus.preliminary { background: var(--tag-warn-bg); color: var(--c-warn); }
.dstatus.pending, .dstatus.partial { background: var(--tag-neutral-bg); color: var(--c-neutral); }
.dstatus.stale, .dstatus.failed { background: var(--tag-down-bg); color: var(--c-down); }
.dstatus.realtime { background: var(--tag-up-bg); color: var(--c-up); }

/* === 数据质量中心 === */
.quality-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--sp-2);
}
.quality-item {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: var(--sp-2) var(--sp-3);
}
.quality-item-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}
.quality-item-name { font-size: var(--fs-small); font-weight: 600; }
.quality-item-meta {
  font-size: var(--fs-tiny);
  color: var(--t3);
  display: flex;
  flex-direction: column;
  gap: 2px;
}

/* === 四象限 === */
.quad-wrap {
  position: relative;
  width: 100%;
  height: 340px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
}
.quad-axis-label {
  position: absolute;
  font-size: var(--fs-tiny);
  color: var(--t3);
}
.quad-dot {
  position: absolute;
  border-radius: 50%;
  cursor: pointer;
  transition: all var(--t);
  border: 2px solid rgba(255,255,255,.2);
}
.quad-dot:hover { transform: scale(1.2); z-index: 10; }
.quad-dot-label {
  position: absolute;
  z-index: 8;
  max-width: 82px;
  padding: 2px 5px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--bg-elevated) 86%, transparent);
  border: 1px solid var(--border);
  color: var(--t2);
  font-size: 10px;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  pointer-events: none;
}
.quad-popup {
  position: absolute;
  background: var(--bg-elevated);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius);
  padding: var(--sp-2) var(--sp-3);
  font-size: var(--fs-small);
  box-shadow: var(--shadow-hover);
  z-index: 20;
  display: none;
  min-width: 160px;
}
.quad-popup.show { display: block; }

/* === 图表容器 === */
.chart-box {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: var(--sp-3);
}
.chart-canvas-wrap {
  position: relative;
  height: 200px;
}
.chart-conclusion {
  font-size: var(--fs-small);
  color: var(--t2);
  padding: var(--sp-1) 0 0;
  border-top: 1px dashed var(--border);
  margin-top: var(--sp-2);
}

/* === 折叠区 === */
.collapse-section { margin-bottom: var(--sp-2); }
.collapse-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--sp-2) var(--sp-3);
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  cursor: pointer;
  transition: all var(--t);
}
.collapse-header:hover { background: var(--bg-hover); }
.collapse-header .arrow { transition: transform var(--t); }
.collapse-header.open .arrow { transform: rotate(90deg); }
.collapse-body {
  max-height: 0;
  overflow: hidden;
  transition: max-height .3s ease;
}
.collapse-body.open { max-height: 3000px; }

/* === 信号格 === */
.signal-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--sp-2);
}
.signal-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: var(--sp-3);
}
.signal-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--sp-1);
}
.signal-card-name { font-size: var(--fs-body); font-weight: 600; }
.signal-card-detail { font-size: var(--fs-small); color: var(--t2); margin-top: 4px; }
.signal-card-meta {
  font-size: var(--fs-tiny);
  font-weight: 600;
  margin-top: 4px;
}
.signal-card-meta.positive { color: var(--c-up); }
.signal-card-meta.negative { color: var(--c-down); }
.signal-card-meta.neutral { color: var(--c-neutral); }
.signal-strength {
  display: flex;
  gap: 3px;
  align-items: center;
}
.signal-bar {
  width: 8px;
  height: 16px;
  border-radius: 2px;
  background: var(--bg-card2);
}
.signal-bar.active.positive { background: var(--c-up); }
.signal-bar.active.negative { background: var(--c-down); }
.signal-bar.active.neutral { background: var(--c-neutral); }
.signal-legend {
  font-size: var(--fs-tiny);
  color: var(--t3);
  padding-left: 2px;
}

/* === 详情展开行 === */
.det-row {
  display: none;
  background: var(--bg-card2);
}
.det-row.open { display: table-row; }
.det-row td { padding: var(--sp-2); }

/* === 响应式 === */
@media (max-width: 1024px) {
  .grid-6 { grid-template-columns: repeat(3, 1fr); }
  .grid-4 { grid-template-columns: repeat(2, 1fr); }
  .theme-map { grid-template-columns: repeat(2, 1fr); }
  .signal-grid { grid-template-columns: 1fr; }
  .quality-grid { grid-template-columns: repeat(2, 1fr); }
}

@media (max-width: 768px) {
  .grid-6, .grid-4, .grid-3, .grid-2 { grid-template-columns: 1fr; }
  .grid-12 { grid-template-columns: repeat(2, 1fr); }
  .theme-map { grid-template-columns: 1fr; }
  .verdict-evidence { flex-direction: column; }
  .tabs-bar { gap: 0; }
  .tab-btn { padding: 8px 10px; font-size: var(--fs-small); }
  .topbar { padding: var(--sp-1) var(--sp-2); }
  .topbar-meta { font-size: var(--fs-tiny); }
  .wrap { padding: 0 var(--sp-1); }
  .module-title .title { font-size: var(--fs-body); }

  /* 表格转卡片 */
  .tbl-scroll thead { display: none; }
  .tbl-scroll table, .tbl-scroll tbody, .tbl-scroll tr, .tbl-scroll td { display: block; width: 100%; }
  .tbl-scroll tr { border-bottom: 1px solid var(--border); padding: var(--sp-1); }
  .tbl-scroll td { text-align: left; padding: 3px 0; }
  .tbl-scroll td:before {
    content: attr(data-label) ": ";
    color: var(--t3);
    font-size: var(--fs-tiny);
  }
}

/* === 浅色报告模式特化 === */
[data-theme="light"] .report-full .collapse-body { max-height: 3000px; }
[data-theme="light"] .report-full .collapse-header .arrow { transform: rotate(90deg); }
[data-theme="light"] .report-full .filter-bar { display: none; }
[data-theme="light"] .report-full .scenario-action { color: var(--c-brand); }

/* === 打印/导出优化 === */
@media print {
  .topbar, .tabs-bar, .tb-btn { display: none !important; }
  /* 所有 tab-content 都显示 */
  .tab-content { display: block !important; page-break-after: always; }
  .tab-content.print-show { display: block !important; }
  body { background: #fff; }
}
/* === 专业复盘摘要 === */
.pro-review-card {
  background: linear-gradient(135deg, rgba(43, 147, 245, .12), rgba(18, 24, 38, .72));
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-lg);
  padding: var(--sp-4);
  margin-bottom: var(--sp-4);
  box-shadow: var(--shadow);
}
.pro-review-head {
  display: flex;
  justify-content: space-between;
  gap: var(--sp-3);
  align-items: flex-start;
  margin-bottom: var(--sp-3);
}
.pro-eyebrow {
  font-size: var(--fs-tiny);
  color: var(--c-brand-light);
  letter-spacing: 1px;
  font-weight: 700;
  margin-bottom: 6px;
}
.pro-headline {
  font-size: 22px;
  line-height: 1.35;
  font-weight: 850;
  color: var(--t0);
}
.pro-conclusion {
  margin-top: var(--sp-1);
  color: var(--t2);
  line-height: 1.65;
  font-size: var(--fs-body);
  max-width: 980px;
}
.pro-phase {
  white-space: nowrap;
  border-radius: 999px;
  padding: 6px 14px;
  font-weight: 800;
  font-size: var(--fs-small);
  background: var(--tag-neutral-bg);
  color: var(--t1);
}
.pro-phase.surge { background: var(--tag-confirm-bg); color: var(--phase-surge); }
.pro-phase.crowd { background: var(--tag-warn-bg); color: var(--phase-crowd); }
.pro-phase.diffuse { background: rgba(43,147,245,.14); color: var(--phase-diffuse); }
.pro-phase.cool { background: var(--tag-neutral-bg); color: var(--phase-cool); }
.pro-phase.watch { background: var(--tag-neutral-bg); color: var(--phase-watch); }
.pro-fact-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--sp-2);
  margin-bottom: var(--sp-3);
}
.pro-fact {
  background: rgba(255,255,255,.035);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: var(--sp-3);
  min-height: 108px;
}
.pro-fact.positive { border-color: rgba(232, 64, 87, .42); }
.pro-fact.negative, .pro-fact.dn { border-color: rgba(40, 199, 111, .42); }
.pro-fact.up { border-color: rgba(232, 64, 87, .42); }
.pro-fact-label {
  font-size: var(--fs-tiny);
  color: var(--t3);
  margin-bottom: 6px;
}
.pro-fact-value {
  font-size: 24px;
  font-weight: 850;
  color: var(--t0);
}
.pro-fact-value span {
  font-size: var(--fs-small);
  color: var(--t3);
  margin-left: 4px;
  font-weight: 500;
}
.pro-fact-note {
  margin-top: 6px;
  font-size: var(--fs-tiny);
  color: var(--t2);
  line-height: 1.45;
}
.pro-columns {
  display: grid;
  grid-template-columns: 1.15fr 1.05fr 1fr;
  gap: var(--sp-2);
}
.pro-panel {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: var(--sp-3);
}
.pro-panel-title {
  font-size: var(--fs-small);
  color: var(--t1);
  font-weight: 800;
  margin-bottom: var(--sp-2);
}
.pro-flow-list, .pro-mainline-list, .pro-milestones {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.pro-mainline-summary {
  font-size: var(--fs-small);
  color: var(--t2);
  line-height: 1.55;
  margin-bottom: 8px;
}
.pro-mainline-table {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.pro-mainline-head, .pro-mainline-row {
  display: grid;
  grid-template-columns: 1.15fr .8fr .75fr 1fr;
  gap: 8px;
  align-items: center;
  font-size: var(--fs-small);
}
.pro-mainline-head {
  color: var(--t3);
  padding-bottom: 4px;
  border-bottom: 1px dashed var(--border);
  font-size: var(--fs-tiny);
}
.pro-mainline-head span {
  color: var(--t3);
  font-weight: 700;
}
.pro-flow-row {
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 8px;
  align-items: baseline;
  font-size: var(--fs-small);
}
.pro-mainline-row {
  display: grid;
  grid-template-columns: 1.15fr .8fr .75fr 1fr;
  gap: 8px;
  align-items: center;
  font-size: var(--fs-small);
}
.pro-flow-row span, .pro-mainline-row span { color: var(--t1); font-weight: 650; }
.pro-mainline-row strong { font-weight: 800; color: var(--t1); }
.pro-mainline-row em {
  font-style: normal;
  color: var(--t3);
  font-size: var(--fs-tiny);
}
.pro-mainline-row small {
  font-style: normal;
  color: var(--t3);
  font-size: var(--fs-tiny);
}
.pro-sell-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: var(--sp-2);
  padding-top: var(--sp-2);
  border-top: 1px dashed var(--border);
}
.pro-sell-list span {
  font-size: var(--fs-tiny);
  color: var(--t2);
  background: var(--bg-card2);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 3px 8px;
}
.pro-milestone {
  border-left: 3px solid var(--c-neutral);
  background: var(--bg-card2);
  border-radius: var(--radius-sm);
  padding: 8px 10px;
}
.pro-milestone.strong { border-left-color: var(--c-confirm); }
.pro-milestone.risk { border-left-color: var(--c-down); }
.pro-milestone.watch { border-left-color: var(--c-warn); }
.pro-milestone strong {
  display: block;
  font-size: var(--fs-small);
  color: var(--t1);
  margin-bottom: 3px;
}
.pro-milestone span {
  font-size: var(--fs-tiny);
  color: var(--t2);
  line-height: 1.45;
}
.pro-empty {
  color: var(--t3);
  font-size: var(--fs-small);
  padding: var(--sp-2) 0;
}
.pro-narrative {
  margin-top: var(--sp-2);
  display: flex;
  flex-direction: column;
  gap: 6px;
  color: var(--t2);
  line-height: 1.65;
  font-size: var(--fs-body);
  max-width: 1080px;
}
.pro-narrative strong {
  color: var(--t1);
  font-weight: 800;
}
.pro-signal-tape {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: var(--sp-2);
  margin: 0 0 var(--sp-3);
}
.pro-signal-chip {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: var(--sp-2);
  min-height: 78px;
}
.pro-signal-chip.strong { border-color: rgba(23,196,154,.42); }
.pro-signal-chip.risk { border-color: rgba(245,85,107,.42); }
.pro-signal-chip.neutral { border-color: var(--border); }
.pro-signal-chip > span {
  display: block;
  font-size: var(--fs-tiny);
  color: var(--t3);
  margin-bottom: 4px;
}
.pro-signal-chip strong span { display: inline; }
.pro-signal-chip strong {
  display: block;
  font-size: var(--fs-small);
  color: var(--t1);
  font-weight: 850;
  line-height: 1.35;
}
.pro-signal-chip em {
  display: block;
  margin-top: 4px;
  font-style: normal;
  color: var(--t3);
  font-size: var(--fs-tiny);
  line-height: 1.35;
}
@media (max-width: 1100px) {
  .pro-fact-grid { grid-template-columns: repeat(2, 1fr); }
  .pro-columns { grid-template-columns: 1fr; }
  .pro-signal-tape { grid-template-columns: repeat(3, 1fr); }
}
@media (max-width: 640px) {
  .pro-review-head { flex-direction: column; }
  .pro-headline { font-size: 18px; }
  .pro-fact-grid { grid-template-columns: 1fr; }
  .pro-signal-tape { grid-template-columns: 1fr; }
  .pro-flow-row { grid-template-columns: 1fr auto auto; }
  .pro-mainline-row { grid-template-columns: 1fr 1fr; }
  .pro-mainline-head { grid-template-columns: 1fr 1fr; }
  .pro-flow-row em { grid-column: 1 / -1; }
  .pro-mainline-row em, .pro-mainline-row small { grid-column: 1 / -1; }
}

/* === 结构性复盘看板模块 === */

/* 布局 */
.struct-wrap { padding-top: var(--sp-3); }

/* 顶部风险底色条 */
.struct-topline { margin-bottom: var(--sp-3); }
.struct-tint {
  border-radius: var(--radius);
  padding: var(--sp-3) var(--sp-4);
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  border: 1px solid var(--border);
}
.struct-tint-loose { background: var(--tint-loose); border-color: #1a7a5a; }
.struct-tint-contract { background: var(--tint-contract); border-color: #6a3a18; }
.struct-tint-extreme { background: var(--tint-extreme); border-color: #6a1a1a; }
.struct-tint-neutral { background: var(--tint-neutral); border-color: #1e3342; }
.struct-tint-label { font-size: var(--fs-small); color: var(--t3); }
.struct-tint-value {
  font-size: 28px;
  font-weight: 700;
  white-space: nowrap;
}
.struct-tint-loose .struct-tint-value { color: var(--tint-loose-text); }
.struct-tint-contract .struct-tint-value { color: var(--tint-contract-text); }
.struct-tint-extreme .struct-tint-value { color: var(--tint-extreme-text); }
.struct-tint-neutral .struct-tint-value { color: var(--tint-neutral-text); }
.struct-tint-desc { font-size: var(--fs-small); color: var(--t2); flex: 1; }

/* 有色说明 */
.struct-disclaimer {
  background: var(--tag-warn-bg);
  border: 1px solid rgba(232,147,10,.2);
  border-radius: var(--radius-sm);
  padding: 8px var(--sp-2);
  font-size: var(--fs-small);
  color: var(--c-warn);
  margin-bottom: var(--sp-3);
}

/* 结构矩阵网格 */
.struct-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: var(--sp-2);
  margin-bottom: var(--sp-4);
}
.struct-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
  transition: border-color var(--t);
}
.struct-card:hover { border-color: var(--border-strong); }
.struct-header {
  background: var(--bg-card2);
  padding: var(--sp-2) var(--sp-2);
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--border);
}
.struct-name { font-weight: 700; font-size: var(--fs-body); }
.struct-idx { font-size: var(--fs-tiny); color: var(--t3); }
.struct-body { padding: var(--sp-1) var(--sp-2); }
.struct-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 0;
  gap: var(--sp-1);
}
.struct-row + .struct-row { border-top: 1px solid rgba(255,255,255,.03); }
.struct-label { font-size: var(--fs-small); color: var(--t3); }
.struct-note { font-size: var(--fs-tiny); color: var(--t4); }
.struct-small { font-size: var(--fs-tiny); color: var(--t3); margin-left: 4px; }
.struct-warn {
  font-size: var(--fs-tiny);
  color: var(--c-warn);
  justify-content: flex-start;
  gap: 4px;
}
.struct-missing { color: var(--t4); font-style: italic; }
.struct-missing-tag {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--tag-neutral-bg);
  color: var(--t3);
  font-size: var(--fs-tiny);
}
.struct-missing-fields {
  font-size: var(--fs-tiny);
  color: var(--c-warn);
  padding: 2px 0;
}

/* 判断 + 条件行 */
.struct-judgment-row { flex-wrap: wrap; }
.struct-judgment {
  font-size: var(--fs-small);
  color: var(--t1);
  flex: 1;
  min-width: 0;
  text-align: right;
  line-height: 1.4;
}
.struct-condition { flex-wrap: wrap; gap: 2px; }
.struct-confirm { font-size: var(--fs-small); color: var(--c-confirm); flex: 1; text-align: right; }
.struct-fail { font-size: var(--fs-small); color: var(--c-warn); flex: 1; text-align: right; }
.struct-footnote {
  font-size: var(--fs-small);
  color: var(--t3);
  line-height: 1.6;
  padding: 8px var(--sp-2);
  background: var(--bg-card2);
  border-radius: var(--radius-sm);
  margin-bottom: var(--sp-1);
}

/* 验证卡片头部 */
.verify-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

/* 数据口径说明 */
.struct-caliber {
  background: var(--bg-card2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: var(--sp-2) var(--sp-3);
  font-size: var(--fs-small);
  line-height: 1.8;
  color: var(--t2);
}
.struct-caliber p { margin: 4px 0; }
.struct-caliber strong { color: var(--t1); }
.struct-caliber .caliber-h {
  margin: 14px 0 6px;
  padding-bottom: 4px;
  border-bottom: 1px solid var(--border);
  font-size: var(--fs-base);
  color: var(--t1);
  font-weight: 600;
}

/* 周期标签变体 */
.theme-status-tag.start {
  background: var(--tag-confirm-bg);
  color: var(--c-confirm);
}
.theme-status-tag.crowd {
  background: var(--tag-warn-bg);
  color: var(--c-warn);
}

/* 区域标题 */
.struct-section { margin-bottom: var(--sp-4); }
.struct-section-title {
  font-size: var(--fs-module);
  font-weight: 700;
  margin-bottom: var(--sp-2);
  color: var(--t1);
}
.struct-missing-label { font-size: var(--fs-small); color: var(--c-warn); font-weight: 400; margin-left: 8px; }
.struct-missing { color: var(--t4); font-style: italic; }
.struct-missing-tag {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--tag-neutral-bg);
  color: var(--t3);
  font-size: var(--fs-tiny);
}

/* 34周线表 + 事件表 */
.struct-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--fs-body);
}
.struct-table th {
  text-align: left;
  padding: 8px var(--sp-1);
  border-bottom: 1px solid var(--border);
  color: var(--t3);
  font-weight: 600;
  font-size: var(--fs-small);
  white-space: nowrap;
}
.struct-table td {
  padding: 6px var(--sp-1);
  border-bottom: 1px solid rgba(255,255,255,.03);
  color: var(--t1);
  white-space: nowrap;
}

/* 验证条件卡片 */
.verify-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: var(--sp-2); }
.verify-card {
  padding: var(--sp-2);
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--bg-card);
}
.verify-ok { border-left: 3px solid var(--c-confirm); }
.verify-watch { border-left: 3px solid var(--c-warn); }
.verify-risk { border-left: 3px solid var(--c-up); }
.verify-sector { font-weight: 700; font-size: var(--fs-body); margin-bottom: 6px; }
.verify-confirm { font-size: var(--fs-small); color: var(--t2); margin-bottom: 4px; }
.verify-fail { font-size: var(--fs-small); color: var(--c-warn); }

/* 事件表格 */
.evt-date { font-size: var(--fs-small); color: var(--t3); }
.evt-tag {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: var(--fs-tiny);
  white-space: nowrap;
}
.evt-boost { background: var(--tag-confirm-bg); color: var(--c-confirm); }
.evt-falsify { background: var(--tag-up-bg); color: var(--c-up); }
.evt-take, .evt-land { background: var(--tag-warn-bg); color: var(--c-warn); }
.evt-choose { background: var(--tag-neutral-bg); color: var(--t2); }
.evt-volatile { background: rgba(232,147,10,.1); color: var(--c-warn); }

/* ============ v4 结构复盘：风格罗盘 ============ */
.compass-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--sp-3);
}
.compass-item {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: var(--sp-3);
}
.compass-label {
  font-size: var(--fs-base);
  font-weight: 600;
  color: var(--t1);
  margin-bottom: var(--sp-2);
}
.compass-bar-wrap {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  margin-bottom: var(--sp-1);
}
.compass-side {
  font-size: var(--fs-tiny);
  color: var(--t3);
  flex-shrink: 0;
  width: 36px;
  text-align: center;
}
.compass-bar {
  flex: 1;
  height: 10px;
  background: var(--bg-2);
  border-radius: 5px;
  position: relative;
  overflow: hidden;
}
.compass-bar-fill {
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  background: var(--accent, #4a9eff);
  border-radius: 5px;
  transition: width .3s;
}
.compass-bar-center {
  position: absolute;
  left: 50%;
  top: -2px;
  width: 2px;
  height: 14px;
  background: var(--t3);
  transform: translateX(-50%);
  opacity: 0.5;
}
.compass-left .compass-bar-fill { background: var(--c-down, #4ade80); }
.compass-right .compass-bar-fill { background: var(--c-up, #f87171); }
.compass-neutral .compass-bar-fill { background: var(--t3, #888); }
.compass-bias {
  font-size: var(--fs-small);
  color: var(--t2);
  margin-top: 2px;
  margin-bottom: var(--sp-1);
}
.compass-reasons {
  list-style: none;
  padding: 0;
  margin: 0;
}
.compass-reasons li {
  font-size: var(--fs-tiny);
  color: var(--t3);
  padding: 1px 0;
}
.compass-reasons li.compass-missing { color: var(--c-warn); font-style: italic; }
.compass-item .compass-missing {
  font-size: var(--fs-tiny);
  color: var(--c-warn);
  margin-top: var(--sp-1);
}

/* ============ v4：核心复盘结论 ============ */
.core-conclusion {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: var(--sp-3);
}
.core-row {
  display: flex;
  align-items: flex-start;
  gap: var(--sp-2);
  padding: var(--sp-2) 0;
  border-bottom: 1px dashed var(--border);
}
.core-row:last-child { border-bottom: none; }
.core-tag {
  flex-shrink: 0;
  width: 80px;
  font-size: var(--fs-tiny);
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 4px;
  text-align: center;
}
.core-tone { background: rgba(74,158,255,.15); color: #4a9eff; }
.core-strategy { background: rgba(74,222,128,.15); color: #4ade80; }
.core-tactic { background: rgba(232,167,10,.15); color: var(--c-warn); }
.core-trade { background: rgba(248,113,113,.15); color: var(--c-up); }
.core-text {
  font-size: var(--fs-small);
  color: var(--t1);
  line-height: 1.5;
  flex: 1;
}

/* ============ v4：节奏路径 ============ */
.rhythm-path {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--sp-2);
  margin-bottom: var(--sp-2);
}
.rhythm-day-card {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: var(--sp-2);
}
.rhythm-day-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}
.rhythm-date { font-size: var(--fs-tiny); color: var(--t3); font-weight: 600; }
.rhythm-tag {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: var(--fs-small);
  font-weight: 600;
}
.rhythm-tag-hot { background: rgba(248,113,113,.2); color: var(--c-up); }
.rhythm-tag-pos { background: rgba(74,222,128,.2); color: var(--c-confirm); }
.rhythm-tag-neutral { background: var(--bg-2); color: var(--t2); }
.rhythm-tag-cool { background: rgba(74,158,255,.15); color: #4a9eff; }
.rhythm-tag-bad { background: rgba(248,113,113,.25); color: var(--c-up); }
.rhythm-tag-warn { background: rgba(232,167,10,.2); color: var(--c-warn); }
.rhythm-tag-info { background: rgba(100,160,210,.15); color: #64a0d2; }
.rhythm-day-secondary {
  font-size: var(--fs-tiny);
  color: var(--t3);
  margin-bottom: 6px;
  line-height: 1.3;
}
.rhythm-day-data {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 8px;
  margin-bottom: 6px;
  padding: 4px 0;
  border-top: 1px dashed var(--border);
  border-bottom: 1px dashed var(--border);
}
.rhythm-metric {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.rm-label { font-size: 9px; color: var(--t3); }
.rm-val { font-size: var(--fs-tiny); color: var(--t1); font-weight: 500; }
.rm-sub { font-size: 9px; color: var(--t3); }
.rhythm-expl { font-size: var(--fs-tiny); color: var(--t3); line-height: 1.4; }
/* 节奏形态标签 */
.rhythm-pattern {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin-top: 4px;
  padding: 4px 6px;
  background: rgba(232,167,10,.08);
  border-radius: 4px;
  border-left: 2px solid var(--c-warn);
}
/* 强信号节奏：警示色（橙） */
.rhythm-pattern-strong {
  background: rgba(248,113,113,.1);
  border-left-color: var(--c-up);
}
.rhythm-pattern-strong .rhythm-pattern-tag {
  color: var(--c-up);
  background: rgba(248,113,113,.2);
}
/* 基础节奏：提示色（蓝灰，弱警示） */
.rhythm-pattern-base {
  background: rgba(100,160,210,.08);
  border-left-color: #64a0d2;
}
.rhythm-pattern-base .rhythm-pattern-tag {
  color: #64a0d2;
  background: rgba(100,160,210,.15);
}
.rhythm-pattern-tag {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 9px;
  font-weight: 600;
  color: var(--c-warn);
  background: rgba(232,167,10,.15);
  white-space: nowrap;
  flex-shrink: 0;
}
.rhythm-pattern-text {
  font-size: 9px;
  color: var(--t2);
  line-height: 1.4;
}
.rhythm-judgment {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  padding: var(--sp-2);
  background: var(--bg-2);
  border-radius: 6px;
  margin-bottom: var(--sp-1);
}
.rj-label { font-size: var(--fs-small); font-weight: 600; color: var(--t2); flex-shrink: 0; }
.rj-tag {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 4px;
  font-size: var(--fs-small);
  font-weight: 600;
}
.rj-pos { background: rgba(74,222,128,.2); color: var(--c-confirm); }
.rj-info { background: rgba(100,160,210,.15); color: #64a0d2; }
.rj-warn { background: rgba(232,167,10,.2); color: var(--c-warn); }
.rj-bad { background: rgba(248,113,113,.25); color: var(--c-up); }
.rj-neutral { background: var(--bg-3); color: var(--t2); }
.rhythm-summary {
  font-size: var(--fs-small);
  color: var(--t2);
  padding: var(--sp-2);
  background: var(--bg-2);
  border-radius: 6px;
  line-height: 1.5;
}

/* ============ v4：资金分层 ============ */
.fund-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--sp-2);
  margin-bottom: var(--sp-2);
}
.fund-layer {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: var(--sp-2);
}
.fund-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: var(--sp-1);
  padding-bottom: 4px;
  border-bottom: 1px solid var(--border);
}
.fund-name { font-size: var(--fs-small); font-weight: 600; color: var(--t1); }
.fund-meaning { font-size: var(--fs-tiny); color: var(--t3); }
.fund-row {
  display: flex;
  justify-content: space-between;
  padding: 2px 0;
  font-size: var(--fs-small);
}
.fund-label { color: var(--t3); }
.fund-detail { font-size: var(--fs-tiny); color: var(--t2); margin-top: 2px; }
.fund-judgment {
  font-size: var(--fs-small);
  color: var(--t1);
  margin-top: var(--sp-1);
  padding-top: 4px;
  border-top: 1px dashed var(--border);
  line-height: 1.4;
}
.fund-conclusion {
  font-size: var(--fs-small);
  color: var(--t1);
  padding: var(--sp-2);
  background: var(--bg-2);
  border-radius: 6px;
  border-left: 3px solid var(--accent, #4a9eff);
}

/* ============ v4：指数验证矩阵 ============ */
.idx-matrix {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--sp-2);
  margin-bottom: var(--sp-2);
}
.idx-group {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: var(--sp-2);
}
.idx-group-title {
  font-size: var(--fs-small);
  font-weight: 600;
  color: var(--t1);
  margin-bottom: 6px;
}
.idx-table { font-size: var(--fs-tiny); }
.idx-table th, .idx-table td { padding: 4px 6px; }
.struct-note { font-size: var(--fs-tiny); color: var(--t3); font-style: italic; }
.role-tag {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 3px;
  font-size: var(--fs-tiny);
  white-space: nowrap;
}
.role-lead { background: rgba(248,113,113,.2); color: var(--c-up); }
.role-hold { background: rgba(74,222,128,.15); color: var(--c-confirm); }
.role-drag { background: rgba(74,158,255,.15); color: #4a9eff; }
.role-rebound { background: rgba(232,167,10,.15); color: var(--c-warn); }
.role-out { background: rgba(248,113,113,.25); color: var(--c-up); }
.role-wait { background: var(--bg-2); color: var(--t3); }
.idx-conclusion {
  font-size: var(--fs-small);
  color: var(--t1);
  padding: var(--sp-2);
  background: var(--bg-2);
  border-radius: 6px;
  border-left: 3px solid var(--accent, #4a9eff);
}

/* ============ v4：事件性质标签 ============ */
.evt-nature {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: var(--fs-tiny);
  white-space: nowrap;
}
.nat-falsify { background: rgba(248,113,113,.2); color: var(--c-up); }
.nat-emo { background: rgba(232,167,10,.15); color: var(--c-warn); }
.nat-rebal { background: rgba(74,158,255,.15); color: #4a9eff; }
.nat-take { background: rgba(232,167,10,.2); color: var(--c-warn); }
.nat-ind { background: rgba(74,222,128,.15); color: var(--c-confirm); }
.nat-liq { background: rgba(74,158,255,.1); color: #4a9eff; }
.nat-other { background: var(--bg-2); color: var(--t3); }
/* 事件状态：已发生/未来 */
.evt-status {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: var(--fs-tiny);
  white-space: nowrap;
  font-weight: 600;
}
.evt-status-past { background: rgba(100,116,139,.25); color: var(--t3); }  /* 已发生：灰色，表示参考性质 */
.evt-status-future { background: rgba(74,222,128,.18); color: var(--c-confirm); }  /* 未来：绿色，表示待验证 */
.evt-table td:nth-child(7) { font-size: var(--fs-tiny); color: var(--t2); }

/* ============ v4：验证条件 ============ */
.valid-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--sp-2);
}
.valid-layer {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: var(--sp-2);
}
.valid-layer-title {
  font-size: var(--fs-small);
  font-weight: 600;
  color: var(--t1);
  margin-bottom: 6px;
  padding-bottom: 4px;
  border-bottom: 1px solid var(--border);
}
.valid-items { display: flex; flex-direction: column; gap: 6px; }
.valid-item {
  background: var(--bg-2);
  border-radius: 4px;
  padding: 6px 8px;
}
.valid-confirm { font-size: var(--fs-tiny); color: var(--c-confirm); margin-bottom: 2px; line-height: 1.4; }
.valid-fail { font-size: var(--fs-tiny); color: var(--c-warn); margin-bottom: 4px; line-height: 1.4; }
.valid-action { font-size: var(--fs-tiny); }
.valid-act-tag {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 600;
}
.act-attack { background: rgba(248,113,113,.2); color: var(--c-up); }
.act-wait { background: rgba(74,158,255,.15); color: #4a9eff; }
.act-cool { background: rgba(232,167,10,.15); color: var(--c-warn); }
.act-defend { background: rgba(74,158,255,.2); color: #4a9eff; }
.act-fail { background: rgba(248,113,113,.25); color: var(--c-up); }
.act-track { background: var(--bg-2); color: var(--t3); }

/* ============ v4：通用 ============ */
.struct-subtitle {
  font-size: var(--fs-tiny);
  color: var(--t3);
  font-weight: 400;
}
.struct-section-title { margin-top: 0 !important; }

/* 风格落点（主题承载卡上方） */
.style-landing {
  font-size: var(--fs-small);
  color: var(--t1);
  padding: var(--sp-2) var(--sp-3);
  background: rgba(74,158,255,.08);
  border-left: 3px solid #4a9eff;
  border-radius: 4px;
  margin-bottom: var(--sp-2);
  line-height: 1.5;
}

/* 指数组内结论 */
.idx-group-conclusion {
  font-size: var(--fs-tiny);
  color: var(--t2);
  padding: 6px 8px;
  margin-top: 6px;
  background: var(--bg-2);
  border-radius: 4px;
  line-height: 1.4;
}

/* 指数组验证维度标签 */
.idx-focus-tag {
  display: inline-block;
  font-size: var(--fs-tiny);
  color: #4a9eff;
  background: rgba(74,158,255,.10);
  padding: 1px 6px;
  margin-left: 6px;
  border-radius: 3px;
  font-weight: normal;
  vertical-align: middle;
}

/* 数据未及时刷新标记：kline 最新日 < 当前 dt 时，在指数名后提示"截至 X 日" */
.struct-stale-tag {
  display: inline-block;
  font-size: var(--fs-tiny);
  color: #c47a00;
  background: rgba(196,122,0,.10);
  padding: 1px 5px;
  margin-left: 6px;
  border-radius: 3px;
  font-weight: normal;
  vertical-align: middle;
}

/* 移动端 */
@media (max-width: 768px) {
  .struct-grid { grid-template-columns: 1fr; }
  .verify-grid { grid-template-columns: 1fr; }
  .struct-tint { flex-wrap: wrap; gap: var(--sp-1); }
  .struct-tint-desc { flex: 0 0 100%; }
  .struct-tint-value { font-size: 22px; }
}

/* ===== 00 决策页紧凑组件 ===== */
.compass-grid-compact .compass-item { min-height: auto; }
.compass-top-reason { font-size: 11px; color: var(--t3); margin-top: 2px; line-height: 1.4; }

.rhythm-path-compact { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px; }
.rhythm-day-compact { display: flex; flex-direction: column; gap: 4px; padding: 8px 12px; border: 1px solid rgba(255,255,255,.08); border-radius: 6px; min-width: 140px; }
.rhythm-day-compact .rhythm-date { font-size: 12px; color: var(--t2); font-weight: 600; }
.rhythm-day-compact .rhythm-tag { font-size: 11px; padding: 2px 6px; border-radius: 3px; }
.rhythm-day-compact .rhythm-pattern-tag { font-size: 10px; color: var(--t4); }

.fund-list-compact { display: flex; flex-direction: column; gap: 4px; }
.fund-layer-compact { display: grid; grid-template-columns: 100px 80px 80px 1fr; gap: 8px; align-items: center; padding: 6px 10px; border: 1px solid rgba(255,255,255,.06); border-radius: 5px; font-size: 12px; }
.fund-layer-compact .fund-name { font-weight: 600; color: var(--t1); }
.fund-layer-compact .fund-judgment { color: var(--t3); font-size: 11px; }

.struct-rank-list { display: flex; flex-direction: column; gap: 4px; }
.struct-rank-item { display: grid; grid-template-columns: 80px 80px 70px 50px; gap: 8px; align-items: center; padding: 6px 10px; border: 1px solid rgba(255,255,255,.06); border-radius: 5px; font-size: 12px; }
.struct-rank-name { font-weight: 600; color: var(--t1); }

.milestone-list { display: flex; flex-direction: column; gap: 4px; }
.milestone-item { display: grid; grid-template-columns: 22px 1fr 1.5fr; gap: 8px; align-items: center; padding: 6px 10px; border: 1px solid rgba(255,255,255,.06); border-radius: 5px; font-size: 12px; }
.milestone-item.ms-risk { border-left: 3px solid #f87171; background: rgba(248,113,113,.06); }
.milestone-item.ms-strong { border-left: 3px solid #4ade80; background: rgba(74,222,128,.06); }
.milestone-item.ms-watch { border-left: 3px solid #facc15; background: rgba(250,204,21,.05); }
.ms-icon { font-size: 14px; text-align: center; }
.ms-risk .ms-icon { color: #f87171; }
.ms-strong .ms-icon { color: #4ade80; }
.ms-watch .ms-icon { color: #facc15; }
.ms-title { color: var(--t1); font-weight: 600; }
.ms-desc { color: var(--t3); font-size: 11px; }

/* 数据健康两层 */
.dq-layer { display: grid; grid-template-columns: 90px 1fr 1.5fr; gap: 10px; align-items: center; padding: 8px 12px; border: 1px solid rgba(255,255,255,.06); border-radius: 5px; margin-top: 4px; font-size: 12px; }
.dq-layer.dq-ok { border-left: 3px solid #4ade80; }
.dq-layer.dq-warning { border-left: 3px solid #facc15; background: rgba(250,204,21,.04); }
.dq-layer.dq-error { border-left: 3px solid #f87171; background: rgba(248,113,113,.06); }
.dq-layer-label { color: var(--t3); font-size: 11px; }
.dq-layer strong { color: var(--t1); font-weight: 600; }
.dq-layer-detail { color: var(--t4); font-size: 11px; }

/* 口径标签 */
.caliber-tag { display: inline-block; padding: 1px 5px; font-size: 10px; color: var(--t3); background: rgba(255,255,255,.06); border-radius: 3px; margin-left: 4px; }

.valid-list-compact { display: flex; flex-direction: column; gap: 6px; }
.valid-layer-compact { padding: 8px 10px; border: 1px solid rgba(255,255,255,.06); border-radius: 6px; }
.valid-layer-compact .valid-layer-title { font-size: 12px; color: var(--t3); margin-bottom: 4px; font-weight: 600; }
.valid-item-compact { display: flex; flex-direction: column; gap: 2px; font-size: 12px; padding: 3px 0; }
.valid-item-compact .valid-confirm { color: #4ade80; font-size: 11px; }
.valid-item-compact .valid-fail { color: #f87171; font-size: 11px; }

.dq-compact { display: flex; gap: 16px; flex-wrap: wrap; padding: 8px 10px; border: 1px solid rgba(255,255,255,.06); border-radius: 6px; margin-top: 8px; font-size: 12px; }
.dq-item { color: var(--t3); }
.dq-item strong { color: var(--t1); }

/* ===== 01 证据页组件 ===== */
.emo-data { display: flex; gap: 16px; flex-wrap: wrap; padding: 10px 14px; border: 1px solid rgba(255,255,255,.08); border-radius: 8px; margin-bottom: var(--sp-2); }
.emo-item { display: flex; flex-direction: column; gap: 2px; }
.emo-item span { font-size: 11px; color: var(--t4); }
.emo-item strong { font-size: 16px; }

.margin-data { display: flex; gap: 16px; flex-wrap: wrap; padding: 10px 14px; border: 1px solid rgba(255,255,255,.08); border-radius: 8px; margin-bottom: 8px; font-size: 13px; }

.data-source-list { display: flex; gap: 16px; flex-wrap: wrap; padding: 10px 14px; border: 1px solid rgba(255,255,255,.08); border-radius: 8px; }
.data-source-list .ds-item { font-size: 12px; color: var(--t3); }
.data-source-list .ds-item strong { color: var(--t1); }

@media (max-width: 768px) {
  .fund-layer-compact { grid-template-columns: 1fr; }
  .struct-rank-item { grid-template-columns: 1fr 1fr; }
  .milestone-item { grid-template-columns: 1fr; }
}

/* ===== 00 决策总览 v2 组件 ===== */
.decision-card { padding: 12px 16px; border-radius: 10px; border-left: 4px solid var(--t4); background: rgba(255,255,255,.03); margin-bottom: var(--sp-2); }
.dc-tone-attack { border-left-color: #4ade80; background: rgba(74,222,128,.06); }
.dc-tone-light-attack { border-left-color: #84cc16; background: rgba(132,204,22,.05); }
.dc-tone-watch { border-left-color: #fbbf24; background: rgba(251,191,36,.05); }
.dc-tone-defend { border-left-color: #f87171; background: rgba(248,113,113,.06); }
.dc-row { display: flex; align-items: flex-start; gap: 12px; padding: 4px 0; border-bottom: 1px solid rgba(255,255,255,.04); }
.dc-row:last-child { border-bottom: none; }
.dc-row.dc-mainline,
.dc-row.dc-mainline-clue { display: block; border-bottom: 1px solid rgba(255,255,255,.04); }
.dc-label { flex: 0 0 110px; font-size: 12px; color: var(--t3); font-weight: 600; padding-top: 4px; line-height: 1.4; }
.dc-value { flex: 1; font-size: 14px; color: var(--t1); line-height: 1.5; }
.dc-risk .dc-value { color: #fca5a5; }
.dc-check .dc-value { color: #86efac; }

.chain-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--sp-2); margin-bottom: var(--sp-2); }
.chain-card { padding: 12px 14px; border: 1px solid rgba(255,255,255,.08); border-radius: 8px; background: rgba(255,255,255,.02); }
.chain-label { font-size: 11px; color: var(--t4); margin-bottom: 4px; font-weight: 600; }
.chain-value { font-size: 16px; font-weight: 700; color: var(--t1); margin-bottom: 8px; }
.chain-evidence { margin: 0; padding-left: 16px; font-size: 11px; color: var(--t3); line-height: 1.6; }
.chain-evidence li { margin-bottom: 2px; }

.leader-list { display: flex; flex-direction: column; gap: 6px; }
.leader-item { display: grid; grid-template-columns: 110px 90px 80px 60px 90px 80px 80px 80px 70px 80px; gap: 6px; align-items: center; padding: 8px 12px; border: 1px solid rgba(255,255,255,.06); border-radius: 6px; font-size: 12px; }
.leader-name { font-weight: 700; color: var(--t1); }
.leader-confirmed { font-size: 10px; color: #4ade80; padding: 2px 6px; background: rgba(74,222,128,.1); border-radius: 3px; }
.leader-unconfirmed { font-size: 10px; color: var(--t4); padding: 2px 6px; background: rgba(255,255,255,.05); border-radius: 3px; }
.leader-weekly { font-size: 11px; color: var(--t3); }

/* 确认等级 4/3/弱/待/反抽/承接（覆盖原 leader-confirmed/unconfirmed） */
.leader-confirm { font-size: 10px; padding: 2px 6px; border-radius: 3px; font-weight: 700; }
.leader-confirm.conf-full { color: #4ade80; background: rgba(74,222,128,.15); border: 1px solid rgba(74,222,128,.3); }
.leader-confirm.conf-three { color: #60a5fa; background: rgba(96,165,250,.12); border: 1px solid rgba(96,165,250,.3); }
.leader-confirm.conf-weak { color: #facc15; background: rgba(250,204,21,.1); border: 1px solid rgba(250,204,21,.3); }
.leader-confirm.conf-rebound { color: #fb923c; background: rgba(251,146,60,.1); border: 1px solid rgba(251,146,60,.3); }
.leader-confirm.conf-underpin { color: #a78bfa; background: rgba(167,139,250,.1); border: 1px solid rgba(167,139,250,.3); }
.leader-confirm.conf-pending { color: #94a3b8; background: rgba(148,163,184,.1); border: 1px solid rgba(148,163,184,.3); }

/* 生命周期文案（主升/扩散/短线承载/修复/资金承接 等） */
.life-tag { font-size: 10px; padding: 2px 6px; border-radius: 3px; font-weight: 600; }
.life-tag.life-conf-full { color: #4ade80; background: rgba(74,222,128,.12); }
.life-tag.life-conf-three { color: #60a5fa; background: rgba(96,165,250,.12); }
.life-tag.life-conf-weak { color: #facc15; background: rgba(250,204,21,.1); }
.life-tag.life-conf-rebound { color: #fb923c; background: rgba(251,146,60,.1); }
.life-tag.life-conf-underpin { color: #a78bfa; background: rgba(167,139,250,.1); }
.life-tag.life-conf-pending { color: #94a3b8; background: rgba(148,163,184,.1); }

/* 强线索待确认区 */
.strong-clue-list { display: flex; flex-direction: column; gap: 6px; }
.strong-clue-item { padding: 10px 14px; border: 1px solid rgba(250,204,21,.25); border-left: 3px solid #facc15; background: rgba(250,204,21,.04); border-radius: 6px; font-size: 12px; }
.sc-header { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
.sc-name { font-weight: 700; color: var(--t1); font-size: 13px; }
.sc-reason { color: var(--t3); font-size: 11px; }

/* 置信度标签 — 旧版本（已被新版覆盖，但保留以防 04 验证页引用） */
.mainline-conf.conf-高-legacy { color: #4ade80; background: rgba(74,222,128,.12); }
.mainline-conf.conf-中-legacy { color: #facc15; background: rgba(250,204,21,.1); }
.mainline-conf.conf-低-legacy { color: #f87171; background: rgba(248,113,113,.1); }
/* 主线区"强线索"旧版样式已删除（避免与新版 mainline-type-clue 冲突） */
.mainline-empty-legacy { color: var(--t3); font-size: 12px; padding: 4px 0; }

/* 04 反向约束 gate-list */
.gate-list { display: flex; flex-direction: column; gap: 4px; }
.gate-row { display: grid; grid-template-columns: 1fr 90px 1.5fr; gap: 10px; align-items: center; padding: 6px 12px; border: 1px solid rgba(255,255,255,.06); border-radius: 5px; font-size: 12px; }
.gate-row.gate-pass { border-left: 3px solid #4ade80; background: rgba(74,222,128,.04); }
.gate-row.gate-clue { border-left: 3px solid #facc15; background: rgba(250,204,21,.04); }
.gate-row.gate-block { border-left: 3px solid #94a3b8; }
.gate-name { font-weight: 700; color: var(--t1); }
.gate-status { font-size: 11px; color: var(--t3); }
.gate-detail { font-size: 11px; color: var(--t4); }

/* 01 跳转按钮 */
.tab-jump-btn { display: inline-block; padding: 4px 10px; font-size: 11px; background: rgba(96,165,250,.15); color: #60a5fa; border: 1px solid rgba(96,165,250,.3); border-radius: 4px; cursor: pointer; margin-left: 10px; transition: background .15s; }
.tab-jump-btn:hover { background: rgba(96,165,250,.25); }

.tomorrow-list { display: flex; flex-direction: column; gap: 6px; }
.tomorrow-item { display: grid; grid-template-columns: 80px 1fr 1fr 80px; gap: 8px; align-items: center; padding: 8px 12px; border: 1px solid rgba(255,255,255,.06); border-radius: 6px; font-size: 12px; }
.tomorrow-layer { font-size: 11px; color: var(--t4); }
.tomorrow-confirm { color: #86efac; font-size: 11px; }
.tomorrow-fail { color: #fca5a5; font-size: 11px; }

.dq-list { display: flex; flex-direction: column; gap: 4px; }
.dq-warning { padding: 6px 10px; border: 1px solid rgba(251,191,36,.2); background: rgba(251,191,36,.04); border-radius: 5px; font-size: 12px; color: #fde68a; }
.dq-ok { padding: 6px 10px; border: 1px solid rgba(74,222,128,.2); background: rgba(74,222,128,.04); border-radius: 5px; font-size: 12px; color: #86efac; }
.dq-meta { padding: 6px 10px; font-size: 12px; color: var(--t3); margin-bottom: 4px; }

/* ===== 02 结构承载 主题卡（合并后：以主题为单位，三层展示）===== */
.theme-card-group { display: flex; flex-direction: column; gap: 10px; margin-bottom: var(--sp-2); }
.theme-card { padding: 14px 16px; border: 1px solid rgba(255,255,255,.08); border-radius: 10px; background: rgba(255,255,255,.02); border-left: 3px solid var(--t4); }
.theme-card-group.group-formal-section .theme-card { border-left-color: #4ade80; }
.theme-card-group.group-strong-section .theme-card { border-left-color: #facc15; }
.theme-card-group.group-other-section .theme-card { border-left-color: #94a3b8; opacity: .85; }

/* 第1层：主题结论区 */
.theme-card-header { margin-bottom: 12px; }
.theme-card-title { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin-bottom: 6px; }
.theme-card-name { font-weight: 700; color: var(--t1); font-size: 15px; }
.theme-card-type { font-size: 11px; padding: 2px 8px; border-radius: 4px; font-weight: 600; }
.theme-card-type.type-drive { background: rgba(74,222,128,.18); color: #4ade80; }
.theme-card-type.type-diffuse { background: rgba(96,165,250,.18); color: #60a5fa; }
.theme-card-type.type-underpin { background: rgba(167,139,250,.18); color: #a78bfa; }
.theme-card-type.type-rebound { background: rgba(250,204,21,.18); color: #facc15; }
.theme-card-type.type-cashout { background: rgba(251,146,60,.18); color: #fb923c; }
.theme-card-type.type-outflow { background: rgba(248,113,113,.18); color: #f87171; }
.theme-card-type.type-neutral { background: rgba(148,163,184,.15); color: #94a3b8; }
.theme-card-confirm { font-size: 11px; padding: 2px 8px; border-radius: 4px; font-weight: 600; }
.theme-card-confirm.lvl-4 { background: rgba(74,222,128,.18); color: #4ade80; border: 1px solid rgba(74,222,128,.4); }
.theme-card-confirm.lvl-3 { background: rgba(96,165,250,.18); color: #60a5fa; border: 1px solid rgba(96,165,250,.4); }
.theme-card-confirm.lvl-2 { background: rgba(148,163,184,.18); color: #94a3b8; border: 1px solid rgba(148,163,184,.4); }
.theme-card-confirm.lvl-strong { background: rgba(250,204,21,.18); color: #facc15; border: 1px solid rgba(250,204,21,.4); }
.theme-card-confirm.lvl-watch { background: rgba(251,146,60,.18); color: #fb923c; border: 1px solid rgba(251,146,60,.4); }
.theme-card-confidence { font-size: 10px; padding: 1px 6px; border-radius: 3px; }
.theme-card-confidence.conf-h { background: rgba(74,222,128,.1); color: #4ade80; }
.theme-card-confidence.conf-m { background: rgba(250,204,21,.1); color: #facc15; }
.theme-card-confidence.conf-l { background: rgba(248,113,113,.1); color: #f87171; }
.theme-group-tag { font-size: 10px; padding: 1px 6px; border-radius: 3px; font-weight: 600; }
.theme-group-tag.group-formal { background: rgba(74,222,128,.18); color: #4ade80; }
.theme-group-tag.group-strong { background: rgba(250,204,21,.18); color: #facc15; }
.theme-group-tag.group-other { background: rgba(148,163,184,.15); color: #94a3b8; }
.theme-card-score { font-size: 11px; color: var(--t4); }
.theme-card-score strong { color: var(--t1); font-size: 13px; }
.theme-card-meta { font-size: 12px; color: var(--t2); line-height: 1.5; padding: 4px 0; border-top: 1px solid rgba(255,255,255,.04); border-bottom: 1px solid rgba(255,255,255,.04); }
.theme-card-meta-label { color: var(--t4); font-size: 11px; }
.sample-warn-tag { font-size: 10px; color: #fbbf24; padding: 2px 6px; background: rgba(251,191,36,.1); border-radius: 3px; }
.sample-ok-tag { font-size: 10px; color: #86efac; padding: 2px 6px; background: rgba(74,222,128,.08); border-radius: 3px; }
.struct-missing { font-size: 12px; color: var(--t4); padding: 12px; text-align: center; background: rgba(255,255,255,.02); border-radius: 6px; }

/* 第2层：核心指标区 */
.theme-card-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 12px; }
.theme-card-stat { display: flex; flex-direction: column; gap: 2px; padding: 8px 10px; background: rgba(255,255,255,.03); border-radius: 6px; }
.theme-stat-label { font-size: 10px; color: var(--t4); }
.theme-stat-value { font-size: 13px; font-weight: 600; color: var(--t1); }
.theme-stat-value.green { color: #4ade80; }
.theme-stat-value.red { color: #f87171; }
.theme-stat-value.struct-neutral { color: var(--t3); }

/* 第3层：ETF明细区 */
.theme-card-etfs { padding-top: 8px; border-top: 1px solid rgba(255,255,255,.04); }
.theme-card-etfs-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
.theme-card-etfs-head > span:first-child { font-size: 12px; color: var(--t3); font-weight: 600; }
.theme-card-etfs-meta { font-size: 10px; color: var(--t4); }
.theme-card-table { font-size: 11px; }
.theme-card-table th { font-size: 10px; color: var(--t4); font-weight: 500; }
.theme-card-table td { font-size: 11px; }
.abn-row-info td { font-size: 10px; color: #fbbf24; text-align: center; padding: 4px; background: rgba(251,191,36,.04); }
.theme-card-expand { margin-top: 6px; text-align: center; }
.theme-expand-btn { background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.06); color: var(--t3); padding: 4px 12px; border-radius: 4px; font-size: 11px; cursor: pointer; }
.theme-expand-btn:hover { background: rgba(255,255,255,.08); color: var(--t1); }
.role-tag.role-lead { background: rgba(74,222,128,.2); color: #4ade80; }
.role-tag.role-hold { background: rgba(96,165,250,.2); color: #60a5fa; }
.role-tag.role-wait { background: rgba(250,204,21,.2); color: #facc15; }
.role-tag.role-rebound { background: rgba(251,146,60,.2); color: #fb923c; }
.role-tag.role-out { background: rgba(248,113,113,.2); color: #f87171; }
.role-tag.role-drag { background: rgba(148,163,184,.2); color: #94a3b8; }

.structure-leader-card { padding: 12px 14px; border: 1px solid rgba(255,255,255,.08); border-radius: 8px; margin-bottom: var(--sp-1); }
.slc-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.slc-name { font-weight: 700; color: var(--t1); font-size: 14px; }
.slc-rhythm { font-size: 11px; color: var(--t3); padding: 2px 6px; background: rgba(255,255,255,.05); border-radius: 3px; }
.slc-stats { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; font-size: 12px; }
.slc-stat { display: flex; flex-direction: column; gap: 2px; }
.slc-stat span { font-size: 10px; color: var(--t4); }

.lifecycle-card { padding: 12px 14px; border: 1px solid rgba(255,255,255,.08); border-radius: 8px; margin-bottom: var(--sp-1); }
.lc-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.lc-name { font-weight: 700; color: var(--t1); font-size: 14px; }
.lc-stats { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; font-size: 12px; margin-bottom: 6px; }
.lc-stat { display: flex; flex-direction: column; gap: 2px; }
.lc-stat span { font-size: 10px; color: var(--t4); }
.lc-judgment { font-size: 12px; color: var(--t2); line-height: 1.5; padding: 6px 0; border-top: 1px solid rgba(255,255,255,.04); }
.lc-confirm { font-size: 11px; color: #86efac; padding: 2px 0; }
.lc-fail { font-size: 11px; color: #fca5a5; padding: 2px 0; }

/* ===== 03 资金与情绪 组件 ===== */
.nature-card { padding: 14px 18px; border-radius: 10px; border-left: 4px solid var(--t4); margin-bottom: var(--sp-2); }
.nature-attack { border-left-color: #4ade80; background: rgba(74,222,128,.06); }
.nature-defend { border-left-color: #3b82f6; background: rgba(59,130,246,.06); }
.nature-switch { border-left-color: #a78bfa; background: rgba(167,139,250,.06); }
.nature-retreat { border-left-color: #f87171; background: rgba(248,113,113,.06); }
.nature-divergence { border-left-color: #fbbf24; background: rgba(251,191,36,.05); }
.nature-label { font-size: 12px; color: var(--t4); margin-bottom: 4px; }
.nature-value { font-size: 18px; font-weight: 700; color: var(--t1); margin-bottom: 4px; }
.nature-desc { font-size: 12px; color: var(--t3); line-height: 1.5; }

.emo-today { display: flex; gap: 20px; flex-wrap: wrap; padding: 12px 14px; border: 1px solid rgba(255,255,255,.08); border-radius: 8px; margin-bottom: var(--sp-2); }

/* ===== 04 验证与数据质量 组件 ===== */
.abnormal-item { display: flex; gap: 12px; padding: 6px 10px; border: 1px solid rgba(248,113,113,.15); background: rgba(248,113,113,.03); border-radius: 5px; font-size: 12px; margin-bottom: 4px; }
.missing-theme { padding: 6px 10px; border: 1px solid rgba(251,191,36,.15); background: rgba(251,191,36,.03); border-radius: 5px; font-size: 12px; color: #fde68a; margin-bottom: 4px; }

/* ===== 00 主线方向 Top3 + 类型徽标 ===== */
/* 关键：dc-mainline / dc-mainline-clue 不继承 dc-row 的 flex 行布局 */
/* 改为 display:block，让 label 和 list 上下排列，避免 flex column 下 dc-label 的 flex:0 0 110px 被解读为高度 */
.dc-mainline,
.dc-mainline-clue {
  display: block;
  padding: 6px 0;
  min-height: 0;
}
.dc-mainline .dc-label,
.dc-mainline-clue .dc-label {
  display: block;
  flex: none;
  width: auto;
  padding-top: 0;
  margin-bottom: 6px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.3;
}
.dc-mainline .dc-label { color: var(--t2); }
.dc-mainline-clue {
  padding: 8px 0 6px 0;
  margin-top: 4px;
  border-top: 1px dashed rgba(250,204,21,.5);
}
.dc-mainline-clue .dc-label { color: #facc15; }
.mainline-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
  margin: 0;
  padding: 0;
  min-height: 0;
}
.mainline-list-clue { opacity: 1; }
.mainline-item {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 34px;
  padding: 6px 10px;
  margin: 0;
  background: rgba(255,255,255,.04);
  border-radius: 5px;
  border-left: 3px solid var(--t3);
  line-height: 1.3;
}
.mainline-item-clue {
  background: rgba(250,204,21,.05);
  border-left: 2px solid #facc15;
}
.mainline-item > * { line-height: 1.3; white-space: nowrap; }
.mainline-item > .mainline-name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1 1 auto; min-width: 0; }
.mainline-item > .mainline-rank { flex: 0 0 22px; }
.mainline-rank { font-size: 13px; font-weight: 700; color: var(--t3); text-align: center; }
.mainline-name { font-size: 13px; font-weight: 600; color: var(--t1); }
.mainline-conf {
  font-size: 11px; padding: 2px 8px; border-radius: 4px;
  font-weight: 600; background: rgba(255,255,255,.06); color: var(--t2);
  white-space: nowrap; /* 防止置信文字被截断 */
}
.mainline-conf.conf-高 { background: rgba(74,222,128,.18); color: #4ade80; }
.mainline-conf.conf-中 { background: rgba(250,204,21,.18); color: #facc15; }
.mainline-conf.conf-低 { background: rgba(248,113,113,.18); color: #f87171; }
.mainline-warn {
  font-size: 11px; padding: 2px 8px; border-radius: 4px;
  font-weight: 600; background: rgba(250,204,21,.15); color: #facc15;
  white-space: nowrap;
  border: 1px dashed rgba(250,204,21,.4); /* 警示标签加虚线边 */
}
.mainline-empty {
  padding: 8px 12px; color: var(--t3); font-size: 12px;
  background: rgba(255,255,255,.03); border-radius: 5px;
}
.mainline-type {
  font-size: 11px; padding: 2px 8px; border-radius: 4px; font-weight: 600;
  white-space: nowrap; /* 防止类型文字被截断 */
}
.mainline-type-drive { background: rgba(74,222,128,.18); color: #4ade80; border-left-color: #4ade80; }
.mainline-type-diffuse { background: rgba(96,165,250,.18); color: #60a5fa; border-left-color: #60a5fa; }
.mainline-type-underpin { background: rgba(167,139,250,.18); color: #a78bfa; border-left-color: #a78bfa; }
.mainline-type-rebound { background: rgba(250,204,21,.18); color: #facc15; border-left-color: #facc15; }
.mainline-type-cashout { background: rgba(251,146,60,.18); color: #fb923c; border-left-color: #fb923c; }
.mainline-type-outflow { background: rgba(248,113,113,.18); color: #f87171; border-left-color: #f87171; }
.mainline-type-neutral { background: rgba(148,163,184,.15); color: #94a3b8; border-left-color: #94a3b8; }
.mainline-type-clue { background: rgba(250,204,21,.12); color: #facc15; border-left-color: #facc15; border: 1px dashed rgba(250,204,21,.4); }

/* ===== 02 结构承载主题卡增强 ===== */
.slc-leader { border-left: 3px solid var(--t3); }
.slc-score { font-size: 18px; font-weight: 700; color: var(--t1); background: rgba(255,255,255,.08); padding: 2px 8px; border-radius: 5px; min-width: 50px; text-align: center; }
.slc-leader-type { font-size: 11px; padding: 2px 8px; border-radius: 4px; font-weight: 600; }
.slc-leader-type.type-drive { background: rgba(74,222,128,.18); color: #4ade80; }
.slc-leader-type.type-diffuse { background: rgba(96,165,250,.18); color: #60a5fa; }
.slc-leader-type.type-underpin { background: rgba(167,139,250,.18); color: #a78bfa; }
.slc-leader-type.type-rebound { background: rgba(250,204,21,.18); color: #facc15; }
.slc-leader-type.type-cashout { background: rgba(251,146,60,.18); color: #fb923c; }
.slc-leader-type.type-outflow { background: rgba(248,113,113,.18); color: #f87171; }
.slc-leader-type.type-neutral { background: rgba(148,163,184,.15); color: #94a3b8; }
.slc-breakdown { font-size: 10px; color: var(--t3); padding: 4px 0; }
.slc-score-detail { font-size: 11px; color: var(--t4); padding-top: 4px; border-top: 1px solid rgba(255,255,255,.04); }

@media (max-width: 768px) {
  .chain-grid { grid-template-columns: 1fr 1fr; }
  .leader-item { grid-template-columns: 1fr 1fr; }
  .tomorrow-item { grid-template-columns: 1fr; }
  .slc-stats, .lc-stats { grid-template-columns: 1fr 1fr; }
  /* mainline-item 已改为 flex 布局，窄屏不需要额外 grid 覆盖 */
  .mainline-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
}
`;
}

module.exports = { getStyles };
