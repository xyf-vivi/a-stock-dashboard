// 用 Wind MCP 取 10 个主题的真实 07-06 成分股涨跌家数 + 沪深融资余额
const { execFileSync } = require('child_process');
const fs = require('fs');
const SKILL = 'C:/Users/xyf31/.workbuddy/skills/wind-mcp-skill';
const BUILD = __dirname;

function wind(server, tool, params) {
  const ps = JSON.stringify(params);
  const out = execFileSync(process.execPath, ['scripts/cli.mjs', 'call', server, tool, ps], { cwd: SKILL, encoding: 'utf8', maxBuffer: 1024 * 1024 * 16 });
  const idx = out.indexOf('{');
  if (idx < 0) throw new Error('Wind 无 JSON 返回: ' + out.slice(0, 200));
  const json = JSON.parse(out.slice(idx));
  return json;
}

// 主题 -> Wind 指数代码（与 theme_constituents.json / 07-03 themeBreadth 一致）
const THEMES = [
  { name: '半导体', indexCode: '882221.WI' },
  { name: 'AI', indexCode: '930713.CSI' },
  { name: '通信', indexCode: '931160.CSI' },
  { name: '机器人', indexCode: 'H30269.CSI' },
  { name: '创新药', indexCode: '931152.CSI' },
  { name: '证券', indexCode: '399975.SZ' },
  { name: '红利', indexCode: '000922.CSI' },
  { name: '有色金属', indexCode: '000819.SH' },
  { name: '化工', indexCode: '000813.CSI' },
  { name: '黄金', indexCode: '930632.CSI' }
];

console.log('=== 取 10 主题涨跌家数 (Wind 指数成分股) ===');
const breadth = [];
for (const t of THEMES) {
  const res = wind('index_data', 'get_index_price_indicators', { windcode: t.indexCode, indexes: '上涨家数,下跌家数,平盘家数' });
  const txt = res.content[0].text;
  const d = JSON.parse(txt).data;
  const row = d.rows[0]; // [up, down, flat, code]
  const up = parseInt(row[0], 10), down = parseInt(row[1], 10), flat = parseInt(row[2], 10);
  const total = up + down + flat;
  const upRatio = total > 0 ? up / total : null;
  breadth.push({ name: t.name, indexCode: t.indexCode, upCount: up, downCount: down, flatCount: flat, totalCount: total, upRatio });
  console.log(`  [${t.name}] ${t.indexCode} 涨${up}/跌${down}/平${flat} 共${total} upRatio=${upRatio == null ? 'null' : upRatio.toFixed(3)}`);
}

console.log('\n=== 取全市场融资余额 (Wind EDB) ===');
const mres = wind('economic_data', 'get_economic_data', { metricIdsStr: '沪深两市融资余额', beginDate: '20260701', endDate: '20260706', freq: '工作日' });
const mtxt = mres.content[0].text;
const md = JSON.parse(mtxt).data;
// 找沪市融资余额 M0061606 / 深市融资余额 M0061610，取 date 中 20260706 的值
const sh = md.indicatorInfo.find(x => x.code === 'M0061606'); // 沪市:融资余额
const sz = md.indicatorInfo.find(x => x.code === 'M0061610'); // 深市:融资余额
const di = md.date.indexOf('20260706');
const diPrev = md.date.indexOf('20260703');
const shVal = sh.data[di];      // 万元
const szVal = sz.data[di];
const shPrev = sh.data[diPrev];
const szPrev = sz.data[diPrev];
const finBalWan = shVal + szVal;          // 万元
const finBalPrevWan = shPrev + szPrev;
const finBalYi = finBalWan / 1e4;         // 亿
const finBalTrillion = finBalYi / 1e4;    // 万亿
const chgYi = (finBalWan - finBalPrevWan) / 1e4; // 亿
console.log(`  沪融资07-06=${shVal}万 深融资07-06=${szVal}万 合计=${finBalWan}万=${finBalYi.toFixed(2)}亿=${finBalTrillion.toFixed(4)}万亿`);
console.log(`  较前一日(07-03)变化=${chgYi.toFixed(2)}亿`);

const out = { breadth, margin: { finBalWan, finBalYi, finBalTrillion, chgYi, chgTrillion: chgYi / 1e4, date: '20260706' } };
fs.writeFileSync(BUILD + '/cache/breadth_margin_wind_0706.json', JSON.stringify(out, null, 2));
console.log('\n已存 cache/breadth_margin_wind_0706.json');
