// Fetch 07-09 kline for 32 codes (6 指数 + 主题 ETF) via westock kline
// 输出 cache/kline_0709.json: { [code]: { nodes: [{date, last, ...}, ...] } }
const fs = require('fs');
const { execFileSync } = require('child_process');
const NODE = process.execPath;
const SCRIPT = 'D:/Programs/WorkBuddy/resources/app.asar.unpacked/resources/builtin-skills/westock-data/scripts/index.js';

const map = JSON.parse(fs.readFileSync('build_kline_codes.json', 'utf8'));
const result = {};
let ok = 0, fail = 0;

for (let i = 0; i < map.codes.length; i++) {
  const orig = map.codes[i];
  const ws = map.ws[i];
  try {
    const out = execFileSync(NODE, [SCRIPT, 'kline', ws, '--period', 'day', '--limit', '25'], { encoding: 'utf8', timeout: 20000, maxBuffer: 5 * 1024 * 1024 });
    // 输出格式："| date | open | high | low | close | volume | ..." 行
    const lines = out.split('\n').filter(l => l.startsWith('| ' + ws) || l.startsWith('| 20'));
    if (lines.length) {
      const nodes = lines.map(line => {
        const cells = line.split('|').map(c => c.trim()).filter(c => c);
        return { date: cells[0], last: parseFloat(cells[4]) };
      });
      result[orig] = { ws, nodes };
      ok++;
    } else {
      fail++;
    }
  } catch (e) { fail++; }
  if ((ok + fail) % 8 === 0) console.log('progress', ok + fail, '/', map.codes.length);
}

fs.writeFileSync('cache/kline_0709.json', JSON.stringify(result, null, 1));
console.log('DONE: ok=' + ok + ' fail=' + fail + ' → cache/kline_0709.json');

// 抽查
['000016.SH', '000300.SH', '000688.SH', '512480.SH', '518880.SH'].forEach(c => {
  const k = result[c];
  if (k && k.nodes.length) {
    const last3 = k.nodes.slice(0, 3);
    console.log(c, 'first3:', last3.map(n => n.date + '=' + n.last).join(' | '));
  } else {
    console.log(c, 'MISS');
  }
});