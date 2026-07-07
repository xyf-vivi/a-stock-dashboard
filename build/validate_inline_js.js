// 抽取 HTML 中所有内联 <script>（不含 src）并做语法编译校验（vm.Script 仅编译不执行）
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const HTML = path.join(__dirname, 'output', 'fused_dashboard_v2.html');
const html = fs.readFileSync(HTML, 'utf8');

const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
let m, idx = 0, errors = 0;
while ((m = re.exec(html)) !== null) {
  const attrs = m[1] || '';
  const code = m[2] || '';
  if (/\bsrc\s*=/.test(attrs)) { idx++; continue; } // 跳过外链
  idx++;
  if (code.trim().length === 0) continue;
  try {
    new vm.Script(code, { filename: 'inline-script-' + idx + '.js' });
    console.log('script#' + idx + ' OK  (' + code.length + ' chars)');
  } catch (e) {
    errors++;
    console.error('script#' + idx + ' SYNTAX ERROR: ' + e.message);
    // 打印出错位置附近
    const lines = code.split('\n');
    const stackLine = (e.stack || '').match(/inline-script-\d+\.js:(\d+)/);
    if (stackLine) {
      const ln = parseInt(stackLine[1], 10);
      for (let i = Math.max(0, ln - 3); i < Math.min(lines.length, ln + 2); i++) {
        console.error('  ' + (i + 1) + ': ' + lines[i]);
      }
    }
  }
}
console.log(errors === 0 ? 'ALL INLINE SCRIPTS PARSE OK' : ('FOUND ' + errors + ' SYNTAX ERRORS'));
process.exit(errors === 0 ? 0 : 1);
