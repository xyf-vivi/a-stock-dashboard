// 用 Wind 取 10 主题的最新成分股涨跌家数（07-09 取的最新值）
// index_data.get_index_price_indicators 不接受 date，只能拿最新
const { execFileSync } = require('child_process');
const fs = require('fs');
const SKILL = 'C:/Users/xyf31/.workbuddy/skills/wind-mcp-skill';
const BUILD = __dirname;

function wind(server, tool, params) {
  const ps = JSON.stringify(params);
  const out = execFileSync(process.execPath, ['scripts/cli.mjs', 'call', server, tool, ps], { cwd: SKILL, encoding: 'utf8', maxBuffer: 1024 * 1024 * 16 });
  const idx = out.indexOf('{');
  if (idx < 0) throw new Error('Wind 无 JSON 返回: ' + out.slice(0, 200));
  return JSON.parse(out.slice(idx));
}

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

console.log('=== 取 10 主题最新涨跌家数 (Wind) ===');
const breadth = [];
for (const t of THEMES) {
  try {
    const res = wind('index_data', 'get_index_price_indicators', { windcode: t.indexCode, indexes: '上涨家数,下跌家数,平盘家数' });
    const txt = res.content[0].text;
    const d = JSON.parse(txt).data;
    const row = d.rows[0];
    const up = parseInt(row[0], 10), down = parseInt(row[1], 10), flat = parseInt(row[2], 10);
    const total = up + down + flat;
    const upRatio = total > 0 ? up / total : null;
    breadth.push({ name: t.name, indexCode: t.indexCode, upCount: up, downCount: down, flatCount: flat, totalCount: total, upRatio });
    console.log(`  [${t.name}] ${t.indexCode} 涨${up}/跌${down}/平${flat} 共${total} upRatio=${upRatio == null ? 'null' : upRatio.toFixed(3)}`);
  } catch (e) {
    console.log(`  [${t.name}] FAIL: ${e.message.slice(0,200)}`);
    breadth.push({ name: t.name, indexCode: t.indexCode, err: e.message.slice(0,200) });
  }
}

const out = { breadth, fetchedAt: new Date().toISOString(), label: '2026-07-09 (Wind latest as of fetch)' };
fs.writeFileSync(BUILD + '/cache/breadth_wind_0709.json', JSON.stringify(out, null, 2));
console.log('\n已存 cache/breadth_wind_0709.json');